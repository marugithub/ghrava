# Trade Terminal — Ghrava Integration
**Status:** Phase 1 + 3A + 3B + 3C + 3D + 4A + 5A + 6 + 7 + 8 LIVE on v202605.195 (Phase 1-2 via parallel chat: v.186-v.189; Phases 3A/3B/6: v.190-v.191; Phases 3D/7: v.192; Phases 3C/4A: v.193; Phase 8: v.194; Phase 5A: v.195)
**Built against:** Ghrava v202604.185 (extended through v202605.195)
**Files changed:** `app/features/trading/routes.js`, `app/public/trade.html`, `app/public/finance.html`, `app/public/dashboard.html`, `app/features/finance/routes.js`
**Migrations applied:** `146_financial_accounts_tax_treatment.sql`

---

## What Was Built

### New backend routes in `app/features/trading/routes.js`

All new routes are GET-only except `save-to-ghrava`. All public — no `requireAuth`.
The trading routes file now requires `../db/db` for read access to `lifetracker.db`.

| Route | Purpose | Tables read |
|---|---|---|
| `GET /api/v1/trading/portfolio/live` | Holdings grouped by account with tax treatment | `financial_accounts`, `holdings` |
| `GET /api/v1/trading/portfolio/performance?months=12` | Snapshot history + allocation + gainers/losers | `portfolio_snapshots`, `holdings` |
| `GET /api/v1/trading/watchlist/summary` | Top movers from watchlist for Dashboard widget | `trading.json` + Yahoo Finance |
| `POST /api/v1/trading/reports/save-to-ghrava` | Save AI analysis to Ghrava Documents | writes to `documents` |

### Migration `146_financial_accounts_tax_treatment.sql`

Adds `tax_treatment TEXT NOT NULL DEFAULT 'taxable'` to the underlying `accounts`
table (mig 130 made `financial_accounts` a VIEW), and recreates the view to expose
the column. Additive only — no existing rows affected.

**Doc-correction note (v.190 audit):** earlier text here claimed migration 146 also
seeded `dropdown_options` with `list_key = 'investment_tax_treatment'`. **It does
not** — only the column + view exist. The dropdown in `finance.html` uses static
`<option>` elements with keys matching `trade.html`'s `taxLabel` enum
(`taxable / traditional_ira / roth_ira / tsp / hsa / other`). This is intentional:
the vocabulary is code-coupled (the trade terminal renders badges per key), so
keeping it static prevents user-added values from becoming silent orphans.

**Status (v.190):** Finance dropdown wired at `finance.html:3610-3623`, show/hide
at `:2620-2621`, save/load at `:2664/2711`. End-to-end verified via live NAS GET
returning `tax_treatment` per investment account.

### Portfolio tab — now reads from Ghrava

The terminal's Portfolio tab has a **Ghrava Holdings / Manual** toggle.

**Ghrava Holdings view:**
- Loads from `GET /api/v1/trading/portfolio/live`
- Groups positions by account, shows tax treatment badge per account
- Live price overlay from the watchlist quote cache — if a symbol is in your
  watchlist, the live price replaces the stale statement price automatically
- 52-week range progress bar per position
- AI ▶ button on each row — jumps to AI Analyst tab with the symbol pre-filled
  and cost basis injected into the context automatically
- Refresh button re-fetches from Ghrava

**Performance chart:**
- Loads from `GET /api/v1/trading/portfolio/performance`
- Reads `portfolio_snapshots` table — populated by `shared/portfolio-analytics.js`
- Three metric toggles: $ Value / $ Gain / % Return
- Asset allocation strip below the chart
- Top 5 gainers and top 5 losers from current holdings

**Manual view:**
- The old manual portfolio entry system — unchanged, still works
- Useful for positions not yet imported into Ghrava Finance

### AI Analyst — two new buttons

`💾 SAVE REPORT` — existing, saves to `/app/data/trading-reports/` JSON files

`📁 SAVE TO GHRAVA` — new, calls `POST /api/v1/trading/reports/save-to-ghrava`.
Creates a new Document record in Ghrava with:
- category: `Trade Research`
- subcategory: ticker symbol
- description: AI thesis (first 500 chars)
- issue_date: today
- issuer: AI provider name
- Tagged with the ticker symbol automatically
Duplicate detection: if the same title + date already exists, returns `duplicate:true`
without creating another row.

---

