-- Migration 098: Undo delete tracking, expiry config, category rule enhancements

-- UNDO DELETE TRACKING
CREATE TABLE IF NOT EXISTS deleted_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  entity_name TEXT NOT NULL,
  deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_data TEXT
);
CREATE INDEX IF NOT EXISTS idx_deleted_type ON deleted_items(entity_type);
CREATE INDEX IF NOT EXISTS idx_deleted_date ON deleted_items(deleted_at DESC);

-- DOCUMENT EXPIRY CONFIG
ALTER TABLE documents ADD COLUMN expiry_notified INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN renewal_reminder_days INTEGER DEFAULT 60;
INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('expiry_timeline_months', '24'),
  ('expiry_show_renewed', '0');

-- SMART CATEGORY RULES ENHANCEMENTS
ALTER TABLE import_category_rules ADD COLUMN priority INTEGER DEFAULT 100;
ALTER TABLE import_category_rules ADD COLUMN match_count INTEGER DEFAULT 0;
ALTER TABLE import_category_rules ADD COLUMN last_matched DATETIME;
