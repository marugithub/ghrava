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

**Last updated: v202603.115**

---

### 🔴 BUILD — No design decision needed

**1. Google Tasks sync on Todos**
- `/api/v1/google` currently has Google Calendar OAuth — repurpose or replace for Tasks
- Todos should push to Google Tasks and pull changes back
- Design: one-way push on save, or full bidirectional sync?
- **Ask before building** — sync strategy needs decision first

**2. vehicle_service table missing from unified XLSX export**
- `vehicle_service` records not in `/api/v1/data/export`
- Add sheet to `app/features/data/routes.js`
- Low risk: additive only

**3. GH_VIEW Advanced Filters — wire to books, documents, resources**
- Currently only inventory has GH_VIEW Advanced Filters
- Books: filter by genre, format, status, rating, tags
- Documents: filter by category, expiry range, family member
- Resources: already has basic category filter — add tag filter + favorites toggle

**4. Medical — physician export as contact_id not name**
- Currently exports `physician` (freetext name); import can't resolve back to contact_id
- Fix: export `physician_contact_id`, add physician name as read-only column

~~**5. Property — maintenance completion tracking** — DONE v202603.119~~

**6. Dashboard attention widget — add property maintenance overdue**
- `/api/v1/dashboard/attention` doesn't include overdue property maintenance
- Already tracked in completeness checks — wire to attention feed too

---

### 🟡 MEDIUM

**Finance net-worth snapshots**
- `POST /api/v1/finance/net-worth/snapshot` exists — verify UI works end-to-end
- Snapshot history chart in Reports → Net Worth tab

**SSO / auth activation**
- requireAuth is a no-op (server/middleware.js returns next() unconditionally)
- Needs SSH setup on QNAP first, then turn on token checking

**Doc Fetcher system (separate project)**
- Playwright + Bitwarden CLI + Paperless-ngx automation stack
- Downloads statements/EOBs from Chase, BCBS, MyChart automatically
- Separate Docker Compose stack at doc-fetcher.local

---

### 🔵 LOW / DESIGN NEEDED

**Notifications email digest** — design conversation needed first
~~**Left nav Data icon**~~ — DONE v202603.120 (database cylinder icon)
**Sidebar logo** — needs to be roughly 2× current size; padding reduction in v121 helped but more to do
**Books — Open Library cover auto-fetch on status change to "Currently Reading"** — nice to have

---

### ✅ CONFIRMED DONE (moved here from active)
- All GH_SELECT violations fixed across all modules
- makeApi() unified api factory — all pages migrated
- Tags wired on all modules (confirmed in WIRING.md entity types table)
- Books reading progress (pages_read, pages_total) — migration 049
- Dashboard redesign — compact 4-col, family strip removed, 12 stat cards
- Modal standard (gh-modal-overlay) — LT.confirm + GH_SELECT "Add new" ported
- Cancel buttons on all drawers (career 5 + property 3 added)
- Button label standard — Save/Cancel/Delete/Archive enforced
- Google Calendar removed — calendar.html dead, no nav entry, no dashboard widget
- Stale backlog items 1-8 from prior sessions — all complete

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


### v202603.122
**medical.html — stray backslash fixed** (was rendering as "/" between hamburger and page icon)

**Reports — net worth snapshot:**
- "📸 Save Now" button added to Historical Snapshots section header
- `takeNwSnapshot()` function added — POSTs to existing `/api/v1/finance/net-worth/snapshot`, refreshes tab after save

**Reports — People tab:**
- `fetch('/api/v1/settings/family')` → `window.api('GET', '/settings/family')`
- `fetch('/api/v1/settings/family/${id}/report')` → `window.api()`

**dashboard/routes.js — attention widget:**
- Completed maintenance (is_completed=1) now filtered out — no longer shows as overdue

**Backlog updated:**
- Logo size added as low-priority item (defer)
- Items #2, #3, #4, #6 confirmed done (were stale in backlog)

