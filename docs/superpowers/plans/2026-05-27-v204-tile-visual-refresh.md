# v.204 — Tile visual refresh: icons + colors + KPI preview

**Goal:** Replace the current text-only tile rendering on `/reports.html` with: real SVG icons per tile + per-category color identity + KPI / sparkline / log data previews on the tile face. Same content, same data, dramatically more visual.

**Architecture:** Pure frontend. Modifications to `app/public/reports.html`:
1. New CSS block defining tile shell (icon chip, top accent stripe, hover lift, preview row)
2. New `window.TILE_ICONS` registry — 41 inline-SVG icons keyed by slug
3. New `window.TILE_PREVIEWS` registry — per-slug renderer that takes a shared data bundle and emits the preview HTML
4. Rewritten `renderTabGridV2` to emit the new structure
5. New `loadLandingPreviews()` orchestrator that fires ~10 summary fetches in parallel on landing-page load, builds a shared data bundle, and hydrates the tile previews

**No new backend endpoints.** Every fetch hits an existing summary route (`/api/v1/finance/landing`, `/medical/summary`, `/hsa/summary`, `/inventory/stats`, `/insurance/summary`, `/subscriptions/summary`, `/trading/reports`, `/trading/portfolio/live`, `/trading/portfolio/performance`, `/maintenance/summary`, `/documents/expiring`). All curl-verified previously.

**Mockups:** `app/public/reports-mockup.html` (v1: icons + colors) and `app/public/reports-mockup-v2.html` (v2: + KPI/sparkline). Implementer should reference v2 for the final look. Both mockup files are deleted in the last task — they're throwaway.

## Cycle-time targets

- Total ≤ 110 min build + ~8 min full E2E deploy
- 6 tasks. Each leaves prod in a working state (intermediate commits are independently shippable if anything goes wrong).
- Single combined spec+quality review per task.
- The 2 existing deploy gates (`trade-mount.spec.js`, `reports-viewers-smoke.spec.js`) auto-cover regression. No new test specs needed.

## Implementation patterns (LOCKED v.200-v.203)

These still apply EVERYWHERE in `app/public/reports.html`:
1. NO wrapper `<div>` around summary cards in `renderSummary` of any viewer
2. Tables `width:100%;border-collapse:collapse;font-size:13px`; header tr standard
3. All untrusted strings via `escapeHtml()`
4. Empty state via `window.GH_REPORT_STATES.empty()`
5. Drilldown via `onDrill({title, html})`

(The NEW tile face is OUTSIDE the viewer's renderSummary — it's the LANDING grid, rendered by `renderTabGridV2`. That function has its own templating and is free to use the new structure including SVG icons + preview rows.)

## Per-category color tokens (locked)

```css
--money:     #f59e0b   --money-soft:     rgba(245,158,11,0.10)
--health:    #22c55e   --health-soft:    rgba(34,197,94,0.10)
--household: #3b82f6   --household-soft: rgba(59,130,246,0.10)
--family:    #a855f7   --family-soft:    rgba(168,85,247,0.10)
```

Mapped from tab id: `money | health | household | family`. The `pending` tab keeps its existing shortcut-tile appearance — no changes there.

## Tile structure (new)

```html
<div class="rep-tile money" data-slug="spending-by-cat" tabindex="0" role="button">
  <div class="rep-tile-head">
    <div class="rep-tile-icon">[inline SVG, 20×20]</div>
    <div class="rep-tile-head-text">
      <span class="rep-tile-eyebrow">spending</span>
      <span class="rep-tile-title">Spending by category</span>
    </div>
  </div>
  <div class="rep-tile-preview" data-preview-slot="spending-by-cat">
    [renderer fills this from the shared data bundle; renderers fall back to
     meta-line text if data is missing]
  </div>
</div>
```

Eyebrow text comes from the tile's section group label (`spending`, `income & cash`, etc.) — already in `REPORT_TABS_V2`. The category class (`money` / `health` / `household` / `family`) comes from the tab id.

## Preview shapes (LOCKED — each tile maps to one shape)

| Shape | Used for | Renderer signature |
|---|---|---|
| **KPI + sparkline** | trends with 12+ data points (cash-flow, net-worth, portfolio-perf, spending-cal, category-trends) | `(d) => '<kpi>$X</kpi><spark>...</spark><delta>+Y%</delta>'` |
| **KPI + KPI** | counts with a secondary flag/count (subs-overview, insurance-policies, meds-active, visits-history, doc-expiry, property-summary, vehicles-summary, kids viewers, contacts viewers, all HSA tiles) | `(d) => '<kpi>X</kpi><kpi-right>Y</kpi-right>'` |
| **Progress bar** | ratio of total (hsa-fsa-irs) | `(d) => '<kpi>$X</kpi><pct>Y%</pct><bar>...</bar>'` |
| **Recent rows** | log-style (trade-research, trade-rebalance, trade-tax-opt, member-detail) | `(d) => '<row>·name·when</row>×3'` |
| **Fallback (meta line)** | any tile whose data isn't in the shared bundle yet | `(d) => '<meta>{tile.meta}</meta>'` |

