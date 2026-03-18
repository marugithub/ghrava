# Ghrava Wiring Map
**Consult this before changing ANYTHING. Update it when adding new dependencies.**
Last updated: 202603.004

---

## Rule: Before touching a file, check its row. Touch cascades to every dependent.

---

## Shared JS Files (affect ALL pages)

| File | What it owns | Change impact |
|------|-------------|---------------|
| `public/nav.js` | Sidebar, page header, collapse state, GH_PAGE config | Every page header and sidebar |
| `public/theme.js` | Dark/light/teal theme application | Every page appearance |
| `public/js/lt-core.js` | `window.$`, `window.api`, `window.esc`, `window.toast`, `window.LT`, auth gate, spinner, emptyState, errorState | Every page — highest risk |
| `public/js/lt-messages.js` | `window.GH_EMPTY` — all empty state content | Any page showing empty states |
| `public/js/lt-shared-data.js` | Shared dropdowns: family, contacts, physicians, locations, tags | finance, inventory, medical, career, books |
| `public/attachments.js` | Attachment UI widget | finance, inventory |
| `public/shared.css` | ALL component styles | Every page — second highest risk |

**Rule: If you change lt-core.js, re-run the full JS audit across all 15 pages.**
**Rule: If you change shared.css, check medical.html and resources.html for local overrides.**

---

## CSS Shared Components (defined in shared.css, used in 12+ pages)

Changing any of these in shared.css affects all pages listed:

| Class | Pages affected | Notes |
|-------|---------------|-------|
| `.view-tab` / `.view-tabs` | All 15 | `flex: 0 0 auto` — do NOT change to flex:1 |
| `.view-panel` / `.view-panel.active` | All 15 | Tab content show/hide |
| `.btn`, `.btn-primary`, `.btn-ghost` | All 15 | |
| `.drawer`, `.drawer-overlay`, `.drawer-title` | All 15 | |
| `.form-input`, `.form-select`, `.form-label`, `.form-group` | All 15 | |
| `.spinner`, `.spin` | All 15 | Initial loading state |
| `.empty-state`, `.empty-state-*` | All 15 | Used via `emptyState()` helper |
| `.fab` | 12 pages | Float action button |
| `--tab-color` CSS var | All tab bars | Set per-page on `.view-tabs` element |

**Rule: Never redefine these in a page `<style>` block. medical.html and resources.html were offenders — fixed in 202603.003.**

---

## Page → Backend API Dependencies

| Page | Backend modules used |
|------|---------------------|
| `finance.html` | `/finance` (LOCKED), `/hsa` (LOCKED), `/import` |
| `inventory.html` | `/inventory`, `/attachments` (LOCKED), `/settings` |
| `medical.html` | `/medical`, `/settings` (partial) |
| `todos.html` | `/todos`, `/settings` (dropdowns) |
| `daily-log.html` | `/daily-log`, `/settings` (dropdowns) |
| `career.html` | `/career`, `/settings` (dropdowns) |
| `property.html` | `/property` |
| `documents.html` | `/documents`, `/settings` (family) |
| `resources.html` | `/resources` |
| `books.html` | `/books` |
| `kids.html` | `/kids` |
| `settings.html` | ALL modules (diagnostic tests) |
| `reports.html` | `/finance` (LOCKED) |
| `index.html` | `/dashboard`, `/google` |
| `calendar.html` | `/google`, `/settings` |

---

## Backend Auth Model

**Rule: Finance and HSA GET routes are intentionally locked. The UI must handle 401 gracefully — show errorState(), never leave a spinner.**

