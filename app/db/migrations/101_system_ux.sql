-- Migration 101: Database maintenance tracking and webhooks

-- DB MAINTENANCE LOG
CREATE TABLE IF NOT EXISTS db_maintenance_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operation TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  duration_ms INTEGER,
  result TEXT,
  details TEXT
);

-- WEBHOOKS
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_type TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  secret TEXT,
  last_triggered DATETIME,
  last_status INTEGER,
  failure_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_webhooks_event ON webhooks(event_type);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER REFERENCES webhooks(id),
  event_type TEXT NOT NULL,
  payload TEXT,
  response_code INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('webhooks_enabled', '0'),
  ('webhook_retry_count', '3'),
  ('webhook_timeout_seconds', '10'),
  ('shortcuts_enabled', '1');
