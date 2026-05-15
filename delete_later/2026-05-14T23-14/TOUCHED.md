# TOUCHED — v202604.150

Files modified in this drop. **Every entry is suspect until Al
confirms "tested, works."** Replaced on each drop; the running record
across drops is in STATE.md "✋ DON'T TRUST WITHOUT RETEST."

This drop is **finance landing, round 1 of 3 (design, sample data
only)**. No backend changes. No migrations. Pure HTML/CSS/JS on
finance.html plus version + STATE/TOUCHED docs.

---

## app/public/finance.html

### New "Overview" tab (default landing)

- Tab buttons: prepended `<button class="view-tab active"
  onclick="switchFinTab('overview',this)">Overview</button>` as the
  first tab. HSA tab loses its `active` class.
- Panel: new `<div class="view-panel active" id="panel-overview">`
  inserted before the existing HSA panel. HSA panel loses its
  `active` class.
- The Overview panel contains a 6-tile grid wrapped in
  `.fin-tiles-wrap > .fin-tiles-grid` with hardcoded sample data.

### 6 tiles (sample data)

1. **Net Worth** — $487,300 hero, +$3.2k MoM pill, 12-month
   sparkline, $521k assets / $34k liabilities strip. Click →
   `gotoFinTab('networth')`.
2. **Cash Flow MTD** — +$1,420 net, on-track pill, in/out bar
   ($9,840 / $8,420), vs-Apr / YTD strip. Click →
   `gotoFinTab('transactions')`.
3. **Credit Cards** — $3,420 owed hero, 12% util pill, 4 active,
   top 2 cards by balance with mini bars + "+2 more" rollup,
   "next due in 7 days · $340 min" strip. Click →
   `gotoFinTab('accounts')`.
4. **Bank Accounts** — $28,540 liquid, 1-stale pill (amber),
   Checking / Savings split, "Navy Fed not reconciled in 18 days"
   strip. Click → `gotoFinTab('accounts')`.
5. **Holdings** — $184,300 market value, +8.4% YTD pill, 28
   positions, top 2 with gain%, "+26 more" rollup, vs-S&P / today
   strip. Click → `gotoFinTab('holdings')`.
6. **HSA + LP-FSA** — $5,650 combined pool, FSA-in-47d pill (amber),
   per-pot mini rows, "manage in Medical → Receipts" strip. Click →
   `gotoFinTab('hsa')` for now (Path B redirect to Medical pending
   in a later drop).

### CSS additions (Vellum theme, scoped)

~50 lines of `.fin-tile-*` rules added to the existing page `<style>`
block. Specifics:

- Tile shell: `#fbf6e9` cream bg, `1px solid #d8cba8` border,
  12px radius, hover lift on `transform: translateY(-1px)` +
  subtle shadow.
- Hero: `Newsreader/Fraunces` italic 40px desktop, 36px mobile.
- Mini list rows: DM Mono 12px with `flex:1` label, optional bar,
  right-aligned amount with `min-width:54px`.
- Strip line: mono 11px, dotted top border via
  `1px solid rgba(216,203,168,0.5)`.
- Avatars: 22×22 circles, gradient color seeded by initial
  (`fin-tile-avatar--A` etc.).
- Mobile breakpoint 700px: grid collapses to 1 column.
- Sample-data banner: dashed red-tinted box at top of Overview.

### JS additions

- New `window.gotoFinTab(id)` helper: looks up the corresponding
  `#finTabs .view-tab` button by matching `onclick` attribute,
  calls existing `switchFinTab(id, btn)`. Inserted right after the
  existing `switchFinTab` definition.

### Existing-state changes (must verify they don't break things)

- `<button id="fabBtn">` initial state → `style="display:none"`.
  Was visible by default (text "+ Add Expense"). Hidden now because
  Overview is default and has no FAB. switchFinTab's tab branches
  set display per tab, so HSA/Accounts/Transactions/Gift Cards all
  still get the FAB when activated.
- `<div id="yearPillWrap">` initial state → `display:none` (the
  📅 year selector). Was visible by default. HSA-only chrome.
  switchFinTab toggles it on entering HSA.

### NOT touched

- `switchFinTab()` itself — its existing else branch already handles
  the 'overview' case (hides FAB).
- All other panels (HSA, Accounts, Transactions, Net Worth, Budgets,
  Gift Cards, Import, Holdings) — untouched.
- Boot sequence — still calls `loadHsaAll()` after `loadSharedData()`,
  which preloads HSA data even though Overview is the default. Wasted
  request but not broken.
- Hash navigation (`#import`) — still works; programmatically clicks
  the Import tab after a 400ms delay.

---

## app/version.txt

Bumped 202604.149 → 202604.150.

---

## STATE.md

- "🚨 NEW CHAT" block updated to v.150.
- Current version section rewritten for v.150.
- "✋ DON'T TRUST WITHOUT RETEST" replaced with v.150 entries plus a
  "Carryover from v.149" subsection so untested v.149 medical work
  isn't lost.
- "✅ SHIPPED THIS DROP" rewritten for v.150 — round 1/2/3 plan,
  tile composition rationale, visual rules, alias-field decision,
  earliest-due-date rule, HSA combined-tile decision, round 2
  schema gaps, capture-everything rule.
- "✅ SHIPPED — RECENT DROPS" added — compressed v.149 + v.148
  changelog so the file doesn't keep growing per drop.
- File map updated to reflect v.150 zip (4 files only).

---

## TEST PLAN (for Al)

**P0 — does it load**
1. Visit `/finance.html`. Should land on Overview tab automatically.
2. 6 tiles should render: Net Worth, Cash Flow, Credit Cards, Bank
   Accounts, Holdings, HSA + LP-FSA. Sample-data banner at the top.
3. No console errors.

**P1 — tile clicks navigate**
4. Click Net Worth tile → switches to Net Worth tab.
5. Click Cash Flow tile → switches to Transactions tab.
6. Click Credit Cards tile → switches to Accounts tab.
7. Click Bank Accounts tile → switches to Accounts tab (same as #6).
8. Click Holdings tile → switches to Holdings tab.
9. Click HSA + LP-FSA tile → switches to HSA tab.

**P2 — chrome state**
10. On Overview: FAB hidden, year pill hidden.
11. Click HSA tab: FAB appears with "+" symbol, year pill appears.
12. Click Net Worth tab: FAB hidden again, year pill hidden.
13. Click Accounts tab: FAB shows ("+ Add account").
14. Back to Overview: FAB hidden, year pill hidden.

**P3 — mobile**
15. Open `/finance.html` on a phone (or devtools narrow viewport).
    Tiles should stack 1-column at ≤700px.

**P4 — no regression on other tabs**
16. Walk through HSA, Accounts, Transactions, Net Worth, Budgets,
    Gift Cards, Import, Holdings. CRUD on each should still work.
17. `/finance.html#import` deep-link still lands on Import tab.

If any test fails:
- Tile click broken → `gotoFinTab()` selector mismatch. Check
  `onclick` attr format on `#finTabs .view-tab` buttons.
- FAB stuck visible → `switchFinTab()` else branch not hit. Verify
  `id` arg matches one of the explicit cases.
- Tiles unstyled → `.fin-tile-*` CSS not in scope. Check `<style>`
  block in finance.html line ~210.
