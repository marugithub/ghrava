---
name: ghrava-schema-safety
description: Use this skill whenever working on Ghrava. Triggers on "package", "deploy", "ship", "build zip", "Ghrava_DEPLOY", "fix bug", "schema", "SQL", "migration", "db.prepare", "route", "feature", any file under app/features/ or app/shared/ or app/db/, any reference to lifetracker.db or better-sqlite3, any mention of validator or SCHEMA.md. Also use when the user reports a container crash, "no such column", "no such table", SqliteError, or any startup failure. Mandatory before producing any Ghrava deploy zip: run gen-schema-doc.js to refresh SCHEMA.md, run validate-schema.js --strict against the changed files, and use package.sh as the only sanctioned path to building Ghrava_DEPLOY.zip. The skill enforces the 4-step gate that prevents shipping SQL referencing columns/tables that don't exist on prod.
---

# Ghrava Schema Safety

You're working on **Ghrava**, a self-hosted household app (Node.js/Express + SQLite + Docker). The codebase has 130+ migrations and the live schema has drifted significantly from what tables/columns look like by name. Pattern matching from memory **does not work** — it has caused 5+ container crashes in recent drops by referencing columns like `accounts.account_type` when the actual column is `accounts.type`, or `contacts.type` when the actual column is `contacts.contact_type`, or `family_members.is_active` when that column does not exist at all.

This skill exists because writing SQL from memory has been the dominant failure mode. It enforces a workflow where you verify schema against the actual migration files before writing any `db.prepare()` call.

## The four-step gate (MANDATORY before any zip)

You **must** do these in order, every time, no exceptions. Show each step in your visible chat output so the user can see you doing it:

### Step 1 — Generate fresh schema doc

The skill provides two equivalent scripts. Use whichever fits your environment:

```bash
# Inside the Docker container (Node + better-sqlite3 already installed):
docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.js

# Or anywhere with Python 3 (uses migration files, no DB needed):
python3 .claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py
```

Both write `SCHEMA.md` at the repo root listing every table with its current columns.

The Node version reads the **live prod DB** — most accurate, requires the container to be running.
The Python version **replays migrations** — works anywhere with Python 3, even without a running DB.

Run this **before** writing any SQL. The output is the ground truth — not your memory, not what feels right, not what a sibling file does.

### Step 2 — Read SCHEMA.md for the tables you'll touch

Open `SCHEMA.md`. For every table your code will read from or write to, copy the column list into your working notes. Reference *that list* when writing SQL, not your assumptions. If the table you want isn't in `SCHEMA.md`, it doesn't exist on prod — stop and ask.

### Step 3 — Write the code

Now you can write the route/linker/migration. For every `db.prepare(\`...\`)` you write, add a comment line above it like:

```js
// schema: accounts.type (mig 130), accounts.alias (mig 130)
const stmt = db.prepare(`SELECT type, alias FROM accounts WHERE id = ?`);
```

This forces you to have actually looked up the migration. If you can't fill in the comment, you didn't look — go back to Step 2.

### Step 4 — Validate before packaging

```bash
# Inside the container (validates against the LIVE prod schema):
docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/validate-schema.js --strict

# Or anywhere with Python 3 (validates against replayed migrations):
python3 .claude/skills/ghrava-schema-safety/scripts/validate-schema.py --strict
```

The Node version is more accurate because it uses the actual prod DB. The Python version is a fallback when no container is available.

Both build a prod-equivalent schema, walk every `db.prepare(\`SQL\`)` in `app/`, and run `EXPLAIN` against it. Real schema errors (missing column, missing table) cause a non-zero exit code with `--strict`.

### Step 5 — Downstream wiring audit (REQUIRED when migration moves/renames data)

When a migration changes column/table structure OR moves data between tables (rename, merge, deprecate), validating SQL parsing is NOT enough. You must also verify every downstream surface still works:

```bash
# Find every reader of the affected table/column:
grep -rn "<old_table_name>" app/features/ app/shared/ app/public/
grep -rn "<old_column_name>" app/features/ app/shared/ app/public/
```

For each match:
- **Route/feature file** — update SQL to use new table/column
- **Tile / card** — verify it still queries correct source and renders the data
- **Report** — verify the new column path produces the same numbers
- **Settings panel** — verify it shows the data (this is the obvious one)
- **Frontend HTML** — if API contract changed, update fetch + render

After deploy, **open each affected page in the browser** and confirm numbers/values render. Don't claim a drop is done until this is done.

Past failure (v.168): HSA `plan_info` data merged from `hsa_plan_info` → `fsa_plan_info`. New Settings panel worked, but the existing `finance.html` HSA tile rendered nothing because nobody verified it post-migration. The user had to flag it.

**If this fails, you do NOT package.** Fix the bug. Re-run. Only when it returns clean can you proceed to `present_files` on the zip.

### Packaging gate

The script `.claude/skills/ghrava-schema-safety/scripts/package.sh` wraps the zip build. It refuses to produce a zip if:
- `SCHEMA.md` is more than 5 minutes old (forces a fresh Step 1)
- `validate-schema.py` fails (catches Step 4 violations)
- The packaging command was invoked without going through the wrapper

Use it instead of manual `zip` commands. It's the structural gate that survives across chats and AI sessions.

## When you trigger the skill

The moment you read this skill, before writing any other response:

1. Acknowledge the skill is active.
2. Run Step 1 (gen-schema-doc) and Step 4 (validate) once as a baseline against the current sandbox so you know the starting state.
3. Only then read STATE.md / HANDOFF.md / BACKLOG.md and start the task.

If during the task you find that pre-existing code has schema bugs the validator flags, log them to BACKLOG.md but don't fix in the same drop unless the task explicitly asked. New code must be clean; old code is its own problem.

## What to do when validation fails after your changes

1. Read the error — it will name the file, line, SQL, and the missing column/table.
2. Open `SCHEMA.md` for the named table. Find the canonical column name.
3. Fix the SQL.
4. Re-run validate-schema.py.
5. Repeat until clean.

Do **not** patch around the validator (skip the check, suppress the error, etc.). The validator catches real bugs. Patching around it crashes the container at prod startup, which is exactly the failure mode this skill exists to prevent.

## Forbidden patterns

These have all caused prod crashes — never do them:

- Writing SQL from memory of "what the column was probably called"
- Copy-pasting SQL from a sibling file without checking that it still matches the current schema
- Assuming a `family_member_id` column exists on every table (only some tables have it)
- Assuming column names match between similar tables (`hsa_payments.provider` is NOT `eob_claims.provider_name`)
- Building a feature that looks like an existing concept ("plan info", "attachments", "contacts") without first grepping for existing tables with similar names — two parallel tables is a worse bug than missing the feature

## Why this skill is non-negotiable

Past chats had docs saying "read this before writing SQL." They didn't work because reading is unreliable — long context window + pattern-matching pull = "I read it but I didn't internalize it." This skill replaces "read this" with "run this script." Scripts are deterministic. The gate either passes or fails. The AI's discipline isn't in the loop.
