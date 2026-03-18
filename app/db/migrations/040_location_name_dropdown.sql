-- 040_location_name_dropdown.sql
-- Seeds the location_name dropdown list from existing locations table.
-- Future locations added via the drawer will also insert into dropdown_options.
-- No system values — user owns and can edit/delete all entries.

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
SELECT
  'location_name',
  name,
  name,
  0,
  1,
  ROW_NUMBER() OVER (ORDER BY name)
FROM locations
WHERE name IS NOT NULL AND trim(name) != '';
