-- Migration 053: fix broken ${t} account type stored when dropdown was broken
-- Also normalise any blank types to 'Checking'
UPDATE finance_accounts
   SET type = 'Checking'
 WHERE type = '${t}' OR type = '' OR type IS NULL;
