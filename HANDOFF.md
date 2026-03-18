# Ghrava — Project Handoff & System Reference
**Last updated:** v202603.051
**Purpose:** Complete context for continuing development in a new chat session.
Read this file before writing any code.

---

## 0. What changed in v202603.047

### Auth gate removed (047)
- `initAuthGate` IIFE removed entirely from lt-core.js — pages now always load freely with no password overlay ever blocking them
- All reads were already public; writes go through `api()` which already shows `_reAuthPrompt` on 401
- Session lifetime is 365 days (set in v045), so after one login the browser stays authenticated for a year
- The `_reAuthPrompt` function is still present for when a write hits 401 (e.g. browser storage cleared)
- To set or change the password: Settings → Change Password



### Backup reliability fix (046)
- `doBackup()` in backup/routes.js switched from `fs.copyFileSync` to `db.backup(dest)` — better-sqlite3's SQLite Online Backup API
- Raw file copy could miss pages in SQLite's internal page cache that hadn't flushed to disk at the moment of the copy. The Online Backup API goes through SQLite itself, guaranteeing every committed row is in the snapshot.
- `POST /api/v1/backup/now` route made `async` to properly await the backup
- Startup auto-backup in server.js retains `fs.copyFileSync` (safe there because it runs before the DB module loads and before any requests, so no concurrent writes)



### Auth + data safety (045)
- **Global 401 interceptor** added in lt-core.js — monkey-patches `window.fetch` so every 401 from any `/api/v1/` call (including raw `fetch()` calls in individual pages) automatically shows the re-auth password overlay. No more silent failures or generic error toasts when a session expires.
- **Session lifetime extended to 365 days** in auth/middleware.js (was 30 days). On a home network you should never need to re-enter the password unless you explicitly log out or clear browser storage.
- **Startup auto-backup** added in server.js — runs before migrations on every container start. Copies the DB to `/app/backups/auto_YYYYMMDD_HHmm.db` (NAS-mapped volume). Keeps the 30 most recent snapshots, pruning older ones automatically. This means a bad deploy or accidental `--build` can never cause permanent data loss — the pre-deploy DB is always preserved.

### Image thumbnail fix (044)
- `GET /api/v1/attachments/:entityType/:entityId` (list) and `GET /count/...` moved before `router.use(requireAuth)` — both were behind the auth wall, causing silent 401s in inventory attachment drawers and card thumbnails.

---

## 0. What changed in v202603.042

**Bug fixes on top of v202603.041 contacts overhaul:**
- `escHtml` function declaration restored in index.html (syntax error was breaking dashboard)
- `med_physicians` references removed from dashboard and backup routes
- Medical summary query updated to use `contact_id` not `physician_id`
- Contact drawer z-index raised to 500 so it appears above the sub-panel (was 300, panel is 400)
- `GH_SELECT` moved to module level in lt-core.js (was accidentally inside `initAuthGate` closure)
- Stale `medical_provider` contact type strings updated to `Medical` in finance and inventory
- `mobile-web-app-capable` meta tag added to all 13 pages
- All diagnostic tests passing ✅
- All Playwright smoke tests passing ✅

---

- `med_physicians` table dropped. Physicians are now contacts with type `Medical`.
- All six extension tables (`contacts_medical`, `contacts_home_service`, etc.) dropped. Contacts is now a single flat table with all fields — UI shows/hides by type.
- Contact types: Medical, Contractor, Financial, Employer, School, Vendor, General, Other.
- Universal `specialty` field on all contacts — "Cardiology" for doctors, "Plumbing" for contractors. Managed dropdown (`contact_specialty`) with 50+ seeded values, inline-add via GH_SELECT.
- `google_contact_id` column reserved for future Google Contacts sync.
- `lt-refs.js` — new shared utility. `GH_REFS.populateFamily()` and `GH_REFS.populateContact()` wire family/contact dropdowns on any page. Inline-add opens Settings iframe overlay, postMessages back on save.
- `med_visit_notes` now links to `contacts.id` via `contact_id` (was `physician_id` → `med_physicians`).
- `med_medications` and `med_conditions` now have `physician_contact_id` (links to contacts).
- `property_maintenance` has new `vendor_contact_id` column.
- `items` has new `warranty_vendor_contact_id` column.
- medical.html: Doctors tab removed. Physician fields on all three drawers now use contact selects filtered to Medical type.
- documents.html, finance.html, property.html, inventory.html: all ref fields wired via GH_REFS.
- Settings contacts drawer: rebuilt for flat model, dynamic field groups by type, Specialty via GH_SELECT.
- Migration: 041_flatten_contacts.sql

