-- Migration 103: Seed kids activity season dropdown
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('kids_activity_season', 'Year-round', 'Year-round', 10, 1, 1),
  ('kids_activity_season', 'Fall',       'Fall',       20, 1, 1),
  ('kids_activity_season', 'Spring',     'Spring',     30, 1, 1),
  ('kids_activity_season', 'Summer',     'Summer',     40, 1, 1),
  ('kids_activity_season', 'Winter',     'Winter',     50, 1, 1);
