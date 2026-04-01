# Ghrava — Project Handoff & System Reference
**Last updated:** v202603.142
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

**Last updated: v202603.140**

---

### 🔴 BUILD — Priority order (do in sequence)

---

#### 🔴-A  Cancel buttons — all drawers (ONE SESSION, do first)
~15-20 drawers across 10 pages missing Cancel.
`structureDrawer()` moves existing buttons but doesn't add missing ones.
Pages to audit: todos, career, medical, property, books, documents, kids,
resources, daily-log, finance, inventory.
Mechanical work — no design decisions needed.
Rule: this must be done BEFORE auto-categorization session.

---

#### 🔴-B  Auto-categorization — Finance Transactions (ONE SESSION, after A)
Three parts in sequence:

**Part 1 — Starter category rules migration (~60 rules):**
Seed import_category_rules with common patterns:
  DFAS / FEDERAL SALARY → Income
  KROGER / PUBLIX / WALMART / COSTCO / ALDI → Groceries
  AMAZON / AMZN → Shopping
  NETFLIX / SPOTIFY / HULU / DISNEY → Subscriptions
  SHELL / BP / CHEVRON / EXXON / GAS → Gas & Fuel
  STARBUCKS / DUNKIN / MCDONALDS / CHICK-FIL-A → Dining
  AUTOPAY / INSURANCE → Insurance
  MORTGAGE / RENT → Housing
  CVS / WALGREENS / PHARMACY → Health
  ATM / WITHDRAWAL → Cash

**Part 2 — Wire rules into CSV drawer import:**
After parseFile() in /finance/transactions/import-file endpoint,
run each transaction description through import_category_rules before INSERT.
Same matching logic already in /import/confirm — extract as shared function.

**Part 3 — On-demand Re-categorize button:**
In Finance → Transactions tab.
POST /api/v1/finance/transactions/recategorize
Applies active rules to finance_transactions WHERE category IS NULL.
Optional "overwrite existing" toggle.
Returns {updated: N}, reloads transaction list.

---

#### 🔴-C  EOB Import — MHBP (ONE SESSION, after B)
See Section 16 for full design spec.

---

#### 🔴-D  Remaining legacy backlog items

**vehicle_service table missing from unified XLSX export**
- `vehicle_service` records not in `/api/v1/data/export`
- Add sheet to `app/features/data/routes.js`
- Low risk: additive only

**GH_VIEW Advanced Filters — wire to books, documents, resources**
- Books: filter by genre, format, status, rating, tags
- Documents: filter by category, expiry range, family member
- Resources: add tag filter + favorites toggle

**Medical — physician export as contact_id not name**
- Currently exports `physician` (freetext name); can't resolve back to contact_id on import
- Fix: export `physician_contact_id`, add physician name as read-only column

**Dashboard attention widget — add property maintenance overdue**
- `/api/v1/dashboard/attention` doesn't include overdue property maintenance

**Google Tasks sync on Todos**
- **Ask before building** — sync strategy (one-way vs bidirectional) needs decision first

---

### 🟢 SMALL — integration builds (after Integrations Settings panel is done)

**NHTSA VIN Decoder + Recalls — Property module**
- Add "Decode" button next to VIN field in vehicle drawer
- GET https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{VIN}?format=json
- Auto-fills: Make, Model, Year, Trim, Engine, Fuel Type, Body Style
- "Check Recalls" button: GET https://api.nhtsa.gov/recalls/recallsByVehicle?make=X&model=Y&modelYear=Z
- Gate on: cfg('api_nhtsa_enabled') === '1'
- ~2 hours. No key needed.

**OpenFDA Drug Lookup — Medical medications drawer**
- Add "Lookup" button in medication drawer
- GET https://api.fda.gov/drug/label.json?search=openfda.brand_name:"{name}"
- Auto-fills: generic name, standard dosage forms, manufacturer
- Gate on: cfg('api_openfda_enabled') === '1'
- ~2 hours. No key needed.

**Open Food Facts — Inventory UPC fallback**
- Add as second fallback in /api/v1/inventory/upc/:barcode route
- Called only when UPCitemdb returns nothing (food/grocery items)
- GET https://world.openfoodfacts.org/api/v0/product/{UPC}.json
- Gate on: cfg('api_openfoodfacts_enabled') === '1'
- ~30 min. No key needed.

**Weather widget — home page top-right (DEFERRED)**
- Small chip: ☀ 72°F — fixed position, top-right of index.html
- GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code
- Reads from app_config: api_openmeteo_enabled, lat, lon, units
- WMO weather code → emoji icon mapping
- Build as its own session. Do not mix into other sessions.
- No key needed.

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
**Gmail Gift Card Scanner** *(deferred — not worth building)*
Rejected because: gift card emails contain redemption links, not usable card numbers/PINs.
Most retailers require CAPTCHA/account login at the redemption URL before card details
are shown. Auto-importing would only capture retailer + amount + date — user still has
to manually retrieve the actual card number. Not enough value for the complexity.

If revisited: only makes sense with Tier 2 (Claude API to parse HTML) + user manually
confirming card number after redemption. Out of scope for now.

**Auto-categorization** — moved to 🔴-B (active backlog, full spec there)

~~**Module Inventory Report**~~ — DONE v202603.127 (GET /api/v1/app/module-inventory, Reports → System tab)
A system-wide snapshot report accessible from Reports → System tab (or a dedicated admin view).
Per-module, per-version it should capture:

Structure metrics (static, derived from code):
- Screens / pages count
- Drawers / forms count
- Form fields per drawer (label + type)
- API routes (GET/POST/PUT/DELETE/PATCH)
- DB tables owned by the module
- Export coverage (is it in the unified XLSX? which sheet?)

Data metrics (live, queried at runtime):
- Record count per table
- Records added in last 30 days
- Tags used (count)
- Family members linked (count)
- Attachments linked (count)

Delivery: Single endpoint `GET /api/v1/settings/module-inventory` returns JSON.
UI: Table or card grid in Reports → System tab. Each row = one module.
Export: Part of the unified XLSX export as a "Module Inventory" sheet (structure snapshot only).

Design note: the static metrics (fields, routes) are best captured at build time or by
parsing HANDOFF.md — not at runtime. Runtime should only serve the live data counts.

