-- Migration 076
ALTER TABLE net_worth_snapshots ADD COLUMN total_assets REAL;
ALTER TABLE net_worth_snapshots ADD COLUMN total_liabilities REAL;
ALTER TABLE net_worth_snapshots ADD COLUMN net_worth REAL;