| Module | GET auth | Write auth | Intent |
|--------|----------|------------|--------|
| `finance` | LOCKED | LOCKED | Sensitive financial data |
| `hsa` | LOCKED | LOCKED | Sensitive financial data |
| `attachments` | LOCKED | LOCKED | File access requires auth |
| `backup` | LOCKED | LOCKED | Data export requires auth |
| `settings` | Partial (7 public, 11 locked) | All locked | Dropdowns public, config locked |
| `todos` | Public | Locked | GETs before requireAuth |
| `resources` | Public | Locked | GETs before requireAuth |
| `inventory` | Public | Locked | GETs before requireAuth |
| `notifications` | Public | Locked | GETs before requireAuth |
| All others | Public | Locked | Standard pattern |

**Rule: When adding a new route, GETs go BEFORE `router.use(requireAuth)`. Writes go after.**

---

## Empty State & Error Pattern

**Rule: NEVER write inline `<div style="color:var(--red)">Failed to load</div>`. Always use:**

```js
// Empty (no data exists yet)
el.innerHTML = emptyState(...GH_EMPTY.accounts);
el.innerHTML = emptyState('🔍', 'No results', 'Try a different filter', '');

// Error (fetch failed)
el.innerHTML = errorState(e.message, 'loadAccounts()');  // with retry
el.innerHTML = errorState(e.message, '');                  // no retry
```

**Rule: NEVER bake a `<div class="spinner">` into HTML for tab panels that load on demand.
Tab panels start EMPTY. The load function sets the spinner, then replaces it with data or error.**

---

## Module-to-Page Mapping (for when you change a backend module)

Changing a backend module affects these frontend pages:

| Backend module | Frontend pages | Risk |
|---------------|----------------|------|
| `finance` | finance.html, reports.html | High — 8 tabs |
| `hsa` | finance.html (HSA tab) | High — 4 sub-tabs |
| `inventory` | inventory.html, settings.html (diag) | High — complex |
| `settings` | todos.html, daily-log.html, career.html, inventory.html, medical.html, calendar.html, settings.html | High — dropdowns used everywhere |
| `todos` | todos.html, index.html (dashboard), settings.html | Medium |
| `daily-log` | daily-log.html, settings.html | Medium |
| `dashboard` | index.html | Low |
| `attachments` | finance.html, inventory.html | Medium |
| `kids` | kids.html | Low |
| `property` | property.html | Low |
| `career` | career.html | Low |
| `medical` | medical.html | Low |
| `books` | books.html, settings.html (diag) | Low |
| `documents` | documents.html | Low |
| `resources` | resources.html | Low |

---

## Known Patterns That Break

1. **Local `<style>` blocks redefining `.view-tab`** → overrides shared.css flex fix → tabs squish. Check: medical.html, resources.html.

2. **Baked-in spinners in tab panels** → spinner shows forever if tab not active on load. Rule: tab panel HTML starts empty.

3. **`router.use(requireAuth)` before `router.get()`** → all GETs return 401 → UI shows error on every load. Rule: GETs always before the blanket middleware.

4. **Boot guard `if(LT.authToken)` in DOMContentLoaded** → page shows nothing if auth token not yet set. Rule: auth gate handles auth before page loads — remove these guards.

5. **`$id()` instead of `$()`** → undefined function error → whole JS crashes silently. Rule: only `$()` is defined in lt-core. Never use `$id()`.

6. **`var(--surface)` or `var(--text1)` in any page** → these vars don't exist in our theme → invisible rendering. Rule: use `var(--bg2)` and `var(--text)`.

7. **Template literal inside HTML string**: `` `<span>${x}</span>` `` as a raw HTML value → renders literal backtick characters. Rule: run the JS syntax audit before shipping.

---

## Pre-Deploy Checklist

Run these before every deploy:

