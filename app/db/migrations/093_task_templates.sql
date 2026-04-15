-- Migration 093: Recurring task templates

CREATE TABLE IF NOT EXISTS task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_template_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES task_templates(id),
  title TEXT NOT NULL,
  notes TEXT,
  priority TEXT DEFAULT 'medium',
  due_days_offset INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tti_template ON task_template_items(template_id);

-- Seed useful templates
INSERT OR IGNORE INTO task_templates (name, description, category) VALUES
  ('Monthly Finance Review', 'Monthly financial check-in tasks', 'Finance'),
  ('Annual Home Maintenance', 'Yearly home maintenance checklist', 'Home'),
  ('Back to School', 'Tasks for back to school season', 'Kids'),
  ('Vehicle Oil Change', 'Tasks around vehicle maintenance', 'Vehicles'),
  ('Tax Preparation', 'Annual tax prep checklist', 'Finance');

-- Monthly Finance Review items
INSERT OR IGNORE INTO task_template_items (template_id, title, priority, sort_order)
SELECT t.id, x.title, x.priority, x.sort_order FROM task_templates t,
(VALUES ('Review bank statements', 'high', 1), ('Categorize uncategorized transactions', 'medium', 2),
        ('Review HSA receipts', 'medium', 3), ('Check investment balances', 'low', 4)) AS x(title, priority, sort_order)
WHERE t.name = 'Monthly Finance Review';
