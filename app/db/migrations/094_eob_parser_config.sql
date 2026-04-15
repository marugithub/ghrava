-- Migration 094: EOB parser config and app defaults

INSERT OR IGNORE INTO app_config (key, value) VALUES ('eob_parser', 'mhbp');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('snooze_default_days', '1');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('reminder_default_days', '7');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('backup_reminder_days', '7');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('document_expiry_warning_days', '90');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('hsa_pool_threshold', '500');

INSERT OR IGNORE INTO dropdown_options (list_key, label, value, sort_order, is_system) VALUES
  ('eob_parser', 'MHBP (Aetna Federal)', 'mhbp', 10, 1);
