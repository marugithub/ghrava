# Ghrava Backlog
**Last updated:** April 2026
**Migration state:** 087 live · 088–091 in build (not yet deployed)

---

## Pending deploy (built, not yet on live server)

| File | Change |
|---|---|
| `app/public/nav.js` | Collapsible sections, Terminal icon fix |
| `app/public/shared.css` | Section collapse CSS |
| `app/public/todos.html` | `.todo-cards-grid` overlap fix |
| `app/public/hsa.html` | Full dashboard (replaces redirect) |
| `app/public/insurance.html` | GH_VIEW shell with sample data |
| `app/public/perfume.html` | GH_VIEW shell with sample data |
| `app/public/subscriptions.html` | GH_VIEW shell with sample data |
| `app/public/wardrobe.html` | Shell page |
| `app/shared/types.js` | instructor_contact_id added to CareerLearning |
| `app/tsconfig.json` | DOM added to lib |
| `app/db/migrations/088–091` | Dropdown standardization, career fields, contacts google_updated_at |
| `MODULES_DESIGN.md` | Full design doc |
| `Ghrava_Share.ps1` | Share zip script |

---

## Feature group A — External AI features (reviewed, not yet applied)
All files received and evaluated against live DB. Apply as one session.

### A1 · Dashboard Focus Strip + Backup Health Widget
**Files:**
- `app/shared/backup-health.js` — NEW · extracts inline backup logic, adds status/message fields
- `app/features/dashboard/routes.js` — ADD `/focus` endpoint (todos, daily log, inventory, docs, gift cards, vehicles, certs)
- `app/public/js/dashboard-focus.js` — NEW · IIFE, `window.loadFocusStrip`, `window.toggleFocusStrip`
- `app/public/index.html` — REPLACE · Focus Strip + Quick Actions + Backup Health widget

**Known issues to fix before applying:**
- `index.html` references `dashboard-focus.js` AND `global-search.js` — must apply A1+A2 together
- `index.html` also contains maintenance widget from A4 — apply all dashboard changes in one pass

---

### A2 · Cross-Module Global Search
**Files:**
- `app/shared/global-search.js` — NEW · searches 12 modules, relevance scoring
- `app/public/js/global-search.js` — NEW · `window.GH_Search`, Cmd+K, arrow nav, highlight
- `app/features/search/routes.js` — NEW · `GET /search?q=`, `GET /search/all`
- `app/public/shared.css` — ADD search modal styles
- `app/server.js` — ADD `app.use('/api/v1/search', ...)`

**Known issues to fix before applying:**
- `kids` query uses `school_name` column — doesn't exist, actual column is `school_id`. Fix: remove `school_name` from WHERE clause or join schools table
- index.html search trigger button — coordinate with A1 since both modify index.html

---

### A3 · Document-Item Linking
**Files:**
- `app/db/migrations/092_document_item_links.sql` — NEW · junction table
- `app/shared/document-item-links.js` — NEW · CRUD utilities, suggest functions
- `app/features/documents/routes.js` — ADD link endpoints
- `app/features/inventory/routes.js` — ADD link endpoints
- `app/public/shared.css` — ADD link chip + picker modal styles
- `app/public/documents.html` — ADD Linked Items section to drawer
- `app/public/inventory.html` — ADD Linked Documents section to detail

**Known issues to fix before applying:**
- Migration 092 uses `ON DELETE CASCADE` on both FKs — **violates no-cascade rule**. Remove CASCADE, cleanup handled by `unlinkAllForDocument` / `unlinkAllForItem` functions which already exist in the shared module

---

### A4 · Unified Maintenance Hub
**Files:**
- `app/shared/maintenance-hub.js` — NEW · queries property_maintenance, vehicle_service, item_maintenance_log
- `app/features/maintenance/routes.js` — NEW · `/tasks`, `/summary`, `/upcoming`
- `app/public/maintenance.html` — NEW · full page
- `app/public/shared.css` — ADD maintenance widget styles
- `app/server.js` — ADD `app.use('/api/v1/maintenance', ...)`
- `app/public/index.html` — ADD maintenance widget (coordinate with A1)
- `app/public/nav.js` — ADD maintenance module + wrench SVG + Home section

**DB verified clean:** All three maintenance tables exist with matching columns.
**PATCH /property/maintenance/:id/complete** endpoint confirmed exists.

