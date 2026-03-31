-- Migration 057: EOB YTD benefit balance snapshots (per person/family per statement)
CREATE TABLE IF NOT EXISTS med_eob_balances (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  eob_id                INTEGER NOT NULL REFERENCES med_eob_statements(id) ON DELETE CASCADE,
  person                TEXT NOT NULL,
  balance_type          TEXT NOT NULL,
  annual_limit          REAL,
  amount_used           REAL,
  amount_remaining      REAL
);
CREATE INDEX IF NOT EXISTS idx_eob_bal_eob ON med_eob_balances(eob_id);
