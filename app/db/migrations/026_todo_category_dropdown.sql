-- 026_todo_category_dropdown.sql
-- Seed todo_category dropdown options if not already present

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_active)
VALUES
  ('todo_category', 'General',   'General',   10, 1),
  ('todo_category', 'Finance',   'Finance',   20, 1),
  ('todo_category', 'HSA',       'HSA',       30, 1),
  ('todo_category', 'Medical',   'Medical',   40, 1),
  ('todo_category', 'Home',      'Home',      50, 1),
  ('todo_category', 'Car',       'Car',       60, 1),
  ('todo_category', 'Health',    'Health',    70, 1),
  ('todo_category', 'Inventory', 'Inventory', 80, 1),
  ('todo_category', 'Work',      'Work',      90, 1),
  ('todo_category', 'Kids',      'Kids',     100, 1);
