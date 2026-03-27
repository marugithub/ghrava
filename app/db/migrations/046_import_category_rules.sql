-- Migration 046: Category rules for auto-categorizing imported transactions
-- Simple keyword matching: if description LIKE pattern, assign category.
-- Rules are applied in sort_order. First match wins.

CREATE TABLE IF NOT EXISTS import_category_rules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern     TEXT    NOT NULL,   -- SQL LIKE pattern, e.g. '%WALMART%'
  category    TEXT    NOT NULL,   -- category to assign
  sort_order  INTEGER NOT NULL DEFAULT 100,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cat_rules_active ON import_category_rules(is_active, sort_order);

-- Seed common rules
INSERT OR IGNORE INTO import_category_rules (pattern, category, sort_order) VALUES
  ('%PAYROLL%',       'Income',        1),
  ('%DIRECT DEP%',    'Income',        2),
  ('%SALARY%',        'Income',        3),
  ('%DIVIDEND%',      'Income',        4),
  ('%INTEREST%',      'Income',        5),
  ('%WALMART%',       'Groceries',    10),
  ('%KROGER%',        'Groceries',    11),
  ('%PUBLIX%',        'Groceries',    12),
  ('%COSTCO%',        'Groceries',    13),
  ('%WHOLE FOODS%',   'Groceries',    14),
  ('%ALDI%',          'Groceries',    15),
  ('%AMAZON%',        'Shopping',     20),
  ('%TARGET%',        'Shopping',     21),
  ('%NETFLIX%',       'Subscriptions',30),
  ('%SPOTIFY%',       'Subscriptions',31),
  ('%HULU%',          'Subscriptions',32),
  ('%APPLE.COM%',     'Subscriptions',33),
  ('%GOOGLE%',        'Subscriptions',34),
  ('%SHELL%',         'Transportation',40),
  ('%EXXON%',         'Transportation',41),
  ('%BP %',           'Transportation',42),
  ('%CHEVRON%',       'Transportation',43),
  ('%GAS%',           'Transportation',44),
  ('%UBER%',          'Transportation',45),
  ('%LYFT%',          'Transportation',46),
  ('%MCDONALD%',      'Dining',       50),
  ('%STARBUCKS%',     'Dining',       51),
  ('%CHICK-FIL%',     'Dining',       52),
  ('%CHIPOTLE%',      'Dining',       53),
  ('%DOORDASH%',      'Dining',       54),
  ('%GRUBHUB%',       'Dining',       55),
  ('%MORTGAGE%',      'Housing',      60),
  ('%RENT%',          'Housing',      61),
  ('%HOA%',           'Housing',      62),
  ('%ELECTRIC%',      'Utilities',    70),
  ('%WATER%',         'Utilities',    71),
  ('%GAS BILL%',      'Utilities',    72),
  ('%INTERNET%',      'Utilities',    73),
  ('%AT&T%',          'Utilities',    74),
  ('%VERIZON%',       'Utilities',    75),
  ('%T-MOBILE%',      'Utilities',    76),
  ('%CVS%',           'Healthcare',   80),
  ('%WALGREEN%',      'Healthcare',   81),
  ('%PHARMACY%',      'Healthcare',   82),
  ('%HOSPITAL%',      'Healthcare',   83),
  ('%MEDICAL%',       'Healthcare',   84),
  ('%DOCTOR%',        'Healthcare',   85),
  ('%INSURANCE%',     'Insurance',    90),
  ('%GEICO%',         'Insurance',    91),
  ('%STATE FARM%',    'Insurance',    92),
  ('%TRANSFER%',      'Transfer',    100),
  ('%ZELLE%',         'Transfer',    101),
  ('%VENMO%',         'Transfer',    102),
  ('%PAYPAL%',        'Transfer',    103);
