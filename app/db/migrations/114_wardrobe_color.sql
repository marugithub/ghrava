-- 114_wardrobe_color.sql
-- Adds wardrobe_color text column on items for clothing items.
-- Free-text so users can type any descriptor: "navy", "off-white", "burgundy + cream stripes".

ALTER TABLE items ADD COLUMN wardrobe_color TEXT;
