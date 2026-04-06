-- Migration 076: Add summary columns to net_worth_snapshots
-- The table existed with per-asset-class columns; the new route stores aggregates.
ALTER TABLE net_worth_snapshots ADD COLUMN total_assets      REAL;
ALTER TABLE net_worth_snapshots ADD COLUMN total_liabilities REAL;
ALTER TABLE net_worth_snapshots ADD COLUMN net_worth         REAL;
