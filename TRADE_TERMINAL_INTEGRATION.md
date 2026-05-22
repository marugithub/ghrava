# Trade Terminal — Ghrava Integration
**Status:** Phase 1 (portfolio + performance + document save) BUILT — not yet deployed
**Built against:** Ghrava v202604.185
**Files changed:** `app/features/trading/routes.js`, `app/public/trade.html`
**New migration:** `146_financial_accounts_tax_treatment.sql`

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

### New migration: `146_financial_accounts_tax_treatment.sql`

Adds `tax_treatment TEXT NOT NULL DEFAULT 'taxable'` to `financial_accounts`.
Seeds `dropdown_options` with `list_key = 'investment_tax_treatment'`.
Additive only — no existing rows affected.

**The Finance account form in `finance.html` still needs a `tax_treatment` dropdown
wired to this column.** That's a Ghrava-side task, not done in this integration.

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

## What Still Needs Doing (Ghrava-side)

### 1. Wire `tax_treatment` dropdown in `finance.html`

Migration 146 adds the column. The Finance account form for investment accounts
needs a new dropdown. The dropdown options are already seeded in `dropdown_options`
under `list_key = 'investment_tax_treatment'`.

The field should appear in the investment account form (account_type = brokerage/tsp/other),
not in the banking account form (checking/savings/credit).

### 2. Dashboard watchlist widget

`GET /api/v1/trading/watchlist/summary` is built and returns top movers.
A small widget on `dashboard.html` should call this endpoint and display:
- Top 3–5 movers with price and % change coloured green/red
- "N symbols in watchlist" count
- Link to open the terminal
Silent fail — if the endpoint is unavailable, widget shows nothing.

### 3. Smoke test additions

Add to `smoke-test.sh`:
```bash
check_endpoint "GET /api/v1/trading/portfolio/live"               200
check_endpoint "GET /api/v1/trading/portfolio/performance?months=12" 200
check_endpoint "GET /api/v1/trading/watchlist/summary"            200
```

---

## Next Phases (not yet built)

**Phase 1 terminal upgrades** (planned after integration):
- Candlestick chart with volume bars — replace line chart in AI Analyst tab
- Technical indicators (RSI, MACD, Bollinger Bands) computed from OHLCV data,
  fed into AI prompt context
- FRED macro panel — Fed rate, CPI, unemployment, yield curve (free, no key)
- Real options chain via Polygon.io free key

**Phase 3 portfolio optimisation** (requires tax_treatment to be filled in):
- Asset allocation vs target allocation
- Tax location advice (AI-generated, based on holdings + tax_treatment per account)
- Concentration/correlation analysis
- Earnings capture — cross-reference holdings vs upcoming earnings calendar

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