```bash
# 1. JS syntax check all pages
python3 -c "
import os, re, subprocess, tempfile
pub = '/home/claude/ghrava_clean/app/public'
for f in sorted(os.listdir(pub)):
    if not f.endswith('.html'): continue
    c = open(f'{pub}/{f}').read()
    scripts = re.findall(r'<script(?:\s+[^>]*)?>(?!.*?src=)(.*?)</script>', c, re.DOTALL)
    combined = '\n'.join(scripts)
    if not combined.strip(): continue
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as tmp:
        tmp.write(combined); tp = tmp.name
    r = subprocess.run(['node', '--check', tp], capture_output=True, text=True)
    os.unlink(tp)
    if r.returncode != 0: print(f'{f}: {r.stderr[:100]}')
"

# 2. Div balance check
python3 -c "
import os
for f in sorted(os.listdir('/home/claude/ghrava_clean/app/public')):
    if not f.endswith('.html'): continue
    c = open(f'/home/claude/ghrava_clean/app/public/{f}').read()
    d = c.count('<div') - c.count('</div>')
    if d: print(f'{f}: {d:+d}')
"

# 3. Check for stale CSS vars
python3 -c "
import os
stale = ['var(--surface)', 'var(--text1)', 'var(--r-sm)', 'var(--bg5)']
for f in sorted(os.listdir('/home/claude/ghrava_clean/app/public')):
    if not f.endswith('.html'): continue
    c = open(f'/home/claude/ghrava_clean/app/public/{f}').read()
    for v in stale:
        if v in c: print(f'{f}: {v}')
"

# 4. Check for local api() definitions
python3 -c "
import re, os
pub = '/home/claude/ghrava_clean/app/public'
for f in sorted(os.listdir(pub)):
    if not f.endswith('.html'): continue
    c = open(f'{pub}/{f}').read()
    if re.search(r'const api\s*=.*?fetch\(', c[:8000], re.DOTALL) and 'window.api' not in c[:1000]:
        print(f'{f}: has local fetch-based api()')
"
```

---

## Canonical Entity Types (tags+taggables system)

Every module that supports tags MUST use exactly this entity_type string.
No other strings are valid. This is the single source of truth.

| Module | entity_type | Backend file | Currently wired? |
|--------|-------------|--------------|-----------------|
| Inventory items | `item` | inventory/routes.js | ✓ Yes |
| Daily Log entries | `daily_log` | dailylog/routes.js | ✓ Yes |
| Resources | `resource` | resources/routes.js | ✓ Yes |
| Documents | `document` | documents/routes.js | ✗ No — uses freetext column |
| Medical visits | `medical_visit` | medical/routes.js | ✗ No |
| Medical medications | `medical_medication` | medical/routes.js | ✗ No |
| Todos | `todo` | todos/routes.js | ✗ No |
| Career certs | `career_cert` | career/routes.js | ✗ No |
| Career jobs | `career_job` | career/routes.js | ✗ No |
| Books | `book` | books/routes.js | ✗ No |
| Kids notes | `kid_note` | kids/routes.js | ✗ No |
| Property | `property` | property/routes.js | ✗ No |
| Vehicles | `vehicle` | property/routes.js | ✗ No |
| Finance transactions | `finance_transaction` | finance/routes.js | ✗ No |
| Gift cards | `gift_card` | finance/routes.js | ✗ No |

**Rule: When adding tag support to a module, use ONLY the entity_type from this table.
Never invent a new string. Update this table when adding a new module.**

---

## Canonical dropdown_options Keys

Every configurable dropdown MUST pull from dropdown_options.
No hardcoded <option> lists are permitted except for truly static enumerations
(e.g. book format: Physical/Kindle/Audible — user would never add "VHS" to this list).

### Already seeded (migration 006, 013, 026, 029):
| list_key | Used by |
|----------|---------|
| `inventory_category` | inventory.html |
| `hw_subcategory` | inventory.html |
| `contact_type` | settings.html |
| `item_condition` | inventory.html |
| `purchase_method` | inventory.html |
| `dailylog_category` | daily-log.html |
| `todo_category` | todos.html |
| `hsa_category` | finance.html |

