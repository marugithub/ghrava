-- 027_google_calendar.sql
-- Calendar events (synced from Google or created locally)

CREATE TABLE IF NOT EXISTS calendar_events (
  id              TEXT    PRIMARY KEY,          -- Google event ID or 'local_<rowid>'
  calendar_id     TEXT    DEFAULT 'primary',
  title           TEXT    NOT NULL,
  description     TEXT,
  location        TEXT,
  start_datetime  TEXT    NOT NULL,             -- ISO8601
  end_datetime    TEXT,
  all_day         INTEGER NOT NULL DEFAULT 0,
  status          TEXT    DEFAULT 'confirmed',  -- confirmed | tentative | cancelled
  recurring       INTEGER NOT NULL DEFAULT 0,
  source          TEXT    NOT NULL DEFAULT 'local', -- local | google
  family_member   TEXT,
  color_id        TEXT,
  html_link       TEXT,
  organizer_email TEXT,
  synced_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cal_start   ON calendar_events(start_datetime);
CREATE INDEX IF NOT EXISTS idx_cal_source  ON calendar_events(source);
CREATE INDEX IF NOT EXISTS idx_cal_status  ON calendar_events(status);

-- Track which Google Calendars are synced
CREATE TABLE IF NOT EXISTS google_calendars (
  id          TEXT PRIMARY KEY,    -- Google calendar ID
  summary     TEXT,
  description TEXT,
  color_hex   TEXT,
  is_enabled  INTEGER DEFAULT 1,   -- user can toggle individual calendars off
  is_primary  INTEGER DEFAULT 0,
  synced_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default app_config keys for Google OAuth (values empty until user configures)
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_client_id',     '');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_client_secret', '');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_access_token',  '');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_refresh_token', '');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_token_expiry',  '');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_sync_calendars','1');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_sync_contacts', '0');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_last_cal_sync', '');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('google_last_con_sync', '');
