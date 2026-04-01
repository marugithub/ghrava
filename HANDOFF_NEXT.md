# Ghrava — Next Session Handoff
**Generated:** v202603.154  
**Purpose:** Complete context for picking up development. Read this before writing any code.

---

## 🔴 PRIORITY 1 — Holdings Display (JUST FIXED, NEEDS VERIFY)

### What was broken
Finance → Holdings tab showed "No holdings yet" even after a successful import.

### Root cause
`loadHoldings()` built the URL as `'/api/v1/import/holdings'` then called `api('GET', url)`.  
`window.api()` **always prepends `/api/v1`** — so the actual fetch was `/api/v1/api/v1/import/holdings` → 404 → silently caught → empty result.

This same double-prefix bug was present in 7 Import module functions. All fixed in v202603.154.

### Fix applied (v202603.154)
- `loadHoldings`: `/api/v1/import/holdings` → `/import/holdings`
- Two `PATCH /api/v1/import/transactions/` calls fixed

### Verify after deploy
1. Finance → Import → Upload Statement → select Schwab account → upload positions CSV
2. After import succeeds, click Holdings tab
3. Should show table with AAPL, ABEV, shares, price, market value, gain/loss

### Holdings tab already displays (but was empty)
`loadHoldings()` already renders: symbol, name, asset_type, shares, price, market_value, gain/loss $.  
It does NOT yet display the new fields added in v202603.152: total_cost_basis, gain_loss_pct, day_change_dollar, day_change_pct, week52_low, week52_high. Those need a UI pass.

---

## 🔴 PRIORITY 2 — Holdings UI Upgrade (Design Ready, Not Built)

### Goal
After holdings display correctly (Priority 1), upgrade the Holdings tab to show all captured fields and add charts.

### Data available per holding (all in `holdings` table after v202603.152)
| DB Column | CSV Source | Display |
|-----------|-----------|---------|
| symbol | Symbol | Bold ticker |
| name | Description | Full name |
| asset_type | Asset Type | Badge (stock/etf/etc) |
| shares | Qty | X.XXXX shares |
| price | Price | Current price |
| cost_basis | Cost/Share | Cost per share |
| total_cost_basis | Cost Basis | Total $ invested |
| market_value | Mkt Val | Current value |
| gain_loss_dollar | Gain $ | Unrealized P&L $ |
| gain_loss_pct | Gain % | Unrealized P&L % |
| day_change_dollar | Day Chng $ | Today's move $ |
| day_change_pct | Day Chng % | Today's move % |
| week52_low | 52 Wk Low | Range bar |
| week52_high | 52 Wk High | Range bar |
| reinvest_dividends | Reinvest? | DRIP flag |
| price_date | Statement date | As-of date |

### Desired UI design

**Summary strip (top of Holdings tab):**
```
Total Value: $XXXX   |   Total Cost: $XXXX   |   Gain/Loss: +$XXXX (+XX%)   |   X positions
```

**Per-holding row:**
```
[AAPL]  APPLE INC         887.48 sh                    $218,879
stock   @ $246.63 now     Cost $25.83/sh ($22,927)     +$195,952  +854.7%
                          52wk: ▓▓▓▓░░░ $169 ——●—— $288
                          Today: -$1,926 (-0.87%)
```

**Charts to build (one per session is fine):**
1. **Portfolio allocation pie** — % of total value by asset_type
2. **Top gainers/losers bar** — sorted by gain_loss_dollar
3. **Cost vs value comparison** — stacked bar per holding (cost_basis vs market_value)
4. **52-week range** — inline range bar showing where current price sits

---

## Current Version & Stack

**Version:** v202603.154  
**Stack:** Node.js/Express + SQLite (better-sqlite3) + vanilla JS + Docker on QNAP NAS  
**Host:** 192.168.4.62:3001, container: `ghrava`  
**Deploy:** `docker restart ghrava` (code changes) | `docker compose up --build -d` (package.json changes)  
**NAS path:** `Z:\ghrava` = `/share/Docker/home-core/ghrava`

---

## CRITICAL WIRING RULES (break these = bugs)

1. **`window.api(method, path)`** prepends `/api/v1` automatically. **NEVER** pass `/api/v1/...` as path. Always use `/feature/path`.
2. **Finance.html uses `window.api` directly** (not makeApi). All Import module paths must be bare: `/import/holdings`, `/import/accounts`, etc.
3. **Two finance account tables** — never mix them:
   - `finance_accounts` → Transactions tab (checking/savings/credit)
   - `financial_accounts` → Import tab (brokerage/TSP/investment)
