# START HERE — Ghrava chat onboarding

You are Claude, picking up Al's Ghrava project. This is the only required
reading. Everything else (STATE.md, HANDOFF.md, BACKLOG.md, SCHEMA.md,
LOCKED.md) is reference material — grep on demand, don't pre-read.

---

## Your first action — non-negotiable

**Run `bash bootstrap.sh` and paste its output verbatim in your first reply.**

Before that output is pasted, you may not:
- Ask Al any clarifying questions
- Write any code
- Make any claim about state, version, or what needs doing
- Use memory of prior conversations as a substitute

You may not fabricate the bootstrap output. If you can't run the script
(no shell access, container not started, gates.sh missing), say so plainly
and stop. Al will fix it.

After pasting bootstrap output, your second reply asks Al:
> What would you like me to build?

That's it. No recap, no suggestions, no "I notice the backlog has…"
unless asked.

---

## How memory and the zip relate

The zip is **prod-truth** as of the day Al shared it. Memory may contain
older snapshots, deferred ideas, or notes from previous chats. **When
they disagree, the zip wins.** SCHEMA.md in the zip was generated from
the live database — that's the actual column names, not what memory
remembers.

Use memory freely for context (what Al likes, what Ghrava is, terminology).
Verify against the zip before writing code or making factual claims.

---

## The 10 locked rules

| # | Rule | Enforced by |
|---|---|---|
| 0 | Run `bootstrap.sh` first, paste output | Al checks |
| 1 | Only required reading is this file | self |
| 2 | grep STATE/HANDOFF/BACKLOG/SCHEMA/LOCKED on demand | self |
| 3 | "Done" = `bash gates.sh` shows 8 passed, 0 failed, output pasted | `gates.sh` |
| 4 | Visual designs ONLY in `_templates.html` + row in `LOCKED.md` | `check-locked.sh`, `check-no-design-prose.sh` |
| 5 | SQL: read SCHEMA.md → write `// schema: …` comment → validate | `check-schema.sh` |
| 6 | Shared tables (`family_members`, `contacts`, `record_links`, `attachments`) are universal | `check-shared-tables.sh` |
| 7 | No packaging without Al saying "package" | Al |
| 8 | No "saved/added/updated" claim without `view` of the changed lines in same turn | self |
| 9 | Build mode: 1-line confirm, blocking Qs only, build, no recap | Al checks |

If you find yourself reasoning around a rule, you're violating it. Stop and ask.

---

## Build mode (default)

- Confirm decisions in **one line**.
- Ask blocking questions only.
- Build.
- Run `bash gates.sh`. Paste output. That's "done".
- No explanations, no recaps, no test-plan narration unless Al asks.

Examples of build-mode replies:

> "Bundling fix into hotfix v.170.1. Confirmed prod has `row_count` not `rows_total`. Building."

Not:

> "Great question! Let me think through this. We could either A) revert the column rename or B) add a migration. Let me list the trade-offs..."

---

## Workflow for SQL changes (because this category broke us)

1. `view SCHEMA.md` — find the table you're touching. SCHEMA.md is prod-truth.
2. Write the SQL with a comment above it:
   ```js
   // schema: hsa_payments.{date, you_paid, status}
   db.prepare("INSERT INTO hsa_payments (date, you_paid, status) VALUES (?,?,?)")
   ```
   The comment names the columns you're using. If you can't write the
   comment without checking SCHEMA.md again, you don't actually know
   the schema. Go back to step 1.
3. `bash gates.sh schema` — validator parses every prepared statement
   against prod-truth SCHEMA.md. Zero failures = safe to deploy.

The 28 schema bugs we fixed in v.170 all came from skipping step 1 or 2.
Don't skip.

---

## Workflow for visual designs

Tile, card, badge, pill, chart, modal, page layout — all "visual."

1. Find the design in `app/public/_templates.html`. Anchor IDs match
   rows in `LOCKED.md`. The anchor IS the design.
2. Build code that renders **byte-identical** to the template HTML.
3. Don't describe the design in prose anywhere else. Don't bikeshed it.
4. If a new visual is needed, lock it FIRST: add markup to
   `_templates.html` with a new `id="…"`, add a row to `LOCKED.md`,
   THEN write the rendering code.

The `check-no-design-prose.sh` gate flags STATE/HANDOFF/BACKLOG entries
that describe how a tile "should look" — those belong in the template,
not in prose.

---

## What "done" looks like

```
$ bash gates.sh
  === Ghrava gates ===

  ✓  syntax          pass
  ✓  schema          pass
  ✓  locked          pass
  ✓  lens            pass
  ✓  commands        pass
  ✓  prose           pass
  ✓  shared          pass
  ✓  smoke           pass

  ✓ 8 gates passed
```

Pasted output of that exact form is the only thing that closes a drop.
Without it, the work is "claimed done", not done.

---

## Packaging

Only after Al says "package" — never volunteered:

1. Confirm gates green (paste output).
2. Build `Ghrava_DEPLOY.zip` with top-level layout (no `ghrava/` wrapper).
3. Include `app/version.txt` (bumped), `app/SCHEMA.md` (regen if schema changed), any migration files, any touched JS/HTML.
4. `present_files` the zip. Stop.

Al handles deploy via `ghrava_deploy.ps1` → `docker restart ghrava`.

---

## When in doubt

- Reach for `grep`, not memory.
- Reach for `bash gates.sh`, not a claim of "I checked".
- Reach for `view`, not "I added X" without showing it.
- Ask one blocking question, not a list of three options.
- If you'd be embarrassed by Al re-reading this chat in 6 months, you're drifting.

That's the contract. Welcome aboard.
