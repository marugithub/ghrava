# Ghrava Wiring Map
**Consult this before changing ANYTHING. Update it when adding new dependencies.**
Last updated: v202603.101

---

## Rule: Before touching a file, check its row. Touch cascades to every dependent.

---

## Shared JS Files (affect ALL pages)

| File | What it owns | Change impact |
|------|-------------|---------------|
| `public/nav.js` | Sidebar, page header, bell dropdown, GH_PAGE config, MODULES registry | Every page header and sidebar |
| `public/theme.js` | Dark/light/teal theme | Every page appearance |
| `public/js/lt-core.js` | `$()`, `api()`, `esc()`, `toast()`, `LT`, `GH_SELECT`, `GH_TAGS`, `GH_TAG_SEARCH`, `GH_VIEW`, `GH_FAMILY`, spinner, emptyState, errorState | Every page — highest risk |
| `public/js/lt-refs.js` | `GH_REFS` — contact/family pickers via settings.html iframe | inventory, medical, property, settings |
| `public/js/lt-messages.js` | `GH_EMPTY` — all empty state content | Any page showing empty states |
| `public/js/lt-shared-data.js` | Shared dropdowns: family, contacts, locations | finance, inventory, medical, career, books |
| `public/shared.css` | ALL component styles | Every page — second highest risk |

**Rule: If you change lt-core.js, re-run the full JS audit across all pages.**
**Rule: If you change lt-refs.js, test contact picker from inventory, medical, and property.**
**Rule: If you change shared.css, check medical.html and resources.html for local overrides.**

---

## Page → Backend API Dependencies

| Page | Backend modules used |
|------|---------------------|
| `index.html` | `/dashboard`, `/google` |
| `finance.html` | `/finance`, `/hsa`, `/import` |
| `inventory.html` | `/inventory`, `/attachments`, `/settings` |
| `medical.html` | `/medical`, `/settings` (contacts via lt-refs) |
| `todos.html` | `/todos`, `/settings` (dropdowns) |
| `daily-log.html` | `/daily-log`, `/settings` (dropdowns) |
| `career.html` | `/career`, `/settings` (dropdowns) |
| `property.html` | `/property`, `/settings` (contacts via lt-refs) |
| `documents.html` | `/documents`, `/settings` (family) |
| `resources.html` | `/resources`, `/settings` (dropdowns) |
| `books.html` | `/books` |
| `kids.html` | `/kids` |
| `notifications.html` | `/notifications` |
| `reports.html` | `/finance`, `/settings`, `/import`, `/app` |
| `settings.html` | ALL modules (diagnostic tests) — canonical contact/family forms |
| `data.html` | `/data` (unified export/import) |

---

## Backend Route Registry

| Mount path | File | Auth on writes |
|-----------|------|----------------|
| `/api/v1/auth` | features/auth/routes.js | n/a |
| `/api/v1/daily-log` | features/dailylog/routes.js | requireAuth (no-op) |
| `/api/v1/inventory` | features/inventory/routes.js | requireAuth (no-op) |
| `/api/v1/resources` | features/resources/routes.js | requireAuth (no-op) |
| `/api/v1/todos` | features/todos/routes.js | requireAuth (no-op) |
| `/api/v1/notifications` | features/notifications/routes.js | requireAuth (no-op) |
| `/api/v1/dashboard` | features/dashboard/routes.js | public |
| `/api/v1/settings` | features/settings/routes.js | requireAuth (no-op) |
| `/api/v1/hsa` | features/hsa/routes.js | requireAuth (no-op) |
| `/api/v1/medical` | features/medical/routes.js | requireAuth (no-op) |
| `/api/v1/attachments` | features/attachments/routes.js | requireAuth (no-op) |
| `/api/v1/backup` | features/backup/routes.js | requireAuth (no-op) |
| `/api/v1/finance` | features/finance/routes.js | requireAuth (no-op) |
| `/api/v1/career` | features/career/routes.js | requireAuth (no-op) |
| `/api/v1/books` | features/books/routes.js | requireAuth (no-op) |
| `/api/v1/property` | features/property/routes.js | requireAuth (no-op) |
| `/api/v1/import` | features/import/routes.js | requireAuth (no-op) |
| `/api/v1/documents` | features/documents/routes.js | requireAuth (no-op) |
| `/api/v1/google` | features/google/routes.js | public |
| `/api/v1/kids` | features/kids/routes.js | requireAuth (no-op) |
| `/api/v1/data` | features/data/routes.js | public (all) |

