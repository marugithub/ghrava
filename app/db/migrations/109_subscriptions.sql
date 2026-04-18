-- Migration 109: Subscriptions module

CREATE TABLE IF NOT EXISTS subscriptions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  category            TEXT,
  cost                REAL,
  billing_cycle       TEXT DEFAULT 'monthly', -- monthly/annual/weekly
  next_billing_date   TEXT,
  auto_renew          INTEGER DEFAULT 1,
  finance_account_id  INTEGER REFERENCES finance_accounts(id),
  provider_contact_id INTEGER REFERENCES contacts(id),
  status              TEXT DEFAULT 'active', -- active/cancelled/paused
  notes               TEXT,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_members (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id   INTEGER NOT NULL REFERENCES subscriptions(id),
  family_member_id  INTEGER NOT NULL REFERENCES family_members(id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_billing ON subscriptions(next_billing_date);

-- Dropdown seeds
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('subscription_category', 'Streaming',  'Streaming',  10, 1, 1),
  ('subscription_category', 'Music',      'Music',      20, 1, 1),
  ('subscription_category', 'Software',   'Software',   30, 1, 1),
  ('subscription_category', 'Fitness',    'Fitness',    40, 1, 1),
  ('subscription_category', 'News',       'News',       50, 1, 1),
  ('subscription_category', 'Gaming',     'Gaming',     60, 1, 1),
  ('subscription_category', 'Utilities',  'Utilities',  70, 1, 1),
  ('subscription_category', 'Other',      'Other',      80, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('subscription_status', 'Active',    'active',    10, 1, 1),
  ('subscription_status', 'Paused',    'paused',    20, 1, 1),
  ('subscription_status', 'Cancelled', 'cancelled', 30, 1, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('billing_cycle', 'Monthly',  'monthly',  10, 1, 1),
  ('billing_cycle', 'Annual',   'annual',   20, 1, 1),
  ('billing_cycle', 'Weekly',   'weekly',   30, 1, 1),
  ('billing_cycle', 'Quarterly','quarterly',40, 1, 1);
