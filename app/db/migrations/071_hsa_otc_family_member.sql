-- Migration 071: Add family_member_id to hsa_otc
-- OTC purchases were household-level; now attributable to specific family member
ALTER TABLE hsa_otc ADD COLUMN family_member_id INTEGER REFERENCES family_members(id);