---

## GH_SELECT — canonical dropdown_options keys

Every configurable dropdown MUST pull from `dropdown_options`. No hardcoded `<option>` lists
for data that grows. Truly static enumerations (book format, cert status) may remain hardcoded.

| list_key | Used by | Seeded in |
|----------|---------|-----------|
| `inventory_category` | inventory.html | migration 006 |
| `hw_subcategory` | inventory.html | migration 013 |
| `contact_specialty` | settings.html | migration 006 |
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
| `location_name` | inventory.html | user-added |
| `resource_category` | resources.html | migration 044 |
| `finance_category` | finance.html | migration 045 |
| `hsa_store` | finance.html | migration 045 |
| `vehicle_service_type` | property.html | migration 047 |
| `hsa_otc_category` | finance.html | migration 047 |
| `financial_institution` | finance.html | migration 047 |

---

## GH_REFS — contact/family picker

Contact creation form lives **only** in `settings.html`. Other pages open it via `lt-refs.js`
which loads `settings.html?drawer=contact` in an iframe overlay. The `gh-drawer-only` CSS
class on body hides everything except the drawer. postMessage signals save/cancel.

Pages that load `lt-refs.js`: inventory.html, medical.html, property.html
Pages that need it but may be missing: **audit before adding new modules with contact fields**

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
| Medical visits | `med_visit_note` | ✗ |
| Medical medications | `med_medication` | ✗ |
| Kids notes | `kid_note` | ✓ (kids) |
| Kids activities | `kid_activity` | ✓ (kids) |
| Career certs | `career_cert` | ✗ |
| Properties | `property` | ✗ |
| Vehicles | `vehicle` | ✗ |

**Rule: Use ONLY the entity_type from this table. Never invent new strings.**

---

## Export / Import Architecture

### Type 1 — Ghrava data (your records)
- `GET /api/v1/data/export` → XLSX workbook, 20 sheets, Instructions sheet
- `GET /api/v1/data/template` → blank workbook with headers + instructions
- `POST /api/v1/data/import` → upload workbook, only present sheets processed
- Upsert key: `id` for most tables, `item_ref` for inventory Items
- Partial import: delete sheets before uploading — only present sheets are processed

### Type 2 — External bank statements
- `POST /api/v1/import/preview` — parse file, show preview (CSV/XLSX/OFX/QFX)
- `POST /api/v1/import/confirm` — import with auto-categorization via rules
- Parsers: Chase, BofA, Navy Federal, Schwab (checking + brokerage), Vanguard, TSP, Citi, Discover, generic
- Auto-categorize: `import_category_rules` table, 50+ seeded keyword rules, `POST /api/v1/finance/category-rules/apply`

---

## Known Patterns That Break

1. **GETs after `router.use(requireAuth)`** → all GETs 401 → UI errors on load. Always put GETs first.
2. **Non-async function with `await GH_SELECT.init()`** → silent crash. Make drawer-open functions async.
3. **`$id()` instead of `$()`** → undefined → whole JS fails silently.
4. **`var(--surface)`, `var(--text1)`, `var(--bg5)`** → don't exist → invisible rendering.
5. **Duplicate contact form** — the contact form lives ONLY in settings.html. Never copy it.
6. **ON DELETE CASCADE** — never. Clean up child records manually in a transaction.
7. **WAL journal mode** — never. Always DELETE + FULL.
8. **Hardcoded `<option>` for growing data** — always GH_SELECT + dropdown_options.
9. **Freetext for named entities** (person, place, org) — always GH_REFS or GH_SELECT.

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

**Rule: When adding a new page, add `const api = window.makeApi('/newmodule')` and use it for all calls.**

---

## Pre-Deploy Checklist

```bash
# JS syntax check all pages
for page in index finance inventory medical todos daily-log career property \
            documents resources books kids notifications reports settings data; do
  python3 -c "
import re
with open('app/public/${page}.html') as f: c=f.read()
scripts=re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>',c,re.DOTALL)
open('/tmp/chk.js','w').write('\n'.join(scripts))" && \
  node --check /tmp/chk.js && echo "${page}.html OK"
done

# Route files
for f in app/features/*/routes.js; do node --check $f && echo "$f OK"; done

# Smoke test
bash smoke-test.sh
```
