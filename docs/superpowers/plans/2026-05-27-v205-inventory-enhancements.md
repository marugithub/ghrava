# v.205 — Inventory grouping enhancements

**Goal:** Ship the 3 locked Inventory grouping candidates from BACKLOG.md (sibling shortcut, container aggregated stats, side-by-side comparison view) plus 2 audit gaps Al picked (sold-item workflow, warranty auto-suggest by category).

**Architecture:** Pure backend route additions + frontend wiring. **Zero schema changes** — all targeted columns already exist (`items.sold_*` fields, `containers.qr_code_path`, etc.). 5 functional pieces in 7 tasks.

**Tech stack:** Existing Express routes, existing `inventory.html` SPA, vanilla JS. No new dependencies. Existing deploy gates (`trade-mount.spec.js`, `reports-viewers-smoke.spec.js`) auto-cover regression for the Reports surface; inventory has no dedicated mount-check but smoke + E2E catch container crashes.

## Audit context (already done — referenced inline below)

Prod state: 27 items, 4 locations, 3 containers all under location id=1. 22 items at locations, 5 in containers, 0 nested-container depth. 1/27 items have warranty data; 0/27 have any value-field set (so the v.202 inventory-value tile shows $0 — data entry, not code).

**Backend readiness check (verified by reading routes):**
- `/items` already accepts `?parent_type=X&parent_id=N&category=Y&search=Z` (line 243 of `routes.js`). ✅
- `/items/:id` returns single-item detail (line 277). Needs `sibling_count` field added.
- `/containers` lists all containers (line 434). Needs aggregate fields added.
- `/containers/:id` returns container + `contents: {containers, items}` already (line 446). Needs aggregates added too.
- `/stats` exists (line 458) — sums `purchase_price` for total_value. ✅

**Schema (verified, no migrations needed):**
- `items.sold_date / sold_price / sold_to / sold_platform / is_archived / archived_reason` — all present (created in `001_initial.sql` + `107_wardrobe.sql`).
- `items.warranty_expires`, `items.purchase_date`, `items.category` — present.
- `items.replacement_value / appraised_value / purchase_price` — all present; the v.204 effective-value cascade (`replacement_value || appraised_value || purchase_price || 0`) reuses here for `total_value` aggregate.

## Cycle-time targets

- ≤ 110 min build + ~3 min smoke-only deploy (every-other rule: v.204 ran full Playwright; v.205 runs SMOKE ONLY via `-SkipE2E`)
- 7 tasks. Backend tasks first; frontend tasks read from already-deployed backend (intermediate states are safe).
- Single combined spec+quality review per task.

## Implementation patterns

Backend routes follow Ghrava conventions:
- Every `db.prepare` raw SQL gets a `// schema:` comment
- Reads stay `AUTH-OPEN-GET`; writes require `requireAuth`
- Errors via `serverError(res, err)` or `notFound(res, 'Resource')` or `badRequest(res, 'msg')`

Frontend follows `inventory.html` existing patterns (vanilla JS, the file is ~3700 lines but well-structured — Browse view, item-detail drawer, container-detail drawer).

---

### Task 1: Plan commit

`git add docs/superpowers/plans/2026-05-27-v205-inventory-enhancements.md && git commit -m "plan: v.205 Inventory enhancements (3 locked + sold + warranty-suggest)"`

---

### Task 2: Backend aggregates (locked #1 + #2)

**File:** `app/features/inventory/routes.js`

Three small changes:

**2A — `/items/:id` adds `sibling_count`** (line ~277):

```js
// schema: items(parent_type, parent_id, is_active, is_archived)
const siblings = db.prepare(
  `SELECT COUNT(*) as n FROM items
   WHERE parent_type=? AND parent_id=? AND id != ?
     AND is_active=1 AND is_archived=0`
).get(item.parent_type, item.parent_id, req.params.id);
item.sibling_count = siblings?.n || 0;
```

