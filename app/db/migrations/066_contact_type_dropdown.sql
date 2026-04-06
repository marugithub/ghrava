-- Migration 066: Seed contact_type dropdown options
-- Enables contact type to be data-driven (GH_SELECT) instead of hardcoded
-- list_key = 'contact_type' follows existing dropdown_options pattern

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order) VALUES
  ('contact_type', 'Medical',     'Medical',     10),
  ('contact_type', 'Contractor',  'Contractor',  20),
  ('contact_type', 'Financial',   'Financial',   30),
  ('contact_type', 'Employer',    'Employer',    40),
  ('contact_type', 'School',      'School',      50),
  ('contact_type', 'Teacher',     'Teacher',     60),
  ('contact_type', 'Vendor',      'Vendor',      70),
  ('contact_type', 'Insurance',   'Insurance',   80),
  ('contact_type', 'Legal',       'Legal',       90),
  ('contact_type', 'General',     'General',     100),
  ('contact_type', 'Other',       'Other',       110);