4. **No `ON DELETE CASCADE`** — manual deletes only
5. **No WAL journal mode**
6. **One XLSX export** at `GET /api/v1/data/export` — never add per-module CSV exports
7. **Never use `c[:start] + new + c[end:]`** on JS template literal blocks — causes file truncation; use `str_replace` or Python `.replace()`

---

## File Layout (key files only)

```
app/
  server.js                          — Express app, all route mounts
  public/
    finance.html                     — Finance module (all tabs: Transactions, Import, Holdings, HSA)
    medical.html                     — Medical module (Meds, Conditions, Visits, H&W, EOB, Summary)
    property.html                    — Property + Vehicles + Maintenance
    kids.html                        — Kids profiles + Activities + Notes
    reports.html                     — Reports (Summary first tab, People, Spending, Health, NetWorth, etc.)
    settings.html                    — Settings (Family, Contacts, Tags, Dropdowns, Backup, etc.)
    nav.js                           — MODULES registry, nav groups, sidebar render
    js/lt-core.js                    — window.api, makeApi, GH_SELECT, GH_TAGS, GH_VIEW, GH_FAMILY
    js/lt-messages.js                — GH_EMPTY definitions (empty state messages)
    shared.css                       — ALL shared styles (card system, drawers, buttons, etc.)
  features/
    import/
      routes.js                      — /import/accounts, /import/preview, /import/confirm, /import/holdings
      parsers.js                     — parseFile(), all bank parsers including parseSchwabPositions
    finance/
      routes.js                      — /finance/accounts, /finance/transactions, /finance/net-worth, etc.
    medical/
      routes.js                      — medications, conditions, notes, EOB endpoints
      eob-parser.js                  — MHBP EOB PDF parser (local, no API)
    settings/routes.js               — /settings/family, /settings/tags, /settings/config, etc.
  db/
    migrations/                      — All SQL migrations (run in filename order)
      032_import_finance.sql         — financial_accounts, imported_transactions, holdings tables
      058_integration_config.sql     — app_config API keys (NHTSA, OpenFDA, etc.)
      059_category_rules_expanded.sql — 113 auto-categorization rules
      061_holdings_expanded.sql      — 7 new columns on holdings (gain/loss, 52wk, etc.)
```

---

## Nav Groups (current)

```
Daily:     Daily Log, Todos
Finance:   Finance, Trading
Household: Inventory, Medical, Kids, Property, Documents
Personal:  Career, Books, Resources
Reports:   Reports
Admin:     Notifications, Data, Settings
```

---

## Account Architecture (two systems — IMPORTANT)

### Banking (Transactions tab)
- Table: `finance_accounts` — columns: name, type, institution, account_last4, current_balance, balance_as_of
- Types: Checking, Savings, Credit Card, Cash, Loan, Other
- Transactions: `finance_transactions`

### Investment (Import tab)
- Table: `financial_accounts` — columns: nickname, institution, account_type, owner, last_four, track_statements
- Types: brokerage, tsp, other
- Transactions: `imported_transactions`
- Holdings: `holdings` — see Priority 2 above for full column list

### Unified Add Account Drawer
One form routes by type:
- Banking types → `POST /api/v1/finance/accounts`
- Investment types → `POST /api/v1/import/accounts`

`window.ACC_INVEST_TYPES = new Set(['Brokerage','TSP','Investment'])` — must be on `window` (not `const`) for cross-block access.

---

## Holdings Table (full schema after v202603.152)

```sql
CREATE TABLE holdings (
  id                INTEGER PRIMARY KEY,
  account_id        INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  name              TEXT,
  asset_type        TEXT DEFAULT 'stock',   -- stock|etf|mutual_fund|tsp_fund|cash|other
  shares            REAL NOT NULL DEFAULT 0,
  cost_basis        REAL,                   -- per share
  total_cost_basis  REAL,                   -- total position cost (NEW v061)
  price             REAL,                   -- current price from statement
  price_date        DATE,
  market_value      REAL,                   -- shares * price
  gain_loss_dollar  REAL,                   -- unrealized $ (NEW v061)
  gain_loss_pct     REAL,                   -- unrealized % (NEW v061)
  day_change_dollar REAL,                   -- today's change $ (NEW v061)
  day_change_pct    REAL,                   -- today's change % (NEW v061)
  week52_low        REAL,                   -- 52-week low (NEW v061)
  week52_high       REAL,                   -- 52-week high (NEW v061)
  reinvest_dividends INTEGER,               -- 1=yes, 0=no (NEW v061)
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, symbol)
);
```

