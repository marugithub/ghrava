-- Migration 036: Seed all missing dropdown_options across every module
-- This is the complete, system-wide dropdown foundation.
--
-- Design principle: categories are per-module, subcategories are flat shared
-- lists (not per-category hierarchies). A single document_subcategory list
-- covers all document types — user picks what fits, or types something new
-- via GH_SELECT inline-add. This avoids 9 separate lists for one field.
--
-- Static enumerations (book format: Physical/Kindle/Audible, cert status, etc.)
-- remain hardcoded in HTML — users would never need to add values to them.
--
-- All list_key names are canonical. See WIRING.md for the full registry.

-- ── Documents ─────────────────────────────────────────────────
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('document_category', 'Tax',        'Tax',        10, 1),
  ('document_category', 'Legal',      'Legal',      20, 1),
  ('document_category', 'Insurance',  'Insurance',  30, 1),
  ('document_category', 'Warranty',   'Warranty',   40, 1),
  ('document_category', 'Medical',    'Medical',    50, 1),
  ('document_category', 'Financial',  'Financial',  60, 1),
  ('document_category', 'Property',   'Property',   70, 1),
  ('document_category', 'Vehicle',    'Vehicle',    80, 1),
  ('document_category', 'Career',     'Career',     90, 1),
  ('document_category', 'Other',      'Other',     100, 1);

-- Single flat subcategory list covering all document categories.
-- GH_SELECT lets the user add their own values inline.
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('document_subcategory', 'Federal Return',        'Federal Return',        10, 1),
  ('document_subcategory', 'State Return',          'State Return',          20, 1),
  ('document_subcategory', 'Property Tax',          'Property Tax',          30, 1),
  ('document_subcategory', 'Life Insurance',        'Life Insurance',        40, 1),
  ('document_subcategory', 'Home Insurance',        'Home Insurance',        50, 1),
  ('document_subcategory', 'Auto Insurance',        'Auto Insurance',        60, 1),
  ('document_subcategory', 'Health Insurance',      'Health Insurance',      70, 1),
  ('document_subcategory', 'Will / Trust',          'Will/Trust',            80, 1),
  ('document_subcategory', 'Power of Attorney',     'Power of Attorney',     90, 1),
  ('document_subcategory', 'Deed / Title',          'Deed/Title',           100, 1),
  ('document_subcategory', 'Service Record',        'Service Record',       110, 1),
  ('document_subcategory', 'Registration',          'Registration',         120, 1),
  ('document_subcategory', 'Medical Records',       'Medical Records',      130, 1),
  ('document_subcategory', 'Lab Results',           'Lab Results',          140, 1),
  ('document_subcategory', 'Prescription',          'Prescription',         150, 1),
  ('document_subcategory', 'Account Statement',     'Account Statement',    160, 1),
  ('document_subcategory', 'Investment Statement',  'Investment Statement', 170, 1),
  ('document_subcategory', 'Warranty Card',         'Warranty Card',        180, 1),
  ('document_subcategory', 'Purchase Receipt',      'Purchase Receipt',     190, 1),
  ('document_subcategory', 'Contract',              'Contract',             200, 1),
  ('document_subcategory', 'Other',                 'Other',                210, 1);

