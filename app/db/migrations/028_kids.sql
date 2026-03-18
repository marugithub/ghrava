-- 028_kids.sql
-- Kids module: profiles, school info, activities, schedules, notes
-- DROP first to handle schema drift from partial earlier runs

DROP TABLE IF EXISTS kid_notes;
DROP TABLE IF EXISTS kid_activities;
DROP TABLE IF EXISTS kids;

-- Main kids table (linked to family_members)
CREATE TABLE IF NOT EXISTS kids (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  family_member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  display_name     TEXT NOT NULL,
  date_of_birth    DATE,
  grade            TEXT,
  school_id        INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  teacher_name     TEXT,
  homeroom         TEXT,
  allergies        TEXT,
  medications_note TEXT,
  emergency_note   TEXT,
  photo_url        TEXT,
  notes            TEXT,
  is_active        INTEGER NOT NULL DEFAULT 1,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Activities per kid (sports, clubs, lessons, etc.)
CREATE TABLE IF NOT EXISTS kid_activities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kid_id          INTEGER NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT DEFAULT 'Other',  -- Sports / Music / Arts / Academic / Social / Other
  day_of_week     TEXT,                  -- Mon, Tue, Wed... (comma-separated for recurring)
  start_time      TEXT,
  end_time        TEXT,
  location        TEXT,
  contact_id      INTEGER REFERENCES contacts(id) ON DELETE SET NULL,  -- coach/instructor
  cost_per_month  REAL,
  season          TEXT,                  -- Fall / Spring / Year-round / Summer
  start_date      DATE,
  end_date        DATE,
  notes           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Per-kid notes/journal (medical notes, school notes, milestones, etc.)
CREATE TABLE IF NOT EXISTS kid_notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kid_id     INTEGER NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  note_date  DATE NOT NULL DEFAULT (DATE('now')),
  category   TEXT DEFAULT 'General',    -- Medical / School / Milestone / Behavior / General
  title      TEXT,
  body       TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kids_family  ON kids(family_member_id);
CREATE INDEX IF NOT EXISTS idx_kact_kid     ON kid_activities(kid_id);
CREATE INDEX IF NOT EXISTS idx_knotes_kid   ON kid_notes(kid_id, note_date DESC);
