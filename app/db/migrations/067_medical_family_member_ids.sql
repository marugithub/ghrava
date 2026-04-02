-- Migration 067: Add family_member_id to medical tables
-- patient TEXT kept for display cache; family_member_id is the proper FK
ALTER TABLE med_medications  ADD COLUMN family_member_id INTEGER REFERENCES family_members(id);
ALTER TABLE med_conditions   ADD COLUMN family_member_id INTEGER REFERENCES family_members(id);
ALTER TABLE med_visit_notes  ADD COLUMN family_member_id INTEGER REFERENCES family_members(id);
