-- 030_ensure_tables.sql
-- Safety net: ensure tables exist that may have been missed on old DBs

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date     DATE    NOT NULL,
  total_assets      REAL    NOT NULL DEFAULT 0,
  total_liabilities REAL    NOT NULL DEFAULT 0,
  net_worth         REAL    NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budgets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  category          TEXT    NOT NULL,
  monthly_limit     REAL    NOT NULL DEFAULT 0,
  year              INTEGER NOT NULL DEFAULT (strftime('%Y', 'now')),
  month             INTEGER,
  notes             TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
