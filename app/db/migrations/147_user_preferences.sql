-- Migration 147: user_preferences for Reports Redesign Foundation (v.197)
-- Stores per-user (single-user in practice) UI preferences. First consumer:
-- the Reports tab pinned-strip on /reports.html. Future consumers can add
-- more rows or columns; the schema is intentionally simple.
--
-- Additive only. No CASCADE. No FK. user_key='default' is the only row used
-- today; if Ghrava ever grows multi-user, the column becomes a real FK then.

CREATE TABLE IF NOT EXISTS user_preferences (
  id              INTEGER  PRIMARY KEY AUTOINCREMENT,
  user_key        TEXT     NOT NULL DEFAULT 'default',
  pinned_reports  TEXT     NOT NULL DEFAULT '[]',  -- JSON array of report slugs, max 4 enforced server-side
  updated_at      DATETIME          DEFAULT CURRENT_TIMESTAMP
);

-- Seed the single default profile so GET returns an empty array (not 404)
-- on first load before any pinning has happened.
INSERT OR IGNORE INTO user_preferences (id, user_key, pinned_reports)
  VALUES (1, 'default', '[]');
