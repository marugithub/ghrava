-- Migration 146: Add tax_treatment to financial_accounts
-- Required for trade terminal portfolio optimisation and tax location advice.
-- Additive only — no existing rows harmed. DEFAULT 'taxable' is safe because
-- brokerage accounts without a specified type are most likely taxable.
-- See TRADE_TERMINAL_INTEGRATION.md for context.

ALTER TABLE financial_accounts
  ADD COLUMN tax_treatment TEXT NOT NULL DEFAULT 'taxable';

-- Note: CHECK constraints cannot be added via ALTER TABLE in SQLite.
-- Valid values enforced at application layer in finance form dropdown.
-- Accepted values: taxable | traditional_ira | roth_ira | tsp | hsa | other

-- Seed dropdown options for the Finance account form
INSERT OR IGNORE INTO dropdown_options (list_key, value, label, sort_order, is_active) VALUES
  ('investment_tax_treatment', 'taxable',          'Taxable (Brokerage)',       10, 1),
  ('investment_tax_treatment', 'traditional_ira',  'Traditional IRA',           20, 1),
  ('investment_tax_treatment', 'roth_ira',         'Roth IRA',                  30, 1),
  ('investment_tax_treatment', 'tsp',              'TSP (Thrift Savings Plan)', 40, 1),
  ('investment_tax_treatment', 'hsa',              'HSA',                       50, 1),
  ('investment_tax_treatment', 'other',            'Other',                     60, 1);
