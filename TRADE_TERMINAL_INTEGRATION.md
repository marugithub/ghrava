# Trade Terminal — Ghrava Integration
**Status:** Phase 1 + 3A LIVE on v202605.190 (deployed via parallel chat: v.186 → v.190)
**Built against:** Ghrava v202604.185 (extended through v202605.190)
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

---

## Next Phases (not yet built)

**Phase 3B — Tax Location Optimisation** (v.191 — unblocked, now that the dropdown
has been live since v.189):
- Reads holdings grouped by account + tax_treatment
- Client-side rule engine flags suboptimal locations (bonds in Taxable, growth
  in Trad IRA, etc.)
- AI "Full Tax Optimisation Analysis" button for prioritised rebalancing plan

**Phase 6 — Short Interest** (v.191): Yahoo `quoteSummary` enrichment + AI prompt
+ AIResultCard badge.

**Phase 3D + Phase 7 (v.192):** Earnings capture for holdings (new `/portfolio/
earnings-calendar` route + "My Holdings" sub-tab) + price alerts (bell icon on
watchlist rows, toast on threshold crossing).

**Phase 3C + Phase 4A (v.193):** Concentration/correlation analysis (new
`/portfolio/correlation` route, Pearson on 90-day closes) + multi-symbol chart
comparison (normalised line mode).

**Phase 8 (v.194):** Reports tab rich viewer for `AI Analysis`, `Portfolio
Snapshot`, and `AI Rebalancing Advice` types. CSV export. Compare-two-snapshots
diff.

**Phase 5A (v.195):** Real screener universe via Finnhub `/stock/symbol` with
24h cache.

**Phase 9 (v.196):** Mobile UX pass.

See `MEMORY.md` → `parallel-roadmaps-may-2026` for the broader queue context
(Trade Terminal v.190-v.196, then Reports Redesign v.197+).

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
