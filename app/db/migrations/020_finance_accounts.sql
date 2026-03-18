-- 020_finance_accounts.sql
-- Financial accounts and manual transaction log
-- Intentionally simple: manual entry, no bank OAuth, CSV import later

CREATE TABLE IF NOT EXISTS finance_accounts (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,          -- "Chase Checking", "Amex Blue"
  type              TEXT    NOT NULL DEFAULT 'Checking',  -- Checking/Savings/Credit/Investment/Cash/HSA
  institution       TEXT,
  account_last4     TEXT,                      -- last 4 digits only
  current_balance   REAL    NOT NULL DEFAULT 0,
  balance_as_of     DATE,                      -- when balance was last updated
  is_active         INTEGER NOT NULL DEFAULT 1,
  include_net_worth INTEGER NOT NULL DEFAULT 1,-- include in net worth calculation
  notes             TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id        INTEGER NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  date              DATE    NOT NULL,
  description       TEXT    NOT NULL,
  amount            REAL    NOT NULL,          -- negative=debit, positive=credit
  category          TEXT,
  notes             TEXT,
  is_reconciled     INTEGER NOT NULL DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_account ON finance_transactions(account_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_date    ON finance_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_cat     ON finance_transactions(category);

-- Net worth snapshots (manual, triggered by user or auto-monthly)
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date     DATE    NOT NULL,
  total_assets      REAL    NOT NULL DEFAULT 0,
  total_liabilities REAL    NOT NULL DEFAULT 0,
  net_worth         REAL    NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
