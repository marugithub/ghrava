# Ghrava — Next Session Handoff
**Generated:** v202604.003

---

## Changes this session (v202604.002 → 202604.003)

**A8 / B11 ✅ — Vehicle service shop → contact picker**
- `property.html`: `sShop` text input → `GH_REFS.populateContact` (type=Vendor)
- `property/routes.js`: INSERT now stores `contact_id` + denormalised `shop` name
- Migration 064 was already applied

**A10 finish ✅ — Banking import skipped row tracking**
- `finance/routes.js`: skipped rows now written to `fin_import_batches.rows_skipped`
- `flagRecords` required (ready for use when rows need flagging)

**B3 ✅ — Import history merged (banking + investment)**
- `loadImpHistory()` now fetches both `/import/batches` and `/finance/import-batches` in parallel
- Normalises to shared shape, sorted by date descending
- INV / BANK type badge on each row
- `rollbackBatch(id, type, e)` — routes DELETE to correct endpoint by type

**B4 ✅ — Dead csvDrawer removed**
- 264 lines of dead HTML + JS removed from `finance.html`
- Stale import tab banner text fixed ("Transactions tab → ⬆ CSV" → correct instructions)

**B5 ✅ — Transaction account filter includes investment accounts**
- `populateTxAccountFilter()` fetches both banking + investment accounts
- Grouped `<optgroup>` display (Banking / Investment)
- Account values prefixed: `b:123` (banking) or `i:456` (investment)
- `loadTransactions()` parses prefix, passes `account_type` param to unified endpoint
- Unified endpoint updated to accept `account_type` filter

**B6 ✅ — Finance reports include investment transactions**
- `spending-by-category`: UNION `finance_transactions` + `imported_transactions`
- `monthly-totals`: UNION both tables, previous year comparison also updated

**B8 ✅ — Net worth includes investment holdings**
- `/finance/net-worth/current` now queries `holdings.market_value` via `financial_accounts`
- Response adds `investment_total` and `investment_accounts` array
- `net_worth` = banking assets − liabilities + investment total
- Accounts tab shows new "Investments" card (hidden when zero)

---

## What's next

### Group B remaining
- **B2**: Google Calendar → Tasks swap (routes, OAuth scope, settings UI, `google_task_id` migration done)
- **B7**: Budget actuals — include `imported_transactions`
- **B9**: Medical patient fields → `family_member_id` (medications, conditions, visit notes)
- **B10**: Property + Inventory → `record_family_members`
- **B12**: Career company/institution → contact refs
- **B13**: Kids teacher → contact ref
- **B14**: Property lender/insurance → contact refs
- **B15**: HSA OTC `family_member_id`

### Group C
- **C1**: `imported_transactions` symbol/shares/price columns (migration 073)
- **C2**: Holdings UI — 7 missing columns + summary strip upgrade
- **C3**: Books ISBN — publisher/year/language/pages (migration 075)
- **C4**: Items size column (migration 074)
- **C5**: Export — add missing tables (EOB, property_maintenance, kid_activities, etc.)
- **C7**: `account_snapshots` → net worth trend chart

### Group S remaining
- **S6**: Contact form — accept `presetType` + `presetName` from calling module

### Annual checklist (open question I1)
- 35 rows in `annual_checklist_items` — surface in Reports or discard?

---

## CRITICAL WIRING RULES (unchanged)

1. `window.api(method, path)` prepends `/api/v1`. Never pass `/api/v1/...`
2. Two finance account tables — never mix: `finance_accounts` (banking) vs `financial_accounts` (investment)
3. No `ON DELETE CASCADE` — explicit deletes only
4. No WAL journal mode
5. Convert forms to centered `GH_MODAL` when touching any HTML file

---

## Stack / Deploy
- **Version:** v202604.003  
- **Host:** 192.168.4.62:3001, container: `ghrava`
- **Deploy:** `docker restart ghrava` (no package.json changes)
- **Smoke test:** `./smoke-test.sh http://192.168.4.62:3001`

Expected improvements vs baseline:
- PASS: B4 — `/finance/transactions/import-csv` returns 404 ✓ (done in .001)
- PASS: B8 — net worth includes `investment_total` ✓
- PASS: B3 — import history shows both batch types ✓
