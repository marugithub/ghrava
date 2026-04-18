# Ghrava — UI & Layout Standards
*Read this before writing any HTML page or modifying any frontend code.*

---

## Core Principle
**Copy the pattern, never invent a new one.** If inventory.html or medical.html already solves the layout problem, match it exactly. Do not approximate.

---

## 1. List / Grid View — Required on Every Module

Every module with a list of records **must** use `GH_VIEW.init()`. No exceptions.

```javascript
GH_VIEW.init('myViewToolbar', 'module_key', state => {
  currentView = state.view;
  currentCols = state.cols;
  currentFilters = state.filters || {};
  render();
}, {
  defaultView: 'grid',        // 'grid' or 'list'
  defaultCols: 2,             // see column rules below
  filterFields: [...]         // see Advanced Find below
});
```

**Toolbar placement:** right-aligned in the panel header row with `flex:1` spacer on the left — matches inventory layout exactly.

**Default column count by card size:**
| Card content | Mobile default | Desktop default |
|---|---|---|
| Large cards (image, many rows) | 1 | 2 |
| Medium cards (name + 3-4 fields) | 2 | 3 |
| Small/compact cards (name + 1-2 fields) | 2 | 4 |

CSS grid uses `--cols` variable set by GH_VIEW:
```css
.my-grid { display:grid; grid-template-columns:repeat(var(--cols,2),minmax(0,1fr)); gap:10px; }
```

---

## 2. Advanced Find — Required on Every Module

Every module toolbar must include filter fields via `GH_VIEW.init()` `filterFields` array.

**Standard filter fields to include per module:**
- Text search (always — this is the search input)
- Status filter (if module has status: active/inactive/archived etc.)
- Date range (if module has dates)
- Family member (if module has `family_member_id`)
- Category (if module has categories)
- Tags (if module uses tags)

Filter field types: `'text'`, `'select'`, `'date'`, `'daterange'`

All filter options must come from `dropdown_options` via the API — never hardcoded in filterFields options array.

---

## 3. Cards — Use gh-card System

**Always use the shared card component. Never write custom card CSS.**

```html
<div class="gh-card gh-s-{color}" onclick="openDrawer(${id})">
  <div class="gh-card-head">
    <div class="gh-card-title">${name}</div>
    <span class="gh-badge gh-badge-{color}">${status}</span>
  </div>
  <div class="gh-card-meta">${subtitle}</div>
  <div class="gh-card-body">
    <div class="gh-card-row"><span>Label</span><span class="ghv">Value</span></div>
    <div class="gh-card-row"><span>Label</span><span class="ghv-warn">Warning value</span></div>
  </div>
  <div class="gh-card-footer">
    <div class="gh-card-tags">
      <span class="gh-badge gh-badge-blue">Tag</span>
    </div>
  </div>
</div>
```

**Status stripe colors:**
- `gh-s-green` — active, healthy, current
- `gh-s-amber` — pending, expiring, needs attention
- `gh-s-red`   — overdue, expired, error
- `gh-s-blue`  — info, selected, in-progress
- `gh-s-gray`  — inactive, archived, cancelled

**Value classes inside gh-card-row:**
- `ghv`      — default value (bold, dark)
- `ghv-ok`   — green positive value
- `ghv-warn` — amber warning value
- `ghv-err`  — red error value
- `ghv-dim`  — muted/secondary value

---

## 4. Badges

Always use `gh-badge`:
```html
<span class="gh-badge gh-badge-green">Active</span>
<span class="gh-badge gh-badge-amber">Expiring</span>
<span class="gh-badge gh-badge-red">Overdue</span>
<span class="gh-badge gh-badge-blue">Info</span>
<span class="gh-badge gh-badge-gray">Inactive</span>
```

Never use inline `background` + `color` for status indicators.

---

## 5. Action Buttons

