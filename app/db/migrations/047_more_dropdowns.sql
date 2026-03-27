-- Migration 047: vehicle_service_type, hsa_otc_category, financial_institution dropdowns

INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active) VALUES
  ('vehicle_service_type', 'Oil Change',            'Oil Change',            10, 1),
  ('vehicle_service_type', 'Tire Rotation',         'Tire Rotation',         20, 1),
  ('vehicle_service_type', 'New Tires',             'New Tires',             30, 1),
  ('vehicle_service_type', 'Brakes',                'Brakes',                40, 1),
  ('vehicle_service_type', 'Battery',               'Battery',               50, 1),
  ('vehicle_service_type', 'State Inspection',      'State Inspection',      60, 1),
  ('vehicle_service_type', 'Registration Renewal',  'Registration Renewal',  70, 1),
  ('vehicle_service_type', 'Air Filter',            'Air Filter',            80, 1),
  ('vehicle_service_type', 'Transmission Service',  'Transmission Service',  90, 1),
  ('vehicle_service_type', 'Coolant Flush',         'Coolant Flush',        100, 1),
  ('vehicle_service_type', 'Alignment',             'Alignment',            110, 1),
  ('vehicle_service_type', 'Windshield',            'Windshield',           120, 1),
  ('vehicle_service_type', 'Detail',                'Detail',               130, 1),
  ('vehicle_service_type', 'Other',                 'Other',                999, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active) VALUES
  ('hsa_otc_category', 'OTC Medicine',          'OTC Medicine',          10, 1),
  ('hsa_otc_category', 'Vitamins & Supplements','Vitamins & Supplements', 20, 1),
  ('hsa_otc_category', 'First Aid',             'First Aid',             30, 1),
  ('hsa_otc_category', 'Medical Supplies',      'Medical Supplies',      40, 1),
  ('hsa_otc_category', 'Feminine Care',         'Feminine Care',         50, 1),
  ('hsa_otc_category', 'Baby & Child',          'Baby & Child',          60, 1),
  ('hsa_otc_category', 'Dental Care',           'Dental Care',           70, 1),
  ('hsa_otc_category', 'Eye Care',              'Eye Care',              80, 1),
  ('hsa_otc_category', 'Other',                 'Other',                999, 1);

INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active) VALUES
  ('financial_institution', 'Chase',          'Chase',          10, 1),
  ('financial_institution', 'Bank of America','Bank of America', 20, 1),
  ('financial_institution', 'Wells Fargo',    'Wells Fargo',    30, 1),
  ('financial_institution', 'Schwab',         'Schwab',         40, 1),
  ('financial_institution', 'Vanguard',       'Vanguard',       50, 1),
  ('financial_institution', 'Fidelity',       'Fidelity',       60, 1),
  ('financial_institution', 'Navy Federal',   'Navy Federal',   70, 1),
  ('financial_institution', 'TSP',            'TSP',            80, 1),
  ('financial_institution', 'Discover',       'Discover',       90, 1),
  ('financial_institution', 'Citi',           'Citi',          100, 1),
  ('financial_institution', 'Capital One',    'Capital One',   110, 1),
  ('financial_institution', 'USAA',           'USAA',          120, 1),
  ('financial_institution', 'Ally',           'Ally',          130, 1),
  ('financial_institution', 'Other',          'Other',         999, 1);
