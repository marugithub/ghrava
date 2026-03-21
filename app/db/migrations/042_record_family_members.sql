-- Migration 042: record_family_members
-- Junction table linking any record to one or more family members.
-- Same pattern as tags/taggables — entity_type + entity_id identifies the record.
--
-- Supported entity types:
--   book, document, resource, todo, hsa_payment, finance_account,
--   finance_transaction, career_job, career_goal, kid_activity, kid_note, contact
--
-- Deliberately excluded:
--   med_visit / med_medication / med_condition — patient field handles this
--   daily_log — personal record, no family member needed
--
-- No ON DELETE CASCADE — data is interconnected, never silently wipe.

CREATE TABLE IF NOT EXISTS record_family_members (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type      TEXT    NOT NULL,
  entity_id        INTEGER NOT NULL,
  family_member_id INTEGER NOT NULL REFERENCES family_members(id),
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rfm_entity ON record_family_members(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_rfm_member ON record_family_members(family_member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfm_unique ON record_family_members(entity_type, entity_id, family_member_id);
