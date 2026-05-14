// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 134 — copy hsa_plan_info rows into fsa_plan_info
//                  (v202604.168)
//
// Single source of truth for plan info: fsa_plan_info. This migration
// copies existing HSA rows over with plan_type='hsa'.
//
// Idempotent via UNIQUE(year, plan_type). Re-running is safe.
// Companion mig 133 must run first (adds the columns).
// Companion mig 135 renames the old table to mark it deprecated.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate134(db) {
  const tx = db.transaction(() => {
    // Guard: only run if hsa_plan_info still exists (mig 135 hasn't renamed it yet)
    const hasOld = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='hsa_plan_info'"
    ).get();
    if (!hasOld) {
      // Already deprecated/renamed — nothing to do.
      db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations_hsa_to_fsa_copy_done (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `);
      db.exec(`INSERT INTO _migrations_hsa_to_fsa_copy_done (notes) VALUES ('v202604.168 — old hsa_plan_info not present; skipped copy')`);
      return;
    }

    // Copy every hsa_plan_info row into fsa_plan_info with plan_type='hsa'.
    // annual_limit on fsa side gets the HSA family IRS limit if present,
    // else self-only. ON CONFLICT(year, plan_type) skips already-copied rows.
    const result = db.prepare(`
      INSERT OR IGNORE INTO fsa_plan_info (
        year, plan_type, plan_name, custodian, insurance_carrier,
        individual_deductible, family_deductible, individual_oop_max, family_oop_max,
        contributions, employer_contribution,
        irs_limit_self_only, irs_limit_family, plan_effective_date,
        annual_limit, active, notes, created_at
      )
      SELECT
        plan_year, 'hsa', plan_name, custodian, insurance_carrier,
        individual_deductible, family_deductible, individual_oop_max, family_oop_max,
        hsa_contribution_self, hsa_contribution_employer,
        irs_limit_self_only, irs_limit_family, plan_effective_date,
        COALESCE(NULLIF(irs_limit_family, 0), irs_limit_self_only),
        active, notes, created_at
      FROM hsa_plan_info
    `).run();

    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_hsa_to_fsa_copy_done (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        rows_copied INTEGER,
        notes TEXT
      )
    `);
    db.prepare(`INSERT INTO _migrations_hsa_to_fsa_copy_done (rows_copied, notes) VALUES (?, 'v202604.168 — copied hsa_plan_info → fsa_plan_info with plan_type=hsa')`)
      .run(result.changes);
  });
  tx();
};
