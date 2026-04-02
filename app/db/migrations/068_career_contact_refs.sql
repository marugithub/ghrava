-- Migration 068: Add contact refs to career tables
ALTER TABLE career_jobs       ADD COLUMN company_contact_id     INTEGER REFERENCES contacts(id);
ALTER TABLE career_education  ADD COLUMN institution_contact_id INTEGER REFERENCES contacts(id);
