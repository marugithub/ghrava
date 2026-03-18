-- 024_property_vehicles.sql
-- Property and vehicles module

CREATE TABLE IF NOT EXISTS properties (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname          TEXT    NOT NULL,           -- "Main Home", "Lake House"
  property_type     TEXT    NOT NULL DEFAULT 'Primary Residence',  -- Primary Residence/Rental/Land/Other
  address_street    TEXT,
  address_city      TEXT,
  address_state     TEXT,
  address_zip       TEXT,
  purchase_date     DATE,
  purchase_price    REAL,
  current_est_value REAL,
  mortgage_balance  REAL,
  mortgage_lender   TEXT,
  mortgage_rate     REAL,                       -- as decimal e.g. 0.0675 = 6.75%
  mortgage_monthly  REAL,
  mortgage_end_date DATE,
  hoa_monthly       REAL,
  property_tax_annual REAL,
  insurance_annual  REAL,
  insurance_company TEXT,
  insurance_policy  TEXT,
  notes             TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicles (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname          TEXT    NOT NULL,           -- "Daily Driver", "Wife's Car"
  year              INTEGER,
  make              TEXT,
  model             TEXT,
  trim              TEXT,
  color             TEXT,
  vin               TEXT,
  license_plate     TEXT,
  state             TEXT,
  purchase_date     DATE,
  purchase_price    REAL,
  current_est_value REAL,
  odometer          INTEGER,                   -- last recorded mileage
  odometer_date     DATE,
  loan_balance      REAL,
  loan_lender       TEXT,
  loan_rate         REAL,
  loan_monthly      REAL,
  loan_end_date     DATE,
  insurance_company TEXT,
  insurance_policy  TEXT,
  insurance_annual  REAL,
  registration_expires DATE,
  inspection_expires   DATE,
  notes             TEXT,
  is_active         INTEGER NOT NULL DEFAULT 1,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service/maintenance log for vehicles
CREATE TABLE IF NOT EXISTS vehicle_service (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id        INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  service_date      DATE    NOT NULL,
  service_type      TEXT    NOT NULL,           -- Oil Change, Tires, Brakes, etc
  mileage           INTEGER,
  cost              REAL,
  shop              TEXT,
  notes             TEXT,
  next_due_date     DATE,
  next_due_miles    INTEGER,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicle_service_vehicle ON vehicle_service(vehicle_id, service_date DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_service_next   ON vehicle_service(next_due_date);
