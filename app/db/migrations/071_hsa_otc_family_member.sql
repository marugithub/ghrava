-- Migration 071: Add family_member_id to hsa_otc
ALTER TABLE hsa_otc ADD COLUMN family_member_id INTEGER;
