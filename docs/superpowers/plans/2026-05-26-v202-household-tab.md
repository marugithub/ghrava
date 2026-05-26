# v.202 — Household tab + 2 test gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship 2 test gates (one trade.html mount-check, one `REPORT_VIEWERS` smoke iteration) + 11 Household tab viewers. After this drop, Reports Redesign is at **34 of 37 implementable tiles LIVE** (only Family tab + labs/bp-trend remain).

**Architecture:** Pure frontend, zero SQL, zero migrations. 11 new `window.REPORT_VIEWERS[slug] = {…}` blocks following v.200/v.201 patterns. Two new Playwright specs added to `tests/` + registered in `playwright.config.js` testMatch. All 13 endpoints pre-verified live-200 on prod 2026-05-26.

**Tech stack:** Vanilla JS, established helpers (`repFmt$`, `repSummaryCard`, `escapeHtml`, `repCurrentYear`), shared `GH_DRILLDOWN`/`GH_FILTERS`/`GH_REPORT_STATES`. New Playwright specs run under the existing `playwright.config.js`.

---

## Cycle-time targets

- Total ≤ 60 min build + ~10 min full Playwright deploy
- **Single combined spec+quality review per task** (proven in v.201)
- **Pointer-to-pattern plan** — implementer reads an existing viewer block as template
- **Endpoint paths pre-verified** via curl (lesson from v.200.1)

## Implementation patterns (apply to every viewer block — locked)

Same as v.200/v.201:
1. NO wrapper `<div>` around summary cards — `#repViewerSummary` is already display:grid auto-fit
2. Table `style="width:100%;border-collapse:collapse;font-size:13px"`; header `<tr>` carries `border-bottom + uppercase + letter-spacing:.04em`; every `<th>` gets `padding:8px 10px`; every `<td>` gets `padding:6px 10px`; body `<tr>` gets `border-bottom:1px solid var(--border)` (+ `cursor:pointer` if clickable)
3. All untrusted strings via `escapeHtml()`
4. Empty state via `window.GH_REPORT_STATES.empty(container, {title, subtitle})`
5. Drilldown via `onDrill({title, html})` — never touch `GH_DRILLDOWN` directly
6. Each `fetch()` must hit a real `app.use(...)` mount path (curl-verify if uncertain)

## Endpoint reference (all curl-verified 200 on prod 2026-05-26)

| Slug | Endpoint(s) | Notes |
|---|---|---|
| `property-summary` | `GET /api/v1/property/properties` | Array of homes with key dates / values |
| `property-maint` | `GET /api/v1/maintenance/upcoming` | Combined property+vehicle log; filter `entity_type==='property'` client-side |
| `vehicles-summary` | `GET /api/v1/property/vehicles` | Fleet snapshot. `vehicle_service` field has next-due-service joined per-row (see route line 130) |
| `vehicle-maint` | `GET /api/v1/maintenance/upcoming` | Same combined endpoint; filter `entity_type==='vehicle'` client-side. For full history: `/api/v1/property/vehicles/:id/service` per vehicle (parallel fetch). |
| `vehicle-fuel` | `GET /api/v1/property/vehicles` → for each, parallel `GET /api/v1/property/vehicles/:id/service` | Combine into one log. Filter `service_type` matching `/fuel|gas/i` for fuel rows; the cost-per-mile metric needs consecutive odometer + cost from each service row. Defer MPG (no gallons logged). |
| `subs-overview` | `GET /api/v1/subscriptions/summary` + `GET /api/v1/subscriptions/` (parallel) | v.199's `subs-renewals` viewer already wires both; copy that shape |
| `insurance-policies` | `GET /api/v1/insurance/summary` + `GET /api/v1/insurance/` (parallel) | Mirror the subscriptions pattern |
| `inventory-value` | `GET /api/v1/inventory/items` + `GET /api/v1/inventory/stats` (parallel) | Per-room rollup + total value |
| `warranty-expiry` | `GET /api/v1/inventory/items` | Filter `warranty_end_date` ≤ 90 days |
| `doc-expiry` | `GET /api/v1/documents/expiring` | Already filtered server-side |
| `items-by-loc` | `GET /api/v1/inventory/items` + `GET /api/v1/inventory/locations` (parallel) | Group items by `location_id` → location_name |

