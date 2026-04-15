-- Migration 096: Folder watcher tables and financial_accounts account_number

ALTER TABLE financial_accounts ADD COLUMN account_number TEXT;

CREATE TABLE IF NOT EXISTS watcher_file_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL UNIQUE,
  file_hash TEXT NOT NULL,
  file_size INTEGER,
  file_modified DATETIME,
  last_scanned DATETIME DEFAULT CURRENT_TIMESTAMP,
  import_status TEXT DEFAULT 'pending',
  import_batch_id INTEGER,
  import_error TEXT,
  imported_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_watcher_hash   ON watcher_file_registry(file_hash);
CREATE INDEX IF NOT EXISTS idx_watcher_status ON watcher_file_registry(import_status);
CREATE INDEX IF NOT EXISTS idx_watcher_path   ON watcher_file_registry(file_path);

CREATE TABLE IF NOT EXISTS watcher_import_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_registry_id INTEGER REFERENCES watcher_file_registry(id),
  rule_id INTEGER, rule_name TEXT,
  module TEXT NOT NULL, account_id INTEGER, batch_id INTEGER,
  transactions_imported INTEGER DEFAULT 0,
  started_at DATETIME, completed_at DATETIME,
  status TEXT DEFAULT 'pending', error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('folder_watcher_enabled', '0'),
  ('folder_watcher_config', '{"watch_paths":[],"rules":[],"catch_all":{"enabled":true,"action":"queue"}}');