### v202603.121
**Fixes from screenshot feedback:**
- Stray "/" on all pages: was a backslash in medical.html comment line
- Logo padding reduced 10px→4px, image 72→88px, header area 92→100px
- Logo confirmed links to /index.html (unchanged)
- Always Ghrava_DEPLOY.zip from now on

### v202603.120
**nav.js — three UI fixes applied to every page globally:**

1. Sidebar logo bigger: height 60px → 72px, nav header area 80px → 92px
2. Home/back button removed from ALL page headers — sidebar navigation makes it redundant.
   Desktop was showing a small home icon next to the page icon; now gone entirely.
3. Module icons bigger: header icon box 32px → 40px, SVG 17px → 22px
4. All 12 module SVGs replaced with more distinctive/representative icons:
   - Daily Log: pencil-on-document (writing/journal)
   - Inventory: 3D box/package with depth lines
   - Medical: EKG heartbeat pulse line
   - Finance: trending-up line chart (money growth)
   - Todos: checkbox with checkmark
   - Property: house silhouette
   - Kids: two people (parent + child silhouette)
   - Documents: lined document with fold corner
   - Career: briefcase with handle
   - Books: open book (two pages)
   - Resources: link/chain icon
   - Reports: vertical bar chart (3 bars)
5. Collapsed sidebar icon: was tiny home SVG, now uses logo.png (36×36)

All changes in nav.js and shared.css only — zero per-page changes needed.

### v202603.119
**LT.confirm — critical bug fix (deletes were broken everywhere):**
LT.confirm was callback-only and never returned a Promise. Every page used
`if (!await LT.confirm(...)) return;` which always evaluated to undefined (falsy),
meaning every delete confirm dialog silently cancelled without executing. Fixed: LT.confirm
now returns a Promise that resolves true/false. Also accepts plain string shorthand:
`await LT.confirm('Sure?')`. Both `await` style and `onConfirm` callback style work.

**Property maintenance completion tracking (migration 050):**
- Migration: `is_completed INTEGER DEFAULT 0`, `completed_date DATE` added to property_maintenance
- Backend: PUT updated, new PATCH /complete and PATCH /reopen routes added
- UI: "✓ Done" / "Reopen" quick-action buttons on each maintenance card
- Drawer: Completed? toggle + Completed Date field (auto-fills today when switching to Yes)

**Nav Data icon fixed:**
- Added `database` SVG to nav.js icon set (cylinder icon)
- Data module now uses database icon instead of settings gear

**Remaining CSV violations cleared:**
- finance.html: HSA export button + exportCsv() function removed
- Orphaned export function tail (from previous removal attempt) cleaned up

**Misc fixes:**
- property.html: 3 remaining old single-arg api() calls in loadMaint fixed
- kids.html: LT.confirm `{message:}` → `{msg:}` fixed (3 calls)
- property.html: LT.confirm deleteMaint converted to clean await style

### v202603.118
**Design consistency pass — major cleanup:**

Search bars added to all modules that were missing them:
- todos.html: search bar + client-side filter wired into render()
- career.html: search bar + wired into loadCerts/Jobs/Skills/Education
- medical.html: search bar + wired into renderMedications/Conditions/Notes
- property.html: search bar + wired into loadProps/Vehs
- kids.html: search bar (shown after kid selected) + wired into renderActivities/Notes

CSV violations removed (no per-module exports per WIRING rule):
- career.html: CSV button + exportMap JS removed
- medical.html: CSV button + exportMap JS removed
- daily-log.html: CSV button removed
- property.html: all 3 CSV buttons (vehicles, service log, maintenance) removed

Kids module full redesign:
- Avatar strip replaces plain text tab buttons — color-coded gradient avatars per child
- Hero banner with gradient background shows name, age/grade, school
- Stats strip (activities count, notes count, school name)
- Points placeholder banner (gamification ready — wired in when points built)
- Info rows use kid-section-label, kid-alert-card CSS classes
- Health/Safety alerts use accent border cards (red for allergies/emergency, amber for meds)

