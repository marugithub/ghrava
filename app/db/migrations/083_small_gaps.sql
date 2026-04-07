-- Migration 083: Small gap fixes
-- C9: hsa_payments.reimbursement_id back-reference
-- B10 extension: hsa_payments.family_member_id
-- finance_accounts.contact_id (link bank to contact)

BEGIN;

-- C9: back-reference from payment to its reimbursement batch
ALTER TABLE hsa_payments ADD COLUMN reimbursement_id INTEGER;

-- hsa_payments family member linking
ALTER TABLE hsa_payments ADD COLUMN family_member_id INTEGER;

-- finance_accounts — link to a contact (e.g. bank contact)
ALTER TABLE finance_accounts ADD COLUMN contact_id INTEGER;

-- hsa_otc family member linking (symmetric with hsa_payments)
ALTER TABLE hsa_otc ADD COLUMN family_member_id INTEGER;

COMMIT;
