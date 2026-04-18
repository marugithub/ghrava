-- Migration 111: Warranty expansion for inventory items

ALTER TABLE items ADD COLUMN warranty_expiry          TEXT;
ALTER TABLE items ADD COLUMN warranty_provider_contact_id INTEGER REFERENCES contacts(id);
ALTER TABLE items ADD COLUMN warranty_details         TEXT;
ALTER TABLE items ADD COLUMN warranty_registration_no TEXT;

CREATE TABLE IF NOT EXISTS warranty_claims (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES items(id),
  claim_date    TEXT NOT NULL,
  description   TEXT,
  resolution    TEXT,
  resolved_date TEXT,
  contact_id    INTEGER REFERENCES contacts(id),
  notes         TEXT,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warranty_claims_item ON warranty_claims(item_id);
CREATE INDEX IF NOT EXISTS idx_items_warranty_expiry ON items(warranty_expiry);