**Next session should start with:** Playwright smoke tests, then in-app diagnostic test updates.

---

## 1. What Is Ghrava

Self-hosted household management app running as a Docker container on a QNAP NAS.
- **Host:** 192.168.4.62:3001, container name: `ghrava`
- **Stack:** Node.js/Express backend, SQLite via better-sqlite3, vanilla JS frontend
- **Deploy:** `docker restart ghrava` for code changes. `--build` only when `package.json` changes.
- **Deploy zip:** always named `Ghrava_DEPLOY.zip` — present at end of every session without being asked
- **Version:** single source of truth in `app/version.txt` (format: YYMMM.NNN)
- **Current version:** 202603.011

---

## 2. Repository Layout

```
ghrava_clean/
├── app/
│   ├── features/          # One folder per module, each has routes.js
│   │   ├── auth/          # Single-password session auth
│   │   ├── backup/        # DB file download
│   │   ├── books/         # Reading list
│   │   ├── career/        # Certs, jobs, skills, goals
│   │   ├── dailylog/      # Personal daily log entries
│   │   ├── dashboard/     # Aggregated home screen data (read-only)
│   │   ├── documents/     # Document vault
│   │   ├── finance/       # Accounts, transactions, net worth
│   │   ├── hsa/           # HSA expense tracking
│   │   ├── import/        # Financial statement import
│   │   ├── inventory/     # Household items (1020+ lines, most complex module)
│   │   ├── kids/          # Per-child profiles, activities, notes
│   │   ├── medical/       # Physicians, medications, conditions, visits
│   │   ├── notifications/ # In-app notification feed
│   │   ├── property/      # Properties + vehicles + maintenance/service
│   │   ├── resources/     # Links, bookmarks, reference items
│   │   ├── settings/      # Tags, family, contacts, dropdowns, config, diagnostics
│   │   └── todos/         # Manual + auto-generated todos
│   ├── shared/
│   │   ├── tags.js        # Central tag utility — ALL modules must use this
│   │   └── errors.js      # badRequest / notFound / serverError helpers
│   ├── db/
│   │   ├── db.js          # better-sqlite3 singleton
│   │   └── migrations/    # Numbered SQL files, run in order on startup
│   │       ├── UPGRADE_NOTES.md          # Field mappings when schema changes
│   │       └── 037_migrate_document_tags.sql  # Rescues freetext tags → taggables
│   └── public/
│       ├── *.html         # One file per module page
│       ├── nav.js         # Left nav, page header, drawer scaffolding
│       └── js/
│           ├── lt-core.js       # Shared: window.api, GH_TAGS, GH_SELECT, GH_EMPTY, toast
│           ├── lt-messages.js   # Toast + confirm dialog implementation
│           └── lt-shared-data.js # Static lookup data (icons, colours)
├── WIRING.md              # Architecture decisions, canonical entity types, patterns
├── HANDOFF.md             # This file — read first in every new session
├── ghrava_test.ps1        # PowerShell test suite
└── ghrava_deploy.ps1      # Deploy script
```

---

## 3. Module Status

