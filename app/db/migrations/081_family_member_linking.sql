-- Migration 081: Add family_member_id to properties, vehicles, items
-- Enables "everything about a person" report to include these modules.
-- Uses record_family_members junction table (already exists).
-- These columns are convenience FKs for single-owner linking;
-- full multi-member linking goes through record_family_members.

BEGIN;

ALTER TABLE properties ADD COLUMN family_member_id INTEGER;
ALTER TABLE vehicles   ADD COLUMN family_member_id INTEGER;
ALTER TABLE items      ADD COLUMN family_member_id INTEGER;

COMMIT;