Insert after the `item` is loaded, before tags/attachments queries.

**2B — `/containers` list adds aggregates** (line ~434):

The current route just `SELECT * FROM containers`. Replace with a query that JOINs in the aggregates. Or — simpler — keep the base query and decorate each container in a `.map()` loop with three follow-up queries. Use the simpler approach:

```js
const containers = db.prepare('SELECT * FROM containers ORDER BY ...').all();
// schema: items(parent_type, parent_id, is_active, is_archived, purchase_price,
//   replacement_value, appraised_value, warranty_expires, lifetime_warranty)
const aggStmt = db.prepare(`
  SELECT
    COUNT(*) as item_count,
    COALESCE(SUM(COALESCE(replacement_value, appraised_value, purchase_price, 0)), 0) as total_value,
    SUM(CASE WHEN warranty_expires IS NOT NULL AND warranty_expires <= date('now','+30 days') AND warranty_expires >= date('now') AND lifetime_warranty=0 THEN 1 ELSE 0 END) as warranty_expiring_30d
  FROM items
  WHERE parent_type='container' AND parent_id=? AND is_active=1 AND is_archived=0
`);
containers.forEach(c => {
  const a = aggStmt.get(c.id);
  c.item_count = a?.item_count || 0;
  c.total_value = a?.total_value || 0;
  c.warranty_expiring_30d = a?.warranty_expiring_30d || 0;
});
```

**2C — `/containers/:id` adds same aggregates**. Same SQL as 2B but for the single container. Add the 3 fields to the response object alongside `contents`.

**Verify:**
- `curl http://192.168.4.62:3001/api/v1/inventory/containers | python -c "import json,sys; d=json.load(sys.stdin); print([{'name':c['name'],'item_count':c.get('item_count'),'total_value':c.get('total_value'),'warranty_30d':c.get('warranty_expiring_30d')} for c in d])"` — every container has the 3 new fields (may be 0)
- `curl http://192.168.4.62:3001/api/v1/inventory/items/1 | python -c "import json,sys; d=json.load(sys.stdin); print('sibling_count:', d.get('sibling_count'))"` — field present

**Commit:** `v.205 task 2: backend — sibling_count + container aggregates`

---

### Task 3: Frontend — sibling shortcut + container aggregated stats display

**File:** `app/public/inventory.html`

Two small additions:

**3A — Item-detail drawer: sibling shortcut.** Find the item-detail drawer's "Location" section (grep for `parent_type` or `Container` text). After the existing parent-link row, add a `Siblings` row that renders when `item.sibling_count > 0`:

```
{item.sibling_count} other item{s} in {container.name or location.name} →
```

Click the link → call the existing "open container drawer" / "show items at location" handler (whichever matches the parent type).

**3B — Browse view: container card aggregates.** Find the container card render (grep for `container_ref` or `CTN-` text within JSX/template strings). Where the container name renders, append an aggregate line below the name:

```
{item_count} item{s} · ${total_value} · {warranty_expiring_30d > 0 ? `⚠ ${warranty_expiring_30d} warranty ending` : ''}
```

Plain English, no jargon. Skip the `· $0` segment if `total_value === 0` (cleaner on prod where no items have value yet).

**Pattern reference:** the v.202 viewer renderers in `reports.html` use the same kind of conditional/null-safe rendering. inventory.html may use its own pattern — match what's already there.

**Verify:**
- Open prod `/inventory.html`, click an item that's in a container → drawer shows "N other items in [container name] →"
- Open Browse → container cards show "5 items" (Kitchen Box, etc.)
- `grep -c "/api/v1/trade/" app/public/inventory.html` → 0 (regression check)

**Commit:** `v.205 task 3: frontend — sibling shortcut + container aggregate cards`

---

### Task 4: Frontend — side-by-side comparison view-mode

**File:** `app/public/inventory.html`

