-- Migration 072: Add reimbursement_id back-reference to hsa_payments
-- When a reimbursement batch is created, this FK is populated so you can
-- query "which reimbursement covered this expense"
ALTER TABLE hsa_payments ADD COLUMN reimbursement_id INTEGER REFERENCES hsa_reimbursements(id);
ALTER TABLE hsa_otc      ADD COLUMN reimbursement_id INTEGER REFERENCES hsa_reimbursements(id);
