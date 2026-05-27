# REPORTS_REDESIGN_HANDOFF.md

**For:** Next Claude Code session OR new chat that picks up Reports work.
**Created:** 2026-05-22 (end of v.185 design session).
**Refined:** 2026-05-23 (post-v.193 design conversation — see REFINEMENT block below).
**Status:** Reports Redesign COMPLETE + visual refresh shipped. Foundation BUILT in v.197 + Money tab COMPLETE in v.200 (16/17) + Health tab 7/9 LIVE in v.201 + Household tab 11/11 LIVE in v.202 + Family tab 7/7 LIVE in v.203 + tile visual refresh (icons + per-category color + KPI/sparkline previews) in v.204. **41 of 41 implementable tiles LIVE with rich previews.** `labs-trend` + `bp-trend` stay "in design" pending metric_index conversation. v.206+ picks up the next backlog item (see BACKLOG.md NEXT UP — likely audit gaps A/B/C/E/G from the Inventory module, or `labs-trend` + `bp-trend` after the metric_index conversation).

---

## ⚡ 2026-05-23 REFINEMENT BLOCK — READ FIRST

This block was added in the post-v.193 design conversation. **Everything here
supersedes any conflicting statement in the original handoff below.** The
original handoff is preserved unchanged for history; this block tells you what
actually shipped through the design conversations since.

### Sequencing (UPDATED)

The original handoff's v.186-v.190 build plan **DID NOT HAPPEN** — those
version labels got used by trade-terminal Phase 1-2 integration shipped via
a parallel chat. Trade-terminal Phase 3-9 then continued through v.190-v.196.
The Reports Redesign now starts at **v.197** (after trade-terminal Phase 8/
5A/9 ship). Build sequence locked 2026-05-23:

- **v.194** — trade-terminal Phase 8 (saved AI report rich viewers inside trade.html)
- **v.195** — trade-terminal Phase 5A (real screener)
- **v.196** — trade-terminal Phase 9 (mobile UX)
- **v.197** — Reports Redesign drop 1 = scaffolding + Money tab live (combined)
- **v.198** — Reports Redesign drop 2 = remaining Money reports
- **v.199** — Reports Redesign drop 3 = Money +4 LIVE (spending-cal / income-flow / net-worth / subs-renewals)
- **v.200** — Money trade-terminal tiles SHIPPED · **v.201 — Health tab 7/9 SHIPPED** · **v.202 — Household tab 11/11 SHIPPED** · **v.203 — Family tab 7/7 SHIPPED · Reports Redesign COMPLETE** · **v.204 — tile visual refresh (icons + KPI previews) SHIPPED**

See [[parallel-roadmaps-may-2026]] memory for the full queue context.

### Grouping pattern within a tab (NEW LOCK)

Variant A: tiny lowercase eyebrows. 10px lowercase muted-grey label above each
tile row. No boxes, no horizontal lines, no background tints, no sub-tabs, no
pill chips. Whitespace + label only.

```
spending                                                 ← 10px, lowercase, muted grey
[tile] [tile] [tile] [tile]
                                                         ← ~24px vertical gap
income & cash
[tile] [tile] [tile]
```

Tiles still carry their per-tile eyebrow chip (e.g. `💰 SPEND`). The section
label adds grouping context without adding chrome. This is the SAME pattern
applied across Money / Health / Household / Family. Pending tab has no groups
(single existing list).

### Build approach (NEW LOCK)

**Scaffolding + Money live in one combined drop.** First Reports Redesign
drop ships:

- New `/reports.html` layout with header + Lens + tabs + Pinned strip
- ALL FOUR non-Pending tabs render real tile grids with locked tile lists
- Pending tab keeps existing v.171 rendering unchanged
- Tiles in the 5 "first-drop live" Money slots → click goes to wired viewer
- All other tiles → click does a "Coming soon" toast (no viewer wired)
- Migration for `user_preferences` + endpoints for pinned-reports
- ALL shared components in `app/public/shared/` (see Centralization below)
- Mobile responsive behavior wired and verified at phone/tablet/desktop widths

