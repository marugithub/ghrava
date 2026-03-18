-- 035_property_maintenance.sql
-- Maintenance/repair log for properties (mirrors vehicle_service pattern)
CREATE TABLE IF NOT EXISTS property_maintenance (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id     INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  maint_date      DATE    NOT NULL,
  category        TEXT    NOT NULL,   -- Roof, HVAC, Plumbing, Electrical, Landscaping, Pest, Other
  description     TEXT    NOT NULL,
  cost            REAL,
  vendor          TEXT,
  warranty_expiry DATE,
  next_due_date   DATE,
  notes           TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prop_maint_property ON property_maintenance(property_id, maint_date DESC);

-- Career goals table
CREATE TABLE IF NOT EXISTS career_goals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  category    TEXT    DEFAULT 'General',   -- Short-term, Long-term, Skill, Financial, Other
  target_date DATE,
  status      TEXT    DEFAULT 'active'     -- active, achieved, dropped
              CHECK(status IN ('active','achieved','dropped')),
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
