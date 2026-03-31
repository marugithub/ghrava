# Ghrava Wiring Map
**Consult this before changing ANYTHING. Update it when adding new dependencies.**
Last updated: v202603.115

---

## Rule: Before touching a file, check its row. Touch cascades to every dependent.

---

## api() Call Rule — MANDATORY

**Every page MUST use `window.makeApi(prefix)`. Never hand-roll `fetch()`.**

```js
// At top of every page script:
const api = window.makeApi('/career');   // prefix = the module's /api/v1/xxx path

// All calls use (method, path, body):
await api('GET', '/certifications');
await api('POST', '/certifications', payload);
await api('PUT', `/certifications/${id}`, payload);
await api('DELETE', `/certifications/${id}`);
```

This gives: auth header, JSON body, 401 retry, error logging — from window.api in lt-core.js.

| Page | makeApi prefix |
|------|---------------|
| books.html | `/books` |
| career.html | `/career` |
| property.html | `/property` |
| medical.html | `''` (calls multiple modules) |
| resources.html | `/resources` |
| todos.html | `/todos` |
| kids.html | `/kids` |
| daily-log.html | `/daily-log` |
| finance.html | uses `window.api` directly — full paths only |
| reports.html | GET-only local wrapper scoped to finance/reports |
| documents.html | uses `window.api` directly |
| inventory.html | `/inventory` |

**Rule: When adding a new page, add `const api = window.makeApi('/newmodule')` and use it for all calls.**
**Exception: FormData uploads (photos, imports) must stay as raw fetch — makeApi only handles JSON.**

---

## Data Export Rule — MANDATORY

**There is ONE export: `GET /api/v1/data/export` → XLSX workbook, all modules, all sheets.**

- No per-module CSV exports. No per-module download buttons.
- Users go to `/data.html` (Data Manager) to export.
- The XLSX workbook covers: Inventory, Documents, Contacts, Family, Medications, Conditions, Books, Resources, Todos, Daily Log, Career (Certs/Jobs/Skills/Education/Goals), Properties, Vehicles, Finance Accounts, Transactions, HSA, Gift Cards, Kids.
- `GET /api/v1/data/template` → blank template with headers.
- `POST /api/v1/data/import` → upload workbook, only present sheets processed.

**Why:** One place, one file, consistent format, no drift between per-module exports.

---

## Popup / Modal Standard

Two patterns exist — use the right one:

**Drawers** (`.drawer` / `.drawer-overlay`) — for record editing, detail views, multi-field forms.
- Every drawer MUST have a visible **Cancel** button. No drawer may rely solely on tapping outside.
- Button row: `Save` (btn-primary, flex:1) · `Delete` (btn-ghost, color:var(--red), hidden until editing) · `Cancel` (btn-ghost)

**Centered Modals** (`.gh-modal-overlay` / `.gh-modal`) — for confirmations, short "Add new" flows, alerts.
- Toggle `.open` class to show/hide. Clicking backdrop closes.
- Button row in `.gh-modal-foot`: primary action left, Cancel right.

```html
<div class="gh-modal-overlay" id="myModal"
     onclick="if(event.target===this)$('myModal').classList.remove('open')">
  <div class="gh-modal">
    <div class="gh-modal-title">Confirm Delete</div>
    <div class="gh-modal-body">This cannot be undone.</div>
    <div class="gh-modal-foot">
      <button class="btn btn-primary" style="background:var(--red)" onclick="doDelete()">Delete</button>
      <button class="btn btn-ghost" onclick="$('myModal').classList.remove('open')">Cancel</button>
    </div>
  </div>
</div>
```

---

## Button Label Standard

| Action | Label | Class |
|--------|-------|-------|
| Save record | **Save** | `btn btn-primary` |
| Close without saving | **Cancel** | `btn btn-ghost` |
| Remove record (soft) | **Delete** | `btn btn-ghost` + `color:var(--red)` |
| Confirm destructive | **Delete** | `btn btn-danger` |
| Archive item | **Archive** | `btn btn-danger` |

