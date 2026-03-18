-- 029_hsa_category_dropdown.sql
-- Seed hsa_category dropdown options if not already present

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_active)
VALUES
  ('hsa_category', 'Doctor',    'Doctor',    10, 1),
  ('hsa_category', 'Hospital',  'Hospital',  20, 1),
  ('hsa_category', 'Pharmacy',  'Pharmacy',  30, 1),
  ('hsa_category', 'Lab',       'Lab',       40, 1),
  ('hsa_category', 'Dental',    'Dental',    50, 1),
  ('hsa_category', 'Vision',    'Vision',    60, 1),
  ('hsa_category', 'Mental Health', 'Mental Health', 70, 1),
  ('hsa_category', 'Therapy',   'Therapy',   80, 1),
  ('hsa_category', 'Other',     'Other',     90, 1);
