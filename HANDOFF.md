# Ghrava Handoff — Session 11
**Last updated:** April 2026

## Stack & Runtime
- Node.js/Express + SQLite (better-sqlite3) + Vanilla JS frontend
- Docker on QNAP NAS: 192.168.4.62:3001, container: `ghrava`
- Working dir (build session): `/home/claude/ghrava_build/`
- Deploy zip: `/mnt/user-data/outputs/Ghrava_DEPLOY.zip`
- NAS mapped at `Z:\ghrava` on Windows

## Migration State
**Live DB:** migrations 087 (last confirmed live)
**Built/Deployed this session:** 088–101 — see migrations list below

### All migrations (088–101) — should all be live after last deploy
- 088: dropdown_standardization
- 089: learning_instructor (career)
- 090: cert_renewal_fee
- 091: contacts_google_updated_at
- 092: document_item_links table
- 093: task_templates + task_template_items (5 seeded templates)
- 094: eob_parser config + app defaults (snooze, reminder, expiry, hsa_pool_threshold)
- 096: watcher_file_registry + watcher_import_history + financial_accounts.account_number
- 097: contacts.is_emergency_contact + family_members.emergency_notes + emergency config keys
- 098: deleted_items table + documents expiry columns + import_category_rules enhancements
- 099: recurring_transactions + portfolio_snapshots + holdings dividend columns
- 100: field_templates table + insurance report config
- 101: db_maintenance_log + webhooks + webhook_logs tables

**Note:** Migration 095 was merged into 097. No gap.

## Last Deploy
**78 files** shipped including chokidar in package.json.
**Deploy required `--build`** because package.json changed (chokidar added).
Correct build command depends on your setup — ask Al how he originally built the container.

## Current Known Issues / Bugs

### 🔴 Print button not showing on any page
- **What was done:** `nav.js` was updated to inject a print button into every page header, `gh-print.js` was created, `@media print` CSS was added to `shared.css`
- **Symptom:** Print button is not visible on any screen
- **Likely cause:** Either nav.js change didn't deploy correctly, or `GH_PAGE` not defined on some pages (nav.js bails if `window.GH_PAGE` is missing)
- **Do NOT fix without asking Al first**
- **Diagnosis:** Check if nav.js was actually extracted correctly from zip. Then check a page like `todos.html` — it should have `window.GH_PAGE = { module:'todos', ... }` at top. If it does and still no button, the nav.js SVG.print reference may be broken.

### 🟡 tests.html has no print button
- `tests.html` has no `window.GH_PAGE` declaration
- Nav.js skips header injection when GH_PAGE is missing
- **Fix options (ask Al which):**
  1. Add `window.GH_PAGE = { module:'tests', title:'System Tests' }` to tests.html
  2. Add a standalone download/print button directly in the tests.html run bar (self-contained, no nav dependency)
- Also: tests.html should have a "Download Report" button that generates a self-contained HTML file of results — not yet built

### 🟡 reports.html was rebuilt as card-grid (new architecture)
- Old tab-based reports.html replaced with registry pattern
- New: card grid → click card → detail panel (no tabs)
- `REPORT_REGISTRY` array is the single source of truth — add one entry to add a new report
- Some render stubs need real data wiring (spending, networth use placeholder logic)

## New Files Added This Session

### Backend routes (all registered in server.js)
| Route prefix | File | Purpose |
|---|---|---|
| /api/v1/search | features/search/routes.js | Global search (Cmd+K) |
| /api/v1/maintenance | features/maintenance/routes.js | Unified maintenance hub |
| /api/v1/templates | features/templates/routes.js | Task templates CRUD + apply |
| /api/v1/family-snapshot | features/family-snapshot/routes.js | Per-member report |
| /api/v1/watcher | features/watcher/routes.js | Folder watcher (needs chokidar) |
| /api/v1/system | features/system/routes.js | Undo delete + DB maintenance + webhooks |
| /api/v1/reports/emergency | features/reports/emergency.js | Emergency card JSON/HTML/text |
| /api/v1/reports/expiry | features/reports/expiry.js | Document expiry timeline |
| /api/v1/receipts | features/receipts/routes.js | Insurance report + field templates |
| /api/v1/dashboard/focus | (added to dashboard/routes.js) | Focus strip for home page |
| /api/v1/dashboard/backup-health | (added to dashboard/routes.js) | Backup health widget |
| /api/v1/google/debug/connection | (added to google/routes.js) | Google connection diagnostics |

