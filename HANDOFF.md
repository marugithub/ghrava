# Ghrava — Project Handoff & System Reference
**Last updated:** v202603.094
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

### Immediate / next session
1. ~~**Migration 043 apply**~~ — **DONE v202603.080.** `docker restart ghrava` applies it. Verify "Every N days" recurrence on a test todo.
2. ~~**GH_VIEW for other modules**~~ — **DONE v202603.080.** Books, Documents, Resources all wired. Grid/list toggle + column picker + tag filter on all three.
3. ~~**Dashboard additions**~~ — **DONE v202603.080.** Expiring documents widget (next 90 days), Backup status widget (days since / overdue flag), Reports teaser card. Data served from `GET /api/v1/dashboard`.
4. **Books cover display** — verify cover thumbnails render correctly on book cards after ISBN scan (unconfirmed from prior session)

### Medium priority
5. **Reports module** — Finance reports (Spending/Health/Net Worth/Annual) were already complete. **v202603.082 added:** System tab (version, uptime, DB size, backup age, record counts) and Data Quality tab (needs_review flags per module, links to relevant pages). Remaining: Phase 3 summary cards for Inventory/Medical/Documents.
6. ~~**Settings audit**~~ — **DONE v202603.084.** Logs, Data Cleanup, Data Review, Diagnostics, Recent Changes all moved to Reports → Tools tab. Settings shows "Moved to Reports → Tools tab" redirect links. Full diagnostics runner rebuilt in Reports with `rpt_` prefix IDs.
7. ~~**Medical patient filter**~~ — **Already built** (discovered v202603.082 audit). Patient pill strip at top of Medical page.
8. ~~**Property maintenance UI**~~ — **Already built** (discovered v202603.082 audit). Full drawer with category, vendor (GH_REFS contact picker), cost, warranty, next due date.
9. **Documents file pointer** — `file_name` field now clickable in cards. Drive paths (Z:\...) open as file:// URL. UNC paths (\\NAS\...) copy to clipboard (browser security prevents direct open). HTTP/HTTPS opens in new tab. Plain text copies to clipboard. Upload to NAS deferred — separate design decision alongside SSO.

### Design discussions needed
10. **Dashboard vs Reports overlap** — teaser cards in place. Build Reports Phase 1 next session.
11. ~~**Recurring tasks linked to records**~~ — **DONE v202603.087.** Vehicle service and property maintenance records with next_due_date within 30 days auto-generate todos. Auto-resolve when date moves out.
12. ~~**Data quality checker**~~ — **DONE v202603.087.** Reports → Data Quality tab shows both needs_review flags and completeness issues (10 checks across 8 modules).
13. ~~**Finance/HSA tags**~~ — **DONE v202603.087.** Tags wired on finance_transactions and hsa_payments. GET responses include tag names, POST/PUT save tags, DELETE clears tags.

### v202603.090 — E2E test suite fixes
- **checkNoRawHtml false positives** — original regex `/<div\s/` and `/<span\s/` matched SVG paths, nav labels, Settings redirect notes, and other legitimate text on every page. Replaced with specific patterns targeting only the actual bug signature: `window.LT?.toast` visible as text, `<button onclick=` in body text, inline style strings leaking, clipboard JS visible. Also skips `<pre>`, `<code>`, log viewers explicitly.
- **Runtime 49min → ~5min** — `waitUntil: 'networkidle'` hangs on pages that poll Google Calendar and other external APIs. Switched page loads to `waitUntil: 'load'` + 1.5s settle wait. Added `navigationTimeout: 10000` and `actionTimeout: 5000` to playwright.config.js.

### v202603.089
- **E2E test suite** — `tests/` folder with Playwright. Runs from Windows against live Ghrava. Catches render bugs (raw HTML as text), JS errors, tag chip integrity, CRUD flows with auto-cleanup. Results POST'd to Ghrava and visible in Reports → Testing tab. Setup: `cd tests && npm install && npx playwright install chromium`. Nightly via Windows Task Scheduler.
- **Reports → Testing tab** — shows all test run history, pass/fail counts, per-suite drill-down, inline failure messages.
- **`POST /api/v1/app/test-results`** — stores JSON run data to `/app/data/test-reports/`. `GET` lists last 30 runs. `GET /:filename` returns full run details.
- **fileLink() bug fixed** — UNC paths with backslashes now use `data-path` attribute + delegated clipboard handler. No more inline `JSON.stringify()` in onclick attributes.

