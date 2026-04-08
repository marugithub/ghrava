-- 088_dropdown_standardization.sql
-- Move hardcoded <select> values into dropdown_options so they are
-- user-configurable and managed in Settings > Customizations.
-- Existing records are unaffected — values already match.

-- family_relationship (settings > family members)
INSERT OR IGNORE INTO dropdown_options (list_key, value, sort_order) VALUES
  ('family_relationship', 'Self',     10),
  ('family_relationship', 'Spouse',   20),
  ('family_relationship', 'Son',      30),
  ('family_relationship', 'Daughter', 40),
  ('family_relationship', 'Parent',   50),
  ('family_relationship', 'Sibling',  60),
  ('family_relationship', 'Other',    70);

-- property_maintenance_type (property > maintenance)
INSERT OR IGNORE INTO dropdown_options (list_key, value, sort_order) VALUES
  ('property_maintenance_type', 'Repair',      10),
  ('property_maintenance_type', 'Service',     20),
  ('property_maintenance_type', 'Inspection',  30),
  ('property_maintenance_type', 'Cleaning',    40),
  ('property_maintenance_type', 'Upgrade',     50),
  ('property_maintenance_type', 'Replacement', 60),
  ('property_maintenance_type', 'Other',       70);

-- location_type (inventory > add location)
INSERT OR IGNORE INTO dropdown_options (list_key, value, sort_order) VALUES
  ('location_type', 'Room',         10),
  ('location_type', 'House',        20),
  ('location_type', 'Garage',       30),
  ('location_type', 'Attic',        40),
  ('location_type', 'Basement',     50),
  ('location_type', 'Storage Unit', 60),
  ('location_type', 'Other',        70);

-- finance_account_type: intentionally hardcoded — drives system routing
-- (banking vs investment table selection). Do not move to dropdown_options.

-- item_condition already exists in dropdown_options (seeded earlier)
-- itm_cond select will now call GH_SELECT — no data change needed