This lets the user visually approve the look on prod before any per-report
work goes in. Subsequent drops fill in viewer pages tab-by-tab.

### Centralization plan (NEW LOCK)

Shared UI components live in central files, NOT duplicated per page. New
shared partials under `app/public/shared/`:

| File | What it does | Used by |
|---|---|---|
| `gh-tile.js` | Renders one shortcut tile in the grid (eyebrow + title + meta) | All Reports tabs |
| `gh-drilldown.js` | The drill-down panel — slideout on desktop, full-screen overlay on mobile. Same component, two visual modes by viewport width. | Every report viewer that drills into a record |
| `gh-filter-strip.js` | Filter pill row + "Add filter" button on viewer pages | All report viewer pages |
| `gh-report-states.js` | Shared empty + error states (icon, title, subtitle, recovery actions) | All report viewer pages + the "Coming soon" toast |
| `gh-print.css` | `@media print` stylesheet — hides nav + actions, keeps title + filters + table | Report viewer pages |

Reuse existing `GH_LENS`, `GH_CARD v5`, `GH_VIEW` as-is — don't fork.

### Mobile picks (NEW LOCK — M1 through M6)

| | Lock | Why |
|---|---|---|
| **M1 Lens search on mobile** | Stacked under title row, full-width, always visible | Reports page is search-forward; hiding behind an icon adds friction. Costs ~40px vertical, worth it. |
| **M2 Pinned strip on mobile** | Horizontal scroll, single thin row, right-edge fade hint | 4 pins in 2×2 takes ~200px before tabs appear. Scroll keeps the top of the page useful. Native iOS/Android pattern. |
| **M3 Action icon row on viewer page** | Refresh + Pin visible inline; PDF/XLS/CSV/Print/Share collapsed into a `⋯` overflow menu | 8 icons wrap ugly on phone; overflow keeps the inline row clean. |
| **M4 Drill-down on mobile** | Full-screen overlay (NOT a right-side slideout) | No horizontal room for a slideout. Same `gh-drilldown.js` component, viewport-aware mode. |
| **M5 Data table on mobile** | Each row becomes a card with 3-4 most important columns visible; tap to expand and see the rest | Stacking 10 fields per row = endless scroll. Important-first + expand pattern. |
| **M6 Filter strip on mobile** | Pills wrap inline to multiple rows. "+ Add filter" stays attached to last pill (no separate row). | Filters are critical context; the Add button is a less-common action and doesn't need its own row. |

### Money tab — final tile list (NEW LOCK — 17 tiles + Pending shortcut)

```
spending
[💰 Spending by category LIVE] [💰 Top vendors LIVE] [💰 Calendar] [💰 Trends LIVE]

income & cash
[💰 Income → categories] [💰 Cash-flow forecast LIVE] [💰 Net worth trend]

tax & receipts
[💰 HSA & FSA — IRS ready LIVE] [💰 Subscriptions — renewals]

trade terminal                          ─────────────  Open terminal ↗
[💰 Portfolio snapshot] [💰 Portfolio performance] [💰 Concentration & corr]
[💰 Tax location check] [💰 Trade research log] [💰 Rebalancing advice log]
[💰 Tax optimization log]

pending shortcut
[⚠ Pending items →]   (links to Pending tab — not its own viewer page)
```

**5 wired LIVE in the first drop:** Spending by category · Top vendors · Trends · Cash-flow forecast · HSA-FSA IRS. All have working backend endpoints from past drops (v.169-v.185), so the work is per-report viewer-page wiring, not new queries.

**12 visible but NON-FUNCTIONAL in first drop:** Click → "Coming soon" toast. Wired one or two per subsequent drop in v.198+.

The 7 trade-terminal tiles all read from existing backend (`/portfolio/live`, `/portfolio/performance`, `/portfolio/correlation`, `/reports` JSON files). Surfacing them inside the redesigned `/reports.html` doesn't change `/trade.html` — the terminal stays as-is and the "Open terminal ↗" link on the trade-terminal section header jumps to it.

