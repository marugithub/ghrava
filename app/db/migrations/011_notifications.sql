-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT NOT NULL,          -- 'expiry','hsa_pool','follow_up','receipt'
  severity     TEXT NOT NULL DEFAULT 'info', -- 'overdue','pending','ok','info'
  title        TEXT NOT NULL,
  body         TEXT,
  module       TEXT,                   -- 'inventory','hsa','daily_log','medical'
  entity_type  TEXT,
  entity_id    TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT                    -- auto-dismiss date
);

CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at DESC);
