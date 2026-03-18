-- Migration 037: Migrate existing freetext tags from documents.tags column
-- into the shared tags+taggables system.
--
-- The documents table had a `tags TEXT` column storing comma-separated tag names.
-- In v202603.008 we moved to the shared tags+taggables system.
-- This migration rescues any existing freetext tags so data is not lost.
--
-- After migration the tags TEXT column is kept (not dropped) for safety.
-- It becomes a legacy/backup column and is ignored by the application.

-- For each document that has freetext tags, split and insert into shared system.
-- SQLite doesn't have split(), so we use a recursive CTE to tokenize.
-- This handles tags separated by commas with optional spaces.

WITH RECURSIVE
  doc_tags AS (
    SELECT id, tags FROM documents
    WHERE is_active = 1
      AND tags IS NOT NULL
      AND trim(tags) != ''
  ),
  -- Tokenize: extract one tag at a time from comma-separated string
  tokenized(doc_id, tag, rest) AS (
    SELECT
      id,
      trim(CASE
        WHEN instr(tags, ',') > 0 THEN substr(tags, 1, instr(tags, ',') - 1)
        ELSE tags
      END),
      CASE
        WHEN instr(tags, ',') > 0 THEN substr(tags, instr(tags, ',') + 1)
        ELSE NULL
      END
    FROM doc_tags
    UNION ALL
    SELECT
      doc_id,
      trim(CASE
        WHEN instr(rest, ',') > 0 THEN substr(rest, 1, instr(rest, ',') - 1)
        ELSE rest
      END),
      CASE
        WHEN instr(rest, ',') > 0 THEN substr(rest, instr(rest, ',') + 1)
        ELSE NULL
      END
    FROM tokenized
    WHERE rest IS NOT NULL AND trim(rest) != ''
  ),
  -- Normalize tag names to lowercase, filter empty
  clean_tags AS (
    SELECT DISTINCT doc_id, lower(trim(tag)) as tag_name
    FROM tokenized
    WHERE trim(tag) != ''
  )
-- Step 1: Ensure each tag exists in the tags table
INSERT OR IGNORE INTO tags (name, color_hex)
SELECT DISTINCT tag_name, '6366f1' FROM clean_tags;

-- Step 2: Insert taggables entries (CTE must be repeated — SQLite CTEs are statement-scoped)
WITH RECURSIVE
  doc_tags AS (
    SELECT id, tags FROM documents
    WHERE is_active = 1
      AND tags IS NOT NULL
      AND trim(tags) != ''
  ),
  tokenized(doc_id, tag, rest) AS (
    SELECT
      id,
      trim(CASE
        WHEN instr(tags, ',') > 0 THEN substr(tags, 1, instr(tags, ',') - 1)
        ELSE tags
      END),
      CASE
        WHEN instr(tags, ',') > 0 THEN substr(tags, instr(tags, ',') + 1)
        ELSE NULL
      END
    FROM doc_tags
    UNION ALL
    SELECT
      doc_id,
      trim(CASE
        WHEN instr(rest, ',') > 0 THEN substr(rest, 1, instr(rest, ',') - 1)
        ELSE rest
      END),
      CASE
        WHEN instr(rest, ',') > 0 THEN substr(rest, instr(rest, ',') + 1)
        ELSE NULL
      END
    FROM tokenized
    WHERE rest IS NOT NULL AND trim(rest) != ''
  ),
  clean_tags AS (
    SELECT DISTINCT doc_id, lower(trim(tag)) as tag_name
    FROM tokenized
    WHERE trim(tag) != ''
  )
INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id)
SELECT t.id, 'document', ct.doc_id
FROM clean_tags ct
JOIN tags t ON t.name = ct.tag_name;
