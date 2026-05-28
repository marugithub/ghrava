# v.206 — Schema tooling: prod-grounded SCHEMA.md + drift detection

**Goal:** Make `SCHEMA.md` reflect what's actually on prod (165 tables), not what migrations describe (124 tables). Add a DRIFT section that flags any mismatch. After this drop, future audits read SCHEMA.md cheaply and trustworthily — no more bias from migration-replay output.

**Scope:** Tooling fix only. **Zero DROPS this drop.** Per Al's safest-path sign-off, defer all actual cleanups (20 mystery tables + 7 legacy preserves + ~38 dead columns) until v.207+ once the prod-grounded SCHEMA.md is the trusted source.

**Architecture:** Modify `app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py` to add a `--prod` mode that queries the running container via SSH→docker exec→node. Keep the existing migration-replay path. Output SCHEMA.md with prod-true tables/columns as canonical + DRIFT section listing mismatches.

**No app code changes, no schema migrations, no backend route additions.** Smoke + full Playwright will pass unchanged — nothing on the running surface is touched.

## Cycle-time targets

- ≤ 75 min build + ~8 min deploy (full Playwright per every-other rotation)
- 5 tasks. Tool change is mostly self-contained Python; SCHEMA.md regen is one command.
- Single combined review per task.

## Prod-query mechanism (LOCKED — pattern proven this session)

```python
def query_prod_schema(host, key, docker, container):
    # Drop a tiny JS script onto Z:\ghrava\app\ (NAS-mounted), exec it via
    # docker, read JSON output, remove the script. This pattern was used
    # manually to produce v206-prod-schema.json — proven to work.
    import subprocess, json, os
    script = '/app/.tmp-schema-dump.js'
    nas_script_path = host_path_for(script)  # via Z: drive mount
    # ... write JS, exec via SSH, parse stdout, cleanup
```

JS script body (the same dump we ran manually — see `docs/superpowers/plans/v206-prod-schema.json` for the exact output shape):

```js
const Database = require('better-sqlite3');
const db = new Database('/app/data/lifetracker.db', { readonly: true });
const tables = db.prepare(`SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`).all();
const out = { table_count: tables.length, tables: [] };
for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all();
  let row_count = null;
  try { row_count = db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get().n; } catch (e) { row_count = '(err)'; }
  out.tables.push({ name: t.name, type: t.type, row_count, columns: cols.map(c => ({ name: c.name, type: c.type, notnull: c.notnull, dflt_value: c.dflt_value, pk: c.pk })) });
}
console.log(JSON.stringify(out, null, 2));
db.close();
```

Defaults for SSH/docker config:
- `--ssh-host` default `192.168.4.62`
- `--ssh-key` default `~/.ssh/ghrava_nas_rsa`
- `--docker-path` default `/share/CACHEDEV4_DATA/.qpkg/container-station/bin/docker`
- `--container` default `ghrava`
- `--nas-app-mount` default `Z:\ghrava\app` (where to drop the tmp script)

Graceful failure: if any of `ssh` / `docker exec` / the JS run fails, log a clear warning and fall back to migration-replay-only mode. The script should still produce a SCHEMA.md, just without the prod-truth column.

## Output format (LOCKED)

```markdown
# SCHEMA.md — Ghrava database reference

> **Auto-generated** by gen-schema-doc.py.
> Last generated: <timestamp>
> Sources: migration replay (145 files in app/db/migrations/) + prod query (192.168.4.62:3001 ghrava container)
> When sources disagree, **prod is canonical**. See DRIFT section below.

## Summary

- **prod tables: 165**
- **migration-replay tables: 124**
- **drift: 51 (46 prod-only, 5 migration-only)**
- **prod columns total: <N>**

## DRIFT — tables exist on prod but NOT in migrations

| Table | Row count | Suspected origin | Suggested action |
|---|---|---|---|
| _account_id_map | 3 | mig 126 migration helper | document; check if still needed |
| _legacy_finance_accounts | 2 | mig 126 unification preserve | drop candidate (see v.207+ plan) |
| ... | ... | ... | ... |

## DRIFT — tables in migrations but NOT on prod

| Migration-replay name | Status on prod | Suspected reason |
|---|---|---|
| annual_checklist | renamed to annual_checklist_items on prod | post-replay rename; replay doesn't pick up |
| holdings_v2 | gone (renamed to holdings already) | mig 126 cleanup completed on prod |
| ... | ... | ... |

## Tables (prod-true)

### `account_snapshots`  [in:both]

_Created in: `032_import_finance.sql`_

| Column | Type | NN | Default | PK | In migrations |
|---|---|---|---|---|---|
| id | INTEGER |  |  | ✓ | ✓ |
| ... | ... | ... | ... | ... | ... |

### `_legacy_finance_transactions`  [in:prod-only]

_Origin: mig 126 unification preserve. No CREATE in any migration._

| Column | Type | NN | Default | PK |
|---|---|---|---|---|
| ... |
```

(Existing format mostly preserved; new annotations: `[in:both | prod-only | migration-only]` per table heading, "In migrations" column showing whether each column was created by a known migration.)

---

### Task 1: Plan commit

`git add docs/superpowers/plans/2026-05-27-v206-schema-tooling-prod-grounded.md && git commit -m "plan: v.206 schema tooling — prod-grounded SCHEMA.md + drift"`

### Task 2: Modify gen-schema-doc.py

**File:** `app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py`

