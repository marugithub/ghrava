# Ghrava — Project Handoff & System Reference
**Last updated:** v202603.103
**Purpose:** Complete context for continuing development in a new chat session.
Read this file before writing any code.

---

## 1. What Is Ghrava

Self-hosted household management app running as a Docker container on a QNAP NAS.
- **Host:** 192.168.4.62:3001, container name: `ghrava`
- **Stack:** Node.js/Express backend, SQLite via better-sqlite3, vanilla JS frontend
- **NAS path:** `Z:\ghrava` = `/share/Docker/home-core/ghrava`
- **Backups volume:** `Z:\backups\ghrava\` = `/app/backups`
- **Deploy:** `docker restart ghrava` for code changes. `--build` only when `package.json` changes.
- **Deploy scripts (local Windows only, never on NAS):**
  - `ghrava_deploy.ps1` — finds Ghrava_DEPLOY.zip in Downloads, extracts to NAS via robocopy, prompts git push
  - `ghrava_git_push.ps1` — commits and pushes NAS state to GitHub
- **GitHub:** https://github.com/marugithub/ghrava (private)
- **Version:** `app/version.txt` — format YYYMM.NNN, bump every session

---

## 2. Repository Layout

```
ghrava/
├── app/
│   ├── features/          # One folder per module, each has routes.js
│   │   ├── auth/
│   │   ├── backup/
│   │   ├── books/         # ISBN scan + Open Library/Google Books lookup
│   │   ├── career/
│   │   ├── dailylog/
│   │   ├── dashboard/
│   │   ├── documents/
│   │   ├── finance/
│   │   ├── hsa/
│   │   ├── import/
│   │   ├── inventory/     # Most complex — UPC scan, attachments, grid/list view
│   │   ├── kids/          # Driven by family_members (relationship = Son/Daughter/Child/etc)
│   │   ├── medical/
│   │   ├── notifications/
│   │   ├── property/
│   │   ├── resources/
│   │   ├── settings/
│   │   ├── todos/         # Auto-todos + recurring todos
│   │   └── trading/       # Trading terminal data store (trading.json + reports)
│   ├── shared/
│   │   ├── tags.js            # Central tag utility — ALL modules must use this
│   │   ├── familyMembers.js   # Family member junction table utility (same pattern as tags)
│   │   ├── errors.js
│   │   └── needs-review.js
│   ├── db/
│   │   ├── db.js
│   │   └── migrations/    # Sequential SQL, auto-run on container start
│   │       └── 043_todos_recurrence_days.sql  # PENDING — needs docker restart to apply
│   └── public/
│       ├── *.html
│       ├── shared.css         # Global styles including add-modal, scanner, tag input
│       ├── nav.js             # Left nav — supports newTab:true on items
│       └── js/
│           ├── lt-core.js     # GH_TAGS, GH_SELECT, GH_FAMILY, GH_VIEW, GH_INFO
│           ├── lt-messages.js
│           └── lt-shared-data.js
├── HANDOFF.md   (this file)
├── BACKLOG.md
└── UPGRADE_NOTES.md
```

---

## 3. Shared Utilities (lt-core.js)

### GH_TAGS — tag pill input
```js
GH_TAGS.init({ inputId, wrapId, module, getFormTags, addTag, allowCreate })
```
- Autocompletes from existing tags, Enter/comma to add
- `allowCreate: true` enables inline tag creation

### GH_SELECT — dropdown backed by dropdown_options
```js
await GH_SELECT.init('selectId', 'list_key', currentVal, { allowAdd, placeholder })
```
- Appends "+ Add new…" option that POSTs to settings API

### GH_FAMILY — family member pill input
```js
GH_FAMILY.init('containerId', existingFamilyMembers, { showLabel: true/false })
GH_FAMILY.getIds('containerId') // returns number[]
```
- Fetches from `/api/v1/settings/family`
- `showLabel: false` suppresses the internal "Family Members" label (use when providing your own)
- Returns selected family_member IDs for saving to `record_family_members` table

### GH_VIEW — grid/list toggle + column picker + Advanced Filters
```js
GH_VIEW.init('containerId', 'storagePrefix', callback, {
  defaultView: 'grid',
  filterFields: [
    { key: 'location_id', type: 'select', label: 'Location', options: [...] },
    { key: 'brand',       type: 'text',   label: 'Brand', placeholder: '...' },
    { key: 'has_photo',   type: 'toggle', label: 'Has Photo', options: [{label:'Any',value:''},{label:'Yes',value:'1'},{label:'No',value:'0'}] },
    { key: 'tags',        type: 'tags',   label: 'Tags' },
  ]
})
```
- Renders: [⊞ grid] [☰ list] | Cols 2 3 4 5 | Sort | Advanced Filters
- Advanced Filters drawer: fields defined per-module, Apply/Reset, accent dot badge when active
- Currently wired: **inventory only**. Books, Documents, Resources are next candidates.

---

## 4. Family Members Architecture

### record_family_members table (migration 042)
```sql
entity_type TEXT, entity_id INTEGER, family_member_id INTEGER
```
Indexes on (entity_type, entity_id) and (family_member_id).

### Wired entity types
`book`, `document`, `resource`, `todo`, `hsa_payment`, `finance_account`,
`finance_transaction`, `career_job`, `career_goal`, `kid_activity`, `kid_note`, `contact`

### Excluded (deliberate)
- `med_visit/med_medication/med_condition` — patient field handles this
- `daily_log` — personal, not needed

### Backend pattern (shared/familyMembers.js)
```js
const { saveFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');
// GET: res.json(records.map(r => withFamilyMembers(withTagNames(r, 'book'), 'book')))
// POST/PUT: if (d.family_member_ids !== undefined) saveFamilyMembers(id, 'book', d.family_member_ids)
// DELETE: clearFamilyMembers(id, 'book')
```

---

## 5. Kids Module — Family Members Driven

Kids module no longer has its own list — it pulls from `family_members` table.

**Child relationship filter:** `Son`, `Daughter`, `Child`, `Stepson`, `Stepdaughter`, `Stepchild`

When the Kids page loads, it queries family members with these relationships and
auto-creates a `kids` profile row for each one if none exists yet.

**Current family members:**
- Algir (Self) — id:1
- Arnav (Son) — id:2
- Risha (Daughter) — id:3
- Zarna (Spouse) — id:4

To add a new child: Settings → Family Members → set relationship to Son/Daughter/Child.
The Kids module will pick them up automatically on next load.

---

## 6. Todos — Recurring Tasks

### Already built and working:
- `recurrence` field: `daily`, `weekly`, `monthly`, `yearly`, `every_n_days`
- `recurrence_days` field: integer, used when recurrence = `every_n_days`
- On mark-done: `spawnNextRecurring()` creates next occurrence from **actual completion date** (today), not original due date
- UI: Repeat dropdown in todo form, "Every N days…" option shows a day-count input

### Migration 043 — PENDING
`recurrence_days` column needs `docker restart ghrava` to apply migration 043.
After restart, "Every N days" recurrence is fully functional.

### Auto-generated todos (existing)
- `inv_expiring` — inventory warranty/item expiry
- `inv_warranty_expiring` — warranty expirations
- `inv_missing_doc` — items flagged for missing docs
- `hsa_unreimbursed` — outstanding HSA pool
- `follow_up_overdue` — daily log follow-up flags
- `med_discontinued` — discontinued medications
- Gift card expiry (finance module)
- Career cert renewal (career module)
- `needs_review` — data flagged across 22 tables

---

## 7. Books Module — ISBN Scan

### Flow
1. FAB → Add modal (Scan ISBN / Add Manually)
2. Scan → camera opens (BarcodeDetector native or ZXing fallback)
3. ISBN decoded → Open Library lookup → Google Books fallback (if API key set)
4. Confirm panel shows cover + editable title/author/genre/ISBN
5. Apply → fills form → Save → cover downloaded as attachment

### Google Books API Key
Stored in `app_config` table, key = `google_books_api_key`.
Set in Settings → Google → API Keys section.
`GET /api/v1/settings/config/:key` returns `{ key, value }`.
`PUT /api/v1/settings/config/:key` saves value.

### Cover images
Stored as attachments in `/app/attachments/books/`, thumbnails in `.../thumbs/`.
Route: `POST /api/v1/books/:id/fetch-cover { url: '...' }`
Book cards show cover thumbnail when `primary_photo_id` is set.

---

## 8. Inventory — All Items View

### Grid/List toggle
- Grid: `all-items-grid` class, CSS custom property `--ai-cols` (2-5 columns)
- List: `ai-list-grid` class, compact horizontal cards
- Column picker + view toggle rendered by `GH_VIEW.init('invViewToolbar', 'inv', callback, { filterFields: [...] })`
- Preferences saved to localStorage keys `inv_view` and `inv_cols`

### Advanced Filters (inventory)
Fields: Location/Room (select), Category (select from dropdown_options), Brand (text), Has Photo (toggle), Tags (pills)
Filter applied client-side in `renderAllItemsFlat()` against full item list.
Search bar also filters inline (no longer switches to separate search view when in All Items mode).

### Card clicks
All item cards use `openDetail(id)` — NOT `openItemDrawer(id)`.
`openItemDrawer` requires a full item object; `openDetail` fetches by ID.

---

## 9. Trading Module

### Backend
- Routes: `app/features/trading/routes.js` — fully public (no requireAuth)
- Registered: `app.use('/api/v1/trading', require('./features/trading/routes'))`
- Data: `/app/data/trading.json` (settings, watchlist, portfolio, analysisHistory)
- Reports: `/app/data/trading-reports/YYYY-MM-DD_HHmm_type.json`

### Nav
- Label: `↗ Terminal`, opens `trade.html` in a new tab
- Listed under Finance section in sidebar nav
- `newTab: true` property on nav item

---

## 10. Documents Module — Centered Modal

Documents drawer converted to a centered modal (not bottom slide-up).
- Class: `doc-modal-overlay` / `doc-modal`
- Close: × button, Cancel button in footer, click outside
- `closeDocModal()` function
- `dMember` (Primary Person single-select) is hidden in DOM but preserved for data compat —
  `family_member` column still saved, existing records unaffected
- Family Members (GH_FAMILY multi-select) is the primary people field going forward

---

## 11. Settings vs Reports — Design Decision

**Settings** = configuration and system actions only:
- Family members, contacts, dropdown options management
- Google integration credentials + API keys
- App URL, QR codes
- Backup actions (take backup, restore)
- Password/auth

**Reports** = anything you look at, analyse, or act on from data. Not yet built.
Planned sections: Data Quality, Inventory, Finance, Medical, Documents, System.

**Dashboard** = right now, today. Urgency and attention. Already well-built.
Planned additions: Documents expiring soon widget, Backup status widget.
"Coming soon" teaser cards for reports sections that overlap with dashboard data.

**Key principle:** Reports cards link to records. "Fix" actions open the record
in a new tab. Reports page polls every 30 seconds to update counts after fixes.

---

## 12. Core Architecture Rules (non-negotiable)

### Database
- **NO ON DELETE CASCADE** — ever
- **journal_mode = DELETE, synchronous = FULL** — never switch back to WAL
- **Migrations additive only** — never DROP on real data without manual backup first
- **Before any DROP/DELETE migration** — ask user to take manual backup first

### Auth
- `requireAuth` is currently a **no-op** — all routes public, no token required
- Route-level `requireAuth` calls are preserved in place as SSO hook points
- When SSO (Authelia/OIDC) is added later, wire it into `middleware.js` `requireAuth` only — no route files need changing
- Settings UI for password is kept but does nothing until SSO is wired
- Trading module: fully public (unchanged)

### Patterns
- **Tags:** always via `shared/tags.js` — never raw taggables SQL in route files
- **Family members:** always via `shared/familyMembers.js`
- **Dropdowns:** always via `GH_SELECT` — never raw `dropdown_options` SQL in frontend
- **Item drawer:** `openDetail(id)` to view, `openItemDrawer(object)` to edit
- **Script scoping:** `const $` and `const esc` defined locally in every .html page
- **GH_FAMILY label:** pass `{ showLabel: false }` when providing your own label above the wrap

---

## 13. Active Backlog

### Status as of v202603.101

---

### ✅ DONE — no action needed
- GH_SELECT across all modules (finance, HSA, resources, property, medical, career)
- Contact drawer iframe rendering fixed (gh-drawer-only CSS class)
- Medical.html missing lt-refs.js — fixed
- Unified transactions view (imported + manual merged)
- Finance import auto-categorization (rules table + apply-on-import)
- Inline category editing on imported transaction rows
- CSV exports: medical, career, property, daily log, HSA
- Excel export with NAS attachment links
- Notifications page (/notifications.html)
- Unified XLSX export/import (/data.html, /api/v1/data/*)
- E2E test script hang fixed (Start-Process → call operator)
- E2E purge endpoint (POST /api/v1/settings/diagnostics/purge-e2e)
- Settings test 14.5s timeout fixed
- Smoke test: 48 assertions

---

### 🔴 NEXT — Build immediately (no design decision needed)

**1. Finance — remaining GH_SELECT violations**
- `openBudgetDrawer` — `budCategory` is still a datalist freetext. Replace with GH_SELECT `finance_category`.
- Finance accounts drawer (`accInstitution`) — still freetext "Chase, Vanguard…". Replace with GH_SELECT `financial_institution`.
- Both drawers need `async function` + `await GH_SELECT.init()`.

**2. Finance — budgets tab full build**
- `loadBudgets()` exists and is wired. Backend budget routes exist (`/finance/budgets`).
- Verify budget CRUD works end-to-end. If broken, fix. Show monthly spend vs budget per category.

**3. Tags — extend to remaining modules**
Per WIRING.md canonical entity types, these are NOT yet tag-wired:
- Medical visit notes (`med_visit_note`)
- Medical medications (`med_medication`)
- Career certifications (`career_cert`)
- Properties (`property`)
- Vehicles (`vehicle`)
Each needs: backend GET/POST/PUT/DELETE tag-aware, UI tag input in drawer + tag chips on cards.

**4. Kids module — full feature review**
- Verify relationship field displays correctly for Arnav/Risha
- Check empty state (verify display_name + relationship both set in Family Members)
- Activity and note tabs — confirm GH_SELECT categories working

**5. Books — cover display**
- Unconfirmed from prior session whether cover thumbnails render correctly after ISBN scan
- Test: scan ISBN → Open Library lookup → cover image downloads → displays on book card

**6. Reports — complete remaining tabs**
- Summary tab: Phase 3 cards for Inventory, Medical, Documents (currently showing placeholder)
- Data Quality tab: completeness checks cover 8 modules — add Kids, Finance

**7. Career — education institution → GH_SELECT**
- `eduInstitution` is still a freetext input
- Create `school_name` dropdown_options key, seed with common institutions + allow add
- Migration 048 needed

**8. Data Manager — import for finance bank statements**
- Currently `/data.html` only handles Ghrava-to-Ghrava data
- Add a second section: "Import Bank Statement" that links to Finance → Import tab
- Makes it the single entry point for all data operations

---

### 🟡 MEDIUM — Build when above is done

**Finance — OFX/QFX import more bank parsers**
- Wells Fargo, Capital One, USAA not yet supported
- Add parsers in `features/import/parsers.js` — same pattern as existing parsers

**Dashboard — attention widget improvements**
- Currently shows expiring docs, overdue todos, HSA pool, certs
- Add: vehicle registration expiring, property maintenance overdue

**Property — vehicle service type in export/import**
- `vehicle_service` table not in unified export yet
- Add sheet to data/routes.js export

**Medical — visit notes physician stored as freetext `physician` in export**
- Currently exports contact name string; import doesn't resolve back to contact_id
- Fix: export `physician_contact_id`, import resolves by contact name

**Calendar module**
- Currently shows but polls Google Calendar (external)
- Decision: keep for Google sync only, or remove from nav?

---

### 🔵 LOW / DESIGN NEEDED

**Left nav icon review** — some modules use wrong SVG icon (using settings icon for Data)
**SSO / auth activation** — requireAuth is a no-op; SSH setup on QNAP needed first
**Notifications email digest** — design conversation first
**Doc Fetcher** — separate automation system (Playwright + Bitwarden CLI + Paperless-ngx)

---

### Key file locations (current)
- `app/features/auth/middleware.js` — requireAuth no-op
- `app/features/data/routes.js` — unified export/import (NEW v202603.101)
- `app/features/finance/routes.js` — transactions, unified, category rules, budgets
- `app/features/import/routes.js` — bank statement import with auto-categorize
- `app/features/settings/routes.js` — dropdowns, tags, completeness, family report, purge-e2e
- `app/features/todos/routes.js` — syncAutoTodos() sections 1-9
- `app/public/data.html` — Data Manager page (NEW v202603.101)
- `app/public/notifications.html` — Notifications page
- `app/public/reports.html` — all 6 tabs
- `app/public/js/lt-refs.js` — GH_REFS contact/family pickers via settings iframe
- `app/public/js/lt-core.js` — GH_SELECT, GH_TAGS, GH_VIEW, GH_TAG_SEARCH, GH_FAMILY
- `app/public/nav.js` — sidebar, bell dropdown, MODULES registry
- `app/public/settings.html` — canonical contact/family forms; gh-drawer-only CSS for iframe
- `smoke-test.sh` — 48 assertions
- `tests/ghrava-e2e.spec.js` — Playwright E2E suite
- `tests/run-tests.ps1` — Windows runner (uses & call operator, exits cleanly)


## 14. Known Issues

1. **Tag input styles** — `tags-input-wrap` / `tags-input` / `tag-chip` CSS was only in `resources.html`. Fixed in this session — moved to `shared.css`. If any module still looks broken, force refresh.
2. **Resources left column blank** — `res-section-label` missing `grid-column: 1/-1`. Fixed this session.
3. **Books add modal** — `$` scope issue in second script block. Fixed with `_$` alias. If still broken, hard refresh.
4. **GH_VIEW Advanced Filters category dropdown** — fetches from `/api/v1/settings/dropdowns/inventory_category`. If empty, check that category values exist in dropdown_options table.
5. **Kids empty state** — if Arnav/Risha not appearing, verify their relationship field is set in Settings → Family Members.

---

## 15. Deployment

```powershell
# Local Windows — run from wherever scripts are saved:
.\ghrava_deploy.ps1           # finds zip in Downloads, copies to NAS, prompts git push

# NAS terminal:
docker restart ghrava         # code-only changes
docker compose up --build -d  # only when package.json changed
```

**Run smoke-test.sh before packaging any deploy zip. If it fails, fix before shipping.**
```bash
# On NAS after docker restart, before zipping:
bash smoke-test.sh http://localhost:3001
```

**Zip packaging pattern:**
```bash
cd /home/claude/ghrava
zip /home/claude/Ghrava_DEPLOY.zip app/path/to/file1 app/path/to/file2 app/version.txt HANDOFF.md
```
Always include `app/version.txt` and `HANDOFF.md` in every zip.
HANDOFF.md-only changes do NOT get their own zip.


### v202603.108
**api() call signature audit — comprehensive fix across all pages:**
- Each page has its own api() wrapper with different signatures. Rule:
  - `window.api` (finance.html, medical.html) = `api(method, path, body)`
  - Local `api(path, opts={})` wrappers (career.html, property.html) = pass method/body in opts object
  - Local `api(path, method='GET', body)` wrappers (books.html) = already correct
  - Local GET-only `api(path)` wrappers (reports.html) = already correct
- Fixed 15+ broken calls in finance.html (import section, accounts, transactions, net-worth, gift cards)
- Fixed 4 career goals calls that double-included `/api/v1/career` prefix
- Reverted 11 career cert/job/skill/edu calls that were broken by earlier "fixes"
- Reverted 8 property.html calls that were broken by earlier "fixes"
- All writes in finance import section now correctly pass method/body

**Nav sidebar — System section added:**
- `notifications` (Alerts, bell icon) and `data` (Data Manager) added to nav sidebar under new "System" section
- Settings moved into System section alongside them

**Data Quality completeness checks expanded:**
- Kids: no date of birth, no grade
- Finance: uncategorized manual transactions, uncategorized imported transactions  
- Property: maintenance overdue (past next_due_date)

### v202603.107
- **E2E tests expanded:** 9 new API contract tests — data export/import xlsx, dashboard doc_total/kids keys, notifications page load, data page sheet pills, finance budget route. Total: ~22 API contract tests.
- **Smoke test:** 51 assertions (was 48). Added notifications page, data page, finance/budgets.

### v202603.106
- **saveBudget api() fixed** — budget saves were silently failing (old signature). Fixed.
- **Bank parsers:** Wells Fargo, Capital One, USAA added (now 11 formats total).
- **Data Manager** — bank import section added linking to Finance → Import.
