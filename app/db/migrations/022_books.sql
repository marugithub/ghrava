-- 022_books.sql
-- Books module: personal reading tracker

CREATE TABLE IF NOT EXISTS books (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT    NOT NULL,
  author            TEXT,
  genre             TEXT,
  status            TEXT    NOT NULL DEFAULT 'Want to Read', -- Want to Read/Currently Reading/Read
  rating            INTEGER,                   -- 1-5, nullable
  format            TEXT    DEFAULT 'Physical', -- Physical/Kindle/Audible
  date_started      DATE,
  date_finished     DATE,
  notes             TEXT,                       -- highlights, thoughts
  isbn              TEXT,
  cover_url         TEXT,                       -- optional cover image URL
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_books_status  ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_author  ON books(author);
CREATE INDEX IF NOT EXISTS idx_books_genre   ON books(genre);