**Rule: Do not build until Reports → System tab is reviewed for available space.**
~~**Left nav Data icon**~~ — DONE v202603.120 (database cylinder icon)
**Sidebar logo** — needs to be roughly 2× current size
**Image rotation** — inventory photo rotate (90°/180°) via sharp on server; re-generates thumbnail; needs PATCH /api/v1/attachments/:id/rotate endpoint + rotate button in photo viewer. Medium effort.; padding reduction in v121 helped but more to do
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

---

## 16. EOB Import — MHBP Design Spec

### Overview
Upload EOB PDFs (one or many combined) to Medical module.
All parsing is **100% local** — pdf-parse + regex. **No API calls. No data leaves NAS.**
Files are **never stored** — memory-only via multer memoryStorage(). Only extracted data persists in SQLite.

### Plan details
- **Insurer:** MHBP (Mail Handlers Benefit Plan) — federal employee plan administered by Aetna
- **Portal:** mhbp.com (NOT aetna.com — different portal, different PDF format than consumer Aetna)
- **Health plan:** MHBP only. BCBS dental not in scope yet.
- **Frequency:** Monthly statements, can combine multiple months into one PDF for bulk upload

### EOB structure — all three variants handled by same parser
One EOB statement can contain:
- 1 patient, 1 visit (simplest)
- 1 patient, multiple visits on different dates (multiple CPT sections, same claim)
- Multiple patients, each with 1+ visits (multiple "Claim for [name]" sections)
Parser scans for all claim sections dynamically — no hardcoded patient count.

### Multi-statement PDF
Combine any number of monthly EOBs into one PDF before uploading.
Parser detects statement boundaries by "Page 1 of N" pattern — each occurrence = new statement start.
Statement date + Member ID = unique key for dedup (re-upload is safe).

### npm dependency to add
```
pdf-parse   (free, local, runs on QNAP, zero network calls)
```
Requires `docker compose up --build -d` after adding to package.json.
Multer is already in the stack — use memoryStorage() (same as import module).

### 4-table schema

```sql
-- One row per EOB statement (one PDF can have multiple statements)
CREATE TABLE med_eob_statements (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  insurer               TEXT NOT NULL DEFAULT 'MHBP',
  plan_name             TEXT,
  group_name            TEXT,
  member_id             TEXT,
  group_number          TEXT,
  member_name           TEXT,
  statement_date        DATE NOT NULL,
  period_start          DATE,
  period_end            DATE,
  amount_billed         REAL,
  allowed_amount        REAL,
  pending_not_payable   REAL,
  deductible_applied    REAL,
  copay_total           REAL,
  coinsurance_total     REAL,
  plan_paid_total       REAL,
  your_share_total      REAL,
  amount_saved          REAL,
  healthfund_applied    REAL,
  deductible_annual     REAL,
  deductible_used       REAL,
  deductible_remaining  REAL,
  oop_max_annual        REAL,
  oop_used              REAL,
  oop_remaining         REAL,
  healthfund_total      REAL,
  healthfund_used       REAL,
  healthfund_remaining  REAL,
  source_filename       TEXT,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(statement_date, member_id)
);

-- One row per patient per claim block within a statement
CREATE TABLE med_eob_claims (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  eob_id                INTEGER NOT NULL REFERENCES med_eob_statements(id),
  patient               TEXT NOT NULL,
  claim_id              TEXT,
  received_date         DATE,
  provider              TEXT,
  network_status        TEXT,
  send_date             DATE,
  amount_billed         REAL,
  member_rate           REAL,
  pending_not_payable   REAL,
  applied_to_deductible REAL,
  copay                 REAL,
  plan_paid             REAL,
  fund_paid             REAL,
  coinsurance           REAL,
  your_share            REAL
);

-- One row per CPT code line within a claim
CREATE TABLE med_eob_services (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id              INTEGER NOT NULL REFERENCES med_eob_claims(id),
  service_description   TEXT,
  service_code          TEXT,
  service_date          DATE,
  amount_billed         REAL,
  member_rate           REAL,
  pending_not_payable   REAL,
  applied_to_deductible REAL,
  copay                 REAL,
  amount_remaining      REAL,
  plan_share            REAL,
  coinsurance           REAL,
  your_share            REAL
);

-- Per-person/family YTD balance snapshot from each statement
CREATE TABLE med_eob_balances (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  eob_id                INTEGER NOT NULL REFERENCES med_eob_statements(id),
  person                TEXT NOT NULL,
  balance_type          TEXT NOT NULL,
  annual_limit          REAL,
  amount_used           REAL,
  amount_remaining      REAL
);
```

### Key regex patterns (MHBP format)
```
Statement date:    /Statement date:\s*(\w+ \d+, \d{4})/
Member ID:         /Member ID:\s*(\S+)/
Group name:        /Group name:\s*(.+)/
Period:            /for (\d+\/\d+\/\d+) to (\d+\/\d+\/\d+)/
Boundary (new):    /Page 1 of \d+/  — each match = new statement start
Amount billed:     /Amount billed:\s*\$([\d,.]+)/
Allowed amount:    /Member rate\/\s*Allowed amount:.*?Your totals\s*\$([\d,.]+)/s
Deductible annual: /Annual deductible\s*\$([\d,.]+)/
Deductible used:   /Deductible used\s*-?\s*\$([\d,.]+)/
Claim block start: /Claim for (.+?)\nProvider:\s*(.+?)\s*\((In-Network|Out-of-Network)\)/gs
Claim ID:          /Claim ID:\s*(\S+)/
Received date:     /Received on\s*(\S+)/
Service line:      description + CPT code + "on MM/DD/YY" + amounts (table row)
Balance rows:      /Medical (?:In|Out of) Network (?:Deductible|Out of Pocket Maximum)\s+\$([\d,.]+)\s+\$([\d,.]+)\s+\$([\d,.]+)/g
HealthFund:        /Fund Benefit\s+\$([\d,.]+)\s+\$([\d,.]+)\s+\$([\d,.]+)/
```

### UI design
New "EOB" tab in Medical module.
- File picker (browse + drag) — accepts single PDF or combined multi-month PDF
- Preview table: one summary row per detected statement
  Columns: Statement Date | Patients | Claims | Plan Paid | Your Share
- Checkboxes to deselect any statements (default all checked)
- Import button — inserts all checked, skips any already in DB
- Duplicate check: UNIQUE(statement_date, member_id) — safe to re-upload

