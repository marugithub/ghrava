-- Migration 062: Add batch_id to finance_transactions for import rollback
-- Also add a fin_import_batches table to track bank CSV imports
CREATE TABLE IF NOT EXISTS fin_import_batches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id   INTEGER NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'banking',  -- 'banking' | 'investment'
  filename     TEXT,
  format       TEXT,
  rows_total   INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  imported_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE finance_transactions ADD COLUMN batch_id INTEGER REFERENCES fin_import_batches(id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_batch ON finance_transactions(batch_id);
