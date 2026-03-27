-- Migration 045: Seed finance_category and hsa_store dropdown options
-- finance_category: backs the transaction category field in finance drawer
-- hsa_store: backs the OTC store field in HSA expense drawer

INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active) VALUES
  ('finance_category', 'Income',        'Income',        10, 1),
  ('finance_category', 'Housing',       'Housing',       20, 1),
  ('finance_category', 'Utilities',     'Utilities',     30, 1),
  ('finance_category', 'Groceries',     'Groceries',     40, 1),
  ('finance_category', 'Dining',        'Dining',        50, 1),
  ('finance_category', 'Transportation','Transportation',60, 1),
  ('finance_category', 'Healthcare',    'Healthcare',    70, 1),
  ('finance_category', 'Insurance',     'Insurance',     80, 1),
  ('finance_category', 'Education',     'Education',     90, 1),
  ('finance_category', 'Entertainment', 'Entertainment',100, 1),
  ('finance_category', 'Clothing',      'Clothing',      110, 1),
  ('finance_category', 'Personal Care', 'Personal Care', 120, 1),
  ('finance_category', 'Subscriptions', 'Subscriptions', 130, 1),
  ('finance_category', 'Travel',        'Travel',        140, 1),
  ('finance_category', 'Gifts',         'Gifts',         150, 1),
  ('finance_category', 'Charity',       'Charity',       160, 1),
  ('finance_category', 'Savings',       'Savings',       170, 1),
  ('finance_category', 'Investment',    'Investment',    180, 1),
  ('finance_category', 'Taxes',         'Taxes',         190, 1),
  ('finance_category', 'Business',      'Business',      200, 1),
  ('finance_category', 'Transfer',      'Transfer',      210, 1),
  ('finance_category', 'Other',         'Other',         999, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active) VALUES
  ('hsa_store', 'CVS',           'CVS',           10, 1),
  ('hsa_store', 'Walgreens',     'Walgreens',     20, 1),
  ('hsa_store', 'Walmart',       'Walmart',       30, 1),
  ('hsa_store', 'Target',        'Target',        40, 1),
  ('hsa_store', 'Amazon',        'Amazon',        50, 1),
  ('hsa_store', 'Costco',        'Costco',        60, 1),
  ('hsa_store', 'Sam''s Club',   'Sam''s Club',   70, 1),
  ('hsa_store', 'Kroger',        'Kroger',        80, 1),
  ('hsa_store', 'Publix',        'Publix',        90, 1),
  ('hsa_store', 'Other',         'Other',         999, 1);
