-- Migration 014: Todos + Smart Automation
-- Todos are user-created tasks AND auto-generated data-integrity items.
-- auto_source links back to the originating record so clicking the todo
-- can deep-link directly to the source (HSA payment, inventory item, etc).

CREATE TABLE IF NOT EXISTS todos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Content
  title           TEXT    NOT NULL,
  notes           TEXT,
  due_date        DATE,

  -- Classification
  priority        TEXT    NOT NULL DEFAULT 'medium'
                  CHECK(priority IN ('urgent','high','medium','low')),
  category        TEXT    NOT NULL DEFAULT 'General',
  -- category values mirror daily_log categories + 'HSA','Medical','Inventory','System'

  -- Status
  status          TEXT    NOT NULL DEFAULT 'open'
                  CHECK(status IN ('open','in_progress','done','dismissed')),
  completed_at    DATETIME,

  -- Automation — auto-generated todos carry source info for deep-linking
  is_auto         INTEGER NOT NULL DEFAULT 0,   -- 1 = system-generated, 0 = user-created
  auto_type       TEXT,    -- 'hsa_missing_receipt','hsa_missing_eob','inv_expiring',
                           -- 'inv_missing_warranty','follow_up_overdue','med_rx_expiring',
                           -- 'inv_warranty_expiring','hsa_unreimbursed'
  auto_source_type TEXT,   -- 'hsa_payment','hsa_otc','item','daily_log','med_medication'
  auto_source_id  INTEGER, -- FK into the originating table

  -- Reminder
  reminder_date   DATE,
  reminder_sent   INTEGER DEFAULT 0,

  -- Repeat (user todos only)
  recurrence      TEXT    CHECK(recurrence IN ('none','daily','weekly','monthly','yearly') OR recurrence IS NULL),

  -- Timestamps
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_todos_status   ON todos(status, due_date);
CREATE INDEX IF NOT EXISTS idx_todos_auto     ON todos(is_auto, auto_type, auto_source_id);
CREATE INDEX IF NOT EXISTS idx_todos_due      ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_reminder ON todos(reminder_date, reminder_sent);

-- Note: annual_checklist items are not seeded here to avoid constraint errors.
-- The auto-generation engine creates todos at runtime when conditions are met.