**Never use:** "OK", "Submit", "Add", "Remove", "del", lone × close buttons on drawers.
**Every modal and drawer must have a visible Cancel button.**

---

## Google Integration — Current State

**Google Calendar: REMOVED.** calendar.html exists but is dead. Not in nav, not in dashboard.
**Google Tasks: PLANNED.** Todos will sync to Google Tasks. Not yet implemented. The `/api/v1/google` routes handle Calendar OAuth — these will be repurposed or replaced for Tasks.

**Rule: Do not add any new Google Calendar references. Do not add Google Tasks until designed.**

---

## Shared JS Files (affect ALL pages)

| File | What it owns | Change impact |
|------|-------------|---------------|
| `public/nav.js` | Sidebar, page header, bell dropdown, MODULES registry | Every page header and sidebar |
| `public/theme.js` | Dark/light/teal theme | Every page appearance |
| `public/js/lt-core.js` | `$()`, `api()`, `esc()`, `toast()`, `LT`, `GH_SELECT`, `GH_TAGS`, `GH_TAG_SEARCH`, `GH_VIEW`, `GH_FAMILY`, `makeApi()`, `fmt$()`, `fmtDate()`, `LT.confirm()`, spinner, emptyState, errorState | Every page — highest risk |
| `public/js/lt-refs.js` | `GH_REFS` — contact/family pickers via settings.html iframe | inventory, medical, property |
| `public/js/lt-messages.js` | `GH_EMPTY`, `emptyState()`, `errorState()` | Any page showing empty/error states |
| `public/shared.css` | ALL component styles | Every page — second highest risk |

**Rule: If you change lt-core.js, run full JS audit across all pages.**

---

## Page → Backend API Dependencies

| Page | Backend modules used |
|------|---------------------|
| `index.html` | `/dashboard` |
| `finance.html` | `/finance`, `/hsa`, `/import` |
| `inventory.html` | `/inventory`, `/attachments`, `/settings` |
| `medical.html` | `/medical`, `/settings` |
| `todos.html` | `/todos`, `/settings` |
| `daily-log.html` | `/daily-log`, `/settings` |
| `career.html` | `/career`, `/settings` |
| `property.html` | `/property`, `/settings` |
| `documents.html` | `/documents`, `/settings` |
| `resources.html` | `/resources`, `/settings` |
| `books.html` | `/books` |
| `kids.html` | `/kids` |
| `notifications.html` | `/notifications` |
| `reports.html` | `/finance/reports`, `/settings`, `/app`, `/dashboard` |
| `settings.html` | ALL modules (diagnostic tests) |
| `data.html` | `/data` |

---

## Backend Route Registry

| Mount path | File |
|-----------|------|
| `/api/v1/auth` | features/auth/routes.js |
| `/api/v1/daily-log` | features/dailylog/routes.js |
| `/api/v1/inventory` | features/inventory/routes.js |
| `/api/v1/resources` | features/resources/routes.js |
| `/api/v1/todos` | features/todos/routes.js |
| `/api/v1/notifications` | features/notifications/routes.js |
| `/api/v1/dashboard` | features/dashboard/routes.js |
| `/api/v1/settings` | features/settings/routes.js |
| `/api/v1/hsa` | features/hsa/routes.js |
| `/api/v1/medical` | features/medical/routes.js |
| `/api/v1/medical/eob` | features/medical/routes.js — **PLANNED** (EOB import, pdf-parse, 4-table schema) |
| `/api/v1/attachments` | features/attachments/routes.js |
| `/api/v1/backup` | features/backup/routes.js |
| `/api/v1/finance` | features/finance/routes.js |
| `/api/v1/career` | features/career/routes.js |
| `/api/v1/books` | features/books/routes.js |
| `/api/v1/property` | features/property/routes.js |
| `/api/v1/import` | features/import/routes.js |
| `/api/v1/documents` | features/documents/routes.js |
| `/api/v1/google` | features/google/routes.js (OAuth only — Google Tasks integration pending design) |
| `/api/v1/kids` | features/kids/routes.js |
| `/api/v1/data` | features/data/routes.js |

