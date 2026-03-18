-- Migration 004: Fix HSA column names to match routes
-- Live DB was created by an older schema where:
--   hsa_payments: has expense_date, patient_id, provider_id (routes expect date, patient, provider)
--   hsa_otc:      has purchase_date, vendor_id              (routes expect date, store)
--   hsa_plan_info: missing insurance_carrier and irs_limit_self_only columns
--
-- Strategy: recreate tables with correct schema, copy any existing data.
-- Safe to run multiple times (IF NOT EXISTS guards + migrate.js skip-on-already-exists).

PRAGMA foreign_keys = OFF;

-- ── hsa_payments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hsa_payments_new (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  date               DATE    NOT NULL,
  patient            TEXT    NOT NULL DEFAULT 'Self',
  provider           TEXT,
  category           TEXT,
  payment_type       TEXT,
  total_bill         REAL    DEFAULT 0,
  insurance_paid     REAL    DEFAULT 0,
  you_paid           REAL    DEFAULT 0,
  hsa_eligible       INTEGER DEFAULT 1,
  receipt_saved      INTEGER DEFAULT 0,
  receipt_location   TEXT,
  reimbursed         INTEGER DEFAULT 0,
  reimbursement_date DATE,
  notes              TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO hsa_payments_new
  (id, date, patient, provider, category, payment_type,
   total_bill, insurance_paid, you_paid, hsa_eligible,
   receipt_saved, reimbursed, reimbursement_date, notes,
   created_at, updated_at)
SELECT
  id,
  COALESCE(expense_date, date(created_at)),
  'Self',
  NULL,
  category, payment_type,
  COALESCE(total_bill,0), COALESCE(insurance_paid,0), COALESCE(you_paid,0),
  COALESCE(hsa_eligible,1), COALESCE(receipt_saved,0),
  COALESCE(reimbursed,0), reimbursement_date, notes,
  created_at, updated_at
FROM hsa_payments;

DROP TABLE hsa_payments;
ALTER TABLE hsa_payments_new RENAME TO hsa_payments;

CREATE INDEX IF NOT EXISTS idx_hsa_payments_date       ON hsa_payments(date DESC);
CREATE INDEX IF NOT EXISTS idx_hsa_payments_reimbursed ON hsa_payments(reimbursed);

-- ── hsa_otc ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hsa_otc_new (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  date               DATE    NOT NULL,
  item_name          TEXT    NOT NULL,
  otc_category       TEXT    DEFAULT 'OTC Medicine',
  store              TEXT,
  amount             REAL    DEFAULT 0,
  quantity           INTEGER DEFAULT 1,
  hsa_eligible       INTEGER DEFAULT 1,
  receipt_saved      INTEGER DEFAULT 0,
  receipt_location   TEXT,
  reimbursed         INTEGER DEFAULT 0,
  reimbursement_date DATE,
  notes              TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO hsa_otc_new
  (id, date, item_name, otc_category, store, amount, quantity,
   hsa_eligible, receipt_saved, reimbursed, reimbursement_date, notes,
   created_at)
SELECT
  id,
  COALESCE(purchase_date, date(created_at)),
  item_name,
  COALESCE(otc_category, 'OTC Medicine'),
  NULL,
  COALESCE(amount,0), COALESCE(quantity,1),
  COALESCE(hsa_eligible,1), COALESCE(receipt_saved,0),
  COALESCE(reimbursed,0), reimbursement_date, notes,
  created_at
FROM hsa_otc;

DROP TABLE hsa_otc;
ALTER TABLE hsa_otc_new RENAME TO hsa_otc;

CREATE INDEX IF NOT EXISTS idx_hsa_otc_date       ON hsa_otc(date DESC);
CREATE INDEX IF NOT EXISTS idx_hsa_otc_reimbursed ON hsa_otc(reimbursed);

-- ── hsa_plan_info — add missing columns ──────────────────────
ALTER TABLE hsa_plan_info ADD COLUMN insurance_carrier TEXT;
ALTER TABLE hsa_plan_info ADD COLUMN irs_limit_self_only REAL DEFAULT 0;

-- ── mark setup complete ───────────────────────────────────────
INSERT OR REPLACE INTO app_config (key, value) VALUES ('setup_complete', '1');

PRAGMA foreign_keys = ON;