For the 4 multi-source/multi-fetch viewers (`vehicle-fuel`, `inventory-value`, `items-by-loc`, `vehicles-summary`), use `Promise.all`. For any per-vehicle iteration, use `Promise.all` over the vehicles list with `vehicles.length === 0` guard (early empty state).

---

### Task 1: Branch + plan commit

- [ ] Verify clean tree on `main`. `git add docs/superpowers/plans/2026-05-26-v202-household-tab.md && git commit -m "plan: v.202 Household tab + 2 test gates"`

---

### Task 2: Test gate — `trade.html` mount-check

**Goal:** Catch v.201.1-style blank-page regressions before they leave the deploy gate. Opens `/trade.html`, waits 5s for Babel, asserts `#root` mounted with non-trivial content + zero `pageerror` events.

**Files:**
- Create: `tests/trade-mount.spec.js`
- Modify: `tests/playwright.config.js` — add `'trade-mount.spec.js'` to the `testMatch` array

**Spec body (copy verbatim):**

```javascript
// trade-mount.spec.js — single hard gate against the v.196 → v.201.1 regression
// where a stray JSX fragment left #root empty. Captures any pageerror and
// asserts the React tree actually mounted with non-trivial content.
const { test, expect } = require('@playwright/test');

test('trade.html — React root mounts without page errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(`${err.name}: ${err.message}`));

  await page.goto('/trade.html', { waitUntil: 'domcontentloaded' });
  // Babel-standalone in-browser transform takes a few seconds on first paint.
  await page.waitForTimeout(5000);

  const rootHTML = await page.locator('#root').innerHTML();
  expect(pageErrors, `unexpected pageerror events:\n${pageErrors.join('\n')}`).toHaveLength(0);
  expect(rootHTML.length, 'React tree did not mount (#root is empty or near-empty)').toBeGreaterThan(100);
});
```

**testMatch update (find the line that lists existing specs):**

Current line in `tests/playwright.config.js`:
```javascript
  testMatch: ['ghrava-e2e.spec.js', 'smoke.spec.js', 'pending-tab.spec.js', 'forecast-chart.spec.js', 'asterisk-per-record.spec.js'],
```

Change to (append `'trade-mount.spec.js'`):
```javascript
  testMatch: ['ghrava-e2e.spec.js', 'smoke.spec.js', 'pending-tab.spec.js', 'forecast-chart.spec.js', 'asterisk-per-record.spec.js', 'trade-mount.spec.js'],
```

**Verify:**
- `cd tests && grep -c "trade-mount" playwright.config.js` → 1
- Run locally: `cd tests && $env:GHRAVA_URL='http://192.168.4.62:3001'; .\node_modules\.bin\playwright.cmd test trade-mount.spec.js --reporter=line` → must pass against live prod (which is already on v.201.1 with the JSX fix)

**Commit:** `git add tests/trade-mount.spec.js tests/playwright.config.js && git commit -m "v.202 task 2: add trade.html mount-check Playwright gate"`

---

### Task 3: Test gate — `REPORT_VIEWERS` smoke iteration

**Goal:** Catch v.200.1-style wrong-fetch-path bugs across all registered Money/Health/Household/Family viewers. Loads `/reports.html`, evaluates the `window.REPORT_VIEWERS` registry, for each slug computes its default-filter fetch URL and asserts the URL returns 2xx.

**Files:**
- Create: `tests/reports-viewers-smoke.spec.js`
- Modify: `tests/playwright.config.js` — add `'reports-viewers-smoke.spec.js'` to the `testMatch` array

