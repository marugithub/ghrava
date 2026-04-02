-- Migration 073: Add trade-level fields to imported_transactions
-- symbol/shares/price are parsed from Schwab/Vanguard/TSP CSVs but were only
-- stored in memo text. Now stored as proper columns for reporting.
ALTER TABLE imported_transactions ADD COLUMN symbol       TEXT;
ALTER TABLE imported_transactions ADD COLUMN shares       REAL;
ALTER TABLE imported_transactions ADD COLUMN price_per_share REAL;