### Health tab — content per original handoff

Per the original "Health tab" section below: hsa-fsa-irs (shared with Money), hsa-spending, meds-active, visits-history, immunizations, procedures, receipts-missing. Labs + BP trend remain "in design" cards until the metric_index design conversation. No changes from the original handoff for this tab.

### Household tab — final tile list (NEW LOCK — 11 tiles, 3 groups)

```
property & vehicles
[🏠 Property summary] [🏠 Maintenance log] [🚗 Vehicles summary]
[🚗 Vehicle maintenance] [🚗 Fuel + service log]

recurring spend & policies
[📰 Subscriptions overview] [🛡 Insurance policies]

inventory & documents
[📦 Inventory valuation] [📦 Warranty expiry] [📄 Document expiry]
[📦 Items by location]
```

All source data exists in current modules — Property, Vehicles, Subscriptions, Insurance, Inventory, Documents.

### Family tab — final tile list (NEW LOCK — 7 tiles, 4 groups)

```
emergency & snapshot
[🆔 Emergency info — per person] [👪 Family snapshot]

family member detail
[👤 Family member detail]   ← ONE tile with member switcher inside the viewer

kids
[👧 Kids — activities] [👧 Kids — school + grades]

contacts
[📇 Care team contacts] [📇 Family contacts directory]
```

**Family member detail = ONE tile with a switcher inside the viewer page** (NOT auto-multiplied per family member). Tile count is stable regardless of family size. Adding a 5th family member doesn't add a 5th tile — the switcher dropdown gets one more option.

### Cross-tab duplicates (NEW LOCK)

Reports listed under multiple tabs (e.g. `hsa-fsa-irs` in Money AND Health) ship as **duplicate tiles, same underlying report, identical drill-down**. The tile's leading icon color/emoji follows the **tab**, not the report — so `hsa-fsa-irs` shows with `💰` under Money and `🩺` under Health. Identical behavior on click.

### Tile sort within a group (NEW LOCK)

Manually curated. The exact tile order is locked at each drop's build time and frozen unless explicitly redesigned. NOT auto-sorted by usage frequency (jumpy) or alphabetical (boring).

### Column picker per-report defaults (DEFERRED, default rule set)

Per-report column visibility defaults stay deferred — they'll be locked at each report's individual build. **Default rule:** every column visible. `GH_VIEW`'s existing column picker is reused, not redesigned.

### Reports Redesign — what's still NOT decided

- **Per-report default column visibility** (above — deferred per default rule)
- **`user_preferences` table schema** for v.197 (likely the handoff's original spec: `id`, `user_key`, `pinned_reports` JSON, `updated_at` — but confirm at build time)
- **"Pinned" interaction model** — pin button lives on viewer pages, which don't exist until at least one report has a viewer. So pinning is a v.197+ concern, not a v.197 task.

Everything else from this chat is **LOCKED**. Don't re-litigate.

---

## How to use this document

Read this end-to-end before doing any code.

If you are **Claude Code**: this is your build spec for v.186 + v.187. Translate it
into a task plan, show Al the plan, get approval, build. Use the visual mockups
referenced below — Al will attach them as image files when this handoff is
delivered. Match those mockups closely.

If you are **a fresh chat**: this is the design state. Use it as ground truth.
The drill-downs that remain (Household + Family tab contents, mobile preview,
column picker modal) need to be done before building those tabs. Money + Health
are fully specified.

---

## What this redesign is

The current `/reports.html` has three tabs (Overview / Pending / Charts) and a
loose collection of report cards. Pending Items Report and the Charts preview
both work. Everything else is unstructured.

This redesign replaces the page with a categorized hub that mirrors the
left-nav sections, adds a Lens search bar like every other page, and gives each
report its own viewer page with proper drill-down, export, and shared
slideout-based record detail.

It is a view-layer redesign only. No data moves. No source-of-truth changes.
Every report queries its module's canonical tables (finance reads from finance
tables, medical reads from medical tables). Cross-module joins happen via the
existing `record_links` table per the SHARED-LNK lock.

