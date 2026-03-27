-- Migration 048: school_name dropdown for career education institution field
-- Backs the GH_SELECT on the Education drawer. Users add their own schools inline.
-- Seeded with common institution types — not a comprehensive list.

INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active) VALUES
  ('school_name', 'High School',                   'High School',                   10, 1),
  ('school_name', 'Community College',              'Community College',              20, 1),
  ('school_name', 'State University',               'State University',               30, 1),
  ('school_name', 'Online / Self-Study',            'Online / Self-Study',            40, 1),
  ('school_name', 'Trade / Vocational School',      'Trade / Vocational School',      50, 1),
  ('school_name', 'Bootcamp',                       'Bootcamp',                       60, 1),
  ('school_name', 'Coursera',                       'Coursera',                       70, 1),
  ('school_name', 'Udemy',                          'Udemy',                          80, 1),
  ('school_name', 'LinkedIn Learning',              'LinkedIn Learning',              90, 1),
  ('school_name', 'Other',                          'Other',                         999, 1);
