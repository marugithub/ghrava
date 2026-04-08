-- Migration 085: Standardize all free-text person/org fields to FK references
-- Rule: text columns kept for display fallback on existing records.
--       New records write FK only. Display: FK name if set, else text fallback.

BEGIN;

-- ── med_medications ──────────────────────────────────────────

-- ── med_conditions ───────────────────────────────────────────

-- ── med_visit_notes ──────────────────────────────────────────

-- ── med_eob_claims ───────────────────────────────────────────

-- ── med_eob_statements ───────────────────────────────────────

-- ── hsa_payments ─────────────────────────────────────────────
-- family_member_id already in migration 083 — skip

-- ── hsa_otc ──────────────────────────────────────────────────

-- ── vehicles ─────────────────────────────────────────────────

-- ── career_jobs ──────────────────────────────────────────────

-- ── finance_accounts ─────────────────────────────────────────

-- ── financial_accounts (investment) ──────────────────────────

-- ── item_maintenance_log ─────────────────────────────────────

COMMIT;
