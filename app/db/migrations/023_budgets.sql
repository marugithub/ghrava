-- 023_budgets.sql
-- Monthly budget tracking

CREATE TABLE IF NOT EXISTS budgets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  category          TEXT    NOT NULL,
  monthly_limit     REAL    NOT NULL DEFAULT 0,
  year              INTEGER NOT NULL DEFAULT (strftime('%Y', 'now')),
  month             INTEGER,           -- NULL = applies to all months (annual budget / monthly goal)
  notes             TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_cat_month ON budgets(category, year, month);
CREATE INDEX IF NOT EXISTS idx_budgets_year ON budgets(year, month);