---

## Locked architecture

### Tabs (locked)

`Money | Health | Household | Family | Pending`

Five tabs. No "Overview" tab — Inventory and Medical don't have one, Reports
shouldn't either. No "Recent" tab — last-run timestamp is on every card and
Lens search handles "find that report I ran Tuesday."

Tab order is by topical relevance, not alphabetical: Money first because
finance is the most-used module, Family last because it's read-mostly.

### Above the tabs (locked)

- **Page header row** (same shape as `inventory.html` and `medical.html`):
  module icon left, page title + "N reports · M pinned" subtitle, **Lens search
  bar** centered/flex-filling, "New report" button right.
- **Pinned strip** — a thin row of 4 pinned report cards directly above the
  tabs row, visible on every tab.

### Lens search behavior (locked)

- Searches **report titles + visible page descriptions only**. Does NOT search
  inside report data.
- Footnote: "Lens searches report names and descriptions on this page only. To
  search inside a report's data, open the report and use its own filters."
- Active query shows as a removable pill inside the search bar.
- Matched terms highlight in `<mark>` style on cards.
- Tabs dim to show non-matches; each tab shows match count.

### Per-tab content shape

Each tab is **a long page with labeled category cards stacked vertically**. No
sub-tabs, no pill chips (rejected during design — adds visual noise; the tab
list itself is enough hierarchy).

Each report inside a tab is a small card with:
- Eyebrow row: small icon + uppercase category subtitle (e.g., "Money · tax")
- Title (13px, weight 500)
- One-line metadata (e.g., "last run today · 9:42 am")
- Click anywhere on the card → opens report viewer

Cards laid out in **4-column grid on desktop**, 2-column on tablet, 1-column on
mobile.

### Report viewer page (locked)

When a user clicks a card, the report opens at its own URL:
`/reports.html?run=<slug>&<filter-query-params>`

Page contents:
1. Breadcrumb: `Reports › <Tab>` (link)
2. Title row: report title + tax-year/scope pill + small "last refreshed"
   timestamp + description on one subtle line
3. Action icon row (top-right): Refresh / Pin / Choose columns | PDF / Excel /
   CSV / Print / Share
4. Filter strip: small pills, removable, plus "+ Add filter"
5. Summary cards: 4-column grid of stat cards (label uppercase + bold value)
6. Data table: sortable headers, hover row shows `…` overflow menu, drill-down
   columns rendered as `→` link style
7. Pagination row at bottom of table

### Drill-down (locked)

Clicking a drill-down link in a row (e.g., the "Linked to: Lisinopril →" cell)
opens a **slideout panel from the right** containing the canonical record
detail view.

Critical constraint: the slideout uses the **same partial component** that the
source module's detail page uses. No duplicate rendering code. The detail view
is loaded once at the right path (`/medical/medications/:id` → returns an HTML
fragment OR existing rendering hook) and mounted into the slideout's content
slot.

The slideout has:
- Back-stack breadcrumb at top (e.g., `← Back · Report › Lisinopril (medication
  detail)`)
- Close button (X) top-right
- Same content the source module's page would render
- "Open in Medical" / "Open in <source-page>" link at the bottom for full-page
  view

If user drills from a record into another record (Lisinopril → Dr. Patel),
the slideout pushes a new view onto the back-stack. Back button pops.

### Auto-refresh + manual refresh (locked)

- Report data **always re-queries source tables on page load**. No cache.
- The "last refreshed" timestamp shows "just now" on first load, "Ns ago"
  thereafter.
- Refresh button in action row forces a re-fetch without leaving the page.
- No "save this view" button — reports are built-in, not user-defined.

### Pin / unpin (locked)

- Pin button in the action row of any report.
- Pinned state stored in `user_preferences` table (one row per user, JSON
  column `pinned_reports` containing `["hsa-irs", "cash-flow", ...]`).