CSS standardization continued:
- shared.css: stats-row, stat-chip, filter-pill, filter-strip, bulk-bar, cat-pill added as shared components
- career.html: .career-card* → .card system (already from v117), old api() calls fixed (8 single-arg calls)
- medical.html: .med-card* → .card system
- property.html: .prop-card/.veh-card → .card; hsa-card* → stat-chip* (was leaking Finance CSS)
- resources.html: .res-card kept as justified exception — specialized card with type icon, favorite star, open link, access note

WIRING.md updated:
- .res-card noted as justified exception to card migration
- todo-item noted as justified exception (checkbox + priority stripe + bulk select)

### v202603.117
**UI design system — card standardization pass 1:**
- shared.css `.card` component expanded into full system: `.card`, `.card-header`, `.card-icon`, `.card-body`, `.card-title`, `.card-sub`, `.card-sub-wrap`, `.card-right`, `.card-meta`
- Migrated: career.html (cert/job/edu cards), medical.html (med/condition/visit cards), property.html (prop/vehicle cards)
- Local `.career-card`, `.med-card`, `.prop-card`, `.veh-card` CSS removed — all use shared `.card` now
- Still to migrate: todos (`.todo-item`), resources (`.res-card`), kids (`.kid-card`), books (`.book-card` partial)

**GH_VIEW Advanced Filters expanded:**
- Books: status, format, genre, rating, tags
- Documents: category, expiring soon (30d/90d), tags
- Resources: favorites toggle, link_type, tags

**XLSX export: 25 sheets complete.** All modules covered.

**WIRING.md additions:**
- UI Design System section: card pattern, filter bar standard, migration checklist
- Gamification architecture: points ledger + achievements schema, trigger events, rules for building
- Cross-module entity_links design documented

**Backlog updated:** Card migration half done, todos/resources/kids/books remaining.

### v202603.116
**XLSX export now 25 sheets — complete coverage:**
Added: Daily Log, Family Members, Transactions (last 5000), Gift Cards, Kids.
Fixed: Visit Notes now exports physician_contact_id (not freetext name), _physician_name as read-only computed column.
Vehicle Service sheet added (previous session). genericUpsert updated with is_reconciled, is_primary_user booleans; initial_balance, monthly_limit floats; service_date, next_due_date dates.

**GH_VIEW Advanced Filters expanded:**
- Books: Status (Reading/Want/Read), Format (Physical/Kindle/Audible), Genre (text), Min Rating, Tags
- Documents: Category (10 doc types), Expiring Soon (30d / 90d toggle), Tags
- Resources: Favorites toggle, Link Type (website/login/document/contact/other), Tags
All filters are client-side on already-loaded data — no extra API calls.

**Cross-module relationship architecture documented in WIRING.md:**
- entity_links table design documented (not yet built)
- Side-effect pattern (consumption → qty change → auto-todo) specified
- Rule: do not build until first use case designed end-to-end (vehicle service is candidate)

**Backlog updated:** Items #2 and #6 marked done (vehicle service export, attention widget maintenance already existed).

### v202603.115
**Documentation overhaul — accurate current state:**
- WIRING.md completely rewritten: api() rule, data export rule (XLSX only), modal/button standards, Google integration status, all page-to-API deps, all route registry, dropdown keys, entity types, known-to-break patterns
- HANDOFF backlog rewritten: stale items removed, completed items moved to ✅ DONE, real remaining work documented
- Google Calendar: confirmed removed. calendar.html dead, removed from MODULES, removed from dashboard polling and widget
- Google Tasks: documented as planned (not built), not to be started without sync strategy decision

**Vehicle Service sheet added to unified XLSX export:**
- New sheet in `/api/v1/data/export` with vehicle_name (computed, read-only), vehicle_id, service_date, service_type, mileage, cost, shop, next_due_date, next_due_miles, notes
- Generic upsert handles import; date/numeric type detection updated for service_date, next_due_date, mileage, next_due_miles
- `_vehicle_name` prefix marks it as computed (not written back on import)

