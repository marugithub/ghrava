# Ghrava Handoff — Session 12

**Last updated:** April 2026
**Latest version:** `v202604.088`
**Latest migration:** `114_wardrobe_color.sql`
**Validation:** see `VALIDATION.md` + `app/scripts/validate-static.py`

## Stack & Runtime

- Node.js/Express + SQLite (better-sqlite3) + Vanilla JS frontend
- Docker on QNAP NAS: `192.168.4.62:3001`, container: `ghrava`
- Build session dir: `/home/claude/ghrava_live/ghrava/`
- Deploy zip: `/mnt/user-data/outputs/Ghrava_DEPLOY.zip` (filename literal — case sensitive: `Ghrava_DEPLOY.zip`)
- NAS mapped at `Z:\ghrava` on Windows
- Deploy script: `ghrava_deploy.ps1` — uses `robocopy /E` (no `/MIR`) so deletes don't propagate; folded pages were converted to redirect stubs rather than deleted to handle this.

---

## Major Work This Session

### Schema
- **Migration 114** — `wardrobe_color` TEXT column on `items`. Free-text (no validation). Surfaced in wardrobe drawer between Brand/Nickname row and Status; shown in grid card meta row + list-view subline.

### Page Consolidation (6 pages folded)
All folded into existing modules with redirect stubs at the original URL:

| Old page | Now at | Status |
|---|---|---|
| `tests.html` | `settings.html#diagnostics` | Settings panel |
| `data.html` | `settings.html#imports` | Settings panel |
| `templates.html` | `todos.html#templates` | Top-level tab in Todos |
| `maintenance.html` | `reports.html?open=maint-rollup` | Reports renderer |
| `snapshot.html` | `reports.html?open=member-snapshot` | Reports renderer (with member dropdown) |
| `watcher-inbox.html` | `notifications.html#inbox` | Top-level tab in Notifications |

`nav.js` updated: removed `tests/templates/data/maintenance` from Admin/Household groups; maintenance entry redirects to Reports.

### Settings Overhaul (left-rail layout)
- Replaced landing card grid with search bar + 4 grouped lists (Setup / Connect / Backup & data / System)
- Hash deep-linking (`/settings.html#diagnostics`) opens panels directly
- 16 existing sub-panels preserved + 2 new (`panel-diagnostics`, `panel-imports`)
- Folded panels use IIFE wrappers to avoid `render()`/`esc()` collisions

### Google Contacts Sync — Label Filter
Backend route `POST /api/v1/google/sync/contacts` now accepts `body.label` (or saved `google_contacts_label` config). Resolves label → `contactGroups`, filters by `memberships`. Returns `{imported, updated, total, label, label_resolved, label_not_found, skipped_by_label}`. Settings UI exposes label input + dedicated "Sync now" button under Google Contacts toggle.

### Unarchive Routes
- `PUT /api/v1/wardrobe/items/:id/unarchive`
- `PUT /api/v1/books/:id/unarchive`
- `PUT /api/v1/documents/:id/unarchive`
- (Inventory already had `PUT /items/:id/unarchive`)

Single-item drawers in wardrobe, books, and documents now have a context-aware archive button: shows green "restore" icon when item is archived, calls unarchive on click. (`toggleWrdItemArchive`, `toggleBkRestore`, `toggleDocRestore`.)

### GH_BULK Widget (NEW shared component)
`window.GH_BULK` in `lt-core.js` — adds a "Select" toggle to a module toolbar. When enabled: capture-phase click intercept, checkbox overlay on cards, floating bottom action bar with Archive / Restore / Delete + Cancel.

**Wired into 5 modules:**
- inventory.html (cardSelector: `.item-grid-card, .item-card, .item-compact-card`)
- wardrobe.html (cardSelector: `.lb-item-card, .wrd-list-card`)
- books.html (cardSelector: `.book-card`)
- perfume.html (cardSelector: `.perf-card`) — Delete only, no archive concept
- documents.html (cardSelector: `.doc-card`)

Each module: cards got `data-id="${item.id}"` and `is-archived` class on archived items.

Context-aware action bar: Archive disabled if any selected is archived; Restore disabled if any is active; Delete always available.

Escape key cancels select mode globally.

### Drawer Restyle
- `.gh-drawer` (inventory item detail) restyled from right-side slide → centered modal. Uses `body:has(.gh-drawer.open)::before` for backdrop (no HTML changes needed).
- All other drawers (`.drawer-overlay`/`.drawer`, archive overlays) were already centered.
- Escape closes any open `.gh-drawer`.

### GH_VIEW Toolbar — More Button Right-Aligned
Replaced the separator between view buttons and the More wrapper with a `<div style="flex:1">` spacer. Pushes More + GH_BULK Select button to the right edge of the toolbar.

### Wardrobe Polaroid CSS Lock (from earlier in session)
Final spec at top of wardrobe.html, marked LOCKED:
- `.lb-polaroid-photo`: `width:calc(100% - 16px); aspect-ratio:1/1; margin:8px auto 0`
- `.lb-polaroid-photo.tall` ALSO `aspect-ratio:1/1` (override default 'tall' ratio)
- `.lb-ph img`: `position:absolute; top:8px; left:0; right:0; bottom:0; height:calc(100% - 8px); object-fit:contain; object-position:top`
- `.lb-polaroid`: `padding-bottom:0`
- `.lb-polaroid-cap`: 2-line clamp, `padding:0 6px 4px; line-height:1.3`