### Shared modules (app/shared/)
- `document-item-links.js` — junction table helpers
- `folder-watcher.js` — chokidar watcher + hash dedup (auto-starts on boot if enabled)
- `undo-delete.js` — soft delete recording + restore
- `recurring-transactions.js` — auto-generates transactions + daily scheduler
- `portfolio-analytics.js` — snapshot + performance + allocation
- `insurance-report.js` — inventory export for insurance
- `field-templates.js` — frequently-used field value suggestions
- `db-maintenance.js` — VACUUM/ANALYZE/integrity check
- `webhooks.js` — outbound webhook triggers (fire-and-forget)

### New pages
- `/maintenance.html` — unified maintenance hub
- `/templates.html` — task template library
- `/help.html` — help center with FAQ
- `/offline.html` — service worker fallback
- `/watcher-inbox.html` — smart inbox for unmatched files
- `/snapshot.html` — family member snapshot viewer
- `/tests.html` — system tests (44 tests, 10 categories)
- `/tests.html` also accessible via nav: Admin → System Tests

### New JS modules (app/public/js/)
- `global-search.js` — Cmd+K modal, arrow nav, grouped results
- `quick-capture.js` — Cmd+Shift+N bottom sheet, saves to daily log
- `offline-indicator.js` — 30s ping, banner on disconnect
- `keyboard-shortcuts.js` — ? key shows cheat sheet modal
- `gh-print.js` — window.print() wrapper with timestamp header (**NOT WORKING yet**)

### PWA
- `sw.js` — service worker (network-first, caches static assets)
- `manifest.json` — PWA manifest

## Key Architecture Decisions Made This Session

### Reports module
Rebuilt as registry pattern — `REPORT_REGISTRY` array drives everything.
No tabs. Card grid → detail panel. To add a report: one object + one render function.

### Print system design (decided, partially broken)
- Approach: `window.print()` directly on current page (not separate window)
- `@media print` CSS in shared.css hides sidebar/nav/buttons
- Print button injected by nav.js into every page header
- **Status: CSS added, button not appearing — needs diagnosis**

### Auth middleware
`auth/middleware.js` intentionally NOT deployed — live server runs in open (no-password) mode.
Build has auth enforcement code but deploying it would lock out Settings without a password configured first.
When ready to enable auth: set password in Settings first, THEN deploy middleware.

### Docker build command
`docker restart ghrava` is NOT the right command when package.json changes.
Al needs to confirm exact build command for his Container Station setup.
When chokidar or any new npm package is added, `--build` equivalent is required.

## What Still Needs Work (Prioritized)

### Immediate (next session)
1. **Diagnose print button** — not showing on any page
2. **tests.html print/download** — add GH_PAGE or standalone button
3. **tests.html download report** — generate self-contained HTML file of results

### Short term
4. **Google OAuth** — run `/api/v1/google/debug/connection` to diagnose connection issue
5. **Folder watcher `--build`** — when ready, needs `npm install chokidar`
6. **Finance routes** — `/finance/categories` for spending report, recurring transaction UI in finance.html
7. **Family snapshot** — snapshot.html member selector needs UI

### Design pending (discuss before building)
- Bottom modules grid on home — remove and replace?
- Collapsible todo group headers (URGENT/HIGH/MEDIUM/LOW)?
- Subscription cards — need design before building
- Step-up auth for exports (designed, not built)

## Auth Policy Reminder
- `requireAuth` exists in settings/routes.js and watcher/routes.js ONLY
- All other modules are open (no auth wall)
- Read-only GET routes always sit BEFORE any auth middleware
- App runs in open mode when no password is set

## Data Safety Rules (never violate)
- NO `ON DELETE CASCADE` anywhere — orphan cleanup is explicit
- Journal mode: `DELETE`, synchronous: `FULL` (WAL caused data loss historically)
- Migrations are additive only — never drop columns or tables with real data
- Always ask for manual DB backup before any migration that deletes data

## Session Startup Procedure
1. Check if `/home/claude/ghrava_build/` exists with full project
2. If not: `unzip -q /mnt/user-data/outputs/Ghrava_DEPLOY.zip -d ghrava_clean && cd ghrava_clean/ghrava && npm install --silent`
3. For DB inspection: use `/home/claude/ghrava_review/data/lifetracker.db`
4. Always `node --check <file>` before packaging
5. Always run inline script syntax check on HTML files before packaging
