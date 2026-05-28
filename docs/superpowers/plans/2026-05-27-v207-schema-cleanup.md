# v.207 — Schema cleanup: drop dead tables + columns + fix JOIN bug

**Goal:** One migration that removes everything confirmed dead — 27 tables (20 Excel-import legacy + 7 mig-126 `_legacy_*` preserves) + the re-verified dead columns — plus fix the `pending/routes.js` silent JOIN bug. Regenerate prod-grounded SCHEMA.md after. Single deploy.

**Why now:** v.206 made SCHEMA.md prod-canonical, so candidates can be verified against truth. Al signed off on one-migration scope.

**Architecture:** One new migration file (next number after the highest existing). Uses `DROP TABLE IF EXISTS` and `ALTER TABLE <t> DROP COLUMN <c>` (SQLite 3.35+, bundled in better-sqlite3 ^9.4.3). Plus a one-line fix in `pending/routes.js`. Then `gen-schema-doc.py --prod` regen.

## CRITICAL safety rules (validate-twice + prod-is-truth)

1. **Every drop verified against PROD, not SCHEMA.md alone.** Even though v.206 made SCHEMA.md prod-true, the migration itself must use `DROP ... IF EXISTS` so a candidate that's already gone doesn't error.
2. **Re-verify every column candidate** (Task 2) — the original ~38-column list was produced against the WRONG (migration-replay) source. Confirm each: (a) exists on prod per the v.206 SCHEMA.md, (b) zero code refs via SQL-context grep.
3. **Dependency order:** before dropping a table/column, check for dependent indexes or views. SQLite auto-drops indexes when a table is dropped, but a VIEW referencing a dropped table/column will break silently. Check `sqlite_master WHERE type='view'` for references first.
4. **The migration must be idempotent + defensive** — wrap each drop in the existing migration pattern (most Ghrava migrations use `db.exec` in a transaction with try/catch per-statement). A failed drop must not abort the whole migration.
5. **DB auto-backs-up on container restart** (`[startup] auto-backup → /app/backups/auto_*.db` seen in every deploy log). That's the rollback path if a drop turns out wrong.

## The 27 tables to drop (confirmed in v.206 audit)

**20 mystery tables** (Excel-import legacy; 0 rows, 0 SQL refs on prod — re-confirm existence in migration via `DROP TABLE IF EXISTS`):
```
beneficiaries, ce_hours, certifications, credit_cards, doctor_visit_notes,
estate_documents, federal_benefits, fers_inputs, gift_log, important_dates,
insurance, loans_debt, medical_conditions, medications, qnap_share_paths,
retirement_contributions, stock_price_history, stock_transactions,
tax_documents, tsp_allocation
```

**7 `_legacy_*` preserves** (Al approved; mig 126 unification stable):
```
_legacy_finance_accounts, _legacy_finance_transactions,
_legacy_financial_accounts, _legacy_holdings, _legacy_import_batches,
_legacy_imported_transactions, _legacy_fin_import_batches
```

**IMPORTANT — `certifications` drop ordering:** the `pending/routes.js:357 JOIN certifications` bug fix (Task 3) MUST land in the same drop, because dropping `certifications` while that JOIN still references it would make the cert-renewal query throw "no such table". Fix the JOIN to point at `career_certifications` FIRST (in code), THEN the migration drops the empty `certifications` table.

## Dead-column candidates (RE-VERIFY in Task 2 before including)

From the v.206 audit, on LIVE tables (NOT the dropped tables above). These are candidates — Task 2 confirms each against prod + grep before the migration includes them:

- `finance_accounts`: contact_id, institution_contact_id, rewards_program
- `financial_accounts`: rewards_program, account_number, institution_contact_id
- `imported_transactions`: pending_or_posted, normalized_description, fx_currency, fx_amount, fx_rate, raw_payload, raw_headers, source_filename, source_format
- `holdings`: raw_payload, source_filename, source_format, last_dividend_date
- `fsa_payments`: raw_payload, source_filename, source_format
- `hsa_payments`: raw_payload, source_filename, source_format
- `med_eob_claims`: cpt_modifiers, denial_reason_codes, prior_auth_ref, appeal_deadline
- `med_eob_statements`: raw_payload, source_format
- `med_eob_balances`: raw_payload
- `med_eob_services`: cpt_modifiers
- `med_visit_notes`: physician_id, review_category
- `med_conditions`: physician
- `med_medications`: physician, route, ndc, mail_order, quantity_total_prescribed, rx_date
- `items`: manufacturer_country, manufacturer_support_phone, manufacturer_support_url
- `locations`: address_street, address_city, address_state, address_zip
- `properties`: mortgage_lender_contact_id
- `vehicles`: lender_contact_id
- `hsa_otc`: store_contact_id
- `calendar_events`: color_id, organizer_email
- `todos`: review_category
- `subscriptions`: billing_day, auto_renews, cancel_url, vendor_id, last_reviewed, card_id
- `career_certifications`: renewal_fee, cert_number

**DUPE/TBD columns explicitly EXCLUDED from this drop** (need their own decision): `kids.photo_url`, `documents.tags`, `documents.file_path`, the insurance text fields on properties/vehicles, the `med_*` import-path columns (icd10_code, source_system, etc.), `med_diagnostics`/`med_vitals_readings`/`task_templates` tables (partially-built features). These stay until a per-row review.

---

### Task 1: Plan commit

`git add docs/superpowers/plans/2026-05-27-v207-schema-cleanup.md && git commit -m "plan: v.207 schema cleanup (drop 27 tables + dead columns + JOIN fix)"`

### Task 2: Re-verify all candidates against prod-grounded SCHEMA.md → confirmed-drop list

