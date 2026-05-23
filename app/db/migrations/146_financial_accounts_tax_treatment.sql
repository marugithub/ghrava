-- Migration 146: Add tax_treatment to accounts table
-- financial_accounts is a VIEW over accounts (mig 126/130).
-- The column must go on the underlying accounts table.
-- Also update the financial_accounts view to expose it.
-- Additive only. DEFAULT 'taxable' is safe.

ALTER TABLE accounts
  ADD COLUMN tax_treatment TEXT NOT NULL DEFAULT 'taxable';

-- Recreate the financial_accounts view to include tax_treatment
DROP VIEW IF EXISTS financial_accounts;
CREATE VIEW financial_accounts AS
  SELECT id, name AS nickname, institution,
         type AS account_type,
         owner, last4 AS last_four, currency,
         is_active, track_statements, notes,
         tax_treatment,
         created_at, updated_at
  FROM accounts;
