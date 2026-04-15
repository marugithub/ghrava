-- Migration 097: Emergency contact flag and emergency notes

ALTER TABLE contacts ADD COLUMN is_emergency_contact INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_contacts_emergency ON contacts(is_emergency_contact);

ALTER TABLE family_members ADD COLUMN emergency_notes TEXT;

INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('emergency_show_ssn', '0'),
  ('emergency_show_dob', '1'),
  ('emergency_include_insurance', '1');
