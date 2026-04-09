-- 089_learning_instructor.sql
-- Add instructor contact reference to career_learning table.
-- Instructor is optional — a Contact of any type.

ALTER TABLE career_learning ADD COLUMN instructor_contact_id INTEGER REFERENCES contacts(id);