Add:
- CLI arg parsing for `--prod` flag plus the 5 SSH/docker config options listed above
- `query_prod_schema()` function — drops the JS dump script, executes via SSH+docker, parses JSON, cleans up the temp file. Returns the same dict shape as `replay_migrations()` (so downstream code can treat them uniformly).
- `diff_schemas(migration_schema, prod_schema)` — returns `{tables_only_in_prod: [], tables_only_in_migrations: [], columns_in_one_only: [(table, col, source)]}`
- `write_schema_md(migration_schema, prod_schema=None, drift=None)` — when `prod_schema` is provided, use it as canonical source for tables/columns; annotate each with the `[in:both | prod-only | migration-only]` tag; write the DRIFT section at the top. When `prod_schema` is None, fall back to the existing migration-replay output (backward-compatible).

Keep all existing helpers (`strip_sql_comments`, `parse_create_table`, etc.) untouched.

Run logic:
```python
def main():
    args = parse_args()
    mig_schema = replay_migrations()  # existing path
    prod_schema = None
    if args.prod:
        try:
            prod_schema = query_prod_schema(args.ssh_host, args.ssh_key, args.docker_path, args.container, args.nas_app_mount)
            print(f"[prod-query] OK: {prod_schema['table_count']} tables")
        except Exception as e:
            print(f"[prod-query] FAILED, falling back to migration-replay only: {e}", file=sys.stderr)
    drift = diff_schemas(mig_schema, prod_schema) if prod_schema else None
    write_schema_md(mig_schema, prod_schema=prod_schema, drift=drift)
```

**Verify:** `python3 .claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py --help` shows the new flags. `python3 ... --prod` exits 0 (or warns-and-falls-back-cleanly if SSH is offline).

**Commit:** `v.206 task 2: gen-schema-doc.py — add --prod flag + drift detection`

### Task 3: Run new script with --prod, regenerate SCHEMA.md

```bash
cd C:/dev/ghrava
python3 app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py --prod
# Expected: prints "[prod-query] OK: 165 tables" then writes SCHEMA.md at repo root.
```

Sanity-check the regenerated SCHEMA.md:
- Table count in the Summary section reflects prod (165)
- DRIFT section lists the 46 prod-only + 5 migration-only tables
- Per-table annotations include `[in:both | prod-only | migration-only]`

**Commit:** `v.206 task 3: regenerate SCHEMA.md (prod-grounded; 165 tables; 51 drift entries)`

### Task 4: Docs + version bump

- `app/version.txt` → `202605.206`
- Prepend `STATE.md` with the v.206 SHIPPED block. Note: tooling-only drop, zero app code changes, zero schema migrations on prod. SCHEMA.md is now prod-grounded and includes a DRIFT section.
- Update `BACKLOG.md` "NEXT UP" to add the deferred cleanup work:
  - `v.207 candidate: DROP 20 mystery tables (Excel-import legacy, all 0 rows, all 0 SQL refs after fixing pending/routes.js JOIN bug)`
  - `v.207 candidate: DROP 7 _legacy_* tables (Al approved; preserve from mig 126 unification, no rollback needed)`
  - `v.207 candidate: ~38 dead columns from earlier audit — re-verify against new prod-grounded SCHEMA.md`
  - `v.207 candidate: fix pending/routes.js:357 JOIN certifications → JOIN career_certifications (silent bug — cert-renewal detection never fires; will be addressed alongside the certifications table drop)`

**Commit:** `v.206 task 4: docs + version bump + queue v.207 cleanup candidates`

### Task 5: Test gates + deploy

Per the every-other rule: v.205 was smoke-only. **v.206 runs FULL Playwright** + smoke. Expected baseline 117/0 — nothing on the running app surface changed.

Path A: push → `-SkipGit` deploy → NAS reset → DEPLOYED marker. No curl-verify needed since no new endpoints.

## Verification before deploy

1. `cat app/version.txt` → `202605.206`
2. `grep -c "DRIFT" SCHEMA.md` ≥ 2 (DRIFT section heading + table headings)
3. `grep -c "in:prod-only\|in:migration-only\|in:both" SCHEMA.md` ≥ 100 (each table gets one annotation)
4. `python3 app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py --help` shows the new flags
5. Brace + syntax check on the modified Python script

## What v.206 explicitly does NOT do

- Drop any tables (deferred to v.207+)
- Drop any columns (deferred)
- Change any backend routes (the `pending/routes.js` JOIN bug fix is deferred — slated to ship with the `certifications` table drop)
- Add any migrations
- Modify any test specs (no test gate changes needed)

## What v.207 candidate list looks like (for context, not in scope)

After v.206 lands and SCHEMA.md is prod-grounded:

- **v.207 — drop the 27 confirmed-dead tables + fix the pending JOIN bug**
  - 20 mystery tables (Excel-import legacy): `beneficiaries, ce_hours, certifications, credit_cards, doctor_visit_notes, estate_documents, federal_benefits, fers_inputs, gift_log, important_dates, insurance, loans_debt, medical_conditions, medications, qnap_share_paths, retirement_contributions, stock_price_history, stock_transactions, tax_documents, tsp_allocation`
  - 7 legacy preserves: `_legacy_finance_accounts, _legacy_finance_transactions, _legacy_financial_accounts, _legacy_holdings, _legacy_import_batches, _legacy_imported_transactions, _legacy_fin_import_batches`
  - Fix `pending/routes.js:357` JOIN
- **v.208 — drop the ~38 dead columns** (re-validated against prod-grounded SCHEMA.md)
- **v.209+** — depends on what surfaces from the prod-grounded view; may include _account_id_map / _batch_id_map drops, mig-126 cleanup completion, etc.
