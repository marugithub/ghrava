-- Migration 080: vehicle_service — add contact_id for shop reference
-- Replaces free-text shop field with a proper contact link.
-- shop TEXT kept as fallback display for existing records.

BEGIN;

ALTER TABLE vehicle_service ADD COLUMN contact_id INTEGER;

CREATE INDEX idx_vehicle_service_contact ON vehicle_service(contact_id);

COMMIT;