---

### A5 · Photo-First Inventory Gallery View
**Files:**
- `app/public/inventory.html` — ADD gallery view toggle, `renderGalleryView`, `renderGalleryCard`, bulk selection
- `app/public/shared.css` — ADD gallery grid, card, bulk bar styles
- `app/features/inventory/routes.js` — OPTIONAL ADD `/gallery` optimized endpoint

**DB verified clean:** `primary_photo_id`, `thumb_path`, `editItem`, `catCfg` all exist and match.

**Known issue to check before applying:**
- `bulkAddPhotos` uses `LT.authToken` — verify this is the correct global for auth token in our app

---

### A6 · Quick Capture Modal (Global)
**Files:**
- `app/public/js/quick-capture.js` — NEW · IIFE, voice dictation, category memory, `window.GH_QuickCapture`
- `app/public/shared.css` — ADD quick capture modal + FAB styles
- `app/public/nav.js` — ADD `buildQuickCaptureFAB()`, script injection
- `app/features/dailylog/routes.js` — ADD `POST /quick` endpoint
- `app/public/index.html` — REMOVE inline quick capture (superseded by module)

**Known issues to fix before applying:**
- Daily log feature folder is `dailylog/` not `daily-log/` — fix route path
- Toast call in quick-capture.js uses `LT.toast` — should be `window.toast`
- `/quick` endpoint has `requireAuth` — **violates auth policy**. Remove it
- nav.js script injection (`injectQuickCaptureScript`) uses dynamic `<script>` tag — race condition risk. Better to add static `<script src>` on each page or load in nav.js directly

---

### A7 · Family Member Snapshot Export
**Files:**
- `app/shared/family-snapshot.js` — NEW · aggregates all linked data for one family member
- `app/features/family-snapshot/routes.js` — NEW · JSON / HTML / text endpoints
- `app/public/snapshot.html` — NEW · printable report page
- `app/public/settings.html` — ADD snapshot button to family member cards
- `app/public/reports.html` — ADD snapshot link in People tab
- `app/server.js` — ADD `app.use('/api/v1/family-snapshot', ...)`

**DB verified clean:** `record_family_members`, `kid_activities`, `kid_notes`, `family_members`, `hsa_otc` all exist with matching columns.

**Known issues to fix before applying:**
- `hsa_otc` has its own `family_member_id` column — snapshot uses `linked()` helper (record_family_members) for OTC which may not be populated. Fix: add direct `family_member_id` query for hsa_otc
- `getTagNames` imported but unused — remove import

---

### A8 · Recurring Task Templates
**Files:**
- `app/db/migrations/093_task_templates.sql` — NEW · templates + items tables + 8 seeded templates
- `app/shared/task-templates.js` — NEW · CRUD + applyTemplate + createTemplateFromTodos
- `app/features/templates/routes.js` — NEW · full CRUD + apply endpoint
- `app/public/templates.html` — NEW · template library page
- `app/public/js/task-templates.js` — NEW · frontend management
- `app/public/todos.html` — ADD Templates button
- `app/public/nav.js` — ADD templates module + layers SVG + Focus section
- `app/server.js` — ADD `app.use('/api/v1/templates', ...)`

**DB verified clean:** `todos.reminder_date` exists. All INSERT columns match.

**Known issues to fix before applying:**
- Migration 093 uses `ON DELETE CASCADE` on task_template_items — **violates no-cascade rule**. Remove CASCADE, handle cleanup explicitly in `deleteTemplate()`
- `templates/routes.js` uses `requireAuth` middleware — **violates auth policy**. Remove it
- Migration numbers: 092 = doc-item links, 093 = task templates — confirmed correct

---

### A9 · Offline Mode Indicator
**Files:**
- `app/public/sw.js` — NEW · service worker, network-first strategy, offline API response
- `app/public/js/offline-indicator.js` — NEW · `window.GH_Offline`, API patching, queue management
- `app/public/offline.html` — NEW · fallback page
- `app/public/manifest.json` — NEW · PWA manifest
- `app/public/shared.css` — ADD offline indicator styles
- `app/public/index.html` — ADD script include (coordinate with A1)

**Design notes:**
- Service worker only caches static assets — API calls always go to network or return 503 JSON
- Offline queue patches `window.api` for writes — queues POST/PUT/PATCH/DELETE, returns mock success
- Queue persists to localStorage, processes on reconnect
- Periodic ping to `/api/v1/app/info` (HEAD) every 30s