### Other polish
- Templates folded into Todos as "Templates" top-level tab
- FAB pills (`+ Add X`) across 7 modules: books, documents, perfume, subscriptions, insurance, finance, medical
- Tag text input min-width 140→180px
- Books + documents drawer Restore button toggle (parallel to wardrobe pattern)

---

## Backlog (priority order)

1. **Tag-based reports filter** (user backlogged) — filter reports output by tag(s). Probably a chip strip above the report content.
2. **Voiding statements** — financial records void/exclude flag (not delete). Needs spec on which records: transactions? imported statements? both?
3. **Settings cleanup** — hide non-functional sections, polish broken UI. Needs spec on which sections.
4. **Bulk Tag/Family actions** in GH_BULK — needs picker UI design + per-module backend wiring.
5. **Click-outside-to-close** for `.gh-drawer` — held back due to race condition with card onclick (needs proper "ignore initial bubble" guard or backdrop element rather than pseudo).
6. **Mobile UX** — phone-first capture (broad, multi-screen).
7. **Global search** across modules.

---

## Architecture Rules (preserved — non-negotiable)

- SQLite must use `journal_mode = DELETE` + `synchronous = FULL`. NO WAL.
- `ON DELETE CASCADE` is never used anywhere in the schema.
- `requireAuth` exists only in `settings/routes.js`; all other modules are public. Read-only GETs (tags, family, contacts, dropdowns) always go before any auth wall.
- Migrations are additive only. Field mappings documented in `UPGRADE_NOTES.md` before any schema change.
- Records not matching a new data pattern must display as-is and never be rejected or blanked.
- `finance_accounts` (banking) and `financial_accounts` (investment) are NEVER mixed.
- `backup` (full SQLite DB file) and `export` (per-module CSV/JSON) are distinct operations — never conflate.

---

## Deploy Procedure

1. Apply zip to `Z:\ghrava\` (deploy script extracts and robocopies)
2. `docker restart ghrava` — migrations auto-run on startup
3. Use `--build` flag ONLY if `package.json` changed (it didn't this session)
4. After restart, verify version in footer matches `app/version.txt`

---

## Predeploy Sanity

```bash
cd app
python3 scripts/validate-static.py
```

Runs 5 static checks: JS syntax, onclick→function existence, window.api()→route
matching, migration validity, db.prepare() static SQL. Exit 0 = clean.

See **`VALIDATION.md`** at repo root for what's checked, what isn't, and the
list of real bugs caught so far. This is the truth on testing — read it before
shipping anything new.

---

## Real bugs caught by validation suite this session

These were live and would have manifested in production:

| Drop | Bug | Caught by |
|------|-----|-----------|
| v086 | `autoFillZip` undefined → console error every keystroke in contact + property ZIP fields | Onclick→function existence check |
| v087 | `DELETE /api/v1/notifications/:id` — UI dismiss button silently 404'd | Endpoint cross-check |
| v087 | `GET /api/v1/inventory/containers/:id/move-preview` — container move dialog crashed on open | Endpoint cross-check |

---

## Testing infrastructure (end-to-end)

Three layers, each separate:

### 1. Static validation (in-sandbox, before every deploy)
`app/scripts/validate-static.py` — see VALIDATION.md. Catches the "broke the
page" class of bugs without running anything.

### 2. In-browser API smoke (Settings → Diagnostics)
Manual button. Hits a curated list of endpoints from the user's browser,
shows pass/fail with response times. Lives in `settings.html` panel-diagnostics.
Use when you want immediate "is the server alive and answering" check.

### 3. Nightly Playwright E2E (Reports → System Tests)
Lives entirely OUTSIDE the container, on the deploy machine:
- `tests/playwright.config.js` — Playwright config
- `tests/ghrava-e2e.spec.js` — 617-line spec hitting every page + API surface
- `tests/run-tests.ps1` — PowerShell scheduled task. Boots Playwright, parses
  results.json, posts structured run data to `POST /api/v1/app/test-results`,
  copies HTML report to `Z:\ghrava\test-results\`, prunes to last 30.

Backend persistence (already in `server.js` at L420-466):
- `POST /api/v1/app/test-results` — runner posts here
- `GET  /api/v1/app/test-results` — list last 30 runs (summary only)
- `GET  /api/v1/app/test-results/:filename` — one run with full suite/test detail

Storage: `/app/data/test-reports/run_YYYY-MM-DD_HHMM.json`

UI: Reports → System Tests has two tabs:
- **Nightly E2E** — pulls run history from API, summary card showing latest
  pass/fail with ago timestamp, clickable list of all runs, drill-down to
  per-suite per-test detail with error messages
- **Quick Smoke** — same in-browser API checker as before, kept for ad-hoc use

### Setup notes
- `tests/` directory lives at `Z:\ghrava\tests\` (sibling of `Z:\ghrava\app\`),
  NOT inside the container. Deploy zips don't touch tests/.
- Task Scheduler: `powershell.exe -NonInteractive -File Z:\ghrava\tests\run-tests.ps1`,
  Start in: `Z:\ghrava`
- First-run: `cd tests && npm init -y && npm install @playwright/test && npx playwright install chromium`

### When updating the spec for new app changes
The spec file is shipped with deploys (in `tests/`) when bundled, but typically
lives only on the deploy machine. When pages get folded into other pages
(like the v088 work folding tests/data/templates/maintenance/snapshot/
watcher-inbox into other pages), update the spec to test the new locations
rather than the redirect stubs. Already done for `data.html → settings.html#imports`.