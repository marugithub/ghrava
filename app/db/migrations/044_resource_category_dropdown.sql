-- Migration 044: Seed resource_category dropdown
-- Converts the resources form from freetext category to GH_SELECT-backed dropdown.
-- Seeds from the categories already present in the resources table, plus common defaults.

INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active)
VALUES
  ('resource_category', 'General',           'General',            10, 1),
  ('resource_category', 'Finance',            'Finance',            20, 1),
  ('resource_category', 'Development',        'Development',        30, 1),
  ('resource_category', 'Career',             'Career',             40, 1),
  ('resource_category', 'Health',             'Health',             50, 1),
  ('resource_category', 'Education',          'Education',          60, 1),
  ('resource_category', 'Legal',              'Legal',              70, 1),
  ('resource_category', 'Government',         'Government',         80, 1),
  ('resource_category', 'Family',             'Family',             90, 1),
  ('resource_category', 'Home',               'Home',              100, 1),
  ('resource_category', 'Technology',         'Technology',        110, 1),
  ('resource_category', 'Academic Research',  'Academic Research', 120, 1),
  ('resource_category', 'Research Database',  'Research Database', 130, 1),
  ('resource_category', 'Thesis Database',    'Thesis Database',   140, 1),
  ('resource_category', 'Reference',          'Reference',         150, 1),
  ('resource_category', 'Tools',              'Tools',             160, 1),
  ('resource_category', 'Media',              'Media',             170, 1),
  ('resource_category', 'Other',              'Other',             999, 1);