-- ── Career ────────────────────────────────────────────────────
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('career_goal_category', 'Short-term',  'Short-term',  10, 1),
  ('career_goal_category', 'Long-term',   'Long-term',   20, 1),
  ('career_goal_category', 'Skill',       'Skill',       30, 1),
  ('career_goal_category', 'Financial',   'Financial',   40, 1),
  ('career_goal_category', 'Leadership',  'Leadership',  50, 1),
  ('career_goal_category', 'Education',   'Education',   60, 1),
  ('career_goal_category', 'General',     'General',     70, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('career_skill_category', 'Technical',      'Technical',      10, 1),
  ('career_skill_category', 'Soft Skill',     'Soft Skill',     20, 1),
  ('career_skill_category', 'Language',       'Language',       30, 1),
  ('career_skill_category', 'Certification',  'Certification',  40, 1),
  ('career_skill_category', 'Tool',           'Tool',           50, 1),
  ('career_skill_category', 'Domain',         'Domain',         60, 1),
  ('career_skill_category', 'Other',          'Other',          70, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('career_job_type', 'Full-time',   'Full-time',   10, 1),
  ('career_job_type', 'Part-time',   'Part-time',   20, 1),
  ('career_job_type', 'Contract',    'Contract',    30, 1),
  ('career_job_type', 'Freelance',   'Freelance',   40, 1),
  ('career_job_type', 'Internship',  'Internship',  50, 1),
  ('career_job_type', 'Consulting',  'Consulting',  60, 1),
  ('career_job_type', 'Other',       'Other',       70, 1);

-- ── Kids ──────────────────────────────────────────────────────
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('kids_activity_category', 'Sports',    'Sports',    10, 1),
  ('kids_activity_category', 'Music',     'Music',     20, 1),
  ('kids_activity_category', 'Arts',      'Arts',      30, 1),
  ('kids_activity_category', 'Academic',  'Academic',  40, 1),
  ('kids_activity_category', 'Social',    'Social',    50, 1),
  ('kids_activity_category', 'Religious', 'Religious', 60, 1),
  ('kids_activity_category', 'Volunteer', 'Volunteer', 70, 1),
  ('kids_activity_category', 'Other',     'Other',     80, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('kids_note_category', 'General',     'General',     10, 1),
  ('kids_note_category', 'Medical',     'Medical',     20, 1),
  ('kids_note_category', 'School',      'School',      30, 1),
  ('kids_note_category', 'Milestone',   'Milestone',   40, 1),
  ('kids_note_category', 'Behavior',    'Behavior',    50, 1),
  ('kids_note_category', 'Achievement', 'Achievement', 60, 1);

-- ── Property ──────────────────────────────────────────────────
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('property_type', 'Primary Residence', 'Primary Residence', 10, 1),
  ('property_type', 'Rental',            'Rental',            20, 1),
  ('property_type', 'Vacation',          'Vacation',          30, 1),
  ('property_type', 'Land',              'Land',              40, 1),
  ('property_type', 'Commercial',        'Commercial',        50, 1),
  ('property_type', 'Other',             'Other',             60, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('property_maintenance_category', 'Roof',          'Roof',          10, 1),
  ('property_maintenance_category', 'HVAC',          'HVAC',          20, 1),
  ('property_maintenance_category', 'Plumbing',      'Plumbing',      30, 1),
  ('property_maintenance_category', 'Electrical',    'Electrical',    40, 1),
  ('property_maintenance_category', 'Landscaping',   'Landscaping',   50, 1),
  ('property_maintenance_category', 'Appliance',     'Appliance',     60, 1),
  ('property_maintenance_category', 'Pest Control',  'Pest Control',  70, 1),
  ('property_maintenance_category', 'Foundation',    'Foundation',    80, 1),
  ('property_maintenance_category', 'Windows/Doors', 'Windows/Doors', 90, 1),
  ('property_maintenance_category', 'Other',         'Other',        100, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('vehicle_service_type', 'Oil Change',    'Oil Change',    10, 1),
  ('vehicle_service_type', 'Tire Rotation', 'Tire Rotation', 20, 1),
  ('vehicle_service_type', 'Brake Service', 'Brake Service', 30, 1),
  ('vehicle_service_type', 'Inspection',    'Inspection',    40, 1),
  ('vehicle_service_type', 'Registration',  'Registration',  50, 1),
  ('vehicle_service_type', 'Repair',        'Repair',        60, 1),
  ('vehicle_service_type', 'Recall',        'Recall',        70, 1),
  ('vehicle_service_type', 'Detailing',     'Detailing',     80, 1),
  ('vehicle_service_type', 'Other',         'Other',         90, 1);

-- ── Medical ───────────────────────────────────────────────────
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('medical_visit_type', 'Primary Care',  'Primary Care',  10, 1),
  ('medical_visit_type', 'Specialist',    'Specialist',    20, 1),
  ('medical_visit_type', 'Urgent Care',   'Urgent Care',   30, 1),
  ('medical_visit_type', 'ER',            'ER',            40, 1),
  ('medical_visit_type', 'Dental',        'Dental',        50, 1),
  ('medical_visit_type', 'Vision',        'Vision',        60, 1),
  ('medical_visit_type', 'Mental Health', 'Mental Health', 70, 1),
  ('medical_visit_type', 'Lab',           'Lab',           80, 1),
  ('medical_visit_type', 'Imaging',       'Imaging',       90, 1),
  ('medical_visit_type', 'Telehealth',    'Telehealth',   100, 1),
  ('medical_visit_type', 'Other',         'Other',        110, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('medical_physician_type', 'Primary Care',      'Primary Care',      10, 1),
  ('medical_physician_type', 'Specialist',        'Specialist',        20, 1),
  ('medical_physician_type', 'Dentist',           'Dentist',           30, 1),
  ('medical_physician_type', 'Optometrist',       'Optometrist',       40, 1),
  ('medical_physician_type', 'Mental Health',     'Mental Health',     50, 1),
  ('medical_physician_type', 'Physical Therapy',  'Physical Therapy',  60, 1),
  ('medical_physician_type', 'Other',             'Other',             70, 1);

-- ── Books ─────────────────────────────────────────────────────
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('book_genre', 'Fiction',     'Fiction',     10, 1),
  ('book_genre', 'Non-fiction', 'Non-fiction', 20, 1),
  ('book_genre', 'Biography',   'Biography',   30, 1),
  ('book_genre', 'Science',     'Science',     40, 1),
  ('book_genre', 'History',     'History',     50, 1),
  ('book_genre', 'Technology',  'Technology',  60, 1),
  ('book_genre', 'Business',    'Business',    70, 1),
  ('book_genre', 'Self-help',   'Self-help',   80, 1),
  ('book_genre', 'Religion',    'Religion',    90, 1),
  ('book_genre', 'Other',       'Other',      100, 1);
