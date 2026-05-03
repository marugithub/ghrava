# Ghrava Handoff — Session 13 (Lens v202604.124, IN PROGRESS)

**Last updated:** May 2026
**Status:** The Lens shipped to 8 pages in sandbox. NOT yet packaged. NOT yet deployed.

---

## What this session built

**The Lens** — a sentence-shaped filter UI that replaces GH_VIEW's filter drawer. Reads as English: *"Subscriptions  12  for Jamie renewing this month   reset"*

### New files
- `app/public/js/lens-config.js` — verb/dimension table per module. **EDIT HERE** to change verbs, never in HTML pages. All 13 modules in one file.
- `app/public/js/gh-lens.js` — the Lens component. Public API: `GH_LENS.init(opts)`, `setCount(n)`, `getState()`, `applyFilter()`, `clear()`.

### Modified files
- `app/public/shared.css` — Lens styles appended (`.gh-lens`, `.gh-lens__pill`, etc.)
- `app/public/subscriptions.html` — wired
- `app/public/books.html` — wired (kept hidden `bookViewToolbar` for GH_BULK)
- `app/public/insurance.html` — wired (no GH_BULK)
- `app/public/documents.html` — wired (kept hidden `docViewToolbar` for GH_BULK)
- `app/public/perfume.html` — wired (kept hidden `perfViewToolbar` for GH_BULK)
- `app/public/wardrobe.html` — wired ITEMS TAB ONLY (kept hidden `itemViewToolbar` for GH_BULK)
- `app/public/property.html` — wired with tab-aware re-init. Bug fix: `_reloadPropTab` had `currentTab` (undefined) → changed to `tab` (correct variable name)
- `app/public/medical.html` — wired with subview-aware re-init. **Dropped `?cards=v2` URL flag entirely** — cards are now always on.

### Sandbox tests
30/30 lens behavior tests pass. Plus 17/17 cards configs, 8/8 mount, 17/17 brands, 10/10 resilience tests still pass.

---

## What still needs to be done before deploy

### 1. Wire `todos.html` (last lens-enabled page)
Same pattern as medical:
- Add lens-config.js + gh-lens.js script tags
- Drop `?cards=v2` URL flag
- Add `<div id="todoLens"></div>` container, hide existing toolbar div for GH_BULK
- Replace `GH_VIEW.init` with `GH_LENS.init({ moduleId: 'todos', ... })`
- Adapter: `lensToTodoFilters(filters)` → flat object the existing renderer expects
- Push `GH_LENS.setCount(rows.length)` after filtering

### 2. Final integrity sweep
- Run inline-script syntax check against ALL HTML pages
- Sandbox tests one more time

### 3. Update e2e tests
- Add lens behavior tests in `tests/ghrava-e2e.spec.js`

### 4. Bump version
- `app/version.txt` → `202604.124`

### 5. Update Deploy-Patch.ps1
- Add `app/public/js/lens-config.js`
- Add `app/public/js/gh-lens.js`
- Add all 8 modified HTML pages
- Add this updated HANDOFF.md

### 6. Build & present zip
- `Ghrava_Deploy.zip` via `present_files` to `/mnt/user-data/outputs/`

---

## Lens design — LOCKED decisions

Don't re-litigate:

- **Empty hint:** *"narrow by family member, status, time…"* (not "person")
- **Persistence:** sessionStorage only. Survives page navigation within session, gone on tab close. NOT localStorage.
- **Pills:** blue dotted underline (Notion-style affordance), click to edit. NO per-pill ✕ by default.
- **Clearing:** italic "reset" at end of sentence + backspace eats last pill + hover reveals ✕.
- **Cross-module:** filters persist across module switches within session. Filters not applicable to new module dropped silently.
- **Phantom cursor:** input's native blinking caret signals typeability. No separate input element.
- **Keyboard:** `/` from anywhere focuses lens. ↑↓ navigate, Enter accepts top, Esc dismisses.
- **Verb table:** lives in `lens-config.js` only. User edits this file when verbs feel wrong.

---

## Today page — DESIGNED, NOT BUILT

User locked this design at end of session. Build AFTER lens is shipped.

### Strategy
- Move existing `app/public/index.html` → `app/public/dashboard.html` (preserve)
- Build new `index.html` as Today
- Add "Stats" nav link → dashboard.html
- If Today flops, swap nav back in 30 seconds

### Two sections only
- **Now (red):** due ≤ 0 days (today or overdue)
- **Soon (amber):** due 1–7 days
- 30-day pipeline as footer: *"12 more items in next month"* (expandable)

### Endpoint
Single `GET /api/v1/today?lookahead=30` — aggregates from subscriptions, documents, insurance, todos. Returns `{ now: [...], soon: [...], pipeline_count: N }`. Each item: `{ severity, title, subtitle, module, record_id, due_date, action_label }`.

### Visual
Dense vertical rows (NOT cards). Color-coded left dot (🔴/🟡), two-line text, Open + Snooze buttons right-aligned.

### Snooze (lower priority)
- Default +7 days
- New table `today_snoozes (record_kind, record_id, snoozed_until)`
- Ship Today without snooze if needed

### Header
*"Saturday, May 2 — 3 things today, 5 this week"*

### Empty state
*"Nothing needs your attention. N items in the pipeline."*

---

## Backlog from this session (priority order)

1. **Per-device family filter** — first-time prompt "who is this device for?", localStorage only, scope indicator near nav avatar. NO DB changes.

2. **Photo-first wardrobe entry** — drag/drop or camera capture creates draft item, fill rest later via existing drawer. Lower priority than initially thought.

3. **Amazon orders → inventory via Gmail** — verify email content first. If too sparse, drop. NO AI cost (regex parsing).

4. **Calendar sync** — Google Calendar → read-only birthdays/appointments inbox. Backlog low.

5. **Browser extension** — defer indefinitely.

### REJECTED
- Email receipt tracking (duplicates bank data)
- User profile switching / multi-tenancy (Ghrava is one-household-per-install)

---

## Working style for next chat

- Discuss design BEFORE code, prototype FIRST (visualize widget)
- ALWAYS check existing infrastructure before building new
- Verify DB schema before treating as field gap
- Centralized/shared code preferred
- Continue without check-ins until natural pause
- User signaled chat was getting heavy — start fresh next time

---

## Critical rules (unchanged)

- SQLite `journal_mode=DELETE` + `synchronous=FULL` — no WAL
- NO `ON DELETE CASCADE`
- `requireAuth` ONLY in `settings/routes.js`
- `finance_accounts` ≠ `financial_accounts`
- Backup ≠ export
- Verify column names against live DB
- Migrations additive only
- Records not matching new patterns display as-is, never blanked