**Known issues to check before applying:**
- Confirm `/api/v1/app/info` endpoint exists for ping — if not, use a different lightweight endpoint
- `LT.authToken` referenced in queue processing — verify correct global

---

## Feature group B — Discussed but not designed yet

### B1 · EOB Parser Selector (Settings)
- Migration: seed `eob_parser` key in `app_config`, seed `eob_parser` dropdown options
- `app/features/medical/routes.js` — read parser type from `app_config` before parsing
- `app/public/settings.html` — add sub-panel with radio selector
- For now only MHBP supported; structure allows adding BCBS/Cigna/UHC later

### B2 · Settings UI Consolidation (app_config viewer)
- Add a card in Settings showing all `app_config` values with edit controls
- Toggles for API flags, number inputs for threshold/day values
- Fields: reminder_default_days, backup_reminder_days, document_expiry_warning_days, hsa_pool_threshold, api_* feature flags
- Backend: `PUT /settings/config/:key` already exists

### B3 · Google Tasks Sync Button in Todos
- Add sync button to todos.html header (globe icon + green badge dot)
- `checkGoogleStatus()` on page load — show/hide button based on connection
- `syncGoogleTasks()` — calls existing `POST /google/sync/tasks` endpoint
- Display last sync time in button title

### B4 · Document Expiry Timeline
- Gantt/timeline view of all expiring records across modules over next 12–24 months
- Sources: documents.expiry_date, career_certifications.expiry_date, vehicles.registration_expires, insurance policies
- Groups by quarter: Q1 passport, Q2 driver's license etc.
- Lives in Reports module

---

## Feature group C — Candidates (not yet designed)

High impact / low effort:
- **Recurring Transactions** — auto-create finance transactions for bills on schedule (builds on finance_accounts)
- **Bill Pay Calendar** — visual calendar of recurring bills with cash flow projection
- **Emergency Info Card** — one-page printable: critical contacts, meds, allergies, insurance
- **Undo Delete UI** — soft-deletes already exist; add restore button on delete confirmation
- **Database Maintenance UI** — VACUUM, integrity check, backup verify buttons in Settings
- **Keyboard Shortcuts Cheat Sheet** — modal listing all shortcuts (⌘K, ⌘⇧N etc.)
- **Audit Log Viewer** — UI for item_events table

Medium effort:
- **Receipt Scanner / OCR** — Tesseract.js (free, local, no API cost) for receipts → HSA/expense
- **Home Inventory Insurance Report** — export by room with photos and values
- **Symptom Tracker** — log symptoms, correlate with medications/conditions
- **Vaccination Records** — digital vaccine card with booster schedule
- **Webhook Support** — POST to Home Assistant / IFTTT on events
- **Export Profiles** — save named export configurations ("Tax Docs only", "Medical Records only")
- **Document Expiry Timeline** — Gantt view (see B4 above)
- **Spending Forecast** — project next month's bills from recurring transactions

Larger scope:
- **Scheduled Backup Verification** — auto-test restore weekly, alert if corrupted
- **Fitness Sync (Google Fit)** — steps/weight/sleep via OAuth; Samsung Health bridges to Google Fit
- **Biometric Unlock (APK)** — Capacitor plugin for fingerprint/Face ID
- **Android Widget** — home screen widget showing today's focus items
- **Share Target** — share images/files from other apps directly into Ghrava

Deferred/won't do:
- Recipes — user has paid app (Mealie compatible), skip
- Estate module — no decision, deferred
- Pets — not applicable
- Email integration — complex, low priority

---

## GitHub Actions — Capacitor APK Build
Full workflow designed (document index 17). Not yet implemented.

**Files when ready:**
- `.github/workflows/build-apk.yml` — builds debug APK on push to main, release APK on version tags
- `capacitor.config.json` — NAS IP, cleartext, splash screen config
- `scripts/build-apk.sh` — local build script, auto-detects LAN IP
- `package.json` additions — `npm run apk` script

**Notes:**
- Capacitor 6, Java 17, Android SDK via github actions
- Release builds require keystore secrets in GitHub
- Server URL is NAS IP:3001 — update `capacitor.config.json` if IP changes
- `android/` folder excluded from git (generated by cap add android)

---

## Open questions / decisions needed