### v202603.088
- **Finance/HSA tag UI** — tag input (GH_TAGS) wired into transaction drawer and HSA expense drawer. Tag chips shown on transaction rows and HSA expense rows with GH_TAG_SEARCH on click.

### v202603.088
- **Finance/HSA tag UI** — tag inputs wired into transaction drawer and HSA expense drawer. Tags save on POST/PUT. Tag chips display on transaction rows and expense rows (already had chip rendering). Delegated clipboard handler on `file-copy-btn` class.
- **fileLink() bug fixed** — UNC paths like `\\SoniNAS\...` were rendering raw HTML as text due to `JSON.stringify()` inside a template literal creating nested backslash/quote escaping. Fixed by using `data-path` attribute with a delegated click handler — no inline JS, no escaping problems.

### v202603.087
- **Data completeness checker** — `GET /api/v1/settings/completeness` returns 10 checks (inventory no-location/price/category, contacts no phone+email, documents missing expiry, books no author, vehicles no registration, medications missing dosage, certs no expiry, HSA missing category). Reports → Data Quality tab now shows both needs_review flags and completeness issues.
- **Recurring tasks — Property** — `syncAutoTodos()` now generates auto-todos from `vehicle_service.next_due_date` (section 8) and `property_maintenance.next_due_date` (section 9). Both auto-resolve when the record's next_due_date is updated past 30 days out.
- **Finance tags** — `finance_transactions` GET/POST/PUT/DELETE all tag-aware via `finance_transaction` entity type.
- **HSA tags** — `hsa_payments` GET/POST/PUT/DELETE all tag-aware via `hsa_payment` entity type.

### Fixed v202603.086
- **smoke-test.sh** — adds 30s server startup wait loop so test runs immediately after `docker restart` without spurious HTTP 000 failures
- **Reports → People tab** — fixed two SQL errors: `kid_activities.schedule` (column is `day_of_week`), `career_jobs.status` (column is `is_current`). Added Career Jobs section to the report.

### Completed this session
- **Scheduled backup** — `node-cron` wired in server.js, runs 2:00 AM America/Chicago, keeps 7 rolling `scheduled_*.db` files. Falls back gracefully if node-cron unavailable.
- **Tag chips on cards** — inventory (grid + list), todos, books now all render clickable tag chips that trigger GH_TAG_SEARCH.
- **Reports → People tab** — full family member report.
- **Settings audit** — Logs/Diagnostics/Data Cleanup/Data Review/Recent Changes moved to Reports → Tools tab.

### v202603.094 — E2E test fixes (all test bugs, not app bugs)
1. **Tag chips test (line 211)** — books page defaults to "Currently Reading" shelf. Test now explicitly clicks "Want to Read" tab after navigation.
2. **Settings sections (line 268)** — `text=Family Members` matched the hidden sub-panel title (off-screen). Now uses `.settings-row-label` scoped locator.
3. **Todos CRUD (line 285)** — removed unreliable `page.on('pageerror')` registered after `goto` (misses load-time errors). JS error coverage stays in Suite 1 dedicated tests.
4. **Books tag chip (line 332)** — same shelf issue as #1. Now clicks "Want to Read" tab.
5. **Tags search (line 447)** — searching for tag `test` returns `{ tag, results: [] }` (no `groups` key when no results). Now creates a book with `_e2e_searchable_tag_` first, searches for it, verifies `groups` exists, then cleans up.

### v202603.094
- **Test script hang fixed** — `run-tests.ps1` was using `Start-Process -Wait -NoNewWindow` which hangs on Windows/mapped drives when Playwright's browser child processes don't release the process group. Replaced with `& $PwPath ...` (call operator) + `$LASTEXITCODE`. Now exits cleanly when tests finish.
- **E2E test data purge** — `POST /api/v1/settings/diagnostics/purge-e2e` hard-deletes all `_e2e_*` records from items (archive then delete), books, documents, todos, contacts, hsa_payments. Cleans taggables and record_family_members first. Returns per-table counts. Surfaced in Reports → Tools → "🧹 Clean E2E Data" button next to Orphan Check.