The fallback shape means tiles without explicit renderers still look like the v1 (icon + title) variant, just without the preview row. Safe degradation.

## Data bundle (single fetch tree on landing load)

```js
async function loadLandingPreviews() {
  const [
    financeLanding, medicalSummary, hsaSummary, inventoryStats,
    insuranceSummary, subsSummary, tradingReports, portfolioLive,
    portfolioPerf, maintSummary, docsExpiring,
  ] = await Promise.all([
    fetch('/api/v1/finance/landing').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/medical/summary').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/hsa/summary').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/inventory/stats').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/insurance/summary').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/subscriptions/summary').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/trading/reports').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/trading/portfolio/live').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/trading/portfolio/performance?months=12').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/maintenance/summary').then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('/api/v1/documents/expiring').then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  return { financeLanding, medicalSummary, hsaSummary, inventoryStats, insuranceSummary, subsSummary, tradingReports, portfolioLive, portfolioPerf, maintSummary, docsExpiring };
}
```

Each `.catch(() => null)` ensures one failing endpoint never blocks the tile grid render. The previewers each check their dependencies and emit `fallback(tile.meta)` if needed.

## Insertion / modification points

Find via grep:
- `renderTabGridV2` definition (around line 451 of `reports.html`) — rewrite to emit the new tile structure.
- CSS: append a `<style>` block (or extend the existing `<style>` block) near the top of `reports.html`.
- `TILE_ICONS` / `TILE_PREVIEWS` / `loadLandingPreviews` — module-scope, defined immediately above the existing `window.REPORT_VIEWERS = window.REPORT_VIEWERS || {};` line (~line 611).
- Boot-time hook: in `bootReportsV2()` (line ~1707), after `await loadPinned()`, call `await hydrateTilePreviews()` once and pass the bundle into each subsequent tab-render call.

## SVG icon set (LOCKED — 41 entries)

