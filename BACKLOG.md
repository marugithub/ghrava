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