## Non-Negotiable Rules (enforced in this code)

1. **No DELETE on any Ghrava table.** All terminal queries are SELECT only,
   except `POST /reports/save-to-ghrava` which does one INSERT into `documents`.

2. **No ON DELETE CASCADE** — not in migration 146 or anywhere else.

3. **All reads filter `WHERE is_active = 1`** on `financial_accounts`.
   Holdings rows don't have `is_active` — they're always returned for active accounts.

4. **Terminal never writes to `financial_accounts`, `holdings`, `imported_transactions`,
   `finance_accounts`, or any finance table.** Read only. The one write is to `documents`.

5. **The two account tables are NOT the same:**
   - `finance_accounts` — manual banking ledger, uses `name` column
   - `financial_accounts` — CSV import system (investments), uses `nickname` column
   The terminal reads from `financial_accounts` only.

---

## Phase 1 + 3A completion status (v.190 audit)

### ✅ DONE in v.189 (shipped by parallel chat)

1. **`tax_treatment` dropdown in `finance.html`** — wired end-to-end. Static options
   match the `trade.html` taxLabel enum (not from `dropdown_options`; see correction
   above). Shown only for investment account types (Brokerage / TSP / Retirement).
2. **Dashboard watchlist widget** — `dashboard.html:418-428` widget HTML,
   `loadWatchlistWidget()` at `:436-467` calls `/api/v1/trading/watchlist/summary`,
   shows top 5 movers + count, silent-fail on error or empty.
3. **Phase 1 terminal upgrades** — candlestick chart, technical indicators
   (RSI/MACD/BB), FRED macro panel, Polygon options chain — all live.

### ✅ DONE in v.190

4. **Smoke test additions** — `smoke-test.sh` Trading Terminal section adds
   `/portfolio/live`, `/portfolio/performance`, `/watchlist/summary`, `/market/macro`.
5. **Phase 3A — Target Allocation editor panel** with AI Rebalancing Advice button.
   New collapsible panel on the Portfolio tab below the performance chart. Reads
   current allocation from `/portfolio/performance`, persists target in
   `trading.json` under `settings.targetAllocation`. AI advice uses
   `callProvider()` with the user's configured provider; result can be saved as a
   report with `type='AI Rebalancing Advice'`.

### ✅ DONE in v.195

17. **Phase 5A — Real screener universe.** New backend route
    `GET /api/v1/trading/market/symbols` fetches Finnhub's free
    `/stock/symbol?exchange=US` (~10k US-listed symbols) and caches
    the slim response in `/app/data/trading-cache.json` with a 24h
    TTL. Cache lives in its OWN file (not `trading.json`) so the
    ~1MB payload doesn't round-trip on every client save of
    settings/watchlist/alerts. Graceful-fallback contract:
    - Cache fresh + no `?refresh=1` → return cache, `_source='cache'`
    - Cache stale OR forced refresh + key + fetch ok → fresh fetch,
      persist, `_source='finnhub_fresh'`
    - Fetch fails + cache present → stale cache with `_note`,
      `_source='cache_stale_fetch_failed'`
    - No key + cache present → stale cache with `_note`,
      `_source='cache_stale_no_key'`
    - No key + no cache → 400 with friendly error
    Frontend: Screener tab's old hardcoded `MOCK_QUOTES` reference
    table replaced with a real filtered universe view. Filters:
    substring on ticker + company name, type select (Common Stock /
    ETF / ADR / ...), exchange select (XNAS / XNYS / ARCX / ...).
    Sortable by symbol or description. Results capped at 100 rows
    for DOM perf (typical search narrows below 100 anyway).
    Refresh button forces re-fetch. Friendly age stamp
    ('fetched 2h ago').

    **Limitation documented in the panel footer:** sector + market-
    cap filters NOT available on Finnhub's free tier — would require
    `/stock/profile2` per symbol (~10k API calls). The existing
    lookup above the table provides full per-symbol metrics on
    demand when the user picks a row.

### ✅ DONE in v.194

