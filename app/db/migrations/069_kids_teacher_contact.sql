-- Migration 069: Add teacher contact ref to kids
-- teacher_name TEXT kept for display; teacher_contact_id is the proper FK
ALTER TABLE kids ADD COLUMN teacher_contact_id INTEGER REFERENCES contacts(id);