---

## GH_SELECT — canonical dropdown_options keys

| list_key | Used by | Seeded in |
|----------|---------|-----------|
| `inventory_category` | inventory.html | migration 006 |
| `hw_subcategory` | inventory.html | migration 013 |
| `dailylog_category` | daily-log.html | migration 006 |
| `todo_category` | todos.html | migration 006 |
| `hsa_category` | finance.html | migration 029 |
| `document_category` | documents.html | migration 026 |
| `document_subcategory` | documents.html | migration 026 |
| `kids_activity_category` | kids.html | migration 013 |
| `kids_note_category` | kids.html | migration 013 |
| `property_type` | property.html | migration 013 |
| `property_maintenance_category` | property.html | migration 013 |
| `book_genre` | books.html | migration 013 |
| `career_job_type` | career.html | migration 013 |
| `career_skill_category` | career.html | migration 013 |
| `career_goal_category` | career.html | migration 013 |
| `resource_category` | resources.html | migration 044 |
| `finance_category` | finance.html | migration 045 |
| `hsa_store` | finance.html | migration 045 |
| `vehicle_service_type` | property.html | migration 047 |
| `hsa_otc_category` | finance.html | migration 047 |
| `financial_institution` | finance.html | migration 047 |
| `school_name` | career.html | migration 048 |

**Rule: Growing dropdown = GH_SELECT + dropdown_options. Never hardcode `<option>` lists.**

---

## Canonical Entity Types (tags system)

| Module | entity_type | Wired? |
|--------|-------------|--------|
| Inventory items | `item` | ✓ |
| Daily Log | `daily_log` | ✓ |
| Resources | `resource` | ✓ |
| Documents | `document` | ✓ |
| Books | `book` | ✓ |
| Finance transactions | `finance_transaction` | ✓ |
| HSA payments | `hsa_payment` | ✓ |
| Todos | `todo` | ✓ |
| Medical medications | `medical_medication` | ✓ |
| Medical visit notes | `medical_visit` | ✓ |
| Kids activities | `kid_activity` | ✓ |
| Kids notes | `kid_note` | ✓ |
| Career certifications | `career_cert` | ✓ |
| Career jobs | `career_job` | ✓ |
| Career skills | `career_skill` | ✓ |
| Properties | `property` | ✓ |
| Vehicles | `vehicle` | ✓ |
| EOB statements | `eob_statement` | ⬜ planned |
| EOB claims | `eob_claim` | ⬜ planned |

**Rule: Use ONLY entity_types from this table. Never invent new strings.**

---

## UI Design System — Consistency Rules

### Card Pattern (ALL modules must use this)

The `.card` class in shared.css is the **single card component**. Every list item across
every module must use it. No per-module `.book-card`, `.career-card`, `.med-card` etc.

```html
<!-- Standard card -->
<div class="card" onclick="openDrawer(item.id)">
  <div class="card-header">
    <div class="card-icon" style="background:rgba(139,92,246,.12)">📚</div>
    <div style="flex:1;min-width:0">
      <div class="card-title">Record Title</div>
      <div class="card-sub">Subtitle / secondary info</div>
    </div>
    <!-- Optional: badge or status on right -->
    <span class="badge badge-active">Active</span>
  </div>
  <div class="card-meta">
    <!-- chips, tags, dates, secondary data -->
  </div>
</div>
```