- **Bottom modules grid on home page** — remove and replace with useful content (recent activity, alerts)? Discussed, not decided.
- **Collapsible todo group headers** — add same collapse behavior as nav sections to URGENT/HIGH/MEDIUM/LOW groups? Discussed, not decided.
- **Subscription card functionality** — cards need click handlers, edit drawer, real API (no backend yet). Design before building.
- **SQLCipher migration** — deferred. QNAP drive already encrypted. Revisit when features stabilize.
- **Session timeout** — configure in Settings when we touch that module.
- **Step-up auth** — password re-prompt for exports/sensitive actions. Designed, not built.

---

## Completed this session
- Nav collapsible sections ✓
- Terminal icon fix (↗ removed, icon 7px) ✓
- HSA dashboard (replaces redirect) ✓
- todos.html overlap fix (todo-cards-grid) ✓
- types.js + tsconfig.json bug fixes ✓
- insurance/perfume/subscriptions shell pages upgraded ✓
- Ghrava_Share.ps1 ✓
- MODULES_DESIGN.md ✓

---

## Feature group B — Fully designed, ready to build
All three features have complete code from design session. Apply together in one pass.

### B1 · EOB Parser Selector (Settings)
**Migration:** `094_eob_parser_config.sql`
```sql
INSERT OR IGNORE INTO app_config (key, value) VALUES ('eob_parser', 'mhbp');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('snooze_default_days', '1');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('reminder_default_days', '7');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('backup_reminder_days', '7');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('document_expiry_warning_days', '90');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('hsa_pool_threshold', '500');
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('eob_parser', 'MHBP (Aetna Federal)', 'mhbp', 10, 1);
-- Only add implemented parsers — no "coming soon" entries
```

**`app/features/medical/routes.js`** — add `getEobParser()` helper at top, use it in `/eob/preview` and `/eob/import` routes:
```javascript
function getEobParser() {
  try {
    const row = db.prepare("SELECT value FROM app_config WHERE key = 'eob_parser'").get();
    return row?.value || 'mhbp';
  } catch { return 'mhbp'; }
}
// In /eob/preview and /eob/import: call getEobParser() before requiring eob-parser.js
// If parser !== 'mhbp' return 400 "Parser not implemented yet"
```

**`app/public/settings.html`** — add to PANEL_LOADERS: `eob: () => { loadEobParserPanel(); }`
- Add row in Integrations card: "EOB Parser · Insurance EOB import format · badge showing current"
- Add sub-panel `panel-eob` with radio buttons (one per implemented parser only)
- Functions: `loadEobParserPanel()`, `saveEobParser()`
- Badge updates on save

**`app/public/settings.html`** — add App Configuration card:
- Fields defined in `CONFIG_FIELDS` array: snooze_default_days, reminder_default_days, backup_reminder_days, document_expiry_warning_days, hsa_pool_threshold, api_* feature flags
- Toggles use `saveConfigToggle(key, checked)`
- Number inputs use `saveConfigValue(key, value)` with Save button
- Calls `loadAppConfig()` on DOMContentLoaded

---

### B2 · Google Tasks Sync Button (Todos)
**`app/public/todos.html`** — add to header controls:
```html
<button class="gh-icon-btn" id="googleSyncBtn" title="Sync with Google Tasks" onclick="syncGoogleTasks()" style="position:relative">
  <!-- globe SVG -->
  <span id="googleSyncBadge" style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:var(--green);display:none"></span>
</button>
```
Add JS functions: `checkGoogleStatus()` (calls `GET /google/status`, shows/hides badge), `syncGoogleTasks()` (calls `POST /google/sync/tasks`, shows spinner, calls `load()` on success)
Call `checkGoogleStatus()` in DOMContentLoaded.

**`app/public/shared.css`** — add spinner for icon buttons:
```css
.gh-icon-btn .spin { border: 2px solid var(--text3); border-top-color: var(--accent); }
```

---

### B3 · Google Debug Endpoint
**`app/features/google/routes.js`** — add `GET /debug/connection`:
- Tests: DNS resolution to oauth2.googleapis.com, HTTPS reach to token endpoint, token validity, Tasks API call
- Returns JSON: config (has_client_id, has_client_secret, has_refresh_token, token_expiry_date), tests (dns, token_endpoint, token, tasks_api)
- Permanent diagnostic endpoint — not temporary
- Used by test runner in Reports → Tools

