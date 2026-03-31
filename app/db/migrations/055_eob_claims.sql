-- Migration 055: EOB claims (one row per patient per claim block)
CREATE TABLE IF NOT EXISTS med_eob_claims (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  eob_id                INTEGER NOT NULL REFERENCES med_eob_statements(id) ON DELETE CASCADE,
  patient               TEXT NOT NULL,
  claim_id              TEXT,
  received_date         DATE,
  provider              TEXT,
  network_status        TEXT,
  send_date             DATE,
  amount_billed         REAL,
  member_rate           REAL,
  pending_not_payable   REAL,
  applied_to_deductible REAL,
  copay                 REAL,
  plan_paid             REAL,
  fund_paid             REAL,
  coinsurance           REAL,
  your_share            REAL
);
CREATE INDEX IF NOT EXISTS idx_eob_claims_eob ON med_eob_claims(eob_id);
CREATE INDEX IF NOT EXISTS idx_eob_claims_patient ON med_eob_claims(patient);