**GET /api/v1/import/holdings** returns `{ holdings: [...], summary: [...] }` — already returns all columns via `SELECT h.*`.

---

## Import Flow (Schwab Positions CSV)

**Correct path:** Finance → Import tab → Upload Statement → select account → upload CSV → Preview → Confirm  
**Wrong path:** The ⬆️ CSV drawer (Transactions tab) — shows redirect banner now if positions file detected

**Format:** `schwab_positions` — detected when `raw.includes('positions for account')`  
**Parser:** `parseSchwabPositions()` in parsers.js — uses csv-parse for quoted-comma handling  
**All 15 CSV fields captured** (v202603.152)

---

## Known Issues / Next Backlog

### 🔴 Priority (do first)
1. **Holdings display verify** — deploy v202603.154, confirm Holdings tab now shows data
2. **Holdings UI upgrade** — add gain_loss_pct, day change, 52-wk range bar, charts

### 🟢 Small / Ready to build
- **Integrations Settings panel** — Settings → new Integrations row → panel showing all API toggles/keys from `app_config`. Migration 058 already seeded keys. Design in HANDOFF.md Section 17.
- **Weather widget** — index.html top-right chip. `api_openmeteo_enabled` config key exists, lat/lon pre-seeded (33.4052, -86.8278). Own session.
- **Institution dropdown** — GH_SELECT restored in Add Account drawer (v202603.148). List has 55 entries (migration 047 + 060).

### 🟡 Medium
- Finance net-worth snapshots end-to-end verify
- SSO/auth activation (needs SSH on QNAP)

### Known patterns to watch
- **Double-prefix bug pattern:** Any `api()` call in Finance.html Import module — always check paths are bare (`/import/...` not `/api/v1/import/...`)
- **ACC_INVEST_TYPES** — must be `window.ACC_INVEST_TYPES = new Set(...)`, not `const`
- **EOB imports** require `docker compose up --build -d` (pdf-parse dependency)

---

## Smoke Test

```bash
./smoke-test.sh http://192.168.4.62:3001
```

Tests 60+ endpoints. Each asserts HTTP 200 + correct JSON shape + required keys. Runs from NAS or any machine with curl. Exits 1 on any failure.

---

## Recent Changelog Summary (last 15 versions)

| Version | Key Change |
|---------|-----------|
| v202603.154 | **Holdings double-prefix bug fixed** — loadHoldings was hitting 404 silently |
| v202603.153 | CSV drawer redirect banner when positions file detected |
| v202603.152 | Holdings: 7 new DB columns (gain/loss, 52wk, day change, reinvest) |
| v202603.151 | parseSchwabPositions uses csv-parse (handles "$22,927.02" quoted commas) |
| v202603.150 | Preview doesn't block on 0 transactions when positions exist |
| v202603.149 | schwab_positions format detected + parseSchwabPositions added |
| v202603.148 | Institution GH_SELECT dropdown restored (55 entries, migration 060) |
| v202603.147 | Duplicate openAcctDrawer removed (was overriding shim, breaking Add) |
| v202603.146 | Unified account drawer + all Import double-prefix paths fixed |
| v202603.145 | Smoke test rewrite + NHTSA VIN decode + OpenFDA drug lookup + Open Food Facts |
| v202603.144 | All 9 user-reported bugs fixed (property blank, career raw JS, nav, etc.) |
| v202603.143 | EOB Import MHBP complete (4 tables, parser, Medical EOB tab) |
| v202603.142 | Auto-categorization: migration 059 (113 rules) + recategorize endpoint |
| v202603.141 | Cancel buttons: property svcDrawer, finance txDrawer, budgetDrawer |
| v202603.140 | Finance Import tab clarification banners |

---

## SSH Access (pending)

Once SSH account is created on QNAP:
- Deploy without zip: `rsync` or `scp` directly
- Log tailing: `docker logs -f ghrava`
- Container restart: `docker restart ghrava`
- Run smoke test against live: `./smoke-test.sh http://192.168.4.62:3001`