---

### B4 · System Test Runner (Reports → Tools)
**`app/public/reports.html`** — add "🧪 System Tests" section to Tools tab:
- Button "▶ Run All Tests"
- Tests: Config API responds, EOB parser configured, Google status endpoint responds, Google credentials present, Google DNS, Google token valid (skipped if not connected)
- Results displayed inline: ✅ pass / ❌ fail / ⏭️ skip with error messages
- Uses `GET /google/debug/connection` for Google tests

---

## Feature group C — Emergency Info Card
**Designed, partially coded. Build after B group.**

### C1 · Emergency Contact Flag on Contacts
**Migration `095_emergency_contact.sql`:**
```sql
ALTER TABLE contacts ADD COLUMN is_emergency_contact INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_contacts_emergency ON contacts(is_emergency_contact);
```
**`app/features/contacts/routes.js`** — add `is_emergency_contact` to SELECT/UPDATE columns
**`app/public/settings.html`** (or contacts.html) — add toggle in contact drawer: "🚨 Emergency Contact"

### C2 · Emergency Report Endpoints
**`app/features/reports/routes.js`** — add:
- `GET /emergency` — JSON with: emergency_contacts, family_members, active medications, active conditions, allergies (from kids + family), insurance, primary_physician
- `GET /emergency/html` — self-contained printable HTML with print CSS

**`app/public/reports.html`** — add "🚨 Emergency" tab:
- Red info banner explaining the card
- "View & Print" button opens `/api/v1/reports/emergency/html` in new tab
- List of emergency contacts shown inline
- Requires step-up auth on export

**Notes on queries:**
- Allergies pulled from `kids.allergies` + `family_members.notes LIKE '%allerg%'`
- Insurance from `hsa_plan_info` current year
- Primary physician from `contacts WHERE contact_type='Medical' AND specialty LIKE '%Primary%'`

---

## Feature group D — Undo Delete UI
**Designed, partially coded.**

### D1 · Restore Endpoints
**`app/features/system/routes.js`** (new file) — add:
- `GET /api/v1/system/deleted` — lists soft-deleted items across tables (items=is_archived, documents/books=is_active=0, todos=status='dismissed')
- `POST /api/v1/system/restore` — takes `{table, id}`, reverses soft delete per table

**`app/public/settings.html`** — add "Recently Deleted" row → sub-panel `panel-deleted`:
- Lists recently archived/deleted items with restore buttons
- Trash icon in settings rows section

**Tables supporting restore:** items (is_archived), documents (is_active), todos (status→open), books (is_active)
**Tables NOT supporting restore (hard delete):** contacts, daily_log entries — flag these clearly

---

## Feature group E — NAS Folder Watcher
**Extensively designed. Build after C+D. Requires chokidar npm package.**

### Design decisions (confirmed)
- **File hash:** SHA256 of file content, store ALL seen files in registry (even skipped)
- **Pending queue ("Smart Inbox"):** Files not matching any rule go to inbox, managed in Settings
- **File patterns:** Checkbox UI for common types (CSV/XLSX/PDF/OFX) + custom pattern input
- **Path matching:** `path_contains` array (case-insensitive) + optional `filename_contains`
- **Recursive:** Yes, configurable depth slider
- **Processed files:** Stay in place, never moved or deleted
- **Duplicates:** Hash-based skip with "Force Re-import" option in audit log
- **Rule order:** First-match-wins, drag to reorder in UI
- **Initial scan:** Yes, on rule creation with progress indicator

### Migration `096_watcher_tables.sql`
```sql
ALTER TABLE financial_accounts ADD COLUMN account_number TEXT;

CREATE TABLE IF NOT EXISTS watcher_file_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL UNIQUE,
  file_hash TEXT NOT NULL,
  file_size INTEGER, file_modified DATETIME,
  last_scanned DATETIME DEFAULT CURRENT_TIMESTAMP,
  import_status TEXT DEFAULT 'pending',  -- pending/imported/failed/ignored/skipped
  import_batch_id INTEGER, import_error TEXT, imported_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_watcher_hash ON watcher_file_registry(file_hash);
CREATE INDEX IF NOT EXISTS idx_watcher_status ON watcher_file_registry(import_status);
CREATE INDEX IF NOT EXISTS idx_watcher_path ON watcher_file_registry(file_path);

CREATE TABLE IF NOT EXISTS watcher_import_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_registry_id INTEGER REFERENCES watcher_file_registry(id),
  rule_id INTEGER, rule_name TEXT,
  module TEXT NOT NULL, account_id INTEGER, batch_id INTEGER,
  transactions_imported INTEGER DEFAULT 0,
  started_at DATETIME, completed_at DATETIME,
  status TEXT DEFAULT 'pending', error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_config (key, value) VALUES 
  ('folder_watcher_enabled', '0'),
  ('folder_watcher_config', '{"watch_paths":[],"rules":[],"catch_all":{"enabled":true,"action":"queue"}}');
```

