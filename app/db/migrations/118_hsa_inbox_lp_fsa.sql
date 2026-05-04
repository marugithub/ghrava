-- Migration 118: HSA inbox lifecycle + LP-FSA tables + EOB linkage
--
-- v202604.140 — adds infrastructure for the receipt inbox, the LP-FSA
-- companion to HSA, multi-plan HSA support, EOB linkage, and mileage
-- companion rows. See HSA_INBOX_DESIGN.md for the full contract.
--
-- All FKs are nullable. NO ON DELETE CASCADE — per project rules,
-- deletes are soft and orphans are acceptable. Data loss is not.

-- ── LP-FSA tables ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fsa_plan_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'limited_purpose',
  plan_name TEXT,
  custodian TEXT,
  annual_limit REAL,
  contributions REAL DEFAULT 0,
  employer_contribution REAL DEFAULT 0,
  deadline_date TEXT,
  carryover_amount REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year, plan_type)
);

CREATE TABLE IF NOT EXISTS fsa_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  vendor_contact_id INTEGER,
  amount REAL NOT NULL,
  patient TEXT,
  category TEXT,
  fsa_eligible INTEGER DEFAULT 0,
  reimbursed INTEGER DEFAULT 0,
  reimbursement_date TEXT,
  reimbursement_id INTEGER,
  eob_claim_id INTEGER,
  status TEXT DEFAULT 'final',
  inbox_attachment_id INTEGER,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fsa_payments_date ON fsa_payments(date);
CREATE INDEX IF NOT EXISTS idx_fsa_payments_status ON fsa_payments(status);
CREATE INDEX IF NOT EXISTS idx_fsa_payments_reimbursed ON fsa_payments(reimbursed);

CREATE TABLE IF NOT EXISTS fsa_reimbursements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fsa_reimbursement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reimbursement_id INTEGER NOT NULL,
  payment_id INTEGER NOT NULL,
  amount REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fsa_reimb_items_reimb ON fsa_reimbursement_items(reimbursement_id);
CREATE INDEX IF NOT EXISTS idx_fsa_reimb_items_payment ON fsa_reimbursement_items(payment_id);

-- ── IRS mileage rates ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS irs_mileage_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  rate_cents INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'medical',
  UNIQUE(year, start_date, category)
);

INSERT OR IGNORE INTO irs_mileage_rates (year, start_date, end_date, rate_cents, category) VALUES
  (2022, '2022-01-01', '2022-06-30', 18, 'medical'),
  (2022, '2022-07-01', '2022-12-31', 22, 'medical'),
  (2023, '2023-01-01', '2023-12-31', 22, 'medical'),
  (2024, '2024-01-01', '2024-12-31', 21, 'medical'),
  (2025, '2025-01-01', '2025-12-31', 21, 'medical'),
  (2026, '2026-01-01', '2026-12-31', 21, 'medical');

-- ── HSA payments: new columns ─────────────────────────────────────
-- Note: SQLite ALTER TABLE ADD COLUMN is idempotent only if you check
-- first. We rely on the migration system's "already applied" check
-- to avoid re-running. If this migration partially applies and then
-- retries, the ALTERs will fail because columns already exist.
-- That's acceptable — the txn rolls back and the developer fixes.

ALTER TABLE hsa_payments ADD COLUMN eob_claim_id INTEGER;
ALTER TABLE hsa_payments ADD COLUMN vendor_contact_id INTEGER;
ALTER TABLE hsa_payments ADD COLUMN mileage_miles REAL;
ALTER TABLE hsa_payments ADD COLUMN parent_payment_id INTEGER;
ALTER TABLE hsa_payments ADD COLUMN status TEXT DEFAULT 'final';
ALTER TABLE hsa_payments ADD COLUMN inbox_attachment_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_hsa_payments_status ON hsa_payments(status);
CREATE INDEX IF NOT EXISTS idx_hsa_payments_parent ON hsa_payments(parent_payment_id);

-- ── HSA plan info: custodian + active flag ───────────────────────
-- plan_name already exists in the base schema. Multi-plan-per-year
-- support not added here per scoping decision (work HSA being closed,
-- only personal HSA going forward).

ALTER TABLE hsa_plan_info ADD COLUMN custodian TEXT;
ALTER TABLE hsa_plan_info ADD COLUMN active INTEGER DEFAULT 1;

-- ── Medical visit notes: mileage field ────────────────────────────

ALTER TABLE med_visit_notes ADD COLUMN round_trip_miles REAL;
