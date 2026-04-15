-- Migration 100: Field templates and insurance report config
-- (Receipt scanner tables omitted -- requires tesseract npm package)

-- INSURANCE REPORT CONFIG
INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('insurance_report_include_photos', '1'),
  ('insurance_report_include_values', '1'),
  ('insurance_report_group_by', 'room'),
  ('insurance_min_value_threshold', '100');

-- FIELD TEMPLATES
CREATE TABLE IF NOT EXISTS field_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_value TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_templates_entity_field ON field_templates(entity_type, field_name);

INSERT OR IGNORE INTO field_templates (entity_type, field_name, template_name, template_value) VALUES
  ('item', 'store_name', 'Amazon', 'Amazon'),
  ('item', 'store_name', 'Costco', 'Costco'),
  ('item', 'store_name', 'Home Depot', 'Home Depot'),
  ('item', 'store_name', 'Target', 'Target'),
  ('item', 'store_name', 'Walmart', 'Walmart'),
  ('item', 'condition', 'Excellent', 'Excellent'),
  ('item', 'condition', 'Good', 'Good'),
  ('item', 'condition', 'Fair', 'Fair'),
  ('hsa_payment', 'category', 'Doctor Visit', 'Doctor'),
  ('hsa_payment', 'category', 'Pharmacy', 'Pharmacy'),
  ('hsa_payment', 'category', 'Dental', 'Dental'),
  ('hsa_payment', 'category', 'Vision', 'Vision');
