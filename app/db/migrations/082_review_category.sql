-- Migration 082: Add review_category to all needs_review tables
-- Categories: data_quality, name_unmatched, partial_import, duplicate_risk, manual_review

BEGIN;


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