**In cards/detail views:** use `gh-icon-btn` with inline SVG — never text.
```html
<button class="gh-icon-btn" onclick="editItem(id)" title="Edit">
  <svg width="16" height="16" viewBox="0 0 24 24" ...>...</svg>
</button>
```

**In drawers/forms:** text buttons are fine — `btn btn-primary`, `btn btn-ghost`, `btn btn-danger`.

**FAB:** one per page, SVG `+` icon, opens add drawer.
```html
<button class="fab" onclick="openDrawer()">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
</button>
```

---

## 6. Navigation — Every Page

```html
<script src="/nav.js"></script>
<script>window.GH_PAGE = { module:'mymodule', title:'My Module' };</script>
```

- `module` must match a key in `MODULES` registry in nav.js
- Every new module must be added to `MODULES` with `href`, `label`, `color`, `bg`, `svgKey`
- Every new module must be added to the correct section in `SIDEBAR_SECTIONS`
- SVG icon must be added to the `SVG` map in nav.js

---

## 7. Dropdowns — Never Hardcode

Any `<select>` with 3+ options must use `GH_SELECT`:
```javascript
await GH_SELECT.init('mySelect', 'list_key', currentValue, { allowAdd: true });
```

The list_key must be seeded in `dropdown_options` via a migration. No exceptions.

---

## 8. Stats / Summary Strips

Use `stat-item` inside a grid — never custom inline-styled summary cards:
```html
<div class="stats-row">
  <div class="stat-item">
    <div class="stat-value" style="color:var(--accent)">42</div>
    <div class="stat-label">Total</div>
  </div>
</div>
```

---

## 9. Required Shared Scripts

Every module page must load:
```html
<script src="/js/lt-core.js"></script>   <!-- GH_VIEW, GH_SELECT, GH_TAGS, GH_FAMILY -->
<script src="/js/lt-refs.js"></script>    <!-- GH_REFS — only if page uses contact/family pickers -->
<script src="/js/lt-messages.js"></script> <!-- LT.toast, LT.confirm, LT.modal -->
```

---

## 10. Pre-Ship Checklist

Before packaging any module, verify:
- [ ] `GH_VIEW.init()` wired with filterFields
- [ ] Default column count set per card size rules above
- [ ] All cards use `gh-card` + `gh-s-*` — no custom card CSS
- [ ] No hardcoded `<option>` lists with 3+ non-placeholder values
- [ ] `window.GH_PAGE = { module:'...', title:'...' }` present
- [ ] Module registered in `MODULES` and `SIDEBAR_SECTIONS` in nav.js
- [ ] `lt-refs.js` loaded if `GH_REFS` is used
- [ ] No `router.use(requireAuth)` in routes (writes only)
- [ ] No `ON DELETE CASCADE` in migrations
- [ ] Smoke test updated with new page + API endpoints

---

## 11. Modules — GH_VIEW Status

| Module | GH_VIEW | Default Cols | Advanced Find |
|---|---|---|---|
| inventory.html | ✅ | 2 grid | ✅ |
| medical.html | ✅ | list | ✅ |
| todos.html | ✅ | list | ✅ |
| career.html | ✅ | list | ✅ |
| kids.html | ✅ | list | ✅ |
| books.html | ✅ | 2 grid | ✅ |
| documents.html | ✅ | list | ✅ |
| resources.html | ✅ | list | ✅ |
| finance.html | ✅ | list | ✅ |
| property.html | ✅ | list | ✅ |
| daily-log.html | ✅ | list | ✅ |
| perfume.html | ✅ | 2 grid | ✅ status/gender/season/occasion/scent |
| wardrobe.html | ⚠️ planner tab is custom (intentional); Items/Outfits tabs need GH_VIEW | 2 | ⚠️ partial |
| subscriptions.html | ✅ | 2 grid | ✅ status/category |
| insurance.html | ✅ | 2 grid | ✅ status/type |
| notifications.html | ❌ intentional — feed layout | — | — |
