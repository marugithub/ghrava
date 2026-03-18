-- Migration 006: Configurable dropdown options
-- Manages lists of values for dropdowns across the app.
-- list_key identifies the list, items have a label, value, sort_order, and active flag.

CREATE TABLE IF NOT EXISTS dropdown_options (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  list_key   TEXT NOT NULL,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active  INTEGER DEFAULT 1,
  is_system  INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dropdown_list ON dropdown_options(list_key, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dropdown_unique ON dropdown_options(list_key, value);

-- Seed: inventory categories
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('inventory_category', 'Electronics',        'Electronics',        10, 1),
  ('inventory_category', 'Appliances',          'Appliances',         20, 1),
  ('inventory_category', 'Furniture',           'Furniture',          30, 1),
  ('inventory_category', 'Tools',               'Tools',              40, 1),
  ('inventory_category', 'Clothing',            'Clothing',           50, 1),
  ('inventory_category', 'Sports',              'Sports',             60, 1),
  ('inventory_category', 'Toys',                'Toys',               70, 1),
  ('inventory_category', 'Kitchen',             'Kitchen',            80, 1),
  ('inventory_category', 'Outdoor',             'Outdoor',            90, 1),
  ('inventory_category', 'Documents',           'Documents',         100, 1),
  ('inventory_category', 'Health & Wellness',   'Health & Wellness', 110, 1),
  ('inventory_category', 'Holiday',             'Holiday',           120, 1),
  ('inventory_category', 'Books',               'Books',             130, 1),
  ('inventory_category', 'Other',               'Other',             140, 1);

-- Seed: H&W subcategories
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('hw_subcategory', 'Prescription (Rx)',       'Prescription',            10, 1),
  ('hw_subcategory', 'Over-the-Counter (OTC)',  'OTC',                     20, 1),
  ('hw_subcategory', 'First Aid',               'First Aid',               30, 1),
  ('hw_subcategory', 'Personal Care',           'Personal Care',           40, 1),
  ('hw_subcategory', 'Vitamins & Supplements',  'Vitamins & Supplements',  50, 1),
  ('hw_subcategory', 'Medical Equipment',       'Medical Equipment',       60, 1),
  ('hw_subcategory', 'Other',                   'Other',                   70, 1);

-- Seed: contact types
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('contact_type', 'Medical Provider', 'medical_provider', 10, 1),
  ('contact_type', 'Pharmacy',         'pharmacy',         20, 1),
  ('contact_type', 'Auto Service',     'auto_service',     30, 1),
  ('contact_type', 'Home Service',     'home_service',     40, 1),
  ('contact_type', 'Employer',         'employer',         50, 1),
  ('contact_type', 'School',           'school',           60, 1),
  ('contact_type', 'Contractor',       'contractor',       70, 1),
  ('contact_type', 'Financial',        'financial',        80, 1),
  ('contact_type', 'Utility',          'utility',          90, 1),
  ('contact_type', 'Vendor',           'vendor',          100, 1),
  ('contact_type', 'Other',            'other',           110, 1);

-- Seed: item condition
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('item_condition', 'Excellent', 'Excellent', 10, 1),
  ('item_condition', 'Good',      'Good',      20, 1),
  ('item_condition', 'Fair',      'Fair',      30, 1),
  ('item_condition', 'Poor',      'Poor',      40, 1);

-- Seed: purchase method
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('purchase_method', 'In Store',            'in_store',            10, 1),
  ('purchase_method', 'Online',              'online',              20, 1),
  ('purchase_method', 'Facebook Marketplace','facebook_marketplace', 30, 1),
  ('purchase_method', 'Craigslist',          'craigslist',          40, 1),
  ('purchase_method', 'Gift',                'gift',                50, 1),
  ('purchase_method', 'Auction',             'auction',             60, 1),
  ('purchase_method', 'Other',               'other',               70, 1);