**Approach:**
Rather than calling `viewer.fetch()` directly (which throws on 404 and produces noisy stacks), the spec extracts each `fetch('/api/v1/…')` URL pattern by reading the viewer object's source (`viewer.fetch.toString()`), substitutes the default-filter values, and runs a separate plain `page.request.get()` against each — asserting status < 400.

**Spec body:**

```javascript
// reports-viewers-smoke.spec.js — iterates window.REPORT_VIEWERS on /reports.html,
// extracts each viewer's fetch URL, and asserts each returns < 400. Catches the
// v.200.1 family of bugs where a wrong mount path slipped through every code review.
const { test, expect } = require('@playwright/test');

test('REPORT_VIEWERS smoke — every registered viewer fetches a real URL', async ({ page, request }) => {
  await page.goto('/reports.html');
  await page.waitForFunction(() => window.REPORT_VIEWERS && Object.keys(window.REPORT_VIEWERS).length > 0, { timeout: 10000 });

  // Pull each viewer's fetch source + default filters; resolve to concrete URLs.
  const callsByViewer = await page.evaluate(() => {
    const out = {};
    for (const [slug, viewer] of Object.entries(window.REPORT_VIEWERS)) {
      const src = viewer.fetch ? viewer.fetch.toString() : '';
      // Extract any '/api/v1/...' literal URLs the fetch source references.
      const urls = [...src.matchAll(/['"`](\/api\/v1\/[^'"`?]+)/g)].map(m => m[1]);
      // Substitute year filter if defaultFilters() supplies one (most common param).
      const filters = (viewer.defaultFilters ? viewer.defaultFilters() : []) || [];
      const year = (filters.find(f => f.key === 'year') || {}).value;
      out[slug] = urls.map(u => year && src.includes('?year=') ? u + '?year=' + year : u);
    }
    return out;
  });

  const failures = [];
  for (const [slug, urls] of Object.entries(callsByViewer)) {
    if (!urls.length) {
      // Viewer doesn't fetch at all (acceptable — e.g. pending-tab shortcut).
      continue;
    }
    for (const url of urls) {
      const resp = await request.get(url);
      if (resp.status() >= 400) failures.push(`${slug}: GET ${url} → ${resp.status()}`);
    }
  }

  expect(failures, `viewer endpoint failures:\n${failures.join('\n')}`).toHaveLength(0);
});
```

**testMatch update:**

Append `'reports-viewers-smoke.spec.js'` to the array.

**Verify:**
- `grep -c "reports-viewers-smoke" tests/playwright.config.js` → 1
- Run locally against prod → must pass (v.200.1 already fixed every Money viewer; v.201 Health viewers and v.200 trade viewers all point at real mounts)

**Commit:** `git add tests/reports-viewers-smoke.spec.js tests/playwright.config.js && git commit -m "v.202 task 3: add REPORT_VIEWERS smoke gate"`

---

### Task 4: `property-summary` + `property-maint` viewers

**Insertion point:** After the last existing viewer (currently `receipts-missing` from v.201). Implementer must grep for `^window.REPORT_VIEWERS\\[` and find the last entry's closing `};`.

**property-summary spec:**
- No default filters
- `fetch()`: `/api/v1/property/properties` → array of property rows. Sample fields: `id, name, address, property_type, year_built, square_feet, purchase_date, purchase_price, current_value, primary_residence`.
- 4 cards: Total properties · Total value (sum `current_value`) · Total cost basis (sum `purchase_price`) · Net change (value − cost basis, green/red)
- Body: table — Name / Address / Type / Sqft / Year built / Current value / Purchase price. Row click → drilldown with full property detail.
- Empty state: `'No properties recorded'` / `'Add a property in the Property module.'`

**property-maint spec:**
- Default filter: none (show all upcoming maintenance, soonest first)
- `fetch()`: `/api/v1/maintenance/upcoming` → array. Field `entity_type` tells whether each row is property or vehicle. Filter to `entity_type === 'property'` (or whatever the field is — verify by reading routes.js:13).
- 4 cards: Open items · Overdue (days < 0, red) · Due this week (0-7 days, amber) · Distinct properties
- Body: table — Property / Task / Last done / Next due / Days until / Status. Row click → drilldown with full task detail.
- Empty state: `'No upcoming property maintenance'` / `'All property tasks are up to date.'`

**Pattern reference:** v.201 `hsa-spending` for the multi-card+table+drill pattern.

**Commit:** `v.202 task 4: wire property-summary + property-maint viewers (homes + maintenance log)`

---

### Task 5: `vehicles-summary` + `vehicle-maint` + `vehicle-fuel` viewers

Three viewers sharing the vehicles data source.

**vehicles-summary spec:**
- No filters
- `fetch()`: `/api/v1/property/vehicles` (route at property/routes.js:116 joins last/next service per vehicle)
- 4 cards: Total vehicles · Total mileage · Avg mileage · Due for service (count of vehicles with `next_due_date <= today`, amber when >0)
- Body: table — Name / Make / Model / Year / Owner / Mileage / Last service / Next due
- Drill: full vehicle detail + last 5 service rows

**vehicle-maint spec:**
- No filters
- `fetch()`: `/api/v1/maintenance/upcoming` filtered `entity_type === 'vehicle'`
- 4 cards: Open items · Overdue (red) · Due this week (amber) · Distinct vehicles
- Body: table — Vehicle / Task / Last done / Next due / Days until / Cost
- Drill: full task detail + link "Open in Vehicles module ↗"

**vehicle-fuel spec:**
- Default filter: year = current year
- `fetch()`: Promise.all of `/api/v1/property/vehicles` then per-vehicle `/api/v1/property/vehicles/:id/service`. Combine into one log; filter `service_type` matching `/fuel|gas|fill/i`.
- 4 cards: Total fill-ups · Total spent (year) · Avg cost/fill · Avg $/mile (if mileage deltas computable)
- Body: table — Date / Vehicle / Cost / Mileage / Shop / $/mile (when prev fill mileage known)
- Drill: full service record. NO MPG (no gallons captured).

**Commit:** `v.202 task 5: wire 3 vehicles viewers (summary + maint + fuel)`

---

### Task 6: `subs-overview` viewer

- Default filter: none
- `fetch()`: parallel `/api/v1/subscriptions/summary` + `/api/v1/subscriptions/` (mirror v.199 `subs-renewals` pattern at line ~951)
- 4 cards: Active subs · Monthly cost · Annual projected · Renewing this month (amber when >0)
- Body: table — Name / Category / Cycle / Account / Monthly cost / Next renewal — sorted by next_renewal_date ASC
- Drill: full subscription detail + "Open in Subscriptions module ↗" link
- Empty state: `'No active subscriptions'`

**Commit:** `v.202 task 6: wire subs-overview viewer`

---

### Task 7: `insurance-policies` viewer

- Default filter: none
- `fetch()`: parallel `/api/v1/insurance/summary` + `/api/v1/insurance/`
- 4 cards: Active policies · Total annual premium · Renewing within 60 days (amber when >0) · Policy types (distinct)
- Body: table — Provider / Type / Policy # / Coverage / Premium / Renewal date — sorted by renewal_date ASC. Past-due renewal = red row.
- Drill: full policy detail + "Open in Insurance module ↗"
- Empty state: `'No active insurance policies'`

**Commit:** `v.202 task 7: wire insurance-policies viewer`

---

### Task 8: `inventory-value` + `warranty-expiry` + `items-by-loc` viewers

Three inventory viewers sharing data sources.

**inventory-value spec:**
- No filters
- `fetch()`: parallel `/api/v1/inventory/items` + `/api/v1/inventory/stats` + `/api/v1/inventory/locations` (build location-id → name map)
- 4 cards: Total items · Total value · Average value · Items without value (count where `value` is null/0, muted color)
- Body: grouped by location_id — `<h3>` heading per location + sub-table: Name / Category / Brand / Value / Purchase date — sorted by value DESC within each location.
- Drill: item detail

**warranty-expiry spec:**
- Default filter: window = 90 days
- `fetch()`: `/api/v1/inventory/items`. Client filter `warranty_end_date` exists AND within ≤90 days AND not already expired (or include expired with red badge).
- 4 cards: Items under warranty (total count) · Expiring within 30 days (amber) · Expiring within 90 days · Expired (red)
- Body: table — Item / Brand / Purchase date / Warranty start / Warranty end / Days remaining (color-coded)
- Drill: item detail + "Open in Inventory module ↗"

**items-by-loc spec:**
- No filters
- `fetch()`: parallel `/api/v1/inventory/items` + `/api/v1/inventory/locations`. Build location-id → name map.
- 4 cards: Total items · Distinct locations · Items in primary residence · Items unassigned (no location_id, muted)
- Body: grouped by location, similar to inventory-value but emphasizing the BREAKDOWN (item count per location, not value). Each `<h3>` heading shows "Location name (N items)" + a sub-table of items.

**Commit:** `v.202 task 8: wire 3 inventory viewers (value + warranty + by-location)`

---

### Task 9: `doc-expiry` viewer

- Default filter: window = 90 days
- `fetch()`: `/api/v1/documents/expiring` (server-side filtered)
- 4 cards: Documents expiring · Within 30 days (amber) · Within 90 days · Already expired (red)
- Body: table — Title / Type / Holder / Expiry date / Days remaining (color-coded)
- Drill: document detail + "Open in Documents module ↗"

**Commit:** `v.202 task 9: wire doc-expiry viewer`

---

### Task 10: Docs + version bump

- `app/version.txt` → `202605.202`
- Prepend STATE.md section: `## ✅ v.202 SHIPPED — Reports Redesign Drop 6: Household tab 11/11 LIVE + 2 test gates (2026-05-26)` enumerating the 11 new viewers + the 2 test gates + noting the every-other rotation runs FULL Playwright this deploy (expected baseline shifts from 115 to 117 tests).
- `REPORTS_REDESIGN_HANDOFF.md` line 6 → "23 LIVE" → "34 of 37 implementable tiles LIVE; Family v.203 next"; line 31 sequencing → mark v.202 SHIPPED.