- Pinned reports appear in the strip above tabs on the Reports landing.
- Maximum 4 pinned (UI constraint; oldest auto-evicts on 5th pin, with toast
  message).

### Export icons (display-only for now — locked)

PDF / Excel / CSV / Print / Share render as 30px icon buttons in the action row
with tooltips. Functionality wires up later — except Print, which can ship
functional immediately as `window.print()` with a print-friendly CSS stylesheet
on the report viewer page.

---

## Empty + error states (locked)

### Empty state

Shown when a report's query returns zero rows OR when active filters yield no
matches. Icon: `ti-search-off`. Plain English: "No matches for these filters"
+ subtitle naming the filters + 1-2 buttons offering single-tap filter relaxes
("Try 2024", "Remove 'with receipts only'").

### Error state

Shown when the query throws. Icon: `ti-alert-triangle` in danger color. Plain
English: "Couldn't load this report" + subtitle naming the last working
version (Al deploys are version-tagged; this is "last known good" reference).
Two buttons: "Try again" (re-fetches), "Report issue" (opens a feedback/notes
modal — out of scope for v.186).

---

## Tab contents — DETAILED for Money and Health, deferred for the rest

### Money tab

One category card. Inside it, these reports in 4-column grid:

| Slug             | Title                        | Description                                          | Source         | Drills into                |
|------------------|------------------------------|------------------------------------------------------|----------------|----------------------------|
| spending-by-cat  | Spending by category         | Per-category totals, current month + YTD             | transactions   | transaction detail         |
| cash-flow        | Cash-flow forecast           | Projected balance 30/60/90 days out                  | finance/forecast (already shipped v.169) | none                       |
| income-flow      | Income → categories          | Sankey, where every dollar of income went            | transactions   | category-month report      |
| spending-cal     | Spending calendar            | Heatmap of daily spend, last 12 months               | transactions   | day-detail (txns list)     |
| top-vendors      | Top vendors                  | Treemap of vendor totals                             | transactions   | vendor-detail (txns + linked records) |
| category-trends  | Category trends              | Small multiples — one mini-chart per top-10 category | transactions   | category-month report      |
| net-worth        | Net-worth trend              | Line, monthly snapshots                              | net_worth_snapshots | snapshot detail            |
| subs-renewals    | Subscriptions — upcoming renewals | List of next 90 days renewals                   | subscriptions  | subscription detail        |
| hsa-fsa-irs      | HSA & FSA — IRS ready        | Tax-export of all qualifying expenses, current year  | hsa_payments + fsa_payments + record_links | medication / visit detail  |
| pending-trans    | Pending transactions         | Shortcut to Pending tab                              | (links to Pending) | n/a                        |

`hsa-fsa-irs` also appears under **Health** tab (same report, two homes — Money
emphasizes the financial side, Health emphasizes the clinical side; viewer is
the same, drill-down behavior identical).

### Health tab

One category card. Reports:

| Slug              | Title                          | Description                                                   | Source                     | Drills into            |
|-------------------|--------------------------------|---------------------------------------------------------------|----------------------------|------------------------|
| hsa-fsa-irs       | HSA & FSA — IRS ready          | Same report as Money tab                                      | hsa_payments + fsa_payments | medication / visit     |
| hsa-spending      | HSA spending history           | Year-by-year HSA spend with category breakdown                | hsa_payments               | medication / visit     |
| meds-active       | Active medications snapshot    | All active meds across all family, with last fill date        | medications                | medication detail      |
| visits-history    | Visits history                 | All visits, filterable by family member + provider            | medical_visits             | visit detail           |
| labs-trend        | Labs trend                     | (Health Group 2 — blocked on metric_index design)             | medical_labs               | lab detail             |
| bp-trend          | Blood pressure trend           | (Health Group 2 — blocked on metric_index design)             | medical_vitals             | reading detail         |
| immunizations     | Immunizations record           | Card-style summary per family member (post-v.180)             | med_immunizations          | immunization detail    |
| procedures        | Procedures record              | Card-style summary per family member (post-v.180)             | med_procedures             | procedure detail       |
| receipts-missing  | Missing receipts               | HSA/FSA expenses with no attached receipt                     | hsa_payments + fsa_payments + record_links + attachments | payment detail         |

