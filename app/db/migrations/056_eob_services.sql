-- Migration 056: EOB service lines (one row per CPT code within a claim)
CREATE TABLE IF NOT EXISTS med_eob_services (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id              INTEGER NOT NULL REFERENCES med_eob_claims(id) ON DELETE CASCADE,
  service_description   TEXT,
  service_code          TEXT,
  service_date          DATE,
  amount_billed         REAL,
  member_rate           REAL,
  pending_not_payable   REAL,
  applied_to_deductible REAL,
  copay                 REAL,
  amount_remaining      REAL,
  plan_share            REAL,
  coinsurance           REAL,
  your_share            REAL
);
CREATE INDEX IF NOT EXISTS idx_eob_svc_claim ON med_eob_services(claim_id);
