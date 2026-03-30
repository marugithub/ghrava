-- Migration 051: clean tag data
-- Remove all test/seed tag data. Strip # prefix from any real tag names.
-- Users start with a clean slate and build their own tags organically.

DELETE FROM taggables;
DELETE FROM tags;