The mockup files (`reports-mockup.html` and `reports-mockup-v2.html`) contain a representative subset. The implementer should:
1. Use the icons from the mockups for the slugs they cover (~10 slugs).
2. For the remaining ~30 slugs, draw stroke-style 24×24 icons (path with `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, single-color via `currentColor`). Pick a glyph that matches the tile's content; consistency in style matters more than perfection.

Map slug → icon glyph (suggested):
- Money: spending-by-cat=chart-up, top-vendors=blocks, spending-cal=calendar, category-trends=line-chart, income-flow=arrow-cycle, cash-flow=dollar-sign, net-worth=trend-eye, hsa-fsa-irs=document-stamp, subs-renewals=card-inbox, portfolio-snap=donut, portfolio-perf=line-chart-up, concentration=target, tax-location=shield, trade-research=magnifier, trade-rebalance=scales, trade-tax-opt=receipt, pending-trans=triangle-alert
- Health: hsa-fsa-irs (shared), hsa-spending=wallet-cross, meds-active=pill, visits-history=stethoscope, immunizations=syringe, procedures=scalpel, receipts-missing=receipt-x, labs-trend=test-tube (coming-soon), bp-trend=heart-pulse (coming-soon)
- Household: property-summary=home, property-maint=wrench-home, vehicles-summary=car, vehicle-maint=wrench-car, vehicle-fuel=fuel-pump, subs-overview=card-stack, insurance-policies=shield-check, inventory-value=box-dollar, warranty-expiry=clock-warranty, doc-expiry=document-clock, items-by-loc=map-pin
- Family: emergency-info=siren, family-snapshot=users, member-detail=user-detail, kids-activities=star, kids-school=graduation, care-team=phone-medical, family-contacts=address-book

## Steps

### Task 1: Plan commit

`git add docs/superpowers/plans/2026-05-27-v204-tile-visual-refresh.md && git commit -m "plan: v.204 tile visual refresh (icons + colors + KPI preview)"`

### Task 2: CSS shell + icon registry

Append a CSS block to the existing `<style>` in `reports.html` defining all classes: `.rep-tile`, `.rep-tile.money/.health/.household/.family`, `.rep-tile-head`, `.rep-tile-icon`, `.rep-tile-eyebrow`, `.rep-tile-title`, `.rep-tile-preview`, `.rep-spark`, `.rep-progress`, `.rep-recent-row`, `.rep-delta.up/down/flag`. Use the exact rules from the v2 mockup.

Define `window.TILE_ICONS = { 'spending-by-cat': '<svg ...>...</svg>', ... }` as a module-scope constant immediately above `window.REPORT_VIEWERS`. All 41 slugs entered. SVG strings from mockup where available, hand-drawn elsewhere.

After this task: prod still LOOKS like prod (the new CSS exists but nothing emits the new classes yet). Safe halfway state.

Verify: `grep -c "'..*':\s*'<svg" app/public/reports.html` ≥ 41 (the icon registry entries).

Commit: `v.204 task 2: tile CSS + 41-slug icon registry`

### Task 3: Switch renderTabGridV2 to new structure

Rewrite `renderTabGridV2` (around line 451) to emit the new tile HTML using `TILE_ICONS[slug]` for the SVG. Keep the click handler logic unchanged. Use group label as the eyebrow text. Add `class="rep-tile"` + the category class (`money` / `health` / `household` / `family`) based on the tab id.

The preview slot div renders empty (`<div class="rep-tile-preview" data-preview-slot="${slug}"></div>`) at this point — the preview hydration happens in Task 4-5.

After this task: tiles show **icon + color + title** but no KPI yet (v1 look). Safe halfway state.

Verify: open `/reports.html?tab=money` via Playwright; assert tile elements have `class="rep-tile money"` and contain an `<svg>`. (Use the existing `tests/trade-mount.spec.js` pattern, or just visually screenshot.)

Commit: `v.204 task 3: renderTabGridV2 emits icon + category color tiles`

### Task 4: Landing-page data orchestrator

Add `loadLandingPreviews()` as a module-scope async function (above `bootReportsV2`). Wire `hydrateTilePreviews(bundle)` that iterates all rendered `.rep-tile` elements on the current tab, looks up `TILE_PREVIEWS[slug]`, calls the renderer with the data bundle, and injects HTML into the `[data-preview-slot]` div. Stub `TILE_PREVIEWS = {}` for now (Task 5 fills it).

Update `bootReportsV2` to:
1. Start `loadLandingPreviews()` early (parallel with `loadPinned()`).
2. After tab content renders (after `renderTabContent(tabId)` finishes), call `hydrateTilePreviews(bundle)`.
3. Re-hydrate when `switchTab` changes the active tab.

After this task: prod looks like Task 3 (icon + color, no preview). The hydrator runs but TILE_PREVIEWS is empty so nothing visible changes yet.

Verify: open `/reports.html?tab=money` in Playwright; assert `window.__landingPreviewBundle` is set after boot (test hook the orchestrator exposes).

Commit: `v.204 task 4: landing-page summary orchestrator + hydrate hook`

### Task 5: Implement per-slug TILE_PREVIEWS renderers

Define 4 shape helpers at the top of the registry:

```js
function previewKpiSpark({ kpiLabel, kpiValue, sparkPoints, delta, deltaTone }) { ... }
function previewKpiPair({ leftValue, leftLabel, rightValue, rightLabel, rightTone }) { ... }
function previewProgress({ kpiValue, kpiLabel, pct, pctLabel }) { ... }
function previewRecentRows({ rows }) { ... }   // rows = [{label, when}]
```

Then 41 entries in `TILE_PREVIEWS = { slug: (bundle) => previewSomeShape({ ... extracted from bundle ... }) }`. Most are short (3-5 lines each). For tiles where the bundle lacks data, return a meta-line fallback `<div class="rep-tile-meta">${tile.meta}</div>`.

Per-shape examples in the mockup `reports-mockup-v2.html`. Implementer should keep that file open as a visual reference while wiring (it will be deleted in Task 6).

Verify: open `/reports.html?tab=money` in Playwright; assert each tile's `.rep-tile-preview` div is non-empty after hydration; expect total landing-load network time < 1s (10 parallel fetches).

Commit: `v.204 task 5: 41 per-slug TILE_PREVIEWS renderers wired`

### Task 6: Docs + version bump + cleanup

- `app/version.txt` → `202605.204`
- Prepend STATE.md: `## ✅ v.204 SHIPPED — Tile visual refresh (icons + colors + KPI previews) (2026-05-27)`. Note: pure frontend, no SQL, no migrations. Note: the existing deploy gates (`trade-mount.spec.js` + `reports-viewers-smoke.spec.js`) auto-covered regression.
- Update `REPORTS_REDESIGN_HANDOFF.md` line 6 → mention v.204 added the visual layer on top of the now-complete 41-tile data layer.
- **Delete throwaway mockup files:**
  - `app/public/reports-mockup.html`
  - `app/public/reports-mockup-v2.html`
  - `tests/reports-screenshot.spec.js`
  - `tests/playwright.config.shot.js`

Commit: `v.204 task 6: docs + version bump + delete throwaway mockups`

## Deploy

Per the every-other rule: v.203 was smoke-only. **v.204 runs FULL Playwright** + smoke. The 2 existing gates (trade-mount, reports-viewers-smoke) should pass — they're not testing tile visual output, just route validity and React mounting. Expected baseline: 117/0 (unchanged from v.202).

Path A: push → `-SkipGit` deploy (NO `-SkipE2E`) → NAS reset → curl verify the 10 summary endpoints → DEPLOYED marker.

## What's left after v.204

- `labs-trend` + `bp-trend` — still "Coming soon"; pending metric_index conversation. Will get icon + color from v.204 but no KPI (no data layer for them yet).
- `portfolio-perf` "Top losers" header cosmetic — still backlog.
- Inventory grouping enhancements — v.205+ per BACKLOG.md.
