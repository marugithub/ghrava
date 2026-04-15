-- Migration 099: Recurring transactions and investment performance tracking

-- RECURRING TRANSACTIONS
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES finance_accounts(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT,
  frequency TEXT NOT NULL CHECK(frequency IN ('daily','weekly','biweekly','monthly','quarterly','yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_date DATE NOT NULL,
  last_generated DATE,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recurring_next_date ON recurring_transactions(next_date);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_transactions(is_active);

-- INVESTMENT PERFORMANCE
ALTER TABLE holdings ADD COLUMN dividend_yield REAL;
ALTER TABLE holdings ADD COLUMN last_dividend_date DATE;
ALTER TABLE holdings ADD COLUMN annual_dividend REAL;

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date DATE NOT NULL UNIQUE,
  total_value REAL NOT NULL,
  total_cost REAL NOT NULL,
  total_gain REAL NOT NULL,
  total_gain_pct REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('auto_generate_recurring_days', '30');
