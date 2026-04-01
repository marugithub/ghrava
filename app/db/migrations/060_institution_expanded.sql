-- Migration 060: Expand financial_institution dropdown list
INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active) VALUES
  -- Federal / Government
  ('financial_institution', 'TSP (Thrift Savings Plan)', 'TSP (Thrift Savings Plan)', 5,  1),
  -- Major banks
  ('financial_institution', 'Citibank',          'Citibank',          101, 1),
  ('financial_institution', 'TD Bank',           'TD Bank',           140, 1),
  ('financial_institution', 'PNC Bank',          'PNC Bank',          150, 1),
  ('financial_institution', 'US Bank',           'US Bank',           160, 1),
  ('financial_institution', 'Truist',            'Truist',            170, 1),
  ('financial_institution', 'Regions Bank',      'Regions Bank',      180, 1),
  ('financial_institution', 'SunTrust',          'SunTrust',          190, 1),
  ('financial_institution', 'BB&T',              'BB&T',              200, 1),
  ('financial_institution', 'Fifth Third Bank',  'Fifth Third Bank',  210, 1),
  ('financial_institution', 'KeyBank',           'KeyBank',           220, 1),
  ('financial_institution', 'Huntington',        'Huntington',        230, 1),
  ('financial_institution', 'Citizens Bank',     'Citizens Bank',     240, 1),
  ('financial_institution', 'M&T Bank',          'M&T Bank',          250, 1),
  -- Credit cards
  ('financial_institution', 'American Express',  'American Express',  260, 1),
  ('financial_institution', 'Barclays',          'Barclays',          270, 1),
  ('financial_institution', 'Synchrony',         'Synchrony',         280, 1),
  ('financial_institution', 'Bread Financial',   'Bread Financial',   290, 1),
  -- Online / Neobanks
  ('financial_institution', 'Marcus by Goldman', 'Marcus by Goldman', 300, 1),
  ('financial_institution', 'SoFi',              'SoFi',              310, 1),
  ('financial_institution', 'Chime',             'Chime',             320, 1),
  ('financial_institution', 'Current',           'Current',           330, 1),
  ('financial_institution', 'PayPal',            'PayPal',            340, 1),
  ('financial_institution', 'Venmo',             'Venmo',             350, 1),
  -- Investment / Brokerage
  ('financial_institution', 'E*TRADE',           'E*TRADE',           360, 1),
  ('financial_institution', 'TD Ameritrade',     'TD Ameritrade',     370, 1),
  ('financial_institution', 'Merrill Lynch',     'Merrill Lynch',     380, 1),
  ('financial_institution', 'Edward Jones',      'Edward Jones',      390, 1),
  ('financial_institution', 'T. Rowe Price',     'T. Rowe Price',     400, 1),
  ('financial_institution', 'Robinhood',         'Robinhood',         410, 1),
  ('financial_institution', 'Webull',            'Webull',            420, 1),
  ('financial_institution', 'Coinbase',          'Coinbase',          430, 1),
  -- Credit Unions (common)
  ('financial_institution', 'Pentagon FCU',      'Pentagon FCU',      440, 1),
  ('financial_institution', 'SECU',              'SECU',              450, 1),
  ('financial_institution', 'Boeing Employees CU','Boeing Employees CU',460, 1),
  -- Retail / Store cards
  ('financial_institution', 'Amazon',            'Amazon',            470, 1),
  ('financial_institution', 'Apple Card',        'Apple Card',        480, 1),
  ('financial_institution', 'Costco Anywhere',   'Costco Anywhere',   490, 1),
  ('financial_institution', 'Target RedCard',    'Target RedCard',    500, 1),
  ('financial_institution', 'Walmart',           'Walmart',           510, 1);