### Views enabled (build as separate session when needed)
- Deductible tracker — family YTD progress toward annual limit
- OOP max gauge — per person + family
- Claim history — filter by patient, provider, date range
- CPT spend breakdown — preventive vs specialist vs lab
- Provider billing history
- Pending/denied flag
- HealthFund balance over time

### Build dependency
1. ✅ Design confirmed — this document
2. ⬜ Cancel buttons session first (🔴-A)
3. ⬜ Auto-categorization session (🔴-B)
4. ✅ EOB build session complete — v202603.143


---

## 17. Integrations & API Config — Design Standard

### Core principle
Every external API integration — keys, toggles, location config — lives in `app_config`.
Settings → Integrations panel is the single place to configure all of them.
If a module is refactored or moved, the config key name never changes.
Routes always read from app_config at request time. Nothing is hardcoded.

### app_config table (already exists — do not add columns)
```sql
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
Simple key/value is sufficient. Labels, descriptions, grouping live in the
Settings UI code — not in the DB. DB is just storage, UI provides the context.

### Naming convention for integration keys
```
api_{service}_{qualifier}
```
Examples:
  api_google_books_key
  api_upcitemdb_key
  api_nhtsa_enabled
  api_openfda_enabled
  api_openmeteo_enabled
  api_openmeteo_lat
  api_openmeteo_lon
  api_openmeteo_units      (imperial | metric)
  api_openfoodfacts_enabled

Toggle keys (enable/disable a no-key API): value is '1' or '0'.
Key keys (optional paid upgrade): value is the key string, '' means use default/trial.
Location keys: value is decimal string e.g. '33.4052'.

### Migration 058 — seed all integration config keys
```sql
-- api/db/migrations/058_integration_config.sql
INSERT OR IGNORE INTO app_config (key, value) VALUES
  -- Inventory
  ('api_upcitemdb_key',          ''),   -- empty = use trial endpoint
  ('api_openfoodfacts_enabled',  '1'),  -- free fallback for food/grocery UPCs

  -- Books (google_books_api_key already exists in config from earlier migration)

  -- Property / Vehicles
  ('api_nhtsa_enabled',          '1'),  -- VIN decode + recall check, no key needed
  
  -- Medical
  ('api_openfda_enabled',        '1'),  -- drug lookup, no key needed

  -- Weather (for home page widget — deferred feature)
  ('api_openmeteo_enabled',      '0'),  -- off until widget is built
  ('api_openmeteo_lat',          '33.4052'),  -- Hoover, AL
  ('api_openmeteo_lon',         '-86.8278'),
  ('api_openmeteo_units',        'imperial');
```

### Backend pattern — how routes must read integration config
```javascript
// At top of any route that calls an external API:
const cfg = key => db.prepare('SELECT value FROM app_config WHERE key=?').get(key)?.value || '';

// Toggle check:
if (cfg('api_nhtsa_enabled') !== '1') return res.json({ disabled: true });

// Key with trial fallback:
const upcKey = cfg('api_upcitemdb_key');
const upcUrl = upcKey
  ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${upc}`   // paid
  : `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`; // trial
```

### Settings → Integrations panel (new panel to build in settings.html)
Grouped by module. Each row has: label, description, input or toggle, save button.

```
🔗 Inventory
  UPCitemdb API Key  [______] (optional — free trial used if blank)
  Open Food Facts    [toggle ON] food/grocery UPC fallback, no key needed

🔗 Books
  Google Books Key   [______] (optional — Open Library used if blank)

🔗 Property / Vehicles
  NHTSA VIN Decode   [toggle ON] free government API, auto-fills vehicle details
  NHTSA Recalls      [same toggle — both features use same api_nhtsa_enabled key]

🔗 Medical
  OpenFDA Drug Lookup [toggle ON] free government API, medication name/dosage lookup

🔗 Weather  (toggle only — data populated from home address in family settings)
  Open-Meteo Weather  [toggle OFF] enables home page weather widget (deferred)
  Location            Birmingham, AL (33.4052, -86.8278) — auto from home address
  Units               [Imperial ▾]
```

### Settings read/write routes (already exist — use as-is)
  GET  /api/v1/settings/config         — returns all config as {key: value} object
  GET  /api/v1/settings/config/:key    — returns single value
  PUT  /api/v1/settings/config/:key    — saves single value

No new routes needed. Settings panel just calls PUT for each field on change.

### Weather widget — home page top-right (DEFERRED)
Location: index.html — fixed position top-right corner, small chip, e.g.:
  ☀ 72°F  or  🌧 58°F  or  ⛅ 65°F
Reads: api_openmeteo_enabled, api_openmeteo_lat, api_openmeteo_lon, api_openmeteo_units
API: GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code&temperature_unit={unit}&timezone=auto
No key needed. Fires once on page load, no polling.
Weather code → icon mapping (WMO standard: 0=sunny, 1-3=partly cloudy, 45-48=fog,
  51-67=rain, 71-77=snow, 80-82=showers, 95+=thunderstorm)
Build this as part of the weather session, not mixed into other sessions.

### Gmail integrations — DEFERRED (not worth partial)
Per design decision: Gmail receipt scanning deferred until full implementation
is possible (not just partial merchant + amount extraction).
No config keys to add yet.

### Current state of existing integrations
| Service | Config key | Status | Notes |
|---------|-----------|--------|-------|
| Google Books | google_books_api_key | ✅ Live | optional, has Settings UI |
| Google OAuth | google_client_id/secret | ✅ Live | has Settings UI |
| UPCitemdb | api_upcitemdb_key | ⬜ key not in config | trial URL hardcoded in routes |
| Open Library | (none needed) | ✅ Live | no key, always on |
| Yahoo Finance | (none needed) | ✅ Live | Trading terminal only, no key |
| NHTSA | api_nhtsa_enabled | ⬜ not yet built | free, no key |
| OpenFDA | api_openfda_enabled | ⬜ not yet built | free, no key |
| Open Food Facts | api_openfoodfacts_enabled | ⬜ not yet built | free, no key |
| Open-Meteo | api_openmeteo_* | ⬜ not yet built | free, deferred |

### Build order
1. Migration 058 seeds all config keys (add to next deploy, zero risk)
2. Integrations panel in Settings (one session, purely UI + config PUT calls)
3. NHTSA wiring in Property vehicles drawer (small session)
4. OpenFDA wiring in Medical medications drawer (small session)
5. Open Food Facts wiring as UPC fallback in Inventory (30 min)
6. Weather widget in index.html (own session, after config is in place)


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
HANDOFF.md-only
### v202603.149
**Schwab Positions CSV import — new parser (schwab_positions):**

