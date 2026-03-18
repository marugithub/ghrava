-- LifeTracker v3 — Full Schema
-- Clean rebuild: all tables, all fields, all indexes

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ══════════════════════════════════════════════════════════════
-- CORE CONFIG & AUTH
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('app_name',       'LifeTracker'),
  ('timezone',       'America/Chicago'),
  ('setup_complete', '0'),
  ('currency',       'USD');

-- ══════════════════════════════════════════════════════════════
-- FAMILY MEMBERS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS family_members (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name     TEXT NOT NULL,
  full_legal_name  TEXT,
  relationship     TEXT,
  date_of_birth    DATE,
  ssn_last4        TEXT,
  is_primary_user  INTEGER DEFAULT 0,
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- TAGS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color_hex  TEXT DEFAULT '3b82f6',
  icon       TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taggables (
  tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id   INTEGER NOT NULL,
  PRIMARY KEY (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_taggables_entity ON taggables(entity_type, entity_id);

-- ══════════════════════════════════════════════════════════════
-- CUSTOM FIELDS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS custom_field_defs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  field_type     TEXT NOT NULL CHECK(field_type IN ('text','number','date','boolean','url','currency','dropdown')),
  scope_module   TEXT,
  scope_category TEXT,
  required       INTEGER DEFAULT 0,
  default_value  TEXT,
  options        TEXT,
  sort_order     INTEGER DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  field_def_id INTEGER NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,
  entity_id    INTEGER NOT NULL,
  value        TEXT,
  PRIMARY KEY (field_def_id, entity_type, entity_id)
);

-- ══════════════════════════════════════════════════════════════
-- CONTACTS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS contacts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_type     TEXT NOT NULL,
  name             TEXT NOT NULL,
  company          TEXT,
  phone_primary    TEXT,
  phone_secondary  TEXT,
  email            TEXT,
  address          TEXT,
  website          TEXT,
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts_medical (
  contact_id        INTEGER PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  specialty         TEXT,
  practice_name     TEXT,
  accepts_insurance TEXT,
  patients_seen     TEXT
);

CREATE TABLE IF NOT EXISTS contacts_home_service (
  contact_id         INTEGER PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  service_type       TEXT,
  license_number     TEXT,
  insurance_verified INTEGER DEFAULT 0,
  last_used_date     DATE,
  avg_cost           REAL,
  quality_rating     INTEGER
);

CREATE TABLE IF NOT EXISTS contacts_employer (
  contact_id         INTEGER PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  hr_contact_name    TEXT,
  hr_phone           TEXT,
  ein                TEXT,
  employee_person_id INTEGER REFERENCES family_members(id)
);

CREATE TABLE IF NOT EXISTS contacts_school (
  contact_id      INTEGER PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  principal_name  TEXT,
  grade_range     TEXT,
  enrolled_kids   TEXT
);

CREATE TABLE IF NOT EXISTS contacts_contractor (
  contact_id         INTEGER PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  specialty          TEXT,
  license_number     TEXT,
  insurance_verified INTEGER DEFAULT 0,
  bonded             INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contacts_financial (
  contact_id            INTEGER PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  institution_type      TEXT,
  rep_name              TEXT,
  account_types_served  TEXT
);

-- ══════════════════════════════════════════════════════════════
-- ATTACHMENTS (shared across all modules)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS attachments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type      TEXT NOT NULL,
  entity_id        INTEGER NOT NULL,
  attachment_type  TEXT NOT NULL CHECK(attachment_type IN ('photo','document','qnap_link','upload')),
  file_name        TEXT,
  file_path        TEXT,
  file_size        INTEGER,
  mime_type        TEXT,
  thumbnail_path   TEXT,
  label            TEXT,
  notes            TEXT,
  is_primary_photo INTEGER DEFAULT 0,
  sort_order       INTEGER DEFAULT 0,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);

-- ══════════════════════════════════════════════════════════════
-- INVENTORY — LOCATIONS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS locations (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL,
  description        TEXT,
  location_type      TEXT DEFAULT 'room'
    CHECK(location_type IN ('house','room','garage','attic','basement','storage_unit','office','shed','other')),
  parent_location_id INTEGER REFERENCES locations(id),
  address            TEXT,
  notes              TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ══════════════════════════════════════════════════════════════
-- INVENTORY — CONTAINERS
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS containers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  container_ref TEXT UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  subtype       TEXT DEFAULT 'movable'
    CHECK(subtype IN ('movable','fixed','shelf','drawer','cabinet','closet','other')),
  parent_type   TEXT NOT NULL CHECK(parent_type IN ('location','container')),
  parent_id     INTEGER NOT NULL,
  qr_code_path  TEXT,
  last_moved_at DATETIME,
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_containers_parent ON containers(parent_type, parent_id);

-- ══════════════════════════════════════════════════════════════
-- INVENTORY — ITEMS (full schema v3)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  item_ref     TEXT UNIQUE,

  -- Identity
  name                     TEXT NOT NULL,
  description              TEXT,
  category                 TEXT,
  parent_type              TEXT NOT NULL CHECK(parent_type IN ('location','container')),
  parent_id                INTEGER NOT NULL,
  is_container             INTEGER DEFAULT 0,
  quantity                 INTEGER DEFAULT 1,
  is_active                INTEGER DEFAULT 1,
  is_archived              INTEGER DEFAULT 0,
  archived_at              DATETIME,
  archived_reason          TEXT,

  -- Product identity
  brand                    TEXT,
  model_number             TEXT,
  serial_number            TEXT,
  manufacturer             TEXT,
  upc_barcode              TEXT,
  manufacturer_country     TEXT,
  manufacturer_support_phone TEXT,
  manufacturer_support_url   TEXT,

  -- Purchase
  purchase_date            DATE,
  purchase_price           REAL,
  purchased_from           TEXT,
  store_name               TEXT,
  purchase_method          TEXT CHECK(purchase_method IN
    ('in_store','online','facebook_marketplace','craigslist','gift','auction','other') OR purchase_method IS NULL),
  order_number             TEXT,

  -- Value & condition
  replacement_value        REAL,
  appraised_value          REAL,
  appraised_date           DATE,
  condition                TEXT CHECK(condition IN ('Excellent','Good','Fair','Poor') OR condition IS NULL),

  -- Insurance
  insured                  INTEGER DEFAULT 0,
  insurance_policy         TEXT,
  insured_value            REAL,

  -- Warranty
  warranty_expires         DATE,
  lifetime_warranty        INTEGER DEFAULT 0,
  warranty_vendor          TEXT,
  warranty_phone           TEXT,
  warranty_claim_url       TEXT,
  warranty_notes           TEXT,

  -- Sold
  sold_date                DATE,
  sold_price               REAL,
  sold_to                  TEXT,

  -- Meta
  qr_code_path             TEXT,
  notes                    TEXT,
  created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_parent    ON items(parent_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_items_active    ON items(is_active, is_archived);
CREATE INDEX IF NOT EXISTS idx_items_category  ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_ref       ON items(item_ref);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  name, description, brand, model_number, serial_number,
  manufacturer, upc_barcode, store_name, notes,
  content=items, content_rowid=id
);

CREATE TRIGGER IF NOT EXISTS items_fts_insert AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid,name,description,brand,model_number,serial_number,manufacturer,upc_barcode,store_name,notes)
  VALUES (new.id,new.name,new.description,new.brand,new.model_number,new.serial_number,new.manufacturer,new.upc_barcode,new.store_name,new.notes);
END;

CREATE TRIGGER IF NOT EXISTS items_fts_update AFTER UPDATE ON items BEGIN
  INSERT INTO items_fts(items_fts,rowid,name,description,brand,model_number,serial_number,manufacturer,upc_barcode,store_name,notes)
  VALUES ('delete',old.id,old.name,old.description,old.brand,old.model_number,old.serial_number,old.manufacturer,old.upc_barcode,old.store_name,old.notes);
  INSERT INTO items_fts(rowid,name,description,brand,model_number,serial_number,manufacturer,upc_barcode,store_name,notes)
  VALUES (new.id,new.name,new.description,new.brand,new.model_number,new.serial_number,new.manufacturer,new.upc_barcode,new.store_name,new.notes);
END;

CREATE TRIGGER IF NOT EXISTS items_fts_delete AFTER DELETE ON items BEGIN
  INSERT INTO items_fts(items_fts,rowid,name,description,brand,model_number,serial_number,manufacturer,upc_barcode,store_name,notes)
  VALUES ('delete',old.id,old.name,old.description,old.brand,old.model_number,old.serial_number,old.manufacturer,old.upc_barcode,old.store_name,old.notes);
END;

-- ══════════════════════════════════════════════════════════════
-- INVENTORY — AUDIT / EVENT LOG
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS item_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK(event_type IN (
    'created','moved','field_updated','photo_added','photo_removed',
    'document_added','archived','unarchived','sold','quantity_changed',
    'maintenance_logged','tag_added','tag_removed','condition_changed'
  )),
  field_changed TEXT,
  old_value     TEXT,
  new_value     TEXT,
  notes         TEXT,
  created_by    TEXT,  -- NULL now, populated when user profiles added
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_item_events_item ON item_events(item_id, created_at DESC);

-- ══════════════════════════════════════════════════════════════
-- INVENTORY — MAINTENANCE LOG
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS item_maintenance_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  log_date      DATE NOT NULL,
  maintenance_type TEXT NOT NULL CHECK(maintenance_type IN
    ('repair','service','inspection','cleaning','upgrade','replacement','other')),
  description   TEXT NOT NULL,
  cost          REAL,
  provider      TEXT,
  next_due_date DATE,
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_maintenance_item ON item_maintenance_log(item_id);

-- ══════════════════════════════════════════════════════════════
-- DAILY LOG
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS daily_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  log_date         DATE NOT NULL,
  category         TEXT DEFAULT 'General',
  entry_text       TEXT NOT NULL,
  follow_up_needed INTEGER DEFAULT 0,
  follow_up_date   DATE,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_log_date     ON daily_log(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_log_category ON daily_log(category);
CREATE INDEX IF NOT EXISTS idx_daily_log_followup ON daily_log(follow_up_needed, follow_up_date);

-- ══════════════════════════════════════════════════════════════
-- ANNUAL CHECKLIST
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS annual_checklist (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  title          TEXT NOT NULL,
  category       TEXT,
  description    TEXT,
  due_month      INTEGER CHECK(due_month BETWEEN 1 AND 12),
  recurrence     TEXT DEFAULT 'annual',
  is_active      INTEGER DEFAULT 1,
  sort_order     INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS checklist_completions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  checklist_id INTEGER NOT NULL REFERENCES annual_checklist(id),
  year        INTEGER NOT NULL,
  completed   INTEGER DEFAULT 0,
  completed_at DATETIME,
  notes       TEXT,
  UNIQUE(checklist_id, year)
);

-- Seed annual checklist tasks
INSERT OR IGNORE INTO annual_checklist (title, category, due_month, sort_order) VALUES
  ('File Federal & State Taxes',           'Finance',    4,  1),
  ('Review Home Insurance Policy',         'Insurance',  1,  2),
  ('Review Auto Insurance Policy',         'Insurance',  1,  3),
  ('Review Life Insurance Policy',         'Insurance',  1,  4),
  ('Review Umbrella Policy',               'Insurance',  1,  5),
  ('Review & Max HSA Contributions',       'HSA',        12, 6),
  ('Review & Max 401k Contributions',      'Retirement', 12, 7),
  ('Review & Max IRA Contributions',       'Retirement', 4,  8),
  ('Check Credit Reports (all 3)',         'Finance',    1,  9),
  ('Review Net Worth',                     'Finance',    1,  10),
  ('Update Emergency Fund',                'Finance',    6,  11),
  ('Review & Update Budget',               'Finance',    1,  12),
  ('Review Subscriptions',                 'Finance',    1,  13),
  ('Update Estate Documents / Will',       'Estate',     1,  14),
  ('Review Beneficiary Designations',      'Estate',     1,  15),
  ('Review Medical Records',               'Health',     1,  16),
  ('Schedule Annual Physicals',            'Health',     1,  17),
  ('Dental Checkups (x2)',                 'Health',     6,  18),
  ('Eye Exam',                             'Health',     1,  19),
  ('Change HVAC Filters',                  'Home',       3,  20),
  ('Test Smoke & CO2 Detectors',           'Home',       10, 21),
  ('Flush Water Heater',                   'Home',       6,  22),
  ('Service HVAC System',                  'Home',       9,  23),
  ('Clean Dryer Vent',                     'Home',       6,  24),
  ('Gutter Cleaning',                      'Home',       11, 25),
  ('Roof Inspection',                      'Home',       5,  26),
  ('Review Car Maintenance Schedule',      'Car',        1,  27),
  ('Review & Rotate Tires',               'Car',        6,  28),
  ('Backup All Important Documents',       'Admin',      1,  29),
  ('Review/Update Passwords',              'Security',   1,  30),
  ('Review Kids School Documents',         'Family',     8,  31),
  ('Update Emergency Contact List',        'Family',     1,  32),
  ('Review Career Goals',                  'Career',     1,  33),
  ('Update Resume',                        'Career',     6,  34),
  ('Review Investment Allocations',        'Investments',1,  35);
