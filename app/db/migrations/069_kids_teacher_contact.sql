-- Migration 069: Add teacher contact ref to kids
ALTER TABLE kids ADD COLUMN teacher_contact_id INTEGER;
