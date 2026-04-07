-- Migration 082: Add review_category to all needs_review tables
-- Categories: data_quality, name_unmatched, partial_import, duplicate_risk, manual_review

BEGIN;

ALTER TABLE books                ADD COLUMN review_category TEXT;
ALTER TABLE career_certifications ADD COLUMN review_category TEXT;
ALTER TABLE career_goals          ADD COLUMN review_category TEXT;
ALTER TABLE career_jobs           ADD COLUMN review_category TEXT;
ALTER TABLE career_skills         ADD COLUMN review_category TEXT;
ALTER TABLE contacts              ADD COLUMN review_category TEXT;
ALTER TABLE daily_log             ADD COLUMN review_category TEXT;
ALTER TABLE documents             ADD COLUMN review_category TEXT;
ALTER TABLE family_members        ADD COLUMN review_category TEXT;
ALTER TABLE hsa_payments          ADD COLUMN review_category TEXT;
ALTER TABLE items                 ADD COLUMN review_category TEXT;
ALTER TABLE kid_activities        ADD COLUMN review_category TEXT;
ALTER TABLE kid_notes             ADD COLUMN review_category TEXT;
ALTER TABLE kids                  ADD COLUMN review_category TEXT;
ALTER TABLE med_conditions        ADD COLUMN review_category TEXT;
ALTER TABLE med_medications       ADD COLUMN review_category TEXT;
ALTER TABLE properties            ADD COLUMN review_category TEXT;
ALTER TABLE resources             ADD COLUMN review_category TEXT;
ALTER TABLE todos                 ADD COLUMN review_category TEXT;
ALTER TABLE vehicles              ADD COLUMN review_category TEXT;

-- career_education is being dropped in migration 078, skip it

-- Seed dropdown options for review categories
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
VALUES
  ('review_category', 'Data Quality',     'data_quality',    1, 1, 1),
  ('review_category', 'Name Unmatched',   'name_unmatched',  1, 1, 2),
  ('review_category', 'Partial Import',   'partial_import',  1, 1, 3),
  ('review_category', 'Duplicate Risk',   'duplicate_risk',  1, 1, 4),
  ('review_category', 'Manual Review',    'manual_review',   1, 1, 5);

COMMIT;