13. **Phase 8 — Reports tab rich viewer.** Inside `trade.html`'s
    Reports tab, saved JSON reports now render as proper structured
    views instead of raw JSON. Four type-aware renderers:
    - **AI Analysis** → existing `AIResultCard` (was already wired
      correctly — kept as-is)
    - **Portfolio Snapshot** → new `<PortfolioSnapshotViewer>`
      component at module scope. **Snapshot save fixed end-to-end**
      (was BROKEN on v.193 — `savePortfolioReport` wrote
      `data.ghrava.<snake_case>` keys but the viewer read
      `data.summary.<camelCase>` keys; saved reports also didn't
      include per-position detail, only summary totals; v.194
      fixes both ends). Renderer handles three shapes (new v.194 /
      pre-v.194 broken save / legacy positions-array) and shows
      summary cards + positions table with tax-treatment badges +
      CSV export.
    - **AI Rebalancing Advice** → new `<NarrativeAIReport>`
      component. Renders meta strip + current-vs-target table +
      advice body + collapsible 'show prompt sent to AI'.
    - **AI Tax Optimization** → same `<NarrativeAIReport>` component
      (different colour + label). Renders flagged-holdings table +
      advice body + prompt.

14. **Phase 8 — filter UI.** Collapsible filter strip in the
    reports sidebar with three axes: type (multi-select pills,
    one per known type), ticker (substring), date range (from/to
    pickers). Client-side filtering. '✕ CLEAR' button when any
    filter active. Empty-state when no reports match.

15. **Phase 8 — CSV export for Portfolio Snapshots.** '⬇ CSV'
    button on the positions table. Iterates the flattened
    positions list. RFC-4180 escaping (commas, quotes, newlines).
    Filename: `portfolio-snapshot-YYYY-MM-DD.csv`.

16. **Phase 8 — compare-two-snapshots diff.** 'COMPARE TO' picker
    below the positions table on Portfolio Snapshot reports.
    Selecting another snapshot fetches its data and shows a
    per-symbol diff: ADDED / REMOVED / CHANGED / UNCHANGED, with
    Δ shares and Δ value columns. Portfolio-level Δ VALUE / Δ COST /
    Δ P&L cards above the diff table. Unchanged rows hidden by
    default with a toggle. Status counts as colour pills.

### ✅ DONE in v.193

11. **Phase 3C — Concentration & Correlation panel.** New backend route
    `GET /api/v1/trading/portfolio/correlation` walks the user's
    holdings, fetches 90-day daily closes via the existing Yahoo
    proxy for the top 10 by market_value, and computes pairwise
    Pearson correlation on daily LOG-RETURNS (financial standard,
    not raw prices). Sector data comes from Finnhub `/stock/profile2`
    `finnhubIndustry` when a Finnhub key is configured; otherwise
    falls back to `holdings.asset_type`. Per-symbol fetches run
    in parallel with timeouts so slow upstreams can't pin the route.
    Frontend: new collapsible `ConcentrationPanel` on the Portfolio
    tab below Tax Location. Three sub-sections — SINGLE-STOCK
    EXPOSURE (top 10 bars, amber >10%, red >25%), SECTOR EXPOSURE
    (all holdings grouped, amber >40%, red >60%), CORRELATION PAIRS
    (top 12 by |r|, red >0.95, amber >0.85). Auto-loads when the
    parent's `ghravaPf` changes so hitting Refresh on the parent
    reloads concentration too.

12. **Phase 4A — Multi-symbol PriceChart comparison.** PriceChart
    gets a Compare row above the chart canvas. Add up to 3 extra
    symbols; chips show with fixed palette colours matching the
    line colour each symbol gets in the chart. When
    `compareSymbols.length > 0` the chart switches from candlestick
    to a normalised line chart — every series indexed to 100 at
    the first aligned bar (most-recent alignment trims tail to
    shortest series). Legend label: `SYM  +X.XX%` (period return).
    Y-axis labelled 'Indexed to 100'. Overlay buttons
    (Candles/SMA/BB/RSI/MACD) hidden in compare mode — they only
    apply to single-symbol candles. Reuses existing
    `/market/history/:symbol` — no new backend.

### ✅ DONE in v.192

9. **Phase 3D — Earnings capture for holdings.** New backend route
   `GET /api/v1/trading/portfolio/earnings-calendar` cross-references the
   user's holdings (financial_accounts JOIN holdings, is_active=1, equities
   only — bonds/cash skipped) against Finnhub's free `/calendar/earnings`
   for the next 30 days. Position aggregated per symbol across multiple
   accounts (sum shares, weighted-avg cost, sum market_value/gain). Finnhub
   key read server-side from trading.json so it stays out of URL logs.
   Frontend: EarningsTab gets a new 'My Holdings ★' sub-tab alongside All
   Upcoming and My Watchlist. Per-row position panel shows shares + avg
   cost + accounts + market value + P&L. AI Earnings Play button rebrands
   to 'PLAY FOR MY POSITION' and the prompt embeds the actual exposure so
   the AI recommendation is grounded in 'I hold N shares at \$X' rather
   than a generic earnings view.

