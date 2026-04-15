-- Migration 092: Document-item linking

CREATE TABLE IF NOT EXISTS document_item_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id),
  item_id     INTEGER NOT NULL REFERENCES items(id),
  link_type   TEXT DEFAULT 'manual',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_dil_document ON document_item_links(document_id);
CREATE INDEX IF NOT EXISTS idx_dil_item     ON document_item_links(item_id);
