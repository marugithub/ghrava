-- Migration 064: Add contact_id to vehicle_service
-- shop TEXT kept for legacy display, contact_id is the proper reference going forward
ALTER TABLE vehicle_service ADD COLUMN contact_id INTEGER REFERENCES contacts(id);
