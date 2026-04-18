-- Migration 108: Perfume module

CREATE TABLE IF NOT EXISTS perfumes (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  name                    TEXT NOT NULL,
  brand                   TEXT,
  concentration           TEXT, -- EDP/EDT/Parfum/Cologne/EDC
  top_notes               TEXT,
  middle_notes            TEXT,
  base_notes              TEXT,
  scent_family            TEXT, -- JSON array
  season_tags             TEXT, -- JSON array
  occasion_tags           TEXT, -- JSON array
  gender                  TEXT, -- Masculine/Feminine/Unisex
  size_ml                 REAL,
  amount_level            TEXT DEFAULT 'Full', -- Full/75%/50%/25%/Low/Empty
  purchase_price          REAL,
  purchase_date           TEXT,
  purchased_from          TEXT,
  owner_family_member_id  INTEGER REFERENCES family_members(id),
  rating                  INTEGER, -- 1-5
  notes                   TEXT,
  status                  TEXT DEFAULT 'active', -- active/empty/given_away/lost
  barcode                 TEXT,
  fragella_id             TEXT, -- cached lookup ID
  fragella_data           TEXT, -- JSON blob of cached API response
  fragella_cached_at      TEXT,
  created_at              TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at              TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Layering sets (named combinations of 2-4 perfumes)
CREATE TABLE IF NOT EXISTS perfume_layers (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  name                   TEXT NOT NULL,
  owner_family_member_id INTEGER REFERENCES family_members(id),
  season_tags            TEXT,
  occasion_tags          TEXT,
  notes                  TEXT,
  created_at             TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS perfume_layer_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  layer_id          INTEGER NOT NULL REFERENCES perfume_layers(id),
  perfume_id        INTEGER NOT NULL REFERENCES perfumes(id),
  application_order INTEGER DEFAULT 1,
  amount_note       TEXT
);

-- Outfit pairings
CREATE TABLE IF NOT EXISTS perfume_outfit_pairs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  outfit_id  INTEGER REFERENCES wardrobe_outfits(id),
  perfume_id INTEGER REFERENCES perfumes(id),
  layer_id   INTEGER REFERENCES perfume_layers(id),
  notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_perfumes_owner  ON perfumes(owner_family_member_id);
CREATE INDEX IF NOT EXISTS idx_perfumes_status ON perfumes(status);

-- Dropdown seeds
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('perfume_concentration', 'Parfum',   'Parfum',   10, 1, 1),
  ('perfume_concentration', 'EDP',      'EDP',      20, 1, 1),
  ('perfume_concentration', 'EDT',      'EDT',      30, 1, 1),
  ('perfume_concentration', 'EDC',      'EDC',      40, 1, 1),
  ('perfume_concentration', 'Cologne',  'Cologne',  50, 1, 1),
  ('perfume_concentration', 'Mist',     'Mist',     60, 1, 1),
  ('perfume_concentration', 'Oil',      'Oil',      70, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('perfume_amount', 'Full',         'Full',         10, 1, 1),
  ('perfume_amount', '75%',          '75%',          20, 1, 1),
  ('perfume_amount', '50%',          '50%',          30, 1, 1),
  ('perfume_amount', '25%',          '25%',          40, 1, 1),
  ('perfume_amount', 'Low',          'Low',          50, 1, 1),
  ('perfume_amount', 'Empty',        'Empty',        60, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('perfume_gender', 'Masculine', 'Masculine', 10, 1, 1),
  ('perfume_gender', 'Feminine',  'Feminine',  20, 1, 1),
  ('perfume_gender', 'Unisex',    'Unisex',    30, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('perfume_status', 'Active',     'active',     10, 1, 1),
  ('perfume_status', 'Empty',      'empty',      20, 1, 1),
  ('perfume_status', 'Given Away', 'given_away', 30, 1, 1),
  ('perfume_status', 'Lost',       'lost',       40, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('perfume_scent_family', 'Fresh',    'Fresh',    10, 1, 1),
  ('perfume_scent_family', 'Citrus',   'Citrus',   20, 1, 1),
  ('perfume_scent_family', 'Floral',   'Floral',   30, 1, 1),
  ('perfume_scent_family', 'Oriental', 'Oriental', 40, 1, 1),
  ('perfume_scent_family', 'Woody',    'Woody',    50, 1, 1),
  ('perfume_scent_family', 'Gourmand', 'Gourmand', 60, 1, 1),
  ('perfume_scent_family', 'Aquatic',  'Aquatic',  70, 1, 1),
  ('perfume_scent_family', 'Spicy',    'Spicy',    80, 1, 1);
