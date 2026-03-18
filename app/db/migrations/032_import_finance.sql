-- ══════════════════════════════════════════════════════════════
-- Migration 032: Financial Import System
-- Tables: financial_accounts, import_batches, import_transactions,
--         holdings, net_worth_snapshots (already exists via 030)
-- ══════════════════════════════════════════════════════════════

-- ── Financial Accounts ────────────────────────────────────────
-- Tracks all accounts across banks/brokerages
CREATE TABLE IF NOT EXISTS financial_accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname        TEXT    NOT NULL,               -- required friendly name e.g. "Al Checking"
  institution     TEXT    NOT NULL,               -- "Chase", "Schwab", etc.
  account_type    TEXT    NOT NULL                -- checking|savings|brokerage|credit_card|tsp
                  CHECK(account_type IN ('checking','savings','brokerage','credit_card','tsp','other')),
  owner           TEXT,                           -- family member name
  last_four       TEXT,                           -- last 4 digits only, never full number
  currency        TEXT    NOT NULL DEFAULT 'USD',
  is_active       INTEGER NOT NULL DEFAULT 1,
  track_statements INTEGER NOT NULL DEFAULT 1,    -- generate todo if statement missing
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Import Batches ────────────────────────────────────────────
-- One row per file imported
CREATE TABLE IF NOT EXISTS import_batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id      INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  filename        TEXT    NOT NULL,
  statement_date  DATE,                           -- detected from file
  statement_month TEXT,                           -- YYYY-MM for gap detection
  format          TEXT,                           -- chase_checking|schwab_brokerage|etc
  rows_total      INTEGER DEFAULT 0,
  rows_inserted   INTEGER DEFAULT 0,
  rows_skipped    INTEGER DEFAULT 0,
  rows_flagged    INTEGER DEFAULT 0,
  status          TEXT    DEFAULT 'pending'
                  CHECK(status IN ('pending','complete','error')),
  error_message   TEXT,
  imported_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Imported Transactions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS imported_transactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id      INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  batch_id        INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  txn_date        DATE    NOT NULL,
  post_date       DATE,
  description     TEXT    NOT NULL,
  amount          REAL    NOT NULL,               -- negative = outflow, positive = inflow
  balance         REAL,                           -- running balance if provided
  category        TEXT,                           -- from bank or auto-detected
  txn_type        TEXT    DEFAULT 'transaction'
                  CHECK(txn_type IN ('transaction','transfer','payment','fee','interest','dividend','deposit','withdrawal')),
  is_transfer     INTEGER NOT NULL DEFAULT 0,     -- excludes from spending reports
  memo            TEXT,
  fingerprint     TEXT    NOT NULL,               -- hash for duplicate detection
  flagged         INTEGER NOT NULL DEFAULT 0,     -- probable duplicate, needs review
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_imported_txn_fingerprint
  ON imported_transactions(fingerprint);

CREATE INDEX IF NOT EXISTS idx_imported_txn_account_date
  ON imported_transactions(account_id, txn_date DESC);

CREATE INDEX IF NOT EXISTS idx_imported_txn_batch
  ON imported_transactions(batch_id);

-- ── Holdings (positions) ──────────────────────────────────────
-- Latest holdings per account per symbol — upserted on each import
CREATE TABLE IF NOT EXISTS holdings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id      INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  symbol          TEXT    NOT NULL,               -- AAPL, "C Fund", VTSAX, etc.
  name            TEXT,                           -- full name
  asset_type      TEXT    DEFAULT 'stock'
                  CHECK(asset_type IN ('stock','etf','mutual_fund','tsp_fund','cash','other')),
  shares          REAL    NOT NULL DEFAULT 0,
  cost_basis      REAL,                           -- per share
  price           REAL,                           -- per share from statement
  price_date      DATE,                           -- date of price from statement
  market_value    REAL,                           -- shares * price
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_holdings_account_symbol
  ON holdings(account_id, symbol);

CREATE INDEX IF NOT EXISTS idx_holdings_account
  ON holdings(account_id);

-- ── Account Balance Snapshots ─────────────────────────────────
-- One row per account per statement import — drives net worth chart
CREATE TABLE IF NOT EXISTS account_snapshots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id      INTEGER NOT NULL REFERENCES financial_accounts(id) ON DELETE CASCADE,
  snapshot_date   DATE    NOT NULL,
  balance         REAL    NOT NULL,               -- positive = asset, negative = liability
  batch_id        INTEGER REFERENCES import_batches(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_snapshot_unique
  ON account_snapshots(account_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_account_snapshot_date
  ON account_snapshots(account_id, snapshot_date DESC);

