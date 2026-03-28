-- Migration 049: reading progress fields on books
-- pages_total: total pages in the book (set manually or from ISBN lookup)
-- pages_read:  current reading position (updated as you read)
-- Progress % = pages_read / pages_total * 100 (shown on book card when Currently Reading)

ALTER TABLE books ADD COLUMN pages_total INTEGER;
ALTER TABLE books ADD COLUMN pages_read  INTEGER;