**CSV export violations reverted:**
- documents, resources, kids CSV export routes removed — violated XLSX-only data export rule
- Their toolbar/header buttons removed
- Bad smoke test assertions removed

### v202603.114
**Button / modal polish pass:**
- `LT.confirm` ported from `.confirm-overlay`/`.confirm-box` to `.gh-modal-overlay`/`.gh-modal` — consistent with new standard, backdrop-click dismisses, button order: primary action left, Cancel right
- `GH_SELECT` add-new popup ported from absolutely-positioned floating div → `.gh-modal-overlay` centered modal. Label "Add" → "Save". Works on mobile (no more off-screen positioning issues).
- finance.html: inline HSA "del" buttons → "✕" ghost style (keep `btn-ghost` + `color:var(--red)`)
- finance.html: CSV drawer × close → proper "Close" button
- medical.html: inline "del" buttons on med/condition/note cards → "✕" ghost style
- books.html: "Dismiss" on ISBN confirm panel → "Cancel"
- inventory.html: "Dismiss" on UPC feedback → "Cancel"
- All 13 pages + lt-core.js syntax-clean.

### v202603.113
**Dashboard (index.html) — full redesign:**
- Family strip removed entirely (initials-only avatars served no purpose without profile switching)
- New compact `.wgt-row` layout: label left + value right on one row, sub-line below — eliminates the large icon + stacked layout that wasted vertical space
- 4-column grid on desktop (was 3), 2-column on mobile — cards fill available width
- 12 stat cards: To Do, Inventory, Net Worth, HSA Pool, Medical, Property, Career, Books, Kids, Documents, Gift Cards, Backup
- Each card now shows 2–3 data points (e.g. Inventory: count + est value + expiring count; Net Worth: value + assets + liabilities)
- Career widget now leads with active job count (more useful than cert count)
- Daily Log wide widget: date shown inline, entry count added
- "Coming soon" Reports card removed
- Expiring documents card removed (now surfaced via alert badge on Documents widget)
- Attention + Review wide widgets kept, moved to bottom, made more compact

**shared.css — two new sections:**
- `.gh-modal-overlay` / `.gh-modal` — centered modal standard with open animation
- Button label standard comment block documenting Save/Cancel/Delete/Archive rules

**WIRING.md — standards documented:**
- Popup/Modal standard: when to use drawer vs centered modal, HTML pattern
- Button label standard: Save, Cancel, Delete, Archive — never OK/Submit/Remove/lone-×

**Cancel buttons added to drawers that were missing them:**
- career.html: cert, job, skill, education, goal drawers (5 total)
- property.html: property, vehicle, maintenance drawers (3 total)

### v202603.112
**Inventory.html — full fetch/authFetch migration to makeApi:**
- Added `const api = window.makeApi('/inventory')` 
- Migrated 30+ raw `fetch()` and `authFetch()` calls to `api()`
- Fixed malformed body args (leftover `body:JSON.stringify(...)` from authFetch spread)
- Fixed stale `r.ok`/`r.json()` references after api() returns JSON directly
- Intentionally left as raw fetch: photo/document uploads (FormData), inventory CSV import (FormData), silentGet helper (intentional fallback pattern)
- Fixed awawait typo

**Finance.html — 3 more broken write calls fixed:**
- saveTx (transaction save) — `api(url,{method,body})` → `api(method,url,payload)`
- saveAccount — same pattern
- saveGc (gift card save) — same pattern

**All 13 pages syntax-clean.**

---

### BACKLOG — Design & UX (to build after current code pass)

**Dashboard (index.html) redesign — per user feedback:**
1. Family strip names — remove (avatars already show initials, names add no value without profile switching)
2. Widget card vertical padding — reduce significantly, too much whitespace 
3. Widget card content — add more meaningful data per card, not just one number
4. Widget horizontal spacing — cards too wide on desktop with too much gap
5. Empty space — 3-col grid helps but widget-wide should span all 3 cols and show richer content
6. Sub-line placement — move up, doesn't need its own line when content is short
7. **Full redesign authorized** — revise layout, content, and card design from scratch using module data as you see fit

