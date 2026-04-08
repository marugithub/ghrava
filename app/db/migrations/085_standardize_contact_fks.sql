-- Migration 085: Standardize all free-text person/org fields to FK references
-- Rule: text columns kept for display fallback on existing records.
--       New records write FK only. Display: FK name if set, else text fallback.

BEGIN;

-- ── med_medications ──────────────────────────────────────────
ALTER TABLE med_medications ADD COLUMN family_member_id    INTEGER;
ALTER TABLE med_medications ADD COLUMN pharmacy_contact_id INTEGER;
ALTER TABLE med_medications ADD COLUMN condition_id        INTEGER;
ALTER TABLE med_medications ADD COLUMN rx_number           TEXT;
ALTER TABLE med_medications ADD COLUMN refills_remaining   INTEGER;
ALTER TABLE med_medications ADD COLUMN next_refill_date    TEXT;
ALTER TABLE med_medications ADD COLUMN controlled_schedule TEXT;

-- ── med_conditions ───────────────────────────────────────────
ALTER TABLE med_conditions ADD COLUMN family_member_id INTEGER;

-- ── med_visit_notes ──────────────────────────────────────────
ALTER TABLE med_visit_notes ADD COLUMN family_member_id INTEGER;

-- ── med_eob_claims ───────────────────────────────────────────
ALTER TABLE med_eob_claims ADD COLUMN family_member_id    INTEGER;
ALTER TABLE med_eob_claims ADD COLUMN provider_contact_id INTEGER;

-- ── med_eob_statements ───────────────────────────────────────
ALTER TABLE med_eob_statements ADD COLUMN insurer_contact_id INTEGER;

-- ── hsa_payments ─────────────────────────────────────────────
-- family_member_id already in migration 083 — skip
ALTER TABLE hsa_payments ADD COLUMN provider_contact_id INTEGER;

-- ── hsa_otc ──────────────────────────────────────────────────
ALTER TABLE hsa_otc ADD COLUMN store_contact_id INTEGER;

-- ── vehicles ─────────────────────────────────────────────────
ALTER TABLE vehicles ADD COLUMN loan_lender_contact_id  INTEGER;
ALTER TABLE vehicles ADD COLUMN insurance_contact_id    INTEGER;

-- ── career_jobs ──────────────────────────────────────────────
ALTER TABLE career_jobs ADD COLUMN employer_contact_id INTEGER;

-- ── finance_accounts ─────────────────────────────────────────
ALTER TABLE finance_accounts ADD COLUMN institution_contact_id INTEGER;

-- ── financial_accounts (investment) ──────────────────────────
ALTER TABLE financial_accounts ADD COLUMN institution_contact_id INTEGER;

-- ── item_maintenance_log ─────────────────────────────────────
ALTER TABLE item_maintenance_log ADD COLUMN provider_contact_id INTEGER;

COMMIT;
