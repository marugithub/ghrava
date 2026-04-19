-- Migration 112: Memories — life events logged in daily_log
-- Adds is_memory flag + memory_category to daily_log
-- Adds memory_members junction table for multi-person memories

ALTER TABLE daily_log ADD COLUMN is_memory       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_log ADD COLUMN memory_category TEXT;

CREATE TABLE IF NOT EXISTS memory_members (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  log_id           INTEGER NOT NULL REFERENCES daily_log(id),
  family_member_id INTEGER NOT NULL REFERENCES family_members(id),
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memory_members_log    ON memory_members(log_id);
CREATE INDEX IF NOT EXISTS idx_memory_members_member ON memory_members(family_member_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_memory      ON daily_log(is_memory) WHERE is_memory=1;

-- Seed memory_category dropdown values
INSERT OR IGNORE INTO dropdown_options (key, label, value, sort_order, is_active, is_system)
VALUES
  ('memory_category', 'First Time',  'First Time',  10, 1, 1),
  ('memory_category', 'Academic',    'Academic',    20, 1, 1),
  ('memory_category', 'Sports',      'Sports',      30, 1, 1),
  ('memory_category', 'Health',      'Health',      40, 1, 1),
  ('memory_category', 'Career',      'Career',      50, 1, 1),
  ('memory_category', 'Award',       'Award',       60, 1, 1),
  ('memory_category', 'Travel',      'Travel',      70, 1, 1),
  ('memory_category', 'Personal',    'Personal',    80, 1, 1),
  ('memory_category', 'Family',      'Family',      90, 1, 1),
  ('memory_category', 'Milestone',   'Milestone',  100, 1, 1);
