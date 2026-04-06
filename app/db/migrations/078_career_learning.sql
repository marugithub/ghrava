-- Migration 078: Career learning & certification overhaul
-- Drops career_education (0 rows), adds career_learning + career_learning_certs,
-- extends career_certifications with renewal tracking columns.

BEGIN;

-- ── 1. Drop old education table (no data) ─────────────────────
DROP TABLE IF EXISTS career_education;

-- ── 2. New learning table ──────────────────────────────────────
CREATE TABLE career_learning (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  learning_type TEXT    NOT NULL DEFAULT 'Course'
                CHECK(learning_type IN (
                  'Course','Seminar','Conference','Webinar',
                  'Reading','On-the-Job','Volunteering',
                  'Presenting/Teaching','Self-Study','Other'
                )),
  provider      TEXT,
  start_date    DATE,
  end_date      DATE,
  hours_total   REAL,
  location      TEXT,
  url           TEXT,
  cost          REAL,
  description   TEXT,
  notes         TEXT,
  needs_review      INTEGER NOT NULL DEFAULT 0,
  review_flagged_at DATETIME,
  review_reason     TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_career_learning_date ON career_learning(start_date);
CREATE INDEX idx_career_learning_type ON career_learning(learning_type);

-- ── 3. Junction: learning → certifications ────────────────────
CREATE TABLE career_learning_certs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  learning_id      INTEGER NOT NULL REFERENCES career_learning(id),
  certification_id INTEGER NOT NULL REFERENCES career_certifications(id),
  hours_applied    REAL,
  ce_category      TEXT,   -- e.g. "Education", "Technical", "On-the-Job" — text note only
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(learning_id, certification_id)
);

CREATE INDEX idx_clc_learning  ON career_learning_certs(learning_id);
CREATE INDEX idx_clc_cert      ON career_learning_certs(certification_id);

-- ── 4. Extend career_certifications ───────────────────────────
ALTER TABLE career_certifications ADD COLUMN cert_number          TEXT;
ALTER TABLE career_certifications ADD COLUMN ce_hours_required    REAL;
ALTER TABLE career_certifications ADD COLUMN renewal_period_months INTEGER;
ALTER TABLE career_certifications ADD COLUMN current_cycle_start  DATE;
ALTER TABLE career_certifications ADD COLUMN current_cycle_end    DATE;
ALTER TABLE career_certifications ADD COLUMN ce_category_rules    TEXT; -- JSON, future use

COMMIT;
