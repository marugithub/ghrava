-- Migration 086: Add columns that are genuinely missing from live DB

ALTER TABLE med_medications ADD COLUMN family_member_id      INTEGER;
ALTER TABLE med_medications ADD COLUMN pharmacy_contact_id   INTEGER;
ALTER TABLE med_medications ADD COLUMN condition_id          INTEGER;
ALTER TABLE med_medications ADD COLUMN rx_number             TEXT;
ALTER TABLE med_medications ADD COLUMN refills_remaining     INTEGER;
ALTER TABLE med_medications ADD COLUMN next_refill_date      TEXT;
ALTER TABLE med_medications ADD COLUMN controlled_schedule   TEXT;

ALTER TABLE med_conditions  ADD COLUMN family_member_id      INTEGER;
ALTER TABLE med_visit_notes ADD COLUMN family_member_id      INTEGER;

ALTER TABLE med_eob_claims  ADD COLUMN family_member_id      INTEGER;
ALTER TABLE med_eob_claims  ADD COLUMN provider_contact_id   INTEGER;
ALTER TABLE med_eob_statements ADD COLUMN insurer_contact_id INTEGER;

ALTER TABLE hsa_payments    ADD COLUMN provider_contact_id   INTEGER;
ALTER TABLE hsa_otc         ADD COLUMN store_contact_id      INTEGER;

ALTER TABLE kids            ADD COLUMN teacher_contact_id    INTEGER;

ALTER TABLE finance_accounts    ADD COLUMN institution_contact_id INTEGER;
ALTER TABLE financial_accounts  ADD COLUMN institution_contact_id INTEGER;

ALTER TABLE item_maintenance_log ADD COLUMN provider_contact_id INTEGER;
