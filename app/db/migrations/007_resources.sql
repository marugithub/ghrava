-- Migration 007: Resources module
-- No separate tags table — uses central tags + taggables (entity_type='resource')

CREATE TABLE IF NOT EXISTS resources (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  description  TEXT,
  url          TEXT,
  link_type    TEXT    DEFAULT 'website',
  category     TEXT,
  access_note  TEXT,
  is_favorite  INTEGER DEFAULT 0,
  sort_order   INTEGER DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_favorite ON resources(is_favorite);
