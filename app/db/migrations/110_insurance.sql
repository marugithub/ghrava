-- Migration 110: Insurance module

CREATE TABLE IF NOT EXISTS insurance_policies (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_group_id     INTEGER, -- links renewal chain (self-referencing group)
  policy_type         TEXT NOT NULL, -- Auto/Home/Life/Health/Umbrella/Dental/Vision/Other
  provider_contact_id INTEGER REFERENCES contacts(id),
  agent_contact_id    INTEGER REFERENCES contacts(id),
  policy_number       TEXT,
  coverage_start_date TEXT NOT NULL,
  coverage_end_date   TEXT,
  premium_amount      REAL,
  premium_frequency   TEXT DEFAULT 'annual', -- monthly/semi-annual/annual
  deductible          REAL,
  coverage_limit      REAL,
  coverage_details    TEXT,
  vehicle_id          INTEGER REFERENCES vehicles(id),
  property_id         INTEGER REFERENCES properties(id),
  status              TEXT DEFAULT 'active', -- active/expired/cancelled
  alert_days_before   INTEGER DEFAULT 60,
  notes               TEXT,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insurance_policy_members (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id        INTEGER NOT NULL REFERENCES insurance_policies(id),
  family_member_id INTEGER NOT NULL REFERENCES family_members(id)
);

CREATE TABLE IF NOT EXISTS insurance_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_id   INTEGER NOT NULL REFERENCES insurance_policies(id),
  file_name   TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  label       TEXT, -- Declaration page, ID card, etc.
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_insurance_status  ON insurance_policies(status);
CREATE INDEX IF NOT EXISTS idx_insurance_end_date ON insurance_policies(coverage_end_date);
CREATE INDEX IF NOT EXISTS idx_insurance_group    ON insurance_policies(policy_group_id);

-- Dropdown seeds
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('insurance_type', 'Auto',     'Auto',     10, 1, 1),
  ('insurance_type', 'Home',     'Home',     20, 1, 1),
  ('insurance_type', 'Renters',  'Renters',  30, 1, 1),
  ('insurance_type', 'Life',     'Life',     40, 1, 1),
  ('insurance_type', 'Health',   'Health',   50, 1, 1),
  ('insurance_type', 'Umbrella', 'Umbrella', 60, 1, 1),
  ('insurance_type', 'Dental',   'Dental',   70, 1, 1),
  ('insurance_type', 'Vision',   'Vision',   80, 1, 1),
  ('insurance_type', 'Pet',      'Pet',      90, 1, 1),
  ('insurance_type', 'Other',    'Other',   100, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('premium_frequency', 'Monthly',     'monthly',     10, 1, 1),
  ('premium_frequency', 'Semi-annual', 'semi-annual', 20, 1, 1),
  ('premium_frequency', 'Annual',      'annual',      30, 1, 1),
  ('premium_frequency', 'Quarterly',   'quarterly',   40, 1, 1);