Card CSS rules in shared.css:
- `.card` — base: bg2, border, r-lg, padding 12px 14px, hover lift, click cursor
- `.card-header` — flex row, gap 10px, align-items flex-start
- `.card-icon` — 32px square, border-radius r, centered icon/emoji
- `.card-title` — 14px, font-weight 600, color var(--text)
- `.card-sub` — 12px, color var(--text3), margin-top 2px
- `.card-meta` — flex wrap, gap 6px, margin-top 8px (tags, badges, dates)

**Migration status:**
- ✅ career.html — migrated to .card
- ✅ medical.html — migrated to .card
- ✅ property.html — migrated to .card
- ✅ kids.html — full redesign, new CSS classes
- ✓ todos.html — .todo-item kept (justified: checkbox + priority stripe + bulk select)
- ✓ resources.html — .res-card kept (justified: type icon + favorite star + open link)
- books.html — .book-card partial (has cover thumb layout — keep that)

---

### Filter / Search Bar Pattern

Every module that has a list should have consistent filter/search at the top:
1. **Search input** (text, placeholder "Search…") — client-side filter on name/title/description
2. **GH_VIEW toolbar** (grid/list toggle + column count + Advanced Filters) — for modules with GH_VIEW
3. **Category strip** (pill tabs) — for modules with category tabs (resources, medical, inventory)
4. **FAB** (+) — always bottom-right, opens the "Add new" drawer

Modules missing search bar: career, todos, medical, kids — these should get one.

---

### Gamification System — Design (not yet built)

Planned for kids module first, extensible to any family member + module combination.

