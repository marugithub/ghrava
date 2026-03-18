-- Migration 002: HSA & Medical modules
-- Add-only migration — never edit existing files.

PRAGMA foreign_keys = ON;

-- ══════════════════════════════════════════════════════════════
-- HSA — PLAN / INSURANCE INFO  (one row per plan year)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS hsa_plan_info (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_year                 INTEGER NOT NULL UNIQUE,
  plan_name                 TEXT,
  insurance_carrier         TEXT,
  individual_deductible     REAL    DEFAULT 0,
  family_deductible         REAL    DEFAULT 0,
  individual_oop_max        REAL    DEFAULT 0,
  family_oop_max            REAL    DEFAULT 0,
  hsa_contribution_self     REAL    DEFAULT 0,
  hsa_contribution_employer REAL    DEFAULT 0,
  irs_limit_self_only       REAL    DEFAULT 0,
  irs_limit_family          REAL    DEFAULT 0,
  plan_effective_date       DATE,
  notes                     TEXT,
  created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- HSA — MEDICAL EXPENSE PAYMENTS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS hsa_payments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  date              DATE    NOT NULL,
  -- year is derived at query time via substr(date,1,4)
  patient           TEXT    NOT NULL DEFAULT 'Self',
  provider          TEXT,
  category          TEXT,         -- Doctor / Hospital / Pharmacy / Lab / Dental / Vision / Other
  payment_type      TEXT,         -- Insurance Paid / Out of Pocket / HSA Card
  total_bill        REAL    DEFAULT 0,
  insurance_paid    REAL    DEFAULT 0,
  you_paid          REAL    DEFAULT 0,
  hsa_eligible      INTEGER DEFAULT 1,
  receipt_saved     INTEGER DEFAULT 0,
  receipt_location  TEXT,
  reimbursed        INTEGER DEFAULT 0,
  reimbursement_date DATE,
  notes             TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hsa_payments_date       ON hsa_payments(date DESC);
CREATE INDEX IF NOT EXISTS idx_hsa_payments_reimbursed ON hsa_payments(reimbursed);
CREATE INDEX IF NOT EXISTS idx_hsa_payments_patient    ON hsa_payments(patient);

-- ══════════════════════════════════════════════════════════════
-- HSA — OTC / OVER-THE-COUNTER PURCHASES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS hsa_otc (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  date              DATE    NOT NULL,
  item_name         TEXT    NOT NULL,
  otc_category      TEXT    DEFAULT 'OTC Medicine',
  store             TEXT,
  amount            REAL    DEFAULT 0,
  quantity          INTEGER DEFAULT 1,
  hsa_eligible      INTEGER DEFAULT 1,
  receipt_saved     INTEGER DEFAULT 0,
  receipt_location  TEXT,
  reimbursed        INTEGER DEFAULT 0,
  reimbursement_date DATE,
  notes             TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hsa_otc_date       ON hsa_otc(date DESC);
CREATE INDEX IF NOT EXISTS idx_hsa_otc_reimbursed ON hsa_otc(reimbursed);

-- ══════════════════════════════════════════════════════════════
-- HSA — REIMBURSEMENTS (withdrawals from HSA account)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS hsa_reimbursements (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  reimbursement_date DATE    NOT NULL,
  total_amount       REAL    DEFAULT 0,
  from_year          INTEGER,
  method             TEXT    DEFAULT 'ACH',
  notes              TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Line items linking a reimbursement to specific payments / OTC
CREATE TABLE IF NOT EXISTS hsa_reimbursement_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  reimbursement_id INTEGER NOT NULL REFERENCES hsa_reimbursements(id) ON DELETE CASCADE,
  expense_type     TEXT    NOT NULL CHECK(expense_type IN ('payment','otc')),
  expense_id       INTEGER NOT NULL,
  amount           REAL    DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_hsa_reimb_items ON hsa_reimbursement_items(reimbursement_id);

-- ══════════════════════════════════════════════════════════════
-- MEDICAL — MEDICATIONS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS med_medications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  patient     TEXT    NOT NULL DEFAULT 'Self',
  name        TEXT    NOT NULL,
  dosage      TEXT,
  frequency   TEXT,
  physician   TEXT,
  start_date  DATE,
  end_date    DATE,
  status      TEXT    DEFAULT 'Active'
              CHECK(status IN ('Active','Discontinued','As Needed','Completed')),
  purpose     TEXT,
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_med_meds_patient ON med_medications(patient, status);

-- ══════════════════════════════════════════════════════════════
-- MEDICAL — CONDITIONS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS med_conditions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  patient         TEXT    NOT NULL DEFAULT 'Self',
  condition_name  TEXT    NOT NULL,
  start_date      DATE,
  end_date        DATE,
  physician       TEXT,
  treatment_notes TEXT,
  status          TEXT    DEFAULT 'Active'
                  CHECK(status IN ('Active','Resolved','Monitoring','Chronic')),
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_med_conditions_patient ON med_conditions(patient, status);

-- ══════════════════════════════════════════════════════════════
-- MEDICAL — PHYSICIANS & PHARMACIES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS med_physicians (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  type            TEXT    DEFAULT 'Primary Care',
  specialty       TEXT,
  practice_name   TEXT,
  phone           TEXT,
  address         TEXT,
  patient_served  TEXT    DEFAULT 'All',
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- MEDICAL — DOCTOR VISIT NOTES
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS med_visit_notes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  patient          TEXT    NOT NULL DEFAULT 'Self',
  physician_id     INTEGER REFERENCES med_physicians(id) ON DELETE SET NULL,
  visit_date       DATE    NOT NULL,
  questions        TEXT,
  doctors_response TEXT,
  follow_up_needed INTEGER DEFAULT 0,
  follow_up_date   DATE,
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_med_visits_patient ON med_visit_notes(patient, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_med_visits_followup ON med_visit_notes(follow_up_needed, follow_up_date);