Find the existing view-mode toggle (grep for `'card'`, `'grid'`, `'list'`, or `setView`). Add a third option: `'compare'` (or `'table'` — match the file's own naming).

When view-mode is `'compare'`:
- Render all visible items as rows in a single compact table
- Columns: Name / Size / Brand / Category / Purchase date / Effective value / Warranty status
- Sort by name ASC by default; allow column header click to re-sort
- Effective value = `replacement_value || appraised_value || purchase_price || 0`
- Warranty status: `lifetime_warranty=1` → "Lifetime"; `warranty_expires` past → red "Expired"; within 30 days → amber "{days}d left"; future → plain date; null → "—"
- Mobile responsive: drop Size + Category columns on narrow screens (CSS media query OR class toggle)

This view is most useful when filtered to a single container (`?parent_type=container&parent_id=N`) — the "7 wrenches, which sizes?" case from BACKLOG.md. Make sure the view-mode toggle PERSISTS via localStorage (consistent with `GH_VIEW.init` pattern in other modules).

**Verify:**
- Toggle view-mode to "compare" on Browse → table renders
- Sort by clicking a column header
- Toggle other view-modes → state restored on reload (localStorage persisting `inv_view`)

**Commit:** `v.205 task 4: frontend — side-by-side comparison view-mode`

---

### Task 5: Sold-item workflow (gap D)

**Files:** `app/features/inventory/routes.js` + `app/public/inventory.html`

**5A — Backend route:**

```js
// POST /api/v1/inventory/items/:id/sell — record sold metadata + archive
router.post('/items/:id/sell', requireAuth, (req, res) => {
  try {
    const d = req.body || {};
    if (!d.sold_date) return badRequest(res, 'sold_date required');
    // schema: items(sold_date, sold_price, sold_to, sold_platform,
    //   is_archived, archived_at, archived_reason, updated_at)
    const info = db.prepare(`
      UPDATE items SET
        sold_date=?, sold_price=?, sold_to=?, sold_platform=?,
        is_archived=1, archived_at=CURRENT_TIMESTAMP,
        archived_reason=COALESCE(?,'sold'), updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.sold_date,
      d.sold_price != null ? parseFloat(d.sold_price) : null,
      d.sold_to || null,
      d.sold_platform || null,
      d.archived_reason || null,
      req.params.id
    );
    if (info.changes === 0) return notFound(res, 'Item');
    const updated = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
    res.json(updated);
  } catch (err) { serverError(res, err); }
});
```

Insert near the existing item-update routes (grep for `router.put.*items` to find the area).

**5B — Frontend "Sold" action:**

In the item-detail drawer, near the existing edit/archive actions, add a "Sold" button. On click, open a small modal with 4 fields: sold_date (date input, defaults today) / sold_price (number) / sold_to (text) / sold_platform (text, with datalist suggestions: eBay, Facebook Marketplace, Craigslist, OfferUp, Local, Other). Submit → POST `/api/v1/inventory/items/${id}/sell` → close drawer + refresh Browse.

Match the file's existing modal-style and form-style. Keep labels in plain English.

**Verify (against prod after deploy):**
- `curl -X POST http://192.168.4.62:3001/api/v1/inventory/items/<test-id>/sell -H "Authorization: Bearer $TOKEN" -d '{"sold_date":"2026-05-27","sold_price":50,"sold_to":"Test","sold_platform":"eBay"}'` returns the updated item with is_archived=1
- Frontend modal saves + refreshes the item out of the active list (it's now archived)

**Commit:** `v.205 task 5: sold-item workflow (POST /sell + item-detail action)`

---

### Task 6: Warranty auto-suggest by category (gap F)

**Files:** `app/features/inventory/routes.js` + `app/public/inventory.html`

**6A — Backend route:**

A category→months lookup, hardcoded constant (no schema change). Common consumer-product warranty periods:

```js
// GET /api/v1/inventory/warranty-suggestions?category=X
// Returns { category, months } for known categories; null months otherwise.
// Source: typical manufacturer-warranty periods for consumer goods.
const WARRANTY_SUGGESTIONS = {
  'Electronics':    12,
  'Appliances':     24,
  'Tools':          12,
  'Office':         12,
  'Kitchen':        12,
  'Car':            36,
  'Furniture':      12,
  'Personal Care':  6,
  'Beauty':         null,    // typically no warranty
  'Books':          null,
  'Clothing':       null,    // wardrobe lives in wardrobe module
  'Toys':           6,
  'Sports':         12,
  'Music':          12,
};

router.get('/warranty-suggestions', (req, res) => {
  const cat = req.query.category;
  if (!cat) return badRequest(res, 'category param required');
  const months = WARRANTY_SUGGESTIONS[cat] != null ? WARRANTY_SUGGESTIONS[cat] : null;
  res.json({ category: cat, months, known: months != null });
});
```

**6B — Frontend auto-fill in item-entry form:**

In the item-creation/edit form, watch for changes on the `category` AND `purchase_date` fields. When both are non-empty AND `warranty_expires` is currently empty, fire `GET /api/v1/inventory/warranty-suggestions?category=X`. If `known === true`, compute `purchase_date + months` as ISO date and populate the warranty_expires field. Show a small hint near the field: "Auto-filled from typical Electronics warranty (12 mo) — adjust if different".

Don't OVERWRITE if the user already typed a warranty_expires value. Only auto-fill when the field is empty.

**Verify:**
- `curl http://192.168.4.62:3001/api/v1/inventory/warranty-suggestions?category=Electronics` returns `{"category":"Electronics","months":12,"known":true}`
- `?category=Beauty` returns `{"category":"Beauty","months":null,"known":false}`
- Frontend: pick category=Electronics + purchase_date=2026-01-01 → warranty_expires auto-fills 2027-01-01 with hint

**Commit:** `v.205 task 6: warranty auto-suggest by category (route + entry-form auto-fill)`

---

### Task 7: Docs + version bump

- `app/version.txt` → `202605.205`
- Prepend `STATE.md` with v.205 SHIPPED section enumerating: 3 locked + sold workflow + warranty suggest. Note: zero schema changes, smoke-only deploy per rotation.
- Update `BACKLOG.md` — mark "Inventory grouping enhancements" SHIPPED, remove from NEXT UP.
- Update `REPORTS_REDESIGN_HANDOFF.md` if its v.205+ reference still says "Inventory grouping enhancements" — replace with the next backlog item.

**Commit:** `v.205 task 7: docs + version bump + close inventory NEXT-UP item`

---

## Verification before deploy

1. `cat app/version.txt` → `202605.205`
2. `grep -c "router\\.\\(get\\|post\\)\\('" app/features/inventory/routes.js` — increased by 2 (POST /sell + GET /warranty-suggestions)
3. `grep -c "sibling_count\\|warranty_expiring_30d\\|warranty-suggestions" app/features/inventory/routes.js` ≥ 4 (sibling logic + 2 container-route aggregate fields + warranty route)
4. Run trade-mount + reports-viewers-smoke specs locally — both should still pass (v.205 doesn't touch reports.html or trade.html)

## Deploy

Smoke-only per every-other rotation. Path A: push → `-SkipGit -SkipE2E` deploy → NAS reset → curl-verify the 2 new endpoints + 3 new response fields → DEPLOYED marker.

## What's still on the floor after v.205

- **Container nesting depth >1** smoke check (audit gap A) — deferred
- **QR codes + container photos** (audit gap B) — deferred
- **Bulk move / bulk category-edit** (audit gap C) — deferred
- **Category vocabulary drift** (audit gap E) — deferred
- **Value rollup on locations** (audit gap G) — deferred
- **`labs-trend` + `bp-trend`** — still pending metric_index conversation
- **`portfolio-perf` "Top losers" header** cosmetic — backlog
- **Mini-PC migration target OS** — pending hardware arrival
- **Medication HSA-YTD on card** — pending product decision
