# v.208 — labs-trend + bp-trend viewers (Health tab 9/9)

**Goal:** Wire the last 2 Health-tab tiles (`labs-trend`, `bp-trend`), currently "in design — metric_index pending" placeholders. Brings Health to 9/9 LIVE and Reports to 43/43 implementable tiles. Path Y (agreed): each report queries its own source directly, no metric_index abstraction.

**Match-existing mandate:** these are report viewers in `reports.html`. Match the established viewer contract + styling EXACTLY (per the working model — build consistent, don't invent). Reference viewers: `visits-history` (line 3067, year-filtered table) and `net-worth` (line 1737, inline SVG line chart). Reuse `repSummaryCard`, `escapeHtml`, the standard table styling, `GH_REPORT_STATES.empty`, `onDrill`, the year-filter pattern.

**Pure frontend.** Endpoints already exist + verified live-200: `/api/v1/medical/labs` (table `med_lab_results`), `/api/v1/medical/vitals` (table `med_vitals_readings`). Both empty on prod now — viewers must render data when present AND degrade to empty-state cleanly (empty ≠ broken).

## Endpoint shapes (verified from SCHEMA.md + routes)

- `GET /api/v1/medical/labs` → array of `med_lab_results`: `id, family_member_id, patient, panel_name, test_name, test_date, value_numeric, value_text, unit, reference_low, reference_high, reference_text, flag, notes`. Ordered test_date DESC.
- `GET /api/v1/medical/vitals` → array of `med_vitals_readings`: `id, family_member_id, patient, measure_date, measure_time, systolic_bp, diastolic_bp, heart_rate, weight_lbs, height_in, bmi, temperature_f, o2_sat, respiratory_rate, blood_glucose, notes`. Ordered measure_date DESC.

## v.208 deploy

Per the every-other rule: v.207 was smoke-only → **v.208 runs FULL Playwright.** The 2 deploy gates (trade-mount, reports-viewers-smoke) auto-cover; reports-viewers-smoke will now also exercise the 2 new viewer fetch URLs.

---

### Task 1: Plan commit

`git add docs/superpowers/plans/2026-05-28-v208-labs-bp-trend.md && git commit -m "plan: v.208 labs-trend + bp-trend viewers (Health 9/9)"`

### Task 2: Wire both viewers + previews + registry meta

**File:** `app/public/reports.html` only.

Three edits per tile:

**A — Register the viewer** (insert both new `window.REPORT_VIEWERS[...]` blocks after the last viewer `family-contacts` closing `};`, before `// Small HTML-escape`).

**`labs-trend`** — match `visits-history` shape:
- `defaultFilters()`: `[{key:'year', label:'Year', value: repCurrentYear()}]` (empty year = all)
- `fetch(filters)`: `/api/v1/medical/labs`, filter `test_date.startsWith(year)` if year set. Return `{rows}`.
- `renderSummary`: 4 cards — Total results · Distinct tests (Set of test_name) · Latest result (most recent test_date) · Abnormal flags (count where `flag` is truthy and not 'normal'/'N', RED when >0)
- `renderBody`: table — Date / Test / Result (value_numeric+unit, or value_text) / Reference (reference_text, or `reference_low–reference_high`) / Flag. Sort by test_date DESC. Flag cell colored: high/H → red, low/L → amber, else muted. Row click → drilldown with full result detail (panel_name, notes, all fields).
- Empty state: title `'No lab results' + (year ? ' for ' + year : '')`, subtitle `'Add lab results in the Medical module.'`

**`bp-trend`** — match `visits-history` table + `net-worth` inline SVG:
- `defaultFilters()`: `[{key:'year', label:'Year', value: repCurrentYear()}]`
- `fetch(filters)`: `/api/v1/medical/vitals`, filter `measure_date.startsWith(year)` if set. Return `{rows}`.
- `renderSummary`: 4 cards — Total readings · Latest BP (`systolic/diastolic` of most recent) · Avg systolic (rounded) · Avg diastolic (rounded). Avg over rows with non-null systolic/diastolic.
- `renderBody`:
  1. **Inline SVG dual-line chart** of systolic + diastolic over time (chronological), copying the net-worth SVG idiom (800×220, 3 y-ticks, x-date labels). Two polylines: systolic (red stroke) + diastolic (blue/accent stroke), shared y-scale. Only render if ≥2 readings with BP values. Small legend.
  2. **Table below** — Date / Systolic / Diastolic / Pulse / Weight / Glucose / Notes. Sort measure_date DESC. Row click → drilldown with all vitals fields.
- Empty state: title `'No BP readings' + (year ? ' for ' + year : '')`, subtitle `'Add vitals in the Medical module.'`

**B — Update TILE_PREVIEWS** (lines ~1105-1106 currently return `repPreviewMeta('in design — metric_index pending')`). Replace with real previews from the same bundle pattern — BUT the landing bundle doesn't fetch labs/vitals. Two options: (a) keep a meta-line preview describing the tile (e.g. `repPreviewMeta('lab results over time')` / `repPreviewMeta('systolic/diastolic over time')`), OR (b) add labs/vitals to `loadLandingPreviews()` and show a count. **Simplest + consistent: (a) update the meta text only** — drop "in design — metric_index pending", replace with a plain description. Don't expand the landing bundle for 2 tiles.

**C — Update tile registry meta** (lines 432-433): change `meta:'in design — metric_index pending'` to real descriptions: `labs-trend` → `meta:'lab results over time'`; `bp-trend` → `meta:'systolic/diastolic over time'`.

**Verify:**
- `grep -c "^window.REPORT_VIEWERS\\[" app/public/reports.html` → 42
- `grep -c "in design — metric_index pending" app/public/reports.html` → 0
- `grep -c "/api/v1/trade/" app/public/reports.html` → 0
- `grep -n "/api/v1/medical/labs\\|/api/v1/medical/vitals" app/public/reports.html` → 2 fetch lines

**Commit:** `v.208 task 2: wire labs-trend + bp-trend viewers (Health 9/9)`

### Task 3: Docs + version bump

- `app/version.txt` → `202605.208`
- STATE.md v.208 section: Health tab now 9/9 LIVE; both viewers wired (labs = table, bp = table + SVG line); Path Y (no metric_index); pure frontend.
- BACKLOG.md / NEXT_CHAT_HANDOFF.md: mark `labs-trend`/`bp-trend` + the metric_index "parked decision" as RESOLVED (Path Y shipped).

**Commit:** `v.208 task 3: docs + version bump (Health tab 9/9 LIVE)`

### Deploy

Full Playwright. Path A: push → `-SkipGit` deploy → NAS reset → curl-verify `/medical/labs` + `/medical/vitals` still 200 → DEPLOYED marker.

## Verification before deploy

1. `cat app/version.txt` → `202605.208`
2. viewer count 42; zero "in design" strings; zero trade-prefix
3. Both new viewers match the visits-history/net-worth idioms (no invented patterns)