**Core tables (future migration):**
```sql
-- Points ledger — one row per earning event
CREATE TABLE gh_points (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_member_id INTEGER NOT NULL REFERENCES family_members(id),
  points        INTEGER NOT NULL,       -- positive = earned, negative = spent
  source_type   TEXT NOT NULL,          -- 'book_finished', 'todo_completed', 'chore', etc.
  source_id     INTEGER,                -- id of the record that triggered it
  note          TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Achievements / badges — awarded once when condition first met
CREATE TABLE gh_achievements (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  family_member_id INTEGER NOT NULL REFERENCES family_members(id),
  achievement   TEXT NOT NULL,          -- 'first_book', '10_books', 'week_streak', etc.
  awarded_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Rules:**
- Points are additive, immutable — never update a points row, only insert new ones
- Achievements are idempotent — check before insert, skip if already awarded
- Point values configurable via `app_config` table (key: `points_book_finished`, etc.)
- Display: points total, badge shelf, streak counter — shown on kids profile + dashboard widget
- Stickers = achievement badge images stored in `/app/public/stickers/` and referenced by achievement name

**Trigger points (examples — values TBD):**
- Book finished → +10 points + check "X books read" achievements
- Todo completed (tagged 'chore') → +5 points
- Daily log entry (tagged 'school') → +2 points
- Reading streak (7 consecutive days with progress) → achievement "Week Reader"

**Rule: Do not build until the points schema is reviewed and values agreed.**

---


---

## Cross-Module Relationships — Architecture

### What exists today

Three generic link tables handle cross-module associations:

| Table | Pattern | What it links |
|-------|---------|---------------|
| `taggables` | `(tag_id, entity_type, entity_id)` | Any record ↔ any tag |
| `record_family_members` | `(entity_type, entity_id, family_member_id)` | Any record ↔ family member |
| `todos.auto_source_type/auto_source_id` | source type + id on todo | Todo ↔ originating record |

Direct foreign keys also exist for specific relationships:
- `med_visit_notes.contact_id` → contacts (physician)
- `vehicles.contact_id` → contacts (insurance)
- `property_maintenance.contact_id` → contacts (vendor)
- `kids.school_id` → contacts (school)
- `items.warranty_vendor_contact_id` → contacts

### The planned pattern: entity_links (not yet built)

For the consumption/usage model (e.g. vehicle service uses inventory item, which reduces quantity),
a generic **entity_links** table is the right approach — same pattern as taggables:

```sql
CREATE TABLE entity_links (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  -- "from" side: the record that references something
  from_type       TEXT NOT NULL,   -- e.g. 'vehicle_service'
  from_id         INTEGER NOT NULL,
  -- "to" side: what is being referenced/consumed
  to_type         TEXT NOT NULL,   -- e.g. 'item'
  to_id           INTEGER NOT NULL,
  -- optional quantity consumed (for inventory deductions)
  quantity_used   REAL,
  -- relationship label (for display)
  link_label      TEXT,            -- e.g. 'consumed', 'related', 'referenced'
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Side effects on link creation** are handled by a `processLinkSideEffects()` function called
after INSERT — not by triggers (too hard to debug) and not by CASCADE (no ON DELETE CASCADE rule).

Example side effects:
- `vehicle_service → item (consumed, qty=1)` → item.quantity -= 1 → if quantity ≤ 0, auto-create todo "Restock [item name]"
- `daily_log → item (used)` → no quantity change, just a reference
- `medical_visit → med_medication (prescribed)` → no quantity change

### Design rules when this gets built

1. `entity_links` goes in a new migration — never modify existing tables for this
2. `to_type` must be a canonical entity_type from the WIRING.md entity types table
3. Side effects run in a transaction with the original write — never async
4. Auto-todo creation on depletion reuses `syncAutoTodos()` pattern
5. The UI picker for "link to inventory item" uses a search overlay — not a dropdown (too many items)
6. **Do not build until the first concrete use case is designed end-to-end** — vehicle service is the natural first candidate


---

## Known Patterns That Break

1. **GETs after `router.use(requireAuth)`** → all GETs 401. Always put GETs first.
2. **Non-async function with `await GH_SELECT.init()`** → silent crash. Make opener functions async.
3. **`$id()` instead of `$()`** → undefined → whole JS fails silently. Only `$()` is defined.
4. **`var(--surface)`, `var(--text1)`, `var(--bg5)`** → don't exist → invisible rendering.
5. **Duplicate contact form** → lives ONLY in settings.html. Never copy it.
6. **ON DELETE CASCADE** → never. Clean up child records manually.
7. **WAL journal mode** → never. Always DELETE + FULL.
8. **Hardcoded `<option>` for growing data** → always GH_SELECT + dropdown_options.
9. **Per-module CSV/XLSX exports** → never. Use `/api/v1/data/export` only.
10. **api(path, {method, body})** → wrong signature. Always `api(method, path, body)`.
11. **FormData uploads as JSON** → must stay as raw fetch. makeApi is JSON only.

---

## Pre-Deploy Checklist

```bash
# 1. JS syntax check all pages
for page in index finance inventory medical career property todos books documents \
            kids resources daily-log reports notifications data settings; do
  python3 -c "
import re
with open('app/public/${page}.html') as f: c=f.read()
scripts=re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>',c,re.DOTALL)
open('/tmp/chk.js','w').write('\n'.join(scripts))" && \
  node --check /tmp/chk.js && echo "${page}.html OK"
done

# 2. Route files
for f in app/features/*/routes.js app/features/finance/budgets.js; do
  node --check $f && echo "$f OK"
done

# 3. Smoke test
bash smoke-test.sh
```

---

## EOB Import — Wiring Notes (PLANNED — 🔴-C in backlog)

**New tables:** med_eob_statements, med_eob_claims, med_eob_services, med_eob_balances
**New route:** POST /api/v1/medical/eob/preview — returns parsed statement list (no DB write)
**New route:** POST /api/v1/medical/eob/import — writes selected statements to 4 tables
**File handling:** multer memoryStorage() — file never hits disk
**Parser:** pdf-parse (local) → text → MHBP-specific regex extractor
**New migration files:** 054_eob_statements.sql, 055_eob_claims.sql, 056_eob_services.sql, 057_eob_balances.sql

**Read Section 16 of HANDOFF.md before building.**

