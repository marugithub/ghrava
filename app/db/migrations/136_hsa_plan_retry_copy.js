// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 136 — retry HSA→FSA copy after v.168 silent fail (v202604.168.1)
//
// Mig 134 (v.168) had two bugs:
//   1. It SELECTed `created_at` from hsa_plan_info — but the prod table
//      never had that column (only `updated_at`). The INSERT silently
//      failed inside the transaction and rolled back, reporting 0 rows.
//   2. By the time mig 134 ran, mig 135 had already renamed the table
//      to hsa_plan_info_DEPRECATED_v167 — but the guard checked the old
//      name and bailed out anyway.
//
// This migration redoes the copy correctly: reads from the renamed
// table, omits created_at so DEFAULT applies, idempotent via
// UNIQUE(year, plan_type).
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate136(db) {
  const tx = db.transaction(() => {
    const hasSource = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='hsa_plan_info_DEPRECATED_v167'"
    ).get();

    let copied = 0;
    if (hasSource) {
      const result = db.prepare(`
        INSERT OR IGNORE INTO fsa_plan_info (
          year, plan_type, plan_name, custodian, insurance_carrier,
          individual_deductible, family_deductible, individual_oop_max, family_oop_max,
          contributions, employer_contribution,
          irs_limit_self_only, irs_limit_family, plan_effective_date,
          annual_limit, active, notes
        )
        SELECT
          plan_year, 'hsa', plan_name, custodian, insurance_carrier,
          individual_deductible, family_deductible, individual_oop_max, family_oop_max,
          hsa_contribution_self, hsa_contribution_employer,
          irs_limit_self_only, irs_limit_family, plan_effective_date,
          COALESCE(NULLIF(irs_limit_family, 0), irs_limit_self_only),
          active, notes
        FROM hsa_plan_info_DEPRECATED_v167
      `).run();
      copied = result.changes;
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_hsa_to_fsa_retry_done (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        rows_copied INTEGER,
        notes TEXT
      )
    `);
    db.prepare(
      `INSERT INTO _migrations_hsa_to_fsa_retry_done (rows_copied, notes) VALUES (?, 'v202604.168.1 — retry copy after silent-fail bugfix')`
    ).run(copied);
  });
  tx();
};
