-- Migration 067
ALTER TABLE med_medications ADD COLUMN family_member_id INTEGER;
ALTER TABLE med_conditions  ADD COLUMN family_member_id INTEGER;
ALTER TABLE med_visit_notes ADD COLUMN family_member_id INTEGER;
