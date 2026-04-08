-- Migration 076: Add summary columns to net_worth_snapshots
-- Table may not exist on all installs; skip if so
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id INTEGER PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  total_assets REAL,
  total_liabilities REAL,
  net_worth REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
