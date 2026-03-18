-- Migration 041: Flatten contacts table — one table, dynamic field groups
-- Rationale: extension tables created tight coupling and split physicians into
-- a separate table despite being conceptually identical to contacts. This
-- migration collapses everything into a single flat contacts table, drops
-- med_physicians (clean slate, no data preserved by design), and adds
-- physician_contact_id to med tables so visit notes / meds / conditions
-- link to contacts rather than a freetext name or a now-gone table.
--
-- Contact types: Medical, Contractor, Financial, Employer, School, Vendor, General, Other
-- Specialty is universal — doctors have "Cardiology", plumbers have "Plumbing"
-- Type-specific fields exist in the DB for all rows. UI shows/hides by type.
-- Google sync: google_contact_id stored here. Any Google field without a
-- Ghrava column gets appended to notes at sync time.

-- ── Step 1: Add all flat columns to contacts ──────────────────
-- Universal
ALTER TABLE contacts ADD COLUMN specialty           TEXT;
ALTER TABLE contacts ADD COLUMN google_contact_id   TEXT;

-- Medical
ALTER TABLE contacts ADD COLUMN patients_seen       TEXT;
ALTER TABLE contacts ADD COLUMN accepts_insurance   TEXT;

-- Contractor / Home Service
ALTER TABLE contacts ADD COLUMN license_number      TEXT;
ALTER TABLE contacts ADD COLUMN insurance_verified  INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN bonded              INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN last_used_date      DATE;
ALTER TABLE contacts ADD COLUMN quality_rating      INTEGER;

-- Employer
ALTER TABLE contacts ADD COLUMN hr_contact_name     TEXT;
ALTER TABLE contacts ADD COLUMN hr_phone            TEXT;
ALTER TABLE contacts ADD COLUMN ein                 TEXT;
ALTER TABLE contacts ADD COLUMN employee_family_member_id INTEGER;

-- School
ALTER TABLE contacts ADD COLUMN principal_name      TEXT;
ALTER TABLE contacts ADD COLUMN grade_range         TEXT;
ALTER TABLE contacts ADD COLUMN enrolled_kids       TEXT;

-- Financial
ALTER TABLE contacts ADD COLUMN institution_type    TEXT;
ALTER TABLE contacts ADD COLUMN rep_name            TEXT;
ALTER TABLE contacts ADD COLUMN account_types_served TEXT;

-- ── Step 2: Clean slate on contacts and extension tables ──────
DELETE FROM contacts;
DROP TABLE IF EXISTS contacts_medical;
DROP TABLE IF EXISTS contacts_home_service;
DROP TABLE IF EXISTS contacts_employer;
DROP TABLE IF EXISTS contacts_school;
DROP TABLE IF EXISTS contacts_contractor;
DROP TABLE IF EXISTS contacts_financial;

-- ── Step 3: Drop med_physicians if it exists (clean slate) ────
DROP TABLE IF EXISTS med_physicians;

-- ── Step 4: Add contact reference columns to med tables ───────
-- ── Step 4c: Add physician_contact_id to medications and conditions ──
ALTER TABLE med_medications  ADD COLUMN physician_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE med_conditions   ADD COLUMN physician_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

-- Note: physician_id column may or may not exist depending on prior migrations.
-- The new contact_id column is added below and replaces it functionally.

-- ── Step 4b: Recreate med_visit_notes to remove FK to dropped med_physicians ─
-- SQLite foreign_keys=ON causes INSERT to fail if referenced table doesn't exist.
-- We recreate the table keeping all data but dropping the physician_id FK.
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS med_visit_notes_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  patient          TEXT    NOT NULL DEFAULT 'Self',
  physician_id     INTEGER,
  contact_id       INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  visit_date       DATE    NOT NULL,
  questions        TEXT,
  doctors_response TEXT,
  follow_up_needed INTEGER DEFAULT 0,
  follow_up_date   DATE,
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO med_visit_notes_new
  (id, patient, physician_id, visit_date, questions, doctors_response,
   follow_up_needed, follow_up_date, notes, created_at, updated_at)
SELECT
  id, patient, physician_id, visit_date, questions, doctors_response,
  follow_up_needed, follow_up_date, notes, created_at, updated_at
FROM med_visit_notes;

DROP TABLE med_visit_notes;
ALTER TABLE med_visit_notes_new RENAME TO med_visit_notes;

