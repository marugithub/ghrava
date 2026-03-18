-- 034_gift_card_wallets.sql
-- Add digital wallet flags to gift_cards
ALTER TABLE gift_cards ADD COLUMN in_google_pay  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gift_cards ADD COLUMN in_samsung_pay INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gift_cards ADD COLUMN in_apple_pay   INTEGER NOT NULL DEFAULT 0;
