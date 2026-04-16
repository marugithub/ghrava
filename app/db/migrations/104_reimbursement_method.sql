-- Migration 104: Seed HSA reimbursement method dropdown
INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system, is_active) VALUES
  ('hsa_reimbursement_method', 'ACH',        'ACH',        10, 1, 1),
  ('hsa_reimbursement_method', 'Check',      'Check',      20, 1, 1),
  ('hsa_reimbursement_method', 'Debit Card', 'Debit Card', 30, 1, 1),
  ('hsa_reimbursement_method', 'Other',      'Other',      40, 1, 1);
