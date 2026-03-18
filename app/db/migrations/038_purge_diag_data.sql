-- 038_purge_diag_data.sql
-- Hard-delete all diagnostic test records left by the Settings diagnostics suite.
-- These were created by tests that used soft-delete (is_active=0) rather than
-- true DELETE, leaving ghost rows that inflate the app/info record counts.
-- Safe: all rows match the _diag_ prefix used exclusively by the test suite.

DELETE FROM taggables WHERE entity_type = 'book'
  AND entity_id IN (SELECT id FROM books WHERE title LIKE '%_diag_%');

DELETE FROM taggables WHERE entity_type = 'document'
  AND entity_id IN (SELECT id FROM documents WHERE title LIKE '%_diag_%');

DELETE FROM taggables WHERE entity_type = 'item'
  AND entity_id IN (SELECT id FROM items WHERE name LIKE '%_diag_%');

DELETE FROM taggables WHERE entity_type IN ('kid_activity','kid_note')
  AND entity_id IN (
    SELECT ka.id FROM kid_activities ka
    JOIN kids k ON k.id = ka.kid_id WHERE k.display_name LIKE '%_diag_%'
    UNION
    SELECT kn.id FROM kid_notes kn
    JOIN kids k ON k.id = kn.kid_id WHERE k.display_name LIKE '%_diag_%'
  );

DELETE FROM kid_activities WHERE kid_id IN (SELECT id FROM kids WHERE display_name LIKE '%_diag_%');
DELETE FROM kid_notes     WHERE kid_id IN (SELECT id FROM kids WHERE display_name LIKE '%_diag_%');
DELETE FROM kids     WHERE display_name LIKE '%_diag_%';
DELETE FROM books    WHERE title LIKE '%_diag_%';
DELETE FROM documents WHERE title LIKE '%_diag_%';
DELETE FROM items    WHERE name LIKE '%_diag_%';
