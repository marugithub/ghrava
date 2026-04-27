-- Migration 113: archive/dispose fields for books and documents
-- Books: physical status (separate from reading status) + notes
ALTER TABLE books ADD COLUMN physical_status       TEXT DEFAULT 'owned';    -- owned/donated/sold/lost/gifted
ALTER TABLE books ADD COLUMN physical_status_notes TEXT;
ALTER TABLE books ADD COLUMN physical_status_date  TEXT;

-- Documents: archive reason
ALTER TABLE documents ADD COLUMN archive_reason TEXT;

-- Perfume already has status field covering dispose states
-- Wardrobe items already have wardrobe_status + wardrobe_status_notes on items table
