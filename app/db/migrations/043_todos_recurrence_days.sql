-- Migration 043: Add recurrence_days to todos
--
-- SQLite does not support ALTER TABLE ... MODIFY COLUMN, so we rebuild
-- the table to update the recurrence CHECK constraint to include 'every_n_days'
-- and add the recurrence_days integer column.
--
-- All data is preserved. The taggables and record_family_members tables
-- reference todos by text entity_type (not FK), so no cascade issues.

BEGIN;

CREATE TABLE todos_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Content
  title           TEXT    NOT NULL,
  notes           TEXT,
  due_date        DATE,

  -- Classification
  priority        TEXT    NOT NULL DEFAULT 'medium'
                  CHECK(priority IN ('urgent','high','medium','low')),
  category        TEXT    NOT NULL DEFAULT 'General',

  -- Status
  status          TEXT    NOT NULL DEFAULT 'open'
                  CHECK(status IN ('open','in_progress','done','dismissed')),
  completed_at    DATETIME,

  -- Automation
  is_auto         INTEGER NOT NULL DEFAULT 0,
  auto_type       TEXT,
  auto_source_type TEXT,
  auto_source_id  INTEGER,

  -- Reminder
  reminder_date   DATE,
  reminder_sent   INTEGER DEFAULT 0,

  -- Repeat (user todos only)
  recurrence      TEXT    CHECK(recurrence IN ('none','daily','weekly','monthly','yearly','every_n_days') OR recurrence IS NULL),
  recurrence_days INTEGER,  -- used when recurrence = 'every_n_days'

  -- Needs review (added in migration 039)
  needs_review      INTEGER  NOT NULL DEFAULT 0,
  review_flagged_at DATETIME,
  review_reason     TEXT,

  -- Timestamps
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO todos_new (
  id, title, notes, due_date,
  priority, category,
  status, completed_at,
  is_auto, auto_type, auto_source_type, auto_source_id,
  reminder_date, reminder_sent,
  recurrence,
  needs_review, review_flagged_at, review_reason,
  created_at, updated_at
)
SELECT
  id, title, notes, due_date,
  priority, category,
  status, completed_at,
  is_auto, auto_type, auto_source_type, auto_source_id,
  reminder_date, reminder_sent,
  recurrence,
  needs_review, review_flagged_at, review_reason,
  created_at, updated_at
FROM todos;

DROP TABLE todos;
ALTER TABLE todos_new RENAME TO todos;

CREATE INDEX IF NOT EXISTS idx_todos_status   ON todos(status, due_date);
CREATE INDEX IF NOT EXISTS idx_todos_auto     ON todos(is_auto, auto_type, auto_source_id);
CREATE INDEX IF NOT EXISTS idx_todos_due      ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_reminder ON todos(reminder_date, reminder_sent);

COMMIT;
