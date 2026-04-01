-- Migration 061: Add missing columns to holdings table for proper charting
-- Captures all meaningful fields from Schwab positions CSV (and equivalent from other brokerages)
ALTER TABLE holdings ADD COLUMN total_cost_basis   REAL;    -- Cost Basis (total, not per share)
ALTER TABLE holdings ADD COLUMN gain_loss_dollar   REAL;    -- Gain $ (unrealized)
ALTER TABLE holdings ADD COLUMN gain_loss_pct      REAL;    -- Gain % (unrealized)
ALTER TABLE holdings ADD COLUMN day_change_dollar  REAL;    -- Day Chng $
ALTER TABLE holdings ADD COLUMN day_change_pct     REAL;    -- Day Chng %
ALTER TABLE holdings ADD COLUMN week52_low         REAL;    -- 52 Wk Low
ALTER TABLE holdings ADD COLUMN week52_high        REAL;    -- 52 Wk High
ALTER TABLE holdings ADD COLUMN reinvest_dividends INTEGER; -- Reinvest? (1/0)
