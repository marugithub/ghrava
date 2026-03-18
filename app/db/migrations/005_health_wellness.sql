-- Migration 005: Health & Wellness inventory category
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, ALTER TABLE handled by migrate.js duplicate-column guard

CREATE TABLE IF NOT EXISTS item_hw_details (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id               INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  hw_subcategory        TEXT NOT NULL DEFAULT 'OTC',
  family_member_id      INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  dosage_strength       TEXT,
  expiration_date       DATE,
  lot_number            TEXT,
  active_ingredients    TEXT,
  rx_number             TEXT,
  pharmacy_contact_id   INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  prescribing_doctor_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  date_filled           DATE,
  refills_remaining     INTEGER,
  next_refill_date      DATE,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hw_item        ON item_hw_details(item_id);
CREATE INDEX IF NOT EXISTS idx_hw_family      ON item_hw_details(family_member_id);
CREATE INDEX IF NOT EXISTS idx_hw_subcategory ON item_hw_details(hw_subcategory);
CREATE INDEX IF NOT EXISTS idx_hw_expiry      ON item_hw_details(expiration_date);

ALTER TABLE items      ADD COLUMN is_business INTEGER DEFAULT 0;
ALTER TABLE containers ADD COLUMN is_business INTEGER DEFAULT 0;
