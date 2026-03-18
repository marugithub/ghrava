-- Migration 010: Split address into structured fields
-- contacts, locations, and med_physicians tables

-- contacts
ALTER TABLE contacts ADD COLUMN address_street TEXT;
ALTER TABLE contacts ADD COLUMN address_city   TEXT;
ALTER TABLE contacts ADD COLUMN address_state  TEXT;
ALTER TABLE contacts ADD COLUMN address_zip    TEXT;
-- Migrate existing single-field data into street (preserve it)
UPDATE contacts SET address_street = address WHERE address IS NOT NULL;

-- locations
ALTER TABLE locations ADD COLUMN address_street TEXT;
ALTER TABLE locations ADD COLUMN address_city   TEXT;
ALTER TABLE locations ADD COLUMN address_state  TEXT;
ALTER TABLE locations ADD COLUMN address_zip    TEXT;
UPDATE locations SET address_street = address WHERE address IS NOT NULL;

-- med_physicians (has its own address column per original schema)
ALTER TABLE med_physicians ADD COLUMN address_street TEXT;
ALTER TABLE med_physicians ADD COLUMN address_city   TEXT;
ALTER TABLE med_physicians ADD COLUMN address_state  TEXT;
ALTER TABLE med_physicians ADD COLUMN address_zip    TEXT;
UPDATE med_physicians SET address_street = address WHERE address IS NOT NULL;
