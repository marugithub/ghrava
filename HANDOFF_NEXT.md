# Ghrava — Next Session Handoff
**Generated:** v202604.005

---

## Bug fixes in this deploy

**nav.js — applyCollapsed order fixed**
- `applyCollapsed(nav)` was called before `document.body.insertBefore(nav, ...)` → body.classList was null
- Fixed: insertBefore runs first, then applyCollapsed

**property.html — missing lt-messages.js**
- `errorState` and `emptyState` are defined in lt-messages.js which was not loaded on property.html
- Fixed: added `<script src="/js/lt-messages.js"></script>` after lt-refs.js

---

## Features completed this session

**C3 ✅ Books ISBN — publisher/year/language/pages**
- Open Library + Google Books lookups now capture: publisher, publish_year, language, pages
- Confirm panel shows new fields (publisher, year, pages)
- Form has Publisher + Year fields; save wired to books routes
- Migration 075: `books.publisher`, `books.publish_year`, `books.language`

**C4 ✅ Inventory size column**
- UPC `size` (e.g. "12 oz") now saved to `items.size` instead of dumped into notes
- Migration 074: `items.size`
- `applyParsedFields()` updated; inventory INSERT updated

**C5 ✅ Export: 7 missing tables added**
- Added: Property Maintenance, Kid Activities, Kid Notes, EOB Statements, EOB Claims, HSA Reimbursements, Import Batches
- Documents export now includes `family_member` column

**C7 ✅ account_snapshots → net worth trend**
- `/finance/reports/net-worth-trend` now returns `investment_trend` array from `account_snapshots`
- Reports → Net Worth tab shows Investment Account History chart (auto from imports)

**B10 ✅ Property + Inventory family member linking**
- property/routes.js: POST/PUT for properties now calls `saveFamilyMembers`, GET returns `withFamilyMembers`
- inventory/routes.js: item create/update now calls `saveFamilyMembers`
- People report backend can now include properties and inventory items (UI wiring next)

**S6 ✅ Contact form accepts presetType + presetName**
- `GH_REFS.openContactDrawer({ type, name, onSave })` — name param prepopulates contact name field
- lt-refs.js passes `&name=` to iframe URL
- settings.html reads `?name=` param and fills `ct_name` on load

---

## What's still open (from fix list)

### High priority
- **People report UI (B10 follow-up)** — add property/inventory sections to Reports → People tab backend route
- **Medical form wiring (B9 follow-up)** — medical.html patient selects currently store name string; need to resolve to `family_member_id` via namematch on save
- **Todos export (A2)** — was blocked on migration 043; now unblocked, verify it works

### Group B remaining
- **B2 follow-up** — wire Todos page to push completions to Google Tasks (`POST /sync/tasks/push/:id`)
- **B12/B13/B14 form wiring** — migrations done, forms need GH_REFS pickers replacing text inputs (career.html, kids.html, property.html)
- **B16 follow-up** — review category shown in Data Quality panel (already stores it, UI doesn't show it yet)

### Group C remaining
- **C8** — `/import/spending` wired to Reports spending tab toggle
- **C9** — `hsa_payments.reimbursement_id` (migration 072 not yet written)
- **C10** — `annual_checklist_items` decision (I1 still open)
- **C11** — Google contacts org/address captured but not in form display
- **C12** — Custom fields hollow (low priority)

### Group D
- Triggered automatically when touching HTML files

---

## Migrations applied this session (on next restart)
063, 064, 065, 066, 067, 068, 069, 070, 071, 073, 074, 075, 077

## WIRING RULES (unchanged)
1. `window.api(method, path)` prepends `/api/v1`
2. Never mix `finance_accounts` (banking) and `financial_accounts` (investment)
3. No `ON DELETE CASCADE`
4. No WAL journal mode
5. Convert to `GH_MODAL` when touching any HTML file
6. Zip from inside `ghrava/` directory (no `ghrava/` prefix in zip paths)
