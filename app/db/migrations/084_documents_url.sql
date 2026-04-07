-- Migration 084: Add url_link to documents table
BEGIN;
ALTER TABLE documents ADD COLUMN url_link TEXT;
COMMIT;
