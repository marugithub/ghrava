-- Migration 070: Add lender/insurance contact refs to properties and vehicles
ALTER TABLE properties ADD COLUMN mortgage_lender_contact_id  INTEGER REFERENCES contacts(id);
ALTER TABLE properties ADD COLUMN insurance_contact_id        INTEGER REFERENCES contacts(id);
ALTER TABLE vehicles   ADD COLUMN lender_contact_id           INTEGER REFERENCES contacts(id);
ALTER TABLE vehicles   ADD COLUMN insurance_contact_id        INTEGER REFERENCES contacts(id);