| Module | Status | Tags BE | Tags FE | Dropdowns | Notes |
|--------|--------|---------|---------|-----------|-------|
| Dashboard | ✓ Solid | N/A | N/A | N/A | Read-only aggregation |
| Inventory | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | HW subcategory wired |
| Finance | ✓ Solid | ✗ deferred | ✗ deferred | partial | Tags deferred — decision needed |
| HSA | ✓ Solid | ✗ deferred | ✗ deferred | ✓ GH_SELECT | Sub-module of Finance |
| Medical | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | Physician type via GH_SELECT |
| Todos | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | Auto-todos sync on every GET |
| Daily Log | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | Follow-up flags feed dashboard |
| Kids | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | Per-child tabs, activities + notes |
| Career | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | Cert expiry auto-creates Todo |
| Property | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | Properties + vehicles + logs |
| Books | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | Genre now select + GH_SELECT |
| Documents | ✓ Solid | ✓ | ✓ | ✓ GH_SELECT | Category + subcategory via GH_SELECT |
| Resources | ✓ Solid | ✓ | ✓ | partial | Source field not yet added |
| Settings | ✓ Solid | N/A | N/A | manages them | Dropdowns, family, contacts, diagnostics |

---

## 4. Core Architecture Patterns

### Database rules — non-negotiable
- **NO ON DELETE CASCADE anywhere, ever.** Data is interconnected. Use `ON DELETE SET NULL` or no action. Cascades silently wipe data across tables.
- **journal_mode = DELETE, synchronous = FULL** — immediate commits, no WAL buffer. Never switch back to WAL. Data must be on disk the moment it's saved.
- **No bulk DELETEs on real data** — diagnostic purge only touches rows with `_diag_` prefix. All other deletes are single-record by ID.
- **Before any migration that uses DROP TABLE or DELETE FROM on a table with real data** — ask Al to take a manual backup first.

### Auth
- Single password, sessions in SQLite `_sessions` table (30-day expiry, survives restart)
- `requireAuth` used **only on writes** — reads are always public
- Exception: Finance/HSA reads are intentionally locked (financial data)
- **Rule:** all GET routes declared **before** `router.use(requireAuth)` in every route file
- `window.api()` sends `Authorization: Bearer <token>` — public routes ignore absent tokens

### Tags System
- **Tables:** `tags` (id, name, color_hex) + `taggables` (tag_id, entity_type, entity_id)
- **Shared utility:** `app/shared/tags.js` — import this, never write raw taggables SQL
- **Functions:**
  - `saveTagsByName(entityId, entityType, names[])` — replaces all tags for an entity
  - `getTagNames(entityId, entityType)` → string[]
  - `withTagNames(record, entityType)` → record with `tags: string[]` added
  - `clearTags(entityId, entityType)` — call before delete/archive
- **Canonical entity_type strings** (WIRING.md has the full registry):
  `item`, `daily_log`, `resource`, `document`, `todo`, `book`,
  `career_cert`, `career_job`, `career_skill`, `kid_activity`, `kid_note`,
  `property`, `vehicle`, `medical_visit`, `medical_medication`
- **Frontend:** `GH_TAGS` in lt-core.js — pill input with autocomplete, Enter/comma to add

### GH_SELECT — Inline Dropdown Add
- **Location:** `window.GH_SELECT` in `app/public/js/lt-core.js`
- **Purpose:** Wraps any `<select>` backed by `dropdown_options`. Populates from the API
  and appends a "＋ Add new…" option. Selecting it opens an inline popup to add a value,
  which POSTs to `/api/v1/settings/dropdowns` (requires auth) and refreshes the select.
- **Usage:**
  ```js
  await GH_SELECT.init('selectId', 'list_key', currentValue, { allowAdd: true });
  await GH_SELECT.init('dSubcat', 'document_subcategory', '', { allowAdd: true, placeholder: '— none —' });
  ```
- **Wired in 9 pages:** documents, todos, daily-log, career, kids, property, medical,
  books (genre), inventory (category + hw_subcategory)
- **Not yet wired:** finance/HSA expense category (deferred with tags decision)