### v202603.093
- **Pin icon — double-encoded bytes** — v202603.092 replaced 9 single-encoded `f09f938d` bytes but missed 2 double-encoded `c3b0c29fc293c28d` variants on lines 1919 and 1937 (the actual list/grid card templates). Now 11 `&#x1F4CD;` entities total, zero bad bytes.
- **E2E test speed** — replaced 7 fixed `waitForTimeout` calls with `waitForSelector` (returns as soon as element appears, not after a fixed delay). Expected runtime ~3–5 min vs previous 49 min. One intentional 1500ms wait remains in `checkNoRawHtml` after `networkidle`.

### v202603.092 — 6 pending issues fixed
1. ~~**Test results path**~~ — `run-tests.ps1` default changed to `Z:\ghrava\test-results\`.
2. ~~**Settings iframe hides behind main panel**~~ — when `?drawer=contact` param present, `#app` is now hidden before drawer opens. No more z-index conflict.
3. ~~**Settings drawer z-index**~~ — resolved by item 2.
4. ~~**Backup verification in deploy**~~ — smoke-test.sh now checks that `auto_YYYYMMDD*.db` exists from today's date. Fails the smoke test if no fresh backup found.
5. **Pin icon mojibake — PARTIAL FIX** — `&#x1F4CD;` entity was written to inventory.html for 9 occurrences. Deployed, but list/grid card views STILL show mojibake after hard deploy. Detail view is correct. This means the all-items browse cards use a different render path than what was patched. Next fix: audit EVERY render function in inventory.html that outputs location path text — specifically `renderItemCard`, `renderItemGridCard`, `renderItemCompactCard`, and any location-tree item renderers. Do NOT rely on grep for emoji — read byte-by-byte. Also check if the issue is browser cache first (Ctrl+Shift+F5).
6. ~~**E2E `_e2e_item_test` not cleaned up**~~ — inventory CRUD test now calls `PUT /archive` before `DELETE` (route requires archived=1 for hard delete). Also fixed overly-broad `/<span/` raw HTML check in inventory and books tests.

### Next session — before anything else
- **Deploy script exclusions** — update `ghrava_deploy.ps1` to explicitly skip `tests\test-results\` and `tests\node_modules\` in case `run-tests.ps1` cleanup fails (defensive). v202603.091 already handles the immediate EPERM by deleting `test-results/` after posting results.
- ~~**.gitignore for test-results**~~ — **DONE v202603.091.** `tests/test-results/`, `tests/node_modules/`, `tests/playwright-report/` added. — `ghrava_deploy.ps1` should exclude `tests/test-results/` from the zip and from git commits. Add `tests/test-results/` and `tests/node_modules/` to `.gitignore`. The Playwright HTML report and JSON results are runtime artifacts — large, machine-generated, change every night, no value in version control.

### ~~Backlog — Test Data Cleanup~~ DONE v202603.094
- ~~**E2E test data purge mechanism**~~ — the Playwright suite creates records prefixed `_e2e_` that survive if a test crashes before its `finally` block runs. Currently no way to bulk-remove them without manual DB access. Requirements when built:
  - A dedicated purge endpoint `POST /api/v1/settings/diagnostics/purge-e2e` that hard-deletes all records whose name/title/provider starts with `_e2e_`
  - Must cover every table that the test suite writes to: `items` (needs archive first), `books`, `documents`, `todos`, `contacts`, `hsa_payments`, and any future test targets
  - Surface it in Reports → Tools tab as "Clean up E2E test data" button, shown only when `_e2e_` records are actually found
  - Do NOT auto-run on startup or on a schedule — manual trigger only
  - Log how many records were removed per table

### Low / deferred
14. ~~**Global tag search**~~ — **DONE v202603.084/085.** `GH_TAG_SEARCH` modal in lt-core.js. Tag chips on documents, inventory (grid+list), todos, and books cards are all clickable. Slide-up sheet shows grouped cross-module results. Backend: `GET /api/v1/settings/tags/search?tag=X`.
15. **Finance OFX/QFX import UI** — backend exists
16. **Calendar module** — keep for Google Calendar sync only or remove
17. **Google Site data import**
18. **Left nav icon review**
19. ~~**"Everything about Risha" report**~~ — **DONE v202603.085.** Reports → People tab. Family member picker pills, per-member report with: summary stats grid, todos, documents, medical (conditions/meds/visits), books, HSA, career goals, resources. Backend: `GET /api/v1/settings/family/:id/report`.

---

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

