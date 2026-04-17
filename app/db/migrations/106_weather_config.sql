-- Migration 106: Weather API configuration keys
INSERT OR IGNORE INTO app_config (key, value) VALUES
  ('weather_latitude',  ''),
  ('weather_longitude', ''),
  ('weather_city',      ''),
  ('weather_units',     'imperial');