**Popup/modal standardization — per user feedback:**
8. All popups should open centered (like Add Inventory) — drawers are fine for record editing, but "add new" / confirm dialogs should be centered modals
9. Button consistency across all pages:
   - Primary action: always "Save" (not "Add", "Submit", "OK")
   - Secondary: always "Cancel" 
   - Destructive: always "Delete" or "Archive" (not "Remove", "del", small × buttons)
   - Confirm dialogs: "Delete" / "Cancel" — never just ✕ in corner
   - Pages with no explicit cancel: all modals need a visible Cancel button
10. Some drawers currently have no close mechanism except clicking outside — add explicit Cancel/Close button to all

**WIRING update needed:** add popup/modal standard to WIRING.md once pattern is decided.

### v202603.111
**Empty/error state consistency pass:**
- todos.html: inline `<div class="empty">` error → `errorState(e.message, 'load()')`
- daily-log.html: inline empty div → `emptyState(...GH_EMPTY.logEntries)` / search filter variant
- medical.html: 3 inline error divs → `errorState()`; medication/conditions/visits empty → `emptyState()`
- resources.html: inline empty → `emptyState(...GH_EMPTY.resources)` with filter variant
- property.html: 3 inline "No X yet" divs → `emptyState()` with icons and subtitles
All 5 pages syntax-check clean.

### v202603.110
**Design consistency audit — shared utilities added to lt-core:**

Problem: `fmt$` was defined differently in property.html and reports.html. `fmtDate` was defined identically
in todos.html and daily-log.html. Any future page needing these had to copy-paste or go without.

Fixed: Both are now `window` globals in lt-core.js, available to all pages automatically.
- `window.fmt$(n)` — compact dollar, no cents, absolute value: `fmt$(1234.56)` → `"$1,235"`
- `window.fmtDate(iso)` — short date without year: `fmtDate("2025-01-05")` → `"Jan 5"`

Local definitions removed from: property.html, reports.html, todos.html, daily-log.html.

Other findings from audit (not fixed — low risk, not user-visible):
- `esc()` redefined identically in 5 pages — `window.esc` exists. Harmless duplication.
- `$()` redefined identically in 4 pages — `window.$` exists. Harmless duplication.
- Empty/error state inconsistency (some pages use errorState(), others inline HTML) — polish pass deferred.

All 15 pages + 18 routes + lt-core + nav pass syntax check.

### v202603.109
**window.makeApi() — unified api factory, all pages migrated:**

`window.makeApi(prefix)` added to lt-core.js. Two lines. Returns `(method, path, body) => window.api(method, prefix+path, body)`.
All pages now use the same `api(method, path, body)` call signature. All calls inherit: auth header, JSON body, 401 retry, error logging.

Pages migrated (wrappers replaced):
- `books.html`    → `makeApi('/books')`
- `career.html`   → `makeApi('/career')`  — also fixed goals double-prefix bug
- `property.html` → `makeApi('/property')` — maintenance/vehicle CRUD now works
- `medical.html`  → `makeApi('')` (calls multiple modules)
- `resources.html`→ `makeApi('/resources')` (was `apiFetch`)
- `todos.html`    → `makeApi('/todos')` — raw fetch replaced
- `kids.html`     → `makeApi('/kids')` — all 10+ raw fetch calls replaced; r.ok/r.json() removed
- `daily-log.html`→ `makeApi('/daily-log')` — all raw fetch replaced; stale url variable removed

Pages intentionally NOT migrated:
- `finance.html`   — uses window.api directly with full paths (already correct)
- `reports.html`   — GET-only wrapper scoped to finance/reports (correct as-is)
- `documents.html` — already using window.api directly

Rule documented in WIRING.md: every page must use `const api = window.makeApi('/module')`.
Never hand-roll fetch(). Never invent a new local wrapper.

**Syntax check: 15 pages + 18 route files + lt-core + nav = 0 errors.**

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