**Commit:** `v.202 task 10: docs + version bump (Household 11/11 + 2 test gates)`

---

## Verification before deploy

1. `cat app/version.txt` → `202605.202`
2. `grep -c "^window.REPORT_VIEWERS\\[" app/public/reports.html` → **33** (22 + 11 new)
3. `grep -c "/api/v1/trade/" app/public/reports.html` → **0** (regression check)
4. `grep -c "trade-mount\\|reports-viewers-smoke" tests/playwright.config.js` → **2** (both new specs registered)
5. Manual: from `tests/` dir, run BOTH new specs against live prod (which is v.201.1; the new viewers won't yet be deployed but the trade-mount test must pass; the reports-viewers-smoke test must pass against all 22 already-live viewers).

## Deploy

Per the every-other rule: v.200 ran full, v.200.1 + v.201 + v.201.1 were smoke-only. **v.202 runs FULL Playwright** + smoke. Expected: smoke 8/8 ✅; **E2E baseline shifts from 115 to 117** (2 new tests = trade-mount + reports-viewers-smoke). Both new gates must pass for the deploy to be considered healthy.

Path A: push → `-SkipGit` deploy (NO `-SkipE2E`!) → NAS reset → curl-verify the 11 new endpoints + new viewer slugs → DEPLOYED marker.

## What's deferred

- **`labs-trend`** + **`bp-trend`** — Health tab tiles still "Coming soon" pending metric_index design conversation. Not in v.202.
- **Family tab (7 tiles)** — v.203.
- **`portfolio-perf` "Top losers" header cosmetic** — still backlog.
- **Inventory grouping enhancements** — v.204+ per BACKLOG.md.
