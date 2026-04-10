-- 091_contacts_google_updated_at.sql
-- Add google_updated_at to track Google's last update time for two-way sync.
-- Allows "latest wins" comparison between Ghrava updated_at and Google's timestamp.

ALTER TABLE contacts ADD COLUMN google_updated_at TEXT;
