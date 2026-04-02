-- Migration 075: Add publisher, publish_year, language to books
-- ISBN lookup (Open Library / Google Books) returns these but they were dropped
ALTER TABLE books ADD COLUMN publisher    TEXT;
ALTER TABLE books ADD COLUMN publish_year INTEGER;
ALTER TABLE books ADD COLUMN language     TEXT;