### Rule config schema (stored in app_config as JSON)
```json
{
  "watch_paths": [
    { "path": "/share/Documents", "recursive": true, "enabled": true }
  ],
  "rules": [
    {
      "id": 1, "name": "EOB Statements", "enabled": true,
      "path_contains": ["EOB", "Explanation of Benefits"],
      "patterns": ["*.pdf"],
      "module": "eob", "parser": "mhbp"
    },
    {
      "id": 2, "name": "Chase Bank", "enabled": true,
      "path_contains": ["Chase"],
      "patterns": ["*.csv"],
      "module": "statement", "account_id": 5, "parser": "chase"
    }
  ],
  "catch_all": { "enabled": true, "action": "queue" }
}
```

### Files to create
| File | Purpose |
|---|---|
| `app/db/migrations/096_watcher_tables.sql` | Tables above |
| `app/shared/folder-watcher.js` | Core watcher: SHA256 hash, rule matching, chokidar watch, processFile(), scanDirectory(), getPendingFiles(), getImportStats() |
| `app/features/watcher/routes.js` | GET /status, PUT /config, GET /pending, POST /process, POST /scan, GET /history — all behind requireAuth |
| `app/server.js` | ADD route registration + `setTimeout(startWatcher, 5000)` |
| `app/public/settings.html` | Folder Watcher panel: status card, watch paths, rules manager, Smart Inbox |
| `app/public/reports.html` | Audit Log tab in System section |

### Key implementation notes
- `chokidar` must be added to `package.json` dependencies (triggers `--build` on deploy)
- `awaitWriteFinish: { stabilityThreshold: 2000 }` — wait for file to stop changing before processing
- Rules checked top-to-bottom, first match wins — drag handle in UI for reorder
- "Test Rule" button: scan folder, show first 5 matching files, count total matches
- Smart Inbox badge count shown in Settings nav entry
- Audit log pagination: "Load More" not page numbers

### Banking vs Investment routing
```javascript
// In importStatement():
const account = db.prepare('SELECT account_type FROM financial_accounts WHERE id = ?').get(rule.account_id);
if (['brokerage','tsp'].includes(account.account_type)) {
  // → investment import flow (/import/confirm equivalent)
} else {
  // → banking import flow (/finance/transactions/import-file equivalent)
}
```

### requireAuth note
- `watcher/routes.js` has `router.use(requireAuth)` — this is intentional since it modifies config and triggers imports
- Consistent with settings/routes.js pattern
- All other module routes remain open

---

## Feature group F — CouchDB/PouchDB Offline Sync
**Discussed, not designed. Major architectural change.**

### Assessment
Current: `Browser ←→ Express API ←→ SQLite`
CouchDB: `PouchDB (phone, offline) ←→ CouchDB (NAS) ←→ SQLite (optional)`

**Effort:** 6–8 weeks. Not worth it for single-household LAN app.

**Recommendation:** Use A9 (Offline Mode Indicator + service worker) for offline capability. Add selective PouchDB sync for todos+contacts only if needed later.

**If revisited:** Start with a proof-of-concept syncing only `todos` and `contacts`. Evaluate before expanding.

---

## Pending questions / decisions

| Question | Status |
|---|---|
| Bottom modules grid on home — remove? | Undecided |
| Collapsible todo group headers (URGENT/HIGH) | Undecided |
| Subscription cards — design before building | Undecided |
| SQLCipher — deferred | Deferred |
| Step-up auth — designed, not built | Backlog |
| Session timeout — configure in Settings when touched | Backlog |
| Google OAuth issue — run `/api/v1/google/debug/connection` to diagnose | Action needed |
| `chokidar` package install before folder watcher | Required for E group |