Problem: Schwab "Positions" tab export (holdings snapshot) was not detected.
Three root causes:
  1. detectFormat looked for "transactions for account" but file says "Positions for account"
  2. Parser looked for column header "Quantity" but file has "Qty (Quantity)"
  3. File is tab-separated (TSV), not comma-separated

Fix: New parseSchwabPositions() function + detection rule:
  Detection: raw.includes("positions for account") OR
             joined has symbol + qty + mkt val
  Parsing: auto-detects tab vs comma separator
           column mapping by partial name match (handles parenthetical variants)
           skips cash rows (symbol starts with ~$ or contains "cash")
           skips Account Total summary row
  Output: positions[] only (no transactions — it's a snapshot, not a history)
          Each row: symbol, name, assetType, shares, price, costBasis,
                    totalCostBasis, marketValue

Fields mapped:
  Symbol → symbol
  Description → name
  Qty (Quantity) → shares
  Price → price
  Cost/Share → costBasis (per share)
  Cost Basis → totalCostBasis
  Mkt Val (Market Value) → marketValue
  Asset Type → assetType (classified via classifySchwabAsset)

### v202603.148
**Institution dropdown restored + expanded in unified account drawer:**

Migration 060: 41 new entries added to financial_institution dropdown_options.
List now covers: Chase, BofA, Wells Fargo, Schwab, Vanguard, Fidelity,
Navy Federal, TSP, USAA, Ally, Discover, Citi, Capital One + 27 more
including Regions, Truist, PNC, SoFi, AmEx, Apple Card, Robinhood,
Pentagon FCU, store cards, and neobanks. allowAdd:true so any
institution not in the list can be typed in manually.

Institution field changed from plain <input> to <select> backed by GH_SELECT.
openAccountDrawer() now calls GH_SELECT.init() for the institution field.

Also includes v202603.147 fix: window.ACC_INVEST_TYPES (was const, now on window
so saveAccount cross-block reference resolves correctly — Brokerage/TSP/Investment
now route to financial_accounts instead of incorrectly to finance_accounts).

### v202603.147
**Import → Accounts → Add button not working:**

Root cause: Two `openAcctDrawer` function definitions existed in finance.html.
The shim (line 1777) redirects to the unified `openAccountDrawer()`.
But the original `openAcctDrawer` (line ~3388) was never removed in v146 —
it overrode the shim and tried to open the now-removed `acctDrawer` DOM
(which had been replaced with a hidden shim div), causing silent failure.

Fix: Removed the duplicate old `openAcctDrawer` and its paired `saveAcct`
function. The shim at line 1777 is now the only definition and correctly
routes Add → openAccountDrawer(null, null) and Edit → openAccountDrawer(id, 'financial').

### v202603.146
**Finance accounts — unified form + double-prefix bug fix:**

Root cause of "Not Found": window.api already prepends /api/v1 to all paths.
saveAcct() was calling api('POST', '/api/v1/import/accounts') →
actual fetch to /api/v1/api/v1/import/accounts → 404.
Fixed: stripped /api/v1 prefix from all 7 calls in the Import module.

Unified account drawer (accountDrawer):
- One form for ALL account types — no more two separate drawers
- Type selector split into Banking group (Checking/Savings/Credit Card/Cash/Loan)
  and Investment group (Brokerage/TSP/Investment other)
- Banking types show: Balance, As of date, Include in Net Worth
- Investment types show: Owner, Track statements?
- saveAccount() routes to the correct table by type:
  Banking → finance_accounts (Transactions tab)
  Investment → financial_accounts (Import tab)
- openAcctDrawer() shim: Import tab + New account still works, calls openAccountDrawer()
- Old saveAcct() removed; acctDrawer replaced with hidden shim
- Institution is a plain text input on both (not GH_SELECT dropdown)
  to keep it consistent and not require dropdown_options maintenance

Still two tables in SQLite — that is correct (different transaction schemas).
The unification is at the UI level only.

### v202603.145
**Smoke test rewrite + 3 free API integrations:**

**smoke-test.sh — fully rewritten:**
Old version was checking status codes only and had multiple bugs:
  - Duplicated assertions, tested non-existent routes (/finance/spending, /property/maintenance)
  - recategorize curl code extraction was broken (appended http_code to body var)
  - Used assert_json_array/object helpers that didn't validate body content

New version:
  - assert_json(): 200 + body starts with { or [
  - assert_array(): 200 + starts with [, shows item count
  - assert_key(): 200 + JSON has a specific required key
  - assert_write(): empty POST → 400/422 (route reachable + validates)
  - Tests 60+ endpoints across all modules
  - Recategorize POST tested end-to-end with real body validation
  - Pages tested: all 16 HTML pages checked for 200
  - CSV exports tested for all modules

**NHTSA VIN Decoder + Recalls (property.html):**
  - "🔍 Decode" button next to VIN field in vehicle drawer
    → calls vpic.nhtsa.dot.gov, fills Year/Make/Model/Trim/Engine/Fuel
  - "⚠ Recalls" button → calls api.nhtsa.gov/recalls
    → shows count + summary of open recalls inline
  - Both free government APIs, no key needed
  - vinFeedback div shows result inline below VIN row

**OpenFDA Drug Lookup (medical.html):**
  - "🔍 Lookup" button in medication name label row
  - Searches openFDA by brand name then generic name
  - Shows: generic name, route, manufacturer inline
  - Free, no key, zero network from NAS (client-side fetch)
  - drugFeedback div shows result under name field

**Open Food Facts UPC fallback (inventory/routes.js):**
  - Fires when UPCitemdb returns null (covers grocery/food items it misses)
  - Gated on app_config api_openfoodfacts_enabled (default '1')
  - Returns: name, brand, category='Food & Beverage', images
  - Source field set to 'open_food_facts' for debugging

### v202603.144
**Bug report fixes — 9 issues from user testing:**

Issue 1 — Finance Import tab Add Account:
  - "Not Found" was a UX confusion: Import Accounts is for brokerage/investment
    (financial_accounts). Checking/savings go via Finance → Accounts tab.
  - Added blue info banner to Import acctDrawer explaining this distinction.
  - Cancel button fixed: closeDrawer() did not exist → wired to classList.remove()

Issue 2 — Settings vs System nav overlap:
  - Renamed "System" nav group → "Admin" to reduce confusion with Reports → System tab.
  - Settings = user config (password, family, tags, dropdowns, backup)
  - Data = data operations (export, import, bank statements)
  - No actual overlap — just confusing label.

Issue 3 — Data → Import Bank Statement link:
  - href="/finance.html#import" now handled: finance.html DOMContentLoaded
    checks window.location.hash === '#import' and clicks the Import tab button.

Issue 4 — Sheet Reference in Data:
  - Description updated to clarify it belongs to the export/import workflow.

Issue 5 — Career shows raw JS code in top-right:
  - Cert name debounce block was appended after </html>. Moved inside final <script>.

Issue 6 — Property.html shows blank page:
  - </style> tag was missing → entire <style> bled into body, hiding all content.
  - Also missing: <body>, nav.js, lt-core.js. All inserted at correct position.

Issue 7 — Kids "Add Child" not obvious:
  - FAB button changed from bare "+" to "+ Add Child" with full label.
  - The Add/Edit child drawer already works correctly (openKidDrawer via mainFab).

Issue 8 — Reports Summary should be first; People gives API error:
  - Tab order: Summary, People, Spending, Health, Net Worth, Annual, Data Quality, System, Tools
  - Testing tab removed (developer-only, not user-facing).
  - People API: window.api('/settings/family') → '/api/v1/settings/family' (missing prefix).
  - activeTab default changed from spending → summary.
  - panel-summary now active by default.

Issue 9 — Reports grouped under Finance in left nav:
  - Reports moved to its own nav group (was under Finance with Trading).
  - Finance group now: Finance, Trading only.
  - New Reports group: Reports only.

### v202603.143
**🔴-C EOB Import — MHBP complete:**

New files:
- app/features/medical/eob-parser.js — fully local MHBP PDF parser
  pdf-parse extracts text → regex pulls all fields → structured data returned
  Handles: single patient/visit, multi-visit, multi-patient (all 3 variants)
  Combined PDFs: splits on "MHBP\nPO BOX" boundary, imports all statements at once
  Dedup: UNIQUE(statement_date, member_id) — safe to re-upload
- app/db/migrations/054-057 — 4 new tables (statements, claims, services, balances)

Updated files:
- app/features/medical/routes.js — EOB routes appended:
    POST /api/v1/medical/eob/preview  (parse + dedup check, no DB write)
    POST /api/v1/medical/eob/import   (write selected statements to 4 tables)
    GET  /api/v1/medical/eob          (list all statements with claim counts)
    GET  /api/v1/medical/eob/:id      (full detail with claims + services + balances)
    DELETE /api/v1/medical/eob/:id    (cascades to claims/services/balances)
- app/public/medical.html — new "EOB" tab:
    Browse/drag PDF → auto-preview → check rows → Import Selected
    Preview shows: date, patients, claim count, plan paid, your share, already-imported flag
    History list of all imported statements with totals
    Detail view (alert-based for now, full views planned separately)

Requires docker compose --build (pdf-parse added to package.json).
After build, restart with: docker compose up --build -d

**🔴-A ✅  🔴-B ✅  🔴-C ✅ — all three priority sessions complete.**
Next: Integrations Settings panel + NHTSA/OpenFDA small builds (🟢 backlog).

### v202603.142
**🔴-B Auto-categorization — all 3 parts complete:**

**Part 1 — Migration 059 (expanded rules, ~113 entries total with 046):**
Added DFAS/federal income, Sam's Club, Trader Joe's, regional grocers,
30+ dining chains (Panera, Moe's, Domino's, Whataburger, etc.),
gas stations (Marathon, Circle K, Pilot, Valero, etc.), Alabama Power/Alagasco/Spire,
Xfinity/Spectrum, streaming (Disney+, HBO, YouTube), airlines/hotels for Travel,
AETNA/BCBS → Healthcare, IRS → Taxes, Home Depot/Lowe's → Shopping.

**Part 2 — applyCategoryRules() shared function in finance/routes.js:**
Extracted from /import/confirm logic. Used by both import-file and recategorize.
Pattern: LIKE syntax → regex, first match wins (sort_order).
import-file endpoint now auto-categorizes every transaction on import.

**Part 3 — Re-categorize button in Transactions tab (🏷 Auto-tag):**
POST /api/v1/finance/transactions/recategorize
Default: applies rules only where category IS NULL or empty (safe).
overwrite:true applies to all rows.
Returns {ok, updated, total}. Reloads transaction list on any updates.
Button shows ⏳ Running… during execution, restores on complete.

**🔴-A Cancel buttons confirmed complete** — all drawers audited v202603.141.
**🔴-B Auto-categorization complete** — this version.
**Next: 🔴-C EOB Import (MHBP)** — see Section 16 of HANDOFF.md for full spec.

### v202603.141
**Integration config migration 058:**
Seeds api_upcitemdb_key, api_openfoodfacts_enabled, api_nhtsa_enabled,
api_openfda_enabled, api_openmeteo_enabled/lat/lon/units into app_config.
Zero-risk additive migration. Enables Integrations Settings panel to be
built without any DB changes needed.

**Cancel buttons — 3 drawers fixed:**
- property.html #svcDrawer (maintenance record): was full-width "Add Record" only
  → now Cancel + Save Record side by side
- finance.html #txDrawer (transaction): was Save + Delete only → added Cancel first
- finance.html #budgetDrawer (budget): was Save + Delete only → added Cancel first

Full cancel button pass confirmed: career (certDrawer, jobDrawer ✓),
todos, medical, property, books, documents, kids, resources all already have Cancel.
finance acctDrawer already has Cancel. Only the 3 above were missing.

### v202603.140
**Finance Import tab — clarification banners:**

Import tab Upload panel: blue banner at top explaining this tab is for
investment/brokerage accounts (Schwab brokerage, Vanguard, TSP). Includes
clickable link to switch to Transactions tab → CSV drawer for checking/savings.

CSV drawer: header updated to "For checking, savings & credit cards" with note
that transactions appear in Transactions tab under selected account.

Added switchFinanceTab() helper for cross-tab navigation links.

**EOB import design (backlog — new session):**

Aetna email = notification only. No data in email. EOB PDF downloaded from
aetna.com member portal manually, then uploaded to Ghrava.

Architecture:
- pdf-parse (free, local, already common in Node stacks) extracts PDF text
- Claude API (claude-sonnet-4) extracts structured data from text
- Cost: ~$0.01-0.02/EOB = ~$0.15-0.30/year. Negligible.
- New med_claims table needed: patient, date_of_service, provider, service_type,
  billed, plan_discount, plan_paid, your_responsibility, deductible_applied,
  claim_number, deductible_ytd, oop_ytd, insurer, raw_text, source_filename
- Upload button in Medical module
- BCBS dental: same approach, separate insurer field, same table
- Build after cancel buttons + auto-categorization sessions

### v202603.139
**Finance — three more fixes:**

1. Import fails: CHECK constraint failed on txn_type
   Root cause: parseSchawbChecking was returning raw Schwab type values (ACH, ATM, Check,
   Transfer etc.) which fail imported_transactions.txn_type CHECK constraint.
   Fix: classifySchawbCheckingType() maps raw values → valid types:
     transfer/journal/wire → transfer
     payment/autopay/bill pay → payment  
     fee/service charge → fee
     interest → interest
     dividend → dividend
     deposit/credit/direct dep → deposit
     withdrawal/atm/check → withdrawal
     everything else → transaction (safe default)

2. Account type still showing ${t}:
   The broken template literal saved ${t} as the actual type value in finance_accounts.
   Migration 053 cleans this: UPDATE finance_accounts SET type='Checking' WHERE type='${t}'.
   Runs automatically on container restart.

3. Account type dropdown — static options now correctly include the types that
   match what finance_accounts.type stores: Checking, Savings, Credit Card,
   Investment, Loan, Cash, Other.

### v202603.138
**Finance — three fixes:**

1. Account type dropdown (accType) showing literal "${t}":
   The <select> had ${ACCT_TYPES.map(t=>`<option>${t}</option>`).join('')} as static
   HTML text — template literals don't execute in plain HTML. Replaced with static
   <option> elements: Checking, Savings, Credit Card, Investment, Loan, Cash, Other.

2. Add Account drawer missing Cancel:
   Cancel button added before Save in accountDrawer footer.

3. Schwab CSV "No valid rows found" — headers now match:
   Real Schwab export headers: Date,Status,Type,CheckNumber,Description,Withdrawal,Deposit,RunningBalance
   Parser previously required: Check #, Withdrawal (-), Deposit (+)
   
   detectFormat: now matches on withdrawal+deposit+runningbalance without requiring "check #"
   parseSchawbChecking: handles CheckNumber vs Check #, Withdrawal vs Withdrawal (-),
   Deposit vs Deposit (+), and Status column (used as type fallback).
   Check numbers now appended to description: "Starbucks (Check 1234)".

### v202603.137
**Finance CSV import — two table mismatch fixed:**

Root cause: Two completely separate account/transaction systems exist:
- finance_accounts + finance_transactions → Transactions tab (manual entry)
- financial_accounts + imported_transactions → Import tab (bank statement imports)

Previous fix incorrectly routed the CSV drawer to /api/v1/import/confirm which writes
to imported_transactions using financial_accounts IDs. But the user's account was in
finance_accounts, so "Account not found" was returned.

Fix:
1. New endpoint: POST /api/v1/finance/transactions/import-file (finance/routes.js)
   - Accepts multipart file upload
   - Uses the same parsers.js as the Import tab (Schwab, Chase, Navy Fed, USAA, etc.)
   - Writes to finance_transactions with finance_accounts IDs
   - Returns {ok, imported, total, format}

2. CSV drawer account dropdown: loads from /finance/accounts (correct table) via fresh
   API call — no longer copies from txAccFilter which may not be populated yet.
   This also fixes the "${t}" showing in the dropdown (was copying un-rendered text).

3. previewCsv: uses /api/v1/import/preview without account_id — just for format
   detection and row preview display, no table lookup needed.

4. importCsv: uses new /finance/transactions/import-file endpoint.

Flow: Select account → Browse Schwab CSV → Preview (shows format + rows) → Import
→ transactions appear in Transactions tab under selected account.

### v202603.135
**Finance CSV import — file browse + drag-drop:**

Previous: paste-only textarea with cryptic format hint.
Now:
- "Browse" button + dashed drop zone → click to pick file OR drag .csv onto it
- File name shown after selection
- File content auto-loaded into textarea + auto-Preview fires
- Paste textarea still available as fallback
- Supported institutions listed at top: Chase · Schwab · Navy Fed · USAA · Wells Fargo · Capital One · Vanguard · TSP · BofA
- Schwab CSV already fully supported (schwab_checking + schwab_brokerage parsers)
  From Schwab: Accounts → History → Export → CSV

**Schwab CSV format (for reference):**
- Checking: Date, Type, Check #, Description, Withdrawal (-), Deposit (+), RunningBalance
- Brokerage: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount
Both auto-detected by detectFormat() in parsers.js — no manual selection needed.

**Settings fix (v202603.134):**
- Password change fields wrapped in <form> to silence Bitwarden autofill warning

### v202603.133
**Inventory fixes:**

Pin emoji garbled in grid view — fixed.
Raw bytes replacement in previous session double-encoded the UTF-8 emoji (Ã°Â... garbage).
All location icons now use HTML entity &#x1F4CD; consistently in both list and grid cards.

Location in detail view now on its own line (not truncated inline with ITM# and category).

**Button/icon sizing:**
- .btn base: padding 10px→11px/20px, min-height 44px added (proper touch target)
- .btn-ghost: border 1px→1.5px, stronger color, hover highlights accent border
- .btn-danger: border 1px→1.5px, heavier font-weight, more visible hover
- .det-icon-btn (detail header): 34px→40px, filled bg (var(--bg3)), heavier border
- det-icon-btn SVGs: 15px→18px
- × close button: 17px→20px font
- Card edit buttons (.ai-card-edit-btn, .ai-list-edit-btn): 30px→36px circles
  Now slightly visible at 0.15 opacity always (not invisible until hover)
- Card edit SVGs: 13px→15px

Stray backtick removed from detail header location line (caused syntax error).

### v202603.132
**Inventory detail view redesign (rebuilt after file truncation incident):**
- Thumbnail (52×52): primary photo (click to zoom) or category emoji — no edit badge
- Meta line: ITM# | Category | 📍 Location — one line, location truncates with ellipsis
- Badges (condition/archived/insured) below meta
- Icon row: QR · Archive/Unarchive · Edit · × — all det-icon-btn (34×34, consistent)
- Bottom: "Mark as Sold" only — Close/Archive moved to header

Grid cards: pencil edit button (30px circle, accent) appears on hover bottom-right
List cards: same edit button appears on hover at right end
Item edit drawer: Save button now has floppy disk icon + "Save" text

**Tag suggestion wiring — Session 2 (all 10 remaining pages):**
- todos: fCategory + fTitle → triggerTodoSuggest
- books: bkGenre + bkTitle → triggerBookSuggest
- documents: dCat + dTitle → triggerDocSuggest
- resources: fCategory + fName → triggerResSuggest
- daily-log: dlCat + dlTitle → triggerDlSuggest
- career: certStatus/certName → triggerCertSuggest; jobType/jobTitle → triggerJobSuggest
- medical: mStatus/mName → triggerMedSuggest; vType/vPatient → triggerVisitSuggest
- property: pType/pNick → triggerPropSuggest; vMake/vNick → triggerVehSuggest
- kids: afCategory/afName → triggerActSuggest
All pages: drawer-open fires suggest after 100ms; category change fires suggest immediately

**File truncation fix:** inventory.html was truncated to 88KB during grid card template
rewrite (page.map end position computed wrong). Restored from git HEAD (172KB).
Reapplied all changes using surgical str_replace and raw-bytes replace only.
Rule going forward: never use c[:start] + new + c[end:] on JS template literal blocks.

### v202603.131
**Inventory detail view + card edit access redesign:**

Detail header:
- Thumbnail: photo or category emoji — no edit badge overlay (removed)
- Meta line: ITM# | Category (colored) | 📍 Location — all one line, location truncates with ellipsis
- Badges (condition/archived/insured) on third line
- Icon row: 4 buttons all 34×34 (.det-icon-btn class), consistent border/hover
  - QR · Archive/Unarchive · Edit · ×

Grid cards:
- Edit pencil button (30×30 circle, accent color) appears on hover in bottom-right corner
- Uses event.stopPropagation() so card click still opens detail
- CSS: .ai-card-edit-btn opacity:0 → 1 on .ai-card:hover

List cards:
- Same edit button (.ai-list-edit-btn) appears on hover at right end of row

Item edit drawer:
- Save button now has floppy disk icon + "Save" text

### v202603.130
**Inventory detail view header redesigned:**

Layout: [thumbnail] [title + ITM# | Category | Location] [× QR Archive Edit]

Thumbnail (52×52, rounded):
- Shows primary photo if item has photos — click to zoom
- Falls back to category emoji in category color background if no photo
- Small blue edit pencil badge overlaid bottom-right corner in both cases — tap to open edit drawer directly

Title block (one line each):
- Line 1: Item name (17px bold)
- Line 2: ITM-XXXX | Category (colored) | 📍 Location path — all inline, no labels
- Line 3: Condition / Archived / Insured badges if present

Action icon row (right, 4 buttons 32×32):
- QR code icon → openQR
- Archive box icon → openArchive (or unarchive arrow when archived)
- Edit pencil → editItem
- × close → closes detail drawer

Bottom button row: kept "Mark as Sold" only — Close/Archive/Edit moved to header

Backlog added: Image rotation — EXIF-aware rotate for inventory photos
(needs server-side sharp rotate + re-thumbnail, medium effort)

### v202603.129
**Tag dropdown fixes + starter library:**

Bug fixes (lt-core.js):
- openDropdown silently returned when allTags was empty AND typed text was empty
  → now always renders the dropdown; shows "Type a name to create a tag" hint when empty
- This was why nothing appeared on focus with a clean DB — both conditions true simultaneously

Migration 052 — 59 starter tags across all modules:
- Inventory: high-value, fragile, seasonal-use, needs-repair, loaned-out, in-storage,
  set-item, collectible, battery-powered, wifi-connected, gift-received, duplicate
- Finance/Docs: receipt-saved, reimbursable, tax-deductible, under-review,
  recurring-charge, disputed, paid-off, hsa-eligible, needs-filing
- Medical: chronic, hereditary, pediatric, follow-up-needed, pre-existing,
  rx-required, covered-by-insurance, out-of-pocket
- Property: urgent-repair, cosmetic-only, diy-ok, needs-contractor, under-warranty, permit-required
- Todos/Log: waiting-on-someone, blocked, quick-win, research-needed, delegate
- Career: federal, renewal-required, continuing-ed, remote-ok, leadership-role
- Kids: competition, school-required, summer-program, team-activity, individual-activity
- Books: recommended, re-read, work-reading, audiobook-preferred
- Resources: requires-login, federal-benefit, student-benefit, bookmark-later, free-resource
- No overlap with any existing dropdown_options values (verified against full list)
- Each tag has a meaningful color_hex from the 10-color palette

### v202603.128
**Tag system redesign — Session 1 (shared infrastructure + inventory pilot):**

Migration 051 — clean slate:
- DELETE FROM taggables; DELETE FROM tags;
- Strips all 225 test/seed tags. Users build their own tags organically.

shared.css — new tag field visual:
- .tags-input-wrap: border-radius 4px (squared off), min-height 44px (bigger target)
- Focus ring: accent border + subtle box-shadow
- .tag-chip: full pill (border-radius 99px), colored per tag color_hex
- .tag-chip-suggested: dashed border, opacity 0.65, click to confirm, × to dismiss
- .gh-tags-dropdown: floating overlay (position:absolute, z-index:9000), max 200px, wrapping pills
- .gh-tags-pill: clickable pill inside dropdown with hover scale effect
- No # prefix anywhere

lt-core.js — GH_TAGS fully rewritten:
- PALETTE: 10 colors cycled for new tags (blue, green, amber, red, purple, pink, cyan, orange, lime, teal)
- fetchAllTags: returns [{name, color_hex, usage_count}], 60s cache
- chipStyle(name): derives bg/border/color from stored color_hex with alpha
- openDropdown: floating div appended to .tags-input-wrap, filters as user types
- makeChip: confirmed pill with colored × remove
- makeSuggestedChip: dashed suggestion pill, click confirms, × dismisses (never re-suggested this session)
- fetchSuggestions: GET /api/v1/settings/tags/suggest with module+entityType+category+name
- GH_TAGS.suggest(wrapId, getFormTags, addTag, {category, name}): external call to refresh suggestions
- GH_TAGS.renderChips(wrapId, tags, onRemove): replaces per-page renderXxxTags boilerplate
- Keyboard: Enter/comma adds, Backspace removes last, Escape closes dropdown
- No # prefix in input or output

settings/routes.js — GET /api/v1/settings/tags/suggest:
- Co-occurrence: finds tags most used by other records with same category (per-module SQL)
- Keyword fallback: name words matched against existing tag names
- Returns top 5, deduped, excludes already-selected
- 13 modules mapped (inventory, books, career, medical, todos, property, documents, resources, kids, dailylog, finance)

inventory.html — pilot wiring:
- renderItmTags → GH_TAGS.renderChips
- addItmTag strips # prefix
- GH_TAGS.init adds entityType + getContext
- onCatChange fires triggerItmSuggest
- itm_name field fires triggerItmSuggest after 600ms debounce
- Drawer open fires triggerItmSuggest after 100ms (edit mode suggestions)
- Placeholder changed to "Tags"

Session 2: wire suggest triggers into remaining 10 pages (todos, career, medical, property, books, documents, kids, resources, daily-log, finance)

### v202603.127
**Module Inventory Report — live, zero maintenance:**

New endpoint: GET /api/v1/app/module-inventory
- 13 modules covered: Inventory, Medical, Finance, To Do, Daily Log, Books, Career, Property, Documents, Resources, Kids, Contacts/Family, System/Shared
- Each module returns: live record counts from DB, tables it owns, key metrics (active vs total, last 30d additions, tagged records, etc.)
- ~80 individual SQL queries, all wrapped in try/catch — one failing table never breaks the response
- Cross-module totals: total modules, total tables tracked, generated_at timestamp
- No config, no code updates needed when data changes — all derived from DB at request time

Reports → System tab updated:
- Calls module-inventory endpoint alongside app/info
- Renders a 4-column table (count | metric | count | metric) grouped by module
- Shows module label + owned tables as section header
- "Live · {timestamp}" label so it's clear the data is real-time

Backlog updated: Module Inventory Report item updated to reflect DONE status.
 changes do NOT get their own zip.


### v202603.126
**GH_VIEW Advanced Filters — all remaining modules wired:**
- kids.html: Activities and Notes tabs get filter toolbar (category + tags); search wired in _medBoot equivalent; toolbar shown/hidden in setDetailTab
- medical.html: medSearch event was declared in HTML but never attached in JS — fixed in _medBoot; GH_VIEW init with status + tags filters

**Finance — transactions search bar:**
- Search input added below account/year filters
- Client-side filter on description + category — no new API call
- Wired to loadTransactions via input event on tab switch

**Finance — holdings api() fixed:**
- `api(url)` single-arg call → `api('GET', url)` — was returning undefined

**CSS — var(--surface2) fixed:**
- Not a defined CSS variable; replaced with var(--bg3) in finance.html and career.html

### v202603.125
**GH_VIEW Advanced Filters added to todos, career, medical, property:**

todos.html:
- Toolbar between search and list; filters: Priority (urgent/high/medium/low), Category, Tags
- Applied inside render() to displayTodos

career.html:
- Toolbar below search bar; filters: Status (Active/In Progress/Expired/Completed), Tags
- Applied in loadCerts; consolidated search+filter reload into _reloadCurrentTab()

medical.html:
- medSearch event was wired in HTML but never attached in JS — now wired in _medBoot()
- Toolbar below search; filters: Status (Active/As Needed/Discontinued/Completed), Tags
- Applied in renderMedications with _medFilters

property.html:
- Toolbar below search; filters: Property Type, Tags
- Search reload consolidated into _reloadPropTab()

**Inventory dropdown bug fix (v202603.123):**
- loadWhereLists and populateCtnParent both used .ok/.json() on api() results
- Both fixed — containers/rooms now populate in Add Item drawer

### v202603.124
**All forms converted to centered modals with fixed footer (zero per-page changes):**

Problem: drawers slid from bottom, sticky Save/Cancel buttons overlapped form fields while scrolling.

Fix — two files only:

shared.css — drawer layout rewritten:
- `.drawer-overlay`: `align-items: flex-end` → `align-items: center` (vertical centering)
- `.drawer`: was single overflow-y:auto block → now `display:flex; flex-direction:column; overflow:hidden`
  - Max width 540px (was 680px), `border-radius: var(--r-xl)` all corners, centered modal shadow
- New `.drawer-header`: fixed top (handle + title) — never scrolls
- New `.drawer-body`: `flex:1; overflow-y:auto` — only the form fields scroll
- New `.drawer-foot`: `flex-shrink:0; border-top` — Save/Cancel/Delete always visible at bottom, never overlaps content
- Entry animation: fade+scale (was slide-up from bottom)

lt-core.js — `initDrawerStickyFooter` replaced with `structureDrawer`:
- MutationObserver watches every `.drawer-overlay` for class "open"
- On first open, auto-restructures the drawer DOM into header/body/foot without per-page changes
- Detects footer by: has direct `.btn` children AND no form fields inside
- Handles all three existing button row patterns: `.btn-row`, `.drawer-footer`, `<div style="display:flex;gap:8px">`
- `drawer.dataset.structured = "1"` guard prevents double-restructuring
- Works for dynamically injected drawers too (inner MutationObserver)

### v202603.123
**Root cause fix — inventory Add Item dropdown empty (containers/rooms):**
`loadWhereLists()` called `locR.ok` and `await locR.json()` on the result of `api()`,
which returns parsed JSON not a Response object. So `locR.ok` was always falsy and
`_whereLocs`/`_whereCtns` were always set to []. Fix: destructure directly to `locs`/`ctns`.
Same bug in `populateCtnParent()` — fixed there too.

**Systematic api() audit — all remaining broken patterns found and categorised:**
- inventory: `populateCtnParent` — `.json()` on api() result → fixed
- daily-log: `markFollowupDone` — `r.ok` check on api() result → removed
- medical: `silentGet` — legitimate raw fetch helper, not a bug
- inventory lines 2454/2480: photo upload raw fetch — legitimate (FormData)
- reports: local `api()` wrapper for /finance/reports — intentional single-arg, not a bug
- reports/settings `.then(r=>r.json())` — on raw `fetch()` chains, not api() — not a bug
- finance line 2819: CSV import raw fetch — legitimate

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