### Needs to be seeded (migration 036):
| list_key | Used by | Values to seed |
|----------|---------|----------------|
| `document_category` | documents.html | Tax, Legal, Insurance, Warranty, Medical, Financial, Property, Vehicle, Career, Other |
| `document_subcategory` | documents.html | Flat list covering all categories: Federal Return, Life Insurance, Will/Trust, Service Record, Lab Results… (21 values). GH_SELECT lets user add their own. |
| `kids_activity_category` | kids.html | Sports, Music, Arts, Academic, Social, Religious, Volunteer, Other |
| `kids_note_category` | kids.html | General, Medical, School, Milestone, Behavior, Achievement |
| `property_type` | property.html | Primary Residence, Rental, Vacation, Land, Commercial, Other |
| `property_maintenance_category` | property.html | Roof, HVAC, Plumbing, Electrical, Landscaping, Appliance, Pest Control, Other |
| `vehicle_service_type` | property.html | Oil Change, Tire Rotation, Brake Service, Inspection, Registration, Repair, Recall, Other |
| `medical_visit_type` | medical.html | Primary Care, Specialist, Urgent Care, ER, Dental, Vision, Mental Health, Lab, Imaging, Other |
| `medical_condition_status` | medical.html | Active, Managed, Resolved, Monitoring |
| `medical_physician_type` | medical.html | Primary Care, Specialist, Dentist, Optometrist, Mental Health, Other |
| `book_genre` | books.html | Fiction, Non-fiction, Biography, Science, History, Technology, Self-help, Other |

### Static enumerations (hardcoded is acceptable — user would never add values):
| Field | Values | Reason static is OK |
|-------|--------|---------------------|
| book_status | Want to Read, Currently Reading, Read | Fixed reading states |
| book_format | Physical, Kindle, Audible | Fixed media types |
| cert_status | Active, Expired, Pending, Suspended | Fixed cert states |
| medical_condition_status | Active, Managed, Resolved, Monitoring | Clinical states |

---

## GH_SELECT Design Specification

A shared utility (in lt-core.js) that wraps any <select> backed by dropdown_options.

**Usage pattern:**
```html
<select id="dCat" class="form-select"></select>
```
```js
// In page init or drawer open:
await GH_SELECT.init('dCat', 'document_category', currentValue);
```

**What GH_SELECT does:**
1. Fetches options from `/api/v1/settings/dropdowns/{list_key}`
2. Populates the `<select>` with those options
3. Appends a special `<option value="__add__">＋ Add new…</option>` at bottom
4. When `__add__` is selected: opens a small inline modal (not a drawer — lightweight)
   - Input field: "New value name"
   - Save button: POSTs to `/api/v1/settings/dropdowns` with the new value
   - On success: refreshes the dropdown, selects the new value
5. Restores the `currentValue` if provided (for edit mode)

**The modal is NOT a full drawer.** It's a small centered popup:
- 320px wide, positioned near the select
- Single text input + Save/Cancel
- Closes on Save or Cancel or Esc

**Authentication:** Creating a new dropdown value requires auth (POST to settings).
The modal shows the auth-required toast if not logged in.

---

## Tag Search Architecture (future feature)

Backend endpoint: `GET /api/v1/tags/:tagName/search`

Returns all records across all modules tagged with that value:
```json
{
  "tag": "insurance",
  "results": [
    { "entity_type": "document", "entity_id": 3, "title": "State Farm Policy 2024", "module": "documents", "url": "/documents.html?id=3" },
    { "entity_type": "resource", "entity_id": 12, "title": "State Farm Portal", "module": "resources", "url": "/resources.html" },
    ...
  ]
}
```

Each module registers a "title query" — a SQL fragment that returns `id, title` for that entity_type.
The endpoint queries taggables for all matching entity_type+entity_id pairs, then fetches titles.

Frontend: A `GH_TAG_SEARCH` panel that can be triggered from any tag click.
Contextual: if triggered from within a module, filters to that module's entity_types only.
Global: if triggered from Reports or a global search, shows all modules.

**This only works if all modules use canonical entity_types from the table above.**