Dispatch a focused re-verification (read-only). For EACH column candidate above:
1. Confirm it exists on prod — grep the v.206 `SCHEMA.md` (now prod-canonical) for `### \`<table>\`` then the column row. If the column isn't in prod SCHEMA.md, SKIP it (already gone).
2. Confirm zero code refs — SQL-context grep: `grep -rEi "(SELECT|WHERE|SET|INSERT|,|\\.)<col>" app/features app/public app/shared tests` for the column, scoped to the table's queries. A column name that's a common word (e.g. `route`, `physician`) needs careful context-checking — confirm the reference is actually to THIS table's column, not a same-named column elsewhere.
3. Output a confirmed-drop list: `table.column` rows that pass BOTH checks. Anything ambiguous → move to EXCLUDED with a reason.

Write the confirmed list to `docs/superpowers/plans/v207-confirmed-drops.md` and commit it. This is the migration's authoritative input.

**Commit:** `v.207 task 2: re-verified confirmed-drop list (prod-grounded)`

### Task 3: Fix pending/routes.js JOIN bug

`app/features/pending/routes.js:357` — change `JOIN certifications c` to `JOIN career_certifications c`. Verify the columns the query uses (`c.cert_name`, `c.renewal_fee`, `c.id`) all exist on `career_certifications` per SCHEMA.md (they do). This must land BEFORE/WITH the migration that drops `certifications`.

Add a `// schema:` comment naming the columns per Ghrava convention.

**Commit:** `v.207 task 3: fix pending cert-renewal JOIN (certifications → career_certifications)`

### Task 4: Write the drop migration

Create the next migration file in `app/db/migrations/` (check the highest existing number first — likely `148_*` or higher). Name it like `148_v207_schema_cleanup.js`.

Structure (follow the existing migration file pattern — look at a recent one like `147_*` for the exact `module.exports` / `db.exec` shape):

```js
// 148_v207_schema_cleanup.js
// Drops confirmed-dead tables + columns identified in the v.206 prod-grounded
// schema audit. All tables verified 0-rows / 0-refs; columns re-verified in
// v.207 task 2 (see docs/superpowers/plans/v207-confirmed-drops.md).
// schema: drops only — no new columns referenced.
module.exports = {
  version: 148,
  name: 'v207_schema_cleanup',
  up(db) {
    const dropTable = (t) => { try { db.exec(`DROP TABLE IF EXISTS "${t}"`); } catch (e) { console.warn(`[mig148] drop table ${t}:`, e.message); } };
    const dropCol = (t, c) => { try { db.exec(`ALTER TABLE "${t}" DROP COLUMN "${c}"`); } catch (e) { console.warn(`[mig148] drop col ${t}.${c}:`, e.message); } };

    // 27 dead tables
    ['beneficiaries','ce_hours','certifications','credit_cards', /* ...all 20... */
     '_legacy_finance_accounts', /* ...all 7... */].forEach(dropTable);

    // Confirmed dead columns (from task 2)
    dropCol('finance_accounts','contact_id');
    // ... one line per confirmed column ...
  }
};
```

(Match the ACTUAL migration interface — some Ghrava migrations are `.sql` files, some `.js` with a specific export shape. Read `app/db/migrations/147_*` to confirm before writing.)

**Pre-flight check inside the migration design:** before dropping any table, query `sqlite_master WHERE type='view'` and confirm no VIEW references the dropped tables/columns. If a view does (e.g. `finance_accounts` is a compat VIEW per earlier notes — CAUTION: `finance_accounts` is on the column-drop list, so confirm whether it's a table or a view on prod before ALTERing it — you can't ALTER a view). **This is a real risk: `finance_accounts` may be a VIEW, not a table, on prod.** Task 2 must classify it.

**Commit:** `v.207 task 4: migration 148 — drop dead tables + columns`

### Task 5: Deploy + regenerate SCHEMA.md

1. Push, build zip (include the new migration + pending/routes.js + version.txt + docs), deploy via `-SkipGit`.
2. The migration auto-applies on container restart. Watch the deploy log for `[mig148]` warnings — any warning means a drop was skipped (already gone OR blocked by a dependency). Investigate warnings.
3. After deploy, run `gen-schema-doc.py --prod` to regenerate SCHEMA.md — drift count should drop substantially (the 46 prod-only tables shrink by 27; mig-only count may change).
4. Commit the regenerated SCHEMA.md.

Per the every-other rule: v.206 ran full Playwright. **v.207 runs smoke-only via `-SkipE2E`.** BUT — this is a schema-changing migration. Strongly consider running full E2E anyway as a safety check despite the rotation, since dropping columns could surface a query that silently depended on one. Recommend: **run full E2E for v.207 regardless of rotation** (override the rotation for schema-change safety).

### Task 6: Docs + version bump

- `app/version.txt` → `202605.207`
- STATE.md v.207 section: list what dropped (final counts from task 2), the JOIN fix, the post-drop drift count.
- BACKLOG.md: mark the v.207 QUEUED items DONE; note v.208 (dead-column pass) is now FOLDED IN (no separate v.208 needed) OR list remaining DUPE/TBD columns for a future per-row review.

**Commit:** `v.207 task 6: docs + version bump (schema cleanup shipped)`

## Verification before deploy

1. Migration file exists + follows the existing migration interface
2. `pending/routes.js` JOIN fixed
3. The `certifications` table drop and the JOIN fix are BOTH in the drop (ordering safe)
4. `finance_accounts` view-vs-table status confirmed before any ALTER on it
5. No DUPE/TBD columns snuck into the drop list

## Rollback plan

If a drop breaks something post-deploy: the container auto-backed-up the DB to `/app/backups/auto_<timestamp>.db` on restart. Restore = SSH to NAS, `docker exec` copy that backup over `lifetracker.db`, restart. Document the exact backup filename from the deploy log before declaring done.
