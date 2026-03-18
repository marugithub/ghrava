-- 025_documents.sql
-- Document vault: tax, legal, insurance, warranties, medical, financial, other

CREATE TABLE IF NOT EXISTS documents (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  category        TEXT    NOT NULL DEFAULT 'Other',
             -- Tax / Legal / Insurance / Warranty / Medical / Financial / Property / Vehicle / Career / Other
  subcategory     TEXT,                          -- e.g. "2024 Federal" for Tax
  description     TEXT,
  file_name       TEXT,                          -- original filename
  file_path       TEXT,                          -- stored path (via attachments system)
  attachment_id   INTEGER,                       -- links to attachments table if uploaded
  issuer          TEXT,                          -- who issued it (IRS, State Farm, etc.)
  issue_date      DATE,
  expiry_date     DATE,
  tags            TEXT,                          -- comma-separated tags
  family_member   TEXT,                          -- who it belongs to (or null = whole family)
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_docs_category  ON documents(category, is_active);
CREATE INDEX IF NOT EXISTS idx_docs_expiry    ON documents(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docs_member    ON documents(family_member);
