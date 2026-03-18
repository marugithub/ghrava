-- 002_inventory_v3.sql
-- Adds all v3 columns/tables to existing v2 databases.
-- Duplicate columns are skipped gracefully by migrate.js.
-- NOTE: No ON DELETE CASCADE — SQLite doesn't enforce FK constraints
-- without PRAGMA foreign_keys=ON, and cascade causes table resolution
-- errors in statement-by-statement execution mode.

-- ── Archive fields ────────────────────────────────────────────
ALTER TABLE items ADD COLUMN is_archived      INTEGER  DEFAULT 0;
ALTER TABLE items ADD COLUMN archived_at      DATETIME;
ALTER TABLE items ADD COLUMN archived_reason  TEXT;

-- ── Purchase fields ───────────────────────────────────────────
ALTER TABLE items ADD COLUMN store_name       TEXT;
ALTER TABLE items ADD COLUMN purchase_method  TEXT;
ALTER TABLE items ADD COLUMN order_number     TEXT;

-- ── Insurance fields ──────────────────────────────────────────
ALTER TABLE items ADD COLUMN insured          INTEGER  DEFAULT 0;
ALTER TABLE items ADD COLUMN insurance_policy TEXT;
ALTER TABLE items ADD COLUMN insured_value    REAL;

-- ── Sold fields ───────────────────────────────────────────────
ALTER TABLE items ADD COLUMN sold_date        DATE;
ALTER TABLE items ADD COLUMN sold_price       REAL;
ALTER TABLE items ADD COLUMN sold_to          TEXT;

-- ── Attachments (photos + documents) ─────────────────────────
CREATE TABLE IF NOT EXISTS attachments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type      TEXT    NOT NULL,
  entity_id        INTEGER NOT NULL,
  attachment_type  TEXT    NOT NULL DEFAULT 'photo',
  file_name        TEXT    NOT NULL,
  file_path        TEXT    NOT NULL,
  thumbnail_path   TEXT,
  file_size        INTEGER,
  mime_type        TEXT,
  label            TEXT,
  notes            TEXT,
  is_primary_photo INTEGER DEFAULT 0,
  sort_order       INTEGER DEFAULT 0,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity
  ON attachments(entity_type, entity_id, attachment_type);

-- ── Audit / event log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL,
  event_type    TEXT    NOT NULL,
  field_changed TEXT,
  old_value     TEXT,
  new_value     TEXT,
  notes         TEXT,
  created_by    TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_events_item
  ON item_events(item_id, created_at DESC);

-- ── Maintenance log ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_maintenance_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id          INTEGER NOT NULL,
  log_date         DATE    NOT NULL,
  maintenance_type TEXT    NOT NULL DEFAULT 'service',
  description      TEXT,
  cost             REAL,
  provider         TEXT,
  next_due_date    DATE,
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maintenance_item
  ON item_maintenance_log(item_id);
