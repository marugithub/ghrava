-- Migration 013: Daily Log category dropdown seeds
-- Enables /api/v1/settings/dropdowns/dailylog_category to return data-driven list

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, sort_order) VALUES
  ('dailylog_category', 'General',    'General',    1, 10),
  ('dailylog_category', 'Investment', 'Investment', 1, 20),
  ('dailylog_category', 'Career',     'Career',     1, 30),
  ('dailylog_category', 'Finance',    'Finance',    1, 40),
  ('dailylog_category', 'Health',     'Health',     1, 50),
  ('dailylog_category', 'Home',       'Home',       1, 60),
  ('dailylog_category', 'Car',        'Car',        1, 70),
  ('dailylog_category', 'Family',     'Family',     1, 80),
  ('dailylog_category', 'Medical',    'Medical',    1, 90),
  ('dailylog_category', 'Estate',     'Estate',     1, 100);
