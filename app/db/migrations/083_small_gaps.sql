-- Migration 083: Small gap fixes
-- C9: hsa_payments.reimbursement_id back-reference
-- B10 extension: hsa_payments.family_member_id
-- finance_accounts.contact_id (link bank to contact)

BEGIN;

-- hsa_payments family member linking
ALTER TABLE hsa_payments ADD COLUMN family_member_id INTEGER;

-- finance_accounts — link to a contact (e.g. bank contact)
ALTER TABLE finance_accounts ADD COLUMN contact_id INTEGER;

COMMIT;
