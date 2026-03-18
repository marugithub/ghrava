-- 019_gift_cards.sql
-- Gift cards tracking (Finance module tab)
-- Expiry auto-generates a Todo 30 days before via notifications system

CREATE TABLE IF NOT EXISTS gift_cards (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  retailer          TEXT    NOT NULL,
  initial_balance   REAL    NOT NULL DEFAULT 0,
  current_balance   REAL    NOT NULL DEFAULT 0,
  expiry_date       DATE,               -- nullable, many don't expire
  where_stored      TEXT    DEFAULT 'Wallet',  -- Wallet/Email/App/Physical
  notes             TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  todo_id           INTEGER,            -- linked Todo if expiry alert was created
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gift_cards_expiry   ON gift_cards(expiry_date);
CREATE INDEX IF NOT EXISTS idx_gift_cards_active   ON gift_cards(is_active);