CREATE INDEX IF NOT EXISTS idx_med_visits_patient  ON med_visit_notes(patient, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_med_visits_followup ON med_visit_notes(follow_up_needed, follow_up_date);

PRAGMA foreign_keys = ON;

-- ── Step 5: Seed contact_type dropdown ───────────────────────
DELETE FROM dropdown_options WHERE list_key = 'contact_type';
INSERT INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('contact_type', 'Medical',    'Medical',    10, 1),
  ('contact_type', 'Contractor', 'Contractor', 20, 1),
  ('contact_type', 'Financial',  'Financial',  30, 1),
  ('contact_type', 'Employer',   'Employer',   40, 1),
  ('contact_type', 'School',     'School',     50, 1),
  ('contact_type', 'Vendor',     'Vendor',     60, 1),
  ('contact_type', 'General',    'General',    70, 1),
  ('contact_type', 'Other',      'Other',      80, 1);

-- ── Step 6: Seed contact_specialty dropdown ──────────────────
-- Universal specialty list — applies to all contact types.
-- Doctors get "Cardiology", plumbers get "Plumbing", etc.
DELETE FROM dropdown_options WHERE list_key = 'contact_specialty';
INSERT INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  -- Medical specialties
  ('contact_specialty', 'Primary Care',            'Primary Care',            10,  1),
  ('contact_specialty', 'Family Medicine',         'Family Medicine',         20,  1),
  ('contact_specialty', 'Internal Medicine',       'Internal Medicine',       30,  1),
  ('contact_specialty', 'Pediatrics',              'Pediatrics',              40,  1),
  ('contact_specialty', 'Cardiology',              'Cardiology',              50,  1),
  ('contact_specialty', 'Dermatology',             'Dermatology',             60,  1),
  ('contact_specialty', 'Gastroenterology',        'Gastroenterology',        70,  1),
  ('contact_specialty', 'Neurology',               'Neurology',               80,  1),
  ('contact_specialty', 'Psychiatry',              'Psychiatry',              90,  1),
  ('contact_specialty', 'OB/GYN',                  'OB/GYN',                  100, 1),
  ('contact_specialty', 'Orthopedics',             'Orthopedics',             110, 1),
  ('contact_specialty', 'Ophthalmology',           'Ophthalmology',           120, 1),
  ('contact_specialty', 'ENT',                     'ENT',                     130, 1),
  ('contact_specialty', 'Endocrinology',           'Endocrinology',           140, 1),
  ('contact_specialty', 'Urology',                 'Urology',                 150, 1),
  ('contact_specialty', 'Nephrology',              'Nephrology',              160, 1),
  ('contact_specialty', 'Oncology',                'Oncology',                170, 1),
  ('contact_specialty', 'Pulmonology',             'Pulmonology',             180, 1),
  ('contact_specialty', 'Rheumatology',            'Rheumatology',            190, 1),
  ('contact_specialty', 'Allergy & Immunology',    'Allergy & Immunology',    200, 1),
  ('contact_specialty', 'Physical Therapy',        'Physical Therapy',        210, 1),
  ('contact_specialty', 'Chiropractic',            'Chiropractic',            220, 1),
  ('contact_specialty', 'Podiatry',                'Podiatry',                230, 1),
  ('contact_specialty', 'Optometry',               'Optometry',               240, 1),
  ('contact_specialty', 'Dentistry — General',     'Dentistry — General',     250, 1),
  ('contact_specialty', 'Dentistry — Orthodontics','Dentistry — Orthodontics',260, 1),
  ('contact_specialty', 'Dentistry — Oral Surgery','Dentistry — Oral Surgery',270, 1),
  ('contact_specialty', 'Emergency Medicine',      'Emergency Medicine',      280, 1),
  ('contact_specialty', 'Radiology',               'Radiology',               290, 1),
  ('contact_specialty', 'Surgery — General',       'Surgery — General',       300, 1),
  -- Contractor / trade specialties
  ('contact_specialty', 'Plumbing',                'Plumbing',                310, 1),
  ('contact_specialty', 'Electrical',              'Electrical',              320, 1),
  ('contact_specialty', 'HVAC',                    'HVAC',                    330, 1),
  ('contact_specialty', 'Roofing',                 'Roofing',                 340, 1),
  ('contact_specialty', 'Landscaping',             'Landscaping',             350, 1),
  ('contact_specialty', 'Painting',                'Painting',                360, 1),
  ('contact_specialty', 'Flooring',                'Flooring',                370, 1),
  ('contact_specialty', 'Pest Control',            'Pest Control',            380, 1),
  ('contact_specialty', 'Cleaning',                'Cleaning',                390, 1),
  ('contact_specialty', 'General Contracting',     'General Contracting',     400, 1),
  -- Financial specialties
  ('contact_specialty', 'Mortgage',                'Mortgage',                410, 1),
  ('contact_specialty', 'Insurance',               'Insurance',               420, 1),
  ('contact_specialty', 'Tax / CPA',               'Tax / CPA',               430, 1),
  ('contact_specialty', 'Financial Planning',      'Financial Planning',      440, 1),
  ('contact_specialty', 'Banking',                 'Banking',                 450, 1),
  -- Auto
  ('contact_specialty', 'Auto Repair',             'Auto Repair',             460, 1),
  ('contact_specialty', 'Auto Sales',              'Auto Sales',              470, 1),
  -- Other
  ('contact_specialty', 'Legal',                   'Legal',                   480, 1),
  ('contact_specialty', 'Real Estate',             'Real Estate',             490, 1),
  ('contact_specialty', 'Tutoring',                'Tutoring',                500, 1),
  ('contact_specialty', 'Childcare',               'Childcare',               510, 1);

-- ── Step 8: Add vendor_contact_id to property_maintenance ─────
ALTER TABLE property_maintenance ADD COLUMN vendor_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

-- ── Step 9: Add warranty_vendor_contact_id to items ───────────
ALTER TABLE items ADD COLUMN warranty_vendor_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;

-- ── Step 10: Remove old physician-specific dropdown ────────────
DELETE FROM dropdown_options WHERE list_key = 'medical_physician_type';
