-- Migration 105: Seed container subtype dropdown
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('container_subtype', 'Movable (box, bin, tote, bag)', 'movable', 10, 1, 1),
  ('container_subtype', 'Fixed (cabinet, bookshelf)',    'fixed',   20, 1, 1),
  ('container_subtype', 'Shelf',                         'shelf',   30, 1, 1),
  ('container_subtype', 'Drawer',                        'drawer',  40, 1, 1),
  ('container_subtype', 'Other',                         'other',   50, 1, 1);
