-- Migration 074: Add size column to inventory items
-- UPC lookup returns size (e.g. "12 oz", "64 fl oz") — was being dumped into notes text
ALTER TABLE items ADD COLUMN size TEXT;