### Dropdown Options
- **Table:** `dropdown_options` (list_key, label, value, sort_order, is_active, is_system)
- **Backend:** `GET /api/v1/settings/dropdowns/:listKey` — public, no auth required
- **Seeded list_keys** (migration 036): document_category, document_subcategory,
  career_goal_category, career_skill_category, career_job_type,
  kids_activity_category, kids_note_category, property_type,
  property_maintenance_category, vehicle_service_type,
  medical_visit_type, medical_physician_type, book_genre
- **Previously seeded** (earlier migrations): inventory_category, hw_subcategory,
  contact_type, item_condition, purchase_method, dailylog_category,
  todo_category, hsa_category
- **Static enumerations** (hardcoded HTML — user would never add values):
  `bkStatus`, `bkFormat`, `certStatus`, `goalStatus`, `mStatus` (medication),
  `cStatus` (condition), `fPaymentType`, `loc_type`, `acctType`, `maint_type`

### Frontend Rules
- Every page has `const $ = id => document.getElementById(id)` and `const esc = ...` defined **locally**
  (not just from lt-core — timing issue on load causes silent failures if lt-core hasn't run yet)
- Drawers start **empty** in HTML — load function sets `spinnerHtml()` then replaces with data
- No baked-in spinners in HTML tab panels
- `emptyState(...GH_EMPTY.module)` for empty lists; `errorState(msg, retryFn)` for errors
- `window.api(method, path, body)` — prepends `/api/v1`, sends auth header, throws on 4xx/5xx
- Drawer open functions that call `GH_SELECT.init()` or `loadXxxDropdowns()` **must be async**

---

## 5. Active Backlog (priority order)

### High — unbuilt features
1. **Auth prompt on 401 everywhere** — lt-core.js already has `_reAuthPrompt()` which fires on 401
   via the shared `api()` wrapper. The gap is pages/modules that use raw `fetch()` directly instead
   of `api()` — these silently fail or show a generic toast instead of prompting for password.
   Fix: audit every `fetch('/api/v1/...')` call that is NOT going through `api()`/`apiPost()` etc.
   and either replace with the shared wrapper or add a 401 check that calls `reAuthPrompt()`.
   Affected areas to check: property.html (uses its own `api()` local function), inventory.html,
   finance.html, any module with inline fetch calls.

2. **Deploy zip — fix packaging** — zip currently creates `ghrava/` at root level instead of files
   at root. Fix: `cd /home/claude/ghrava_fixed && zip -r Ghrava_DEPLOY.zip ghrava/ --exclude ...`
   is wrong. Correct pattern: `cd /home/claude/ghrava_fixed/ghrava && zip -r ../Ghrava_DEPLOY.zip *`
   (using `*` not `.` to avoid the leading `./` and ensure flat structure). Verify with
   `unzip -l Ghrava_DEPLOY.zip | head -5` — first entry should be `app/` not `ghrava/app/`.

3. **Finance/HSA tags** — decide whether finance_transaction and gift_card need tags
   If yes: wire `saveTagsByName` in finance/routes.js and hsa/routes.js, add GH_TAGS to drawers

4. **Global tag search** — `GET /api/v1/tags/:name/search`
   Returns all taggables grouped by entity_type with display titles.
   Each module needs a registered "title query" — SQL returning `{id, title}` per entity.
   Frontend: `GH_TAG_SEARCH` panel triggered by clicking any tag chip anywhere.
   Architecture: clicking a tag in a module shows records for that module only;
   clicking a tag in Reports/Dashboard shows all modules.

5. **Resources → Source field** — add `source TEXT` column (migration needed)
   Simple `ALTER TABLE resources ADD COLUMN source TEXT`

### Medium
6. **Kids profiles — add Arnav and Risha** — data entry task, app is ready

7. **Medical patient filter bar** — persistent Arnav/Risha/Self/All tab at top of Medical page
   Currently filter is per-drawer; a persistent patient context would improve UX

8. **Property maintenance records UI** — backend done (migration 035), UI not built

9. **Documents file upload** — wire attachment_id to NAS filesystem storage path

10. **⚠ REVIEW: Module tab filters not working correctly** — tabs at top of each module
    (e.g. Inventory room tabs, Books format tabs like Audible/Physical/Kindle, Medical view tabs)
    should filter and display ONLY the data relevant to that tab. Currently many tabs highlight
    but show all data or show the wrong level (e.g. inventory room tabs showed full location tree
    instead of drilling into the selected room). Inventory room tab fix deployed in v202603.043.
    Need to audit every module's tab bar and verify each tab genuinely filters its content:
    - Inventory: room tabs ✓ fixed, category chips — verify
    - Books: format tabs (All/Physical/Kindle/Audible) — verify
    - Medical: Medications/Conditions/Visits/Summary tabs — verify
    - Finance: HSA/Accounts/Transactions tabs — verify
    - Documents: category tabs — verify
    - Todos: status tabs — verify
    - Kids: tabs — verify

### Low / deferred
8. **Left nav icon review** — deferred until daily-use testing confirms all modules working
9. **Finance OFX/QFX import UI** — backend parsers exist, UI incomplete
10. **Finance budget vs actual visual** — no design yet
11. **Calendar module** — remove or keep for Google Calendar sync only
12. **Google Site data import** — household data at private Google Site; export via Google Takeout

---

## 6. Known Issues & Regression Risks

### Verify on live after v202603.011 deploy
- **Document visibility** — one document became invisible after v202603.008 due to missing
  `const $ =` in the rewritten documents.html. Fixed in .009. Verify the record is visible
  and that migration 037 moved its freetext tags into taggables.
- **Finance tabs** — Accounts/Transactions/Net Worth had baked-in spinners causing freeze.
  Fixed. Verify all three tabs load data.
- **Inventory items** — stats showed 8 items but browse showed nothing (GET routes were behind
  auth wall). Fixed in .006. Verify items appear in browse.
- **Kids activities/notes POST** — old injection used undefined `d` variable, would crash on save.
  Fixed in .010 (full rewrite of kids/routes.js).

### Structural risks
- **Dropdown select → GH_SELECT async** — any `openXxxDrawer()` calling `GH_SELECT.init()`
  must be `async` or the await is silently ignored and the select stays empty.
  All drawer functions were checked and made async in v202603.011.
- **invCategories boot load** — inventory still fetches `inventory_category` via `silentGet`
  at boot. GH_SELECT also fetches it on demand. The silentGet is now unused (its result was
  passed to `populateCategoryDropdown()` which no longer uses it). Harmless but redundant.
  Can be cleaned up later.

---

## 7. Data Safety Rules

Before any schema or data pattern change:
1. **Check data volume** — `SELECT COUNT(*) FROM table` on live before touching anything
2. **Map fields** — document old → new field mapping in `UPGRADE_NOTES.md` first
3. **Backup first** — full DB file download from Settings → Backup
4. **Migrations additive only** — never DROP, never overwrite, never reject non-matching records
5. **Display as-is** — records that don't fit the new pattern show their saved value unchanged
6. **Rescue existing data** — if changing storage format (freetext → structured), write a
   migration to move existing data before the code change (example: migration 037)

**Backup ≠ Export:**
- **Backup** = full SQLite DB file (binary, disaster recovery, from Settings → Backup)
- **Export** = per-module CSV/JSON (human-readable, portability, manual correction)

---

## 8. Testing

**Script:** `.\ghrava_test.ps1 [-Host 192.168.4.62] [-Port 3001] [-Token bearertoken]`

Three test categories:
1. **API Health** — 22+ endpoints, checks HTTP 200 and response shape
2. **UI Smoke Tests** — every page checks HTTP 200 + key element IDs present
   (includes GH_TAGS wraps, GH_SELECT selects, drawer IDs)
3. **DB Orphan Check** — calls `GET /api/v1/settings/diagnostics/orphans`
   Checks: taggables → missing tags, taggables → deleted entities,
   unmigrated freetext tags in documents, unassigned inventory items

Orphan check also available in Settings UI → Diagnostics → **🔍 Orphan Check** button.

---

## 9. Deployment

```powershell
# Standard deploy — pull from GitHub + restart:
.\ghrava_deploy.ps1

# Then in NAS terminal:
docker restart ghrava

# Full rebuild (only when package.json changes):
cd /share/Docker/home-core/ghrava && docker compose up --build -d
```

**GitHub repo:** https://github.com/marugithub/ghrava (private)
**Deploy flow:** Claude commits to GitHub at end of session → run `ghrava_deploy.ps1` → `docker restart ghrava`
**One-time setup:** `ghrava_git_setup.ps1` (already run if repo has commits)
**No more zips** — `ghrava_deploy.ps1` does `git pull` instead of extracting a zip

---

## 10. Session Conventions

- **Commit to GitHub at end of every session** — `git add -A && git commit -m "..." && git push`
- **No more deploy zips** — deploy is `.\ghrava_deploy.ps1` (git pull) + `docker restart ghrava`
- **Read HANDOFF.md + WIRING.md** at the start of every session before writing code
- **Check all modules** — if a pattern is built for one module, apply it to all modules
  in the same session. Do not wait to be asked.
- **Flag before data changes** — map fields, state what happens to existing records,
  confirm volume before migrating
- **Concise responses** — less explanation, more doing
- **Never bake spinners** into HTML panel content
- **Every GET route before** `router.use(requireAuth)` in route files
- **Local $ and esc** — every .html page defines these locally, not just via lt-core

---

## 11. What Changed Per Version

### v202603.011 (current)
- **GH_SELECT built** in lt-core.js — inline "＋ Add new…" on every dropdown backed
  by dropdown_options. Popup appears near the select, POSTs new value to settings API,
  refreshes the select and picks the new value.
- **GH_SELECT wired across 9 pages** — documents (category + subcategory), todos (category),
  daily-log (category), career (job type, goal category, skill category),
  kids (activity category, note category), property (type, maintenance category),
  medical (physician type), books (genre — converted from text input to select),
  inventory (item category + hw subcategory)
- **todos openEdit()** — was missing `initTodoTags(t.tags||[])` call — fixed

### v202603.010
- **shared/tags.js rebuilt** — added `saveTagsByName`, `withTagNames`, `clearTags`,
  prepared statements at module level (performance), JSDoc, MODULE_COLORS map
- **All 10 tag modules wired** — career, property, medical, todos, dailylog, inventory,
  resources, documents, books, kids all use shared/tags.js; no local helpers remain
- **kids/routes.js rewritten** — old injection had undefined `d.tags` variable in POST
  handlers (would crash on save); now clean and fully wired
- **clearTags on delete** — every module now calls clearTags before delete/archive
- **GET tag enrichment** — every module's list GET returns `tags: string[]` on each record
- **medical.html phType** — physician type select now loads from dropdown_options
- **All 17 route files commented** — header explains data model, entity types, auth model
- **HANDOFF.md written** (this file)

### v202603.009
- Tags wired frontend (GH_TAGS pill input) across todos, books, career, kids, property,
  medical, documents
- Dropdown options seeded (migration 036) for all modules
- documents.html rewritten — category + subcategory now dynamic from dropdown_options
- Migration 037 — rescues existing freetext tags from documents.tags column into taggables
- documents.html rendering bug fixed (missing local $ = ...)
- Orphan check endpoint + Settings UI button
- ghrava_test.ps1 rebuilt with UI smoke tests

### v202603.008 and earlier
- Finance statement import system (migration 032, parsers, import routes, Holdings/Import tabs)
- Tags architecture established (tags + taggables tables)
- Tab/UI standardisation, CSS var cleanup, auth wall fixes across all modules
