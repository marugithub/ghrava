-- 033_gift_card_number.sql
-- Add card_number field to gift_cards for barcode display
ALTER TABLE gift_cards ADD COLUMN card_number TEXT;
ALTER TABLE gift_cards ADD COLUMN card_pin    TEXT;