10. **Phase 7 — Watchlist price alerts.** Bell icon on each Watchlist
    row with an inline editor: 'Alert when price is [above|below]
    \$[___]'. Default price is the current quote — user just changes
    digits. Alerts persist in `trading.json` under `alerts:[]`
    (server's POST /data deep-merge preserves the key automatically).
    Per-row alert chips show armed (green) or fired (amber) state with
    ↻ re-arm and ✕ delete controls. Trigger check runs after every
    `refresh()` once the merged quotes are known — fires once per
    threshold cross (sets `triggered:true` so it doesn't re-fire on the
    next refresh). Banner at top of the Watchlist panel announces
    crossings: '🔔 NVDA crossed above \$950 — now \$967.40'. Dismissable,
    capped at 10 entries. Removing a symbol from the watchlist also
    deletes any alerts attached to it.

### ✅ DONE in v.191

6. **Phase 3B — Tax Location Analysis panel** with AI Full Tax Optimization button.
   New collapsible panel below the Target Allocation panel. Client-side rules
   engine flags four kinds of suboptimal placements:
   bond/Taxable, bond/Roth, cash/Roth, high-dividend/Taxable. AI button sends
   the full holdings-by-account picture + flag set to the configured provider.
   Save-as-Report uses `type='AI Tax Optimization'`.

7. **Phase 6 — Short Interest end-to-end.** New backend route
   `/api/v1/trading/market/short-interest/:symbol` (Yahoo quoteSummary
   defaultKeyStatistics with graceful-null contract on 401/timeout). Frontend
   AI enrichment pipeline wired into `AIAnalystTab.run()` — fetches fundamentals
   + short interest + congress trades + recent filings in parallel; passes a
   structured `enrichment` object to `analyzeStock()`. AIResultCard renders a
   new "Short Interest" section (% of float, days to cover, Δ vs prior month)
   with amber/red severity colouring.
   **Yahoo limitation:** cookie-less `quoteSummary` calls historically return
   401. The route handles this — returns 200 with `shortFloat:null` and
   `_source:'unavailable'`. Future enhancement: implement the Yahoo crumb dance
   OR add a Polygon free-tier fallback (user already has a Polygon key for
   options).

8. **Bug fix uncovered during Phase 6 wiring — AI Analyst was silently broken
   on v.189.** `AIAnalystTab.run()` referenced `setFundamentals`, `enrichment`,
   and (in JSX) `setTechContext` without ever declaring the corresponding
   `useState` hooks. Every Run Analysis click raised
   `setFundamentals is not defined`, was caught by the surrounding try/catch,
   and the error message was shown in the UI — so the AI never actually ran.
   v.191 restores the three hooks and rebuilds the enrichment pipeline.

---

## Next Phases (not yet built)

**Phase 9 (v.196):** Mobile UX — responsive tab bar, watchlist column
collapse, portfolio card view, chart height reduction, settings
accordion sections. **This is the last trade-terminal drop** before
the queue pivots to the Reports Redesign.

**v.197+:** Reports Redesign drop 1 begins (the big `/reports.html`
rewrite). See `REPORTS_REDESIGN_HANDOFF.md` for the locked spec —
the "2026-05-23 REFINEMENT BLOCK" at the top is the current truth.

See `MEMORY.md` → `parallel-roadmaps-may-2026` for the broader queue
context (Trade Terminal v.190-v.196, then Reports Redesign v.197+).

---

## Deployment Instructions

1. Copy `146_financial_accounts_tax_treatment.sql` to `app/db/migrations/`
2. Replace `app/features/trading/routes.js` with updated file
3. Replace `app/public/trade.html` with updated file
4. `docker restart ghrava` — migration runs automatically on startup
5. Open Finance → Holdings in Ghrava and verify accounts still load correctly
6. Open Trade Terminal → Portfolio tab — should show Ghrava Holdings view
   (if no holdings imported yet, shows a helpful message with import instructions)
7. Run smoke tests
