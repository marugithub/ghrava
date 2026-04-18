-- Migration 107: Wardrobe module
-- Adds wardrobe-specific columns to items table and creates outfit/planner/wear tables

-- ── Wardrobe columns on items ─────────────────────────────────
ALTER TABLE items ADD COLUMN wardrobe_owner_id   INTEGER REFERENCES family_members(id);
ALTER TABLE items ADD COLUMN wardrobe_sequence   INTEGER;
ALTER TABLE items ADD COLUMN wardrobe_nickname   TEXT;
ALTER TABLE items ADD COLUMN season_tags         TEXT; -- JSON array e.g. ["Fall","Winter"]
ALTER TABLE items ADD COLUMN occasion_tags       TEXT; -- JSON array e.g. ["Casual","Work"]
ALTER TABLE items ADD COLUMN wardrobe_status     TEXT DEFAULT 'active'; -- active/sold/donated/discarded
ALTER TABLE items ADD COLUMN wardrobe_status_date TEXT;
ALTER TABLE items ADD COLUMN wardrobe_status_notes TEXT;
ALTER TABLE items ADD COLUMN sold_platform       TEXT; -- eBay, Facebook Marketplace, etc.
ALTER TABLE items ADD COLUMN donated_org_contact_id INTEGER REFERENCES contacts(id);
ALTER TABLE items ADD COLUMN donated_fmv         REAL;
ALTER TABLE items ADD COLUMN discarded_reason    TEXT;

-- ── Saved outfits ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wardrobe_outfits (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  family_member_id INTEGER REFERENCES family_members(id),
  occasion_tags    TEXT, -- JSON array
  season_tags      TEXT, -- JSON array
  notes            TEXT,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wardrobe_outfit_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  outfit_id  INTEGER NOT NULL REFERENCES wardrobe_outfits(id),
  item_id    INTEGER NOT NULL REFERENCES items(id),
  sort_order INTEGER DEFAULT 0
);

-- ── Weekly planner ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wardrobe_planner (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date        TEXT NOT NULL, -- YYYY-MM-DD
  outfit_id        INTEGER REFERENCES wardrobe_outfits(id),
  family_member_id INTEGER REFERENCES family_members(id),
  occasion         TEXT,
  notes            TEXT,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ── Wear log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wardrobe_wear_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id          INTEGER NOT NULL REFERENCES items(id),
  outfit_id        INTEGER REFERENCES wardrobe_outfits(id),
  worn_date        TEXT NOT NULL,
  family_member_id INTEGER REFERENCES family_members(id),
  notes            TEXT,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_owner  ON items(wardrobe_owner_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_status ON items(wardrobe_status);
CREATE INDEX IF NOT EXISTS idx_wardrobe_outfit_items ON wardrobe_outfit_items(outfit_id);
CREATE INDEX IF NOT EXISTS idx_wardrobe_wear_log     ON wardrobe_wear_log(item_id, worn_date);
CREATE INDEX IF NOT EXISTS idx_wardrobe_planner      ON wardrobe_planner(plan_date);

-- ── Dropdown seeds ────────────────────────────────────────────
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('wardrobe_category', 'Clothing',     'Clothing',     10, 1, 1),
  ('wardrobe_category', 'Shoes',        'Shoes',        20, 1, 1),
  ('wardrobe_category', 'Accessories',  'Accessories',  30, 1, 1),
  ('wardrobe_category', 'Jewelry',      'Jewelry',      40, 1, 1),
  ('wardrobe_category', 'Hats',         'Hats',         50, 1, 1),
  ('wardrobe_category', 'Bags',         'Bags',         60, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('wardrobe_status', 'Active',    'active',    10, 1, 1),
  ('wardrobe_status', 'Sold',      'sold',      20, 1, 1),
  ('wardrobe_status', 'Donated',   'donated',   30, 1, 1),
  ('wardrobe_status', 'Discarded', 'discarded', 40, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('wardrobe_season', 'Spring',     'Spring',     10, 1, 1),
  ('wardrobe_season', 'Summer',     'Summer',     20, 1, 1),
  ('wardrobe_season', 'Fall',       'Fall',       30, 1, 1),
  ('wardrobe_season', 'Winter',     'Winter',     40, 1, 1),
  ('wardrobe_season', 'Rainy',      'Rainy',      50, 1, 1),
  ('wardrobe_season', 'All-season', 'All-season', 60, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('wardrobe_occasion', 'Casual',  'Casual',  10, 1, 1),
  ('wardrobe_occasion', 'School',  'School',  20, 1, 1),
  ('wardrobe_occasion', 'Sports',  'Sports',  30, 1, 1),
  ('wardrobe_occasion', 'Work',    'Work',    40, 1, 1),
  ('wardrobe_occasion', 'Formal',  'Formal',  50, 1, 1),
  ('wardrobe_occasion', 'Outdoor', 'Outdoor', 60, 1, 1),
  ('wardrobe_occasion', 'Evening', 'Evening', 70, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('sold_platform', 'eBay',               'ebay',               10, 1, 1),
  ('sold_platform', 'Facebook Marketplace','facebook_marketplace',20, 1, 1),
  ('sold_platform', 'Poshmark',           'poshmark',           30, 1, 1),
  ('sold_platform', 'ThredUp',            'thredup',            40, 1, 1),
  ('sold_platform', 'Depop',              'depop',              50, 1, 1),
  ('sold_platform', 'In Person',          'in_person',          60, 1, 1),
  ('sold_platform', 'Other',              'other',              70, 1, 1);
