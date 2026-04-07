-- Migration 081: Add family_member_id to properties, vehicles, items
-- properties.family_member_id is genuinely new (not covered by 063-079)
-- vehicles.family_member_id and items.family_member_id are also new
-- record_family_members junction table already exists (migration 042)

BEGIN;

ALTER TABLE properties ADD COLUMN family_member_id INTEGER;
ALTER TABLE vehicles   ADD COLUMN family_member_id INTEGER;
ALTER TABLE items      ADD COLUMN family_member_id INTEGER;

COMMIT;
