# Ghrava Handoff — Session 12

**Last updated:** April 2026
**Latest version:** `v202604.084`
**Latest migration:** `114_wardrobe_color.sql`

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

## Predeploy Sanity (run from inside `app/`)

```bash
# JS files
node --check public/js/lt-core.js
node --check features/google/routes.js features/wardrobe/routes.js features/books/routes.js features/documents/routes.js

# Inline scripts in HTML — extract + check
python3 -c "
import re, subprocess, tempfile, os
for fp in ['public/wardrobe.html','public/inventory.html','public/books.html','public/documents.html','public/perfume.html','public/notifications.html','public/todos.html','public/reports.html','public/settings.html']:
    for i, s in enumerate(re.findall(r'<script(?![^>]*\bsrc\b)[^>]*>(.*?)</script>', open(fp).read(), re.DOTALL)):
        if len(s.strip()) < 5: continue
        with tempfile.NamedTemporaryFile(suffix='.js', mode='w', delete=False) as t:
            t.write(s); t.flush()
            r = subprocess.run(['node','--check',t.name], capture_output=True, text=True); os.unlink(t.name)
            print(f\"{'PASS' if r.returncode==0 else 'FAIL'} {fp}#{i}\")
            if r.returncode: print(r.stderr[:300])
"
```
