-- Migration 116: today_snoozes — Today page snooze state
--
-- v202604.125: Powers the Snooze action on the Today page (new index.html).
-- Each row hides one source record (subscription, document, insurance,
-- todo) from the Today page until snoozed_until.
--
-- record_kind: 'subscription' | 'document' | 'insurance' | 'todo'
-- record_id:   the id in that module's table
-- snoozed_until: ISO date 'YYYY-MM-DD' — the row reappears on this date
--
-- No FK constraints on (record_kind, record_id) because record_kind picks
-- which table it points at — SQLite can't express that. Cleanup is a
-- nightly sweep (out of scope for this migration).
--
-- Additive only. No CASCADE.

CREATE TABLE IF NOT EXISTS today_snoozes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  record_kind   TEXT NOT NULL,
  record_id     INTEGER NOT NULL,
  snoozed_until TEXT NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_kind, record_id)
);

CREATE INDEX IF NOT EXISTS idx_today_snoozes_until
  ON today_snoozes(snoozed_until);
