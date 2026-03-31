-- Migration 058: seed all integration API config keys
-- All free APIs — NHTSA, OpenFDA, Open Food Facts, Open-Meteo
-- Empty key = use trial/free endpoint. '1'/'0' = feature toggle.
INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('api_upcitemdb_key',          ''),
  ('api_openfoodfacts_enabled',  '1'),
  ('api_nhtsa_enabled',          '1'),
  ('api_openfda_enabled',        '1'),
  ('api_openmeteo_enabled',      '0'),
  ('api_openmeteo_lat',          '33.4052'),
  ('api_openmeteo_lon',         '-86.8278'),
  ('api_openmeteo_units',        'imperial');