Reports marked "blocked on metric_index design" render as "in design" cards
(50% opacity, no click action) until the design conversation happens.

### Household tab

DEFERRED to a follow-up chat. Drill-down conversation needed to enumerate
contents.

Likely candidates (not locked): Property summary, Vehicles summary, Inventory
valuation, Subscriptions, Insurance policies, Document expiry, Warranty expiry,
Maintenance log.

### Family tab

DEFERRED to a follow-up chat. Drill-down conversation needed.

Likely candidates (not locked): Emergency info card (per person), Family
snapshot (whole family overview), Per-member detail (one tab per family
member or a switcher), Kids activity report, Care team contacts directory.

### Pending tab

Already built. Renders the existing Pending Items Report (v.171 / v.173
locked design #29 in `_templates.html`). No changes — just lives under this
tab in the new layout.

---

## Build plan — v.186 + v.187

### v.186 — Foundation (no per-tab content yet)

1. **Database**: new `user_preferences` table.
   - Migration additive, no CASCADE, schema comment.
   - Columns: `id INTEGER PK, user_key TEXT NOT NULL DEFAULT 'default', pinned_reports TEXT (JSON array), updated_at DATETIME`.
   - Seed one row with `user_key='default'`, `pinned_reports='[]'`.

2. **New endpoints**:
   - `GET /api/v1/preferences/pinned-reports` → returns array of report slugs
   - `PUT /api/v1/preferences/pinned-reports` → accepts `{ pinned_reports: [...] }`, max 4 enforced server-side

3. **Frontend `/reports.html` rewrite**:
   - New header row with Lens search (use existing GH_LENS pattern, scope name `reports`)
   - New tabs row: `Money | Health | Household | Family | Pending`
   - Each non-Pending tab renders a placeholder category card with text "This category will be populated in v.187+"
   - Pending tab keeps existing behavior
   - Pinned strip above tabs, populated from `/api/v1/preferences/pinned-reports`

4. **Lens config**: new entry `reports` with dimensions `{ title, description, category }`.

5. **Empty + error state CSS** and shared partial — used across all reports.

6. **No report viewer page yet** — that ships in v.187.

7. **Tests**:
   - Smoke: GET `/api/v1/preferences/pinned-reports` returns 200 + array
   - Playwright: load `/reports.html`, switch tabs, Lens search bar appears, pinned strip renders (empty)
   - Lens search input narrows visible cards by name (test against placeholder cards)

8. **Docs + version**: STATE.md, BACKLOG.md, app/version.txt → 202604.186

### v.187 — Money tab + Report viewer page

1. **Report viewer page**:
   - URL pattern: `/reports.html?run=<slug>&<filter-params>`
   - JS routing — when `?run=` is present, switch from landing layout to viewer layout in-place (no separate file)
   - All shared partials: title row, filter strip, summary cards, data table, drill-down slideout, empty state, error state
   - Print stylesheet (`@media print`) hides nav rail, header, action buttons; keeps title + filters + table
   - URL encodes active filters so share-link reproduces the view

2. **Money tab content**:
   - Populate the Money tab card with all 10 reports from the table above
   - Each report has an entry in a new `REPORT_REGISTRY` (in-memory JS array OR a database table — your call; in-memory simpler, persistent table cleaner). Each entry: `slug, title, tab, description, icon, source_modules, drill_targets`.
   - Wire `spending-by-cat`, `cash-flow`, `hsa-fsa-irs`, `top-vendors`, `category-trends` to live queries. Other Money reports can be stubs in v.187 if scope tight.

3. **Drill-down slideout component**:
   - New shared partial `_reports_drillout.html` (or .js) loaded on the report viewer page
   - Accepts: target record type + record ID + return-to context
   - Loads source module's existing detail rendering hook (medication detail, visit detail, etc.)
   - Implements back-stack with `pushState`-style navigation inside the slideout
   - Close button restores focus to the row that opened it

4. **Tests**:
   - Smoke: each Money report endpoint returns 200
   - Playwright: navigate to Money tab, click a report card, viewer page renders, refresh button works, drill-down opens slideout, slideout back button works

5. **Docs + version**: STATE.md, BACKLOG.md, app/version.txt → 202604.187

### v.188 onward

- v.188: Health tab + Health-specific reports (incl. those that depend on
  v.180's med_immunizations / med_procedures tables — ensure ordering correct)
- v.189: Household tab (after another design pass)
- v.190: Family tab (after another design pass)
- v.191+: Wire deferred Health reports as metric_index design unlocks them

---

## What does NOT change

- Pending Items Report (#29 locked, v.171) — same code, just renders under new tab.
- Charts preview (current #26 work) — folds into Money tab card as the live charts there.
- `record_links` SHARED-LNK lock — unchanged.
- Auth boundary (open mode, requireAuth on settings + watcher only) — unchanged.
- The Settings page absorbs the "Operational" reports (Emergency info FAMILY tab; Family snapshot FAMILY tab; Data export / Audit log / Test results stay in Settings as today).

---

## Open product decisions (DON'T BUILD WITHOUT THESE)

1. **Per-tab landing-page contents for Household + Family** — Al needs to drill
   down with chat in a future session. Don't guess.
2. **Mobile layout** — drafted in concept (4-col → 2x2 grid; table → cards),
   not visually approved. Defer until after v.187 ships and Al sees the
   desktop version live.
3. **Column picker modal** — pattern exists in Ghrava already (`GH_VIEW`'s
   column picker). Reuse, don't redesign. But the picker's contents per report
   need a default-columns list per slug; treat as "every column on by default"
   until Al wants to hide things.

---

## Visual references attached

Al will attach screenshots from the chat that designed this:

1. `reports_page_mockup_v1_tabs_by_category` — overall page layout with tabs +
   pinned strip + category cards
2. `reports_lens_search_behavior` — Lens search active state with matched
   results
3. `report_viewer_full_with_all_states` — report viewer page, drill-down
   slideout, empty state, error state

Match these closely. The icons, spacing, and font sizes shown there are part
of the lock.

---

## Build rules applying to every drop (carry-forward from prior locks)

- Plain English everywhere user-facing. No internal jargon on screen.
- Every dataset gets at least grid + list views via `GH_VIEW.init()` — the
  report card grid satisfies "grid view"; the report viewer table satisfies
  "list view" for that report's underlying data.
- No new ON DELETE CASCADE.
- Every `db.prepare` raw SQL gets a `// schema:` comment naming columns.
- Bundle 3-5 tasks per drop — no single-task drops except critical bugs.
- Show Al the plan before code in every drop.
- Default rule for ambiguity: pick the option that touches the least code and
  matches existing pattern, document in commit, don't pause to ask.
- Gates won't run on Windows — that's normal, mention in commit messages.
- Do NOT package a zip — Al says "package" when ready.
- For each commit message, note "gates not run locally" if applicable.

---

## What "done" looks like for the whole redesign

When all of these are true:

- All 5 tabs render with real content (no placeholder text)
- Every report listed under Money + Health is wired to a live query OR clearly
  marked "in design"
- Pinned strip persists across page loads via user_preferences
- Report viewer page works for every wired report: filters, sorts, drills,
  exports show (functional for Print; display-only for PDF/Excel/CSV; Share
  copies URL)
- Empty + error states render in tests
- Existing Pending Items Report works inside the Pending tab without
  regression
- Smoke suite + full Playwright pass 0 failures vs current baseline
- STATE.md, BACKLOG.md updated; app/version.txt = 202604.190 or wherever
  Household + Family tabs finish

Expected total drop count: **v.186 through v.190**, plus follow-ups for
metric_index when that design conversation happens.

---

**End of handoff.** Save this file in repo root. Open it in next session.
