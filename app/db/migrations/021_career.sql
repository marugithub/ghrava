-- 021_career.sql
-- Career module: certifications, jobs, skills, education

CREATE TABLE IF NOT EXISTS career_certifications (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  issuing_body      TEXT,
  credential_id     TEXT,                      -- badge/license number
  issue_date        DATE,
  expiry_date       DATE,                      -- nullable for non-expiring certs
  status            TEXT    NOT NULL DEFAULT 'Active',  -- Active/Expired/In Progress
  notes             TEXT,
  todo_id           INTEGER,                   -- linked renewal reminder Todo
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS career_jobs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  company           TEXT    NOT NULL,
  title             TEXT    NOT NULL,
  employment_type   TEXT    DEFAULT 'Full-time', -- Full-time/Part-time/Contract/Freelance
  start_date        DATE,
  end_date          DATE,                      -- null = current
  location          TEXT,
  description       TEXT,
  is_current        INTEGER NOT NULL DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS career_skills (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  category          TEXT,                      -- Technical/Soft/Language/Tool etc
  proficiency       TEXT    DEFAULT 'Intermediate', -- Beginner/Intermediate/Advanced/Expert
  years_experience  REAL,
  last_used_year    INTEGER,
  notes             TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS career_education (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  institution       TEXT    NOT NULL,
  degree            TEXT,
  field_of_study    TEXT,
  start_year        INTEGER,
  end_year          INTEGER,
  gpa               TEXT,
  notes             TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_career_certs_expiry ON career_certifications(expiry_date);
CREATE INDEX IF NOT EXISTS idx_career_jobs_current ON career_jobs(is_current, start_date DESC);
