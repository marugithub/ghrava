// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 133 — extend fsa_plan_info with HSA-specific fields
//                  (v202604.168)
//
// Adds 8 columns to fsa_plan_info so it can hold HSA plan data without
// loss. These columns mirror what hsa_plan_info has but fsa_plan_info
// didn't.
//
// Additive only, idempotent, transaction-wrapped.
// Companion mig 134 copies hsa_plan_info rows into fsa_plan_info.
// Companion mig 135 renames hsa_plan_info to mark it deprecated.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate133(db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql};`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };

  const tx = db.transaction(() => {
    // HSA-specific fields (deductible / OOP / IRS limits / effective date)
    addCol('fsa_plan_info', 'insurance_carrier TEXT');
    addCol('fsa_plan_info', 'individual_deductible REAL DEFAULT 0');
    addCol('fsa_plan_info', 'family_deductible REAL DEFAULT 0');
    addCol('fsa_plan_info', 'individual_oop_max REAL DEFAULT 0');
    addCol('fsa_plan_info', 'family_oop_max REAL DEFAULT 0');
    addCol('fsa_plan_info', 'irs_limit_self_only REAL DEFAULT 0');
    addCol('fsa_plan_info', 'irs_limit_family REAL DEFAULT 0');
    addCol('fsa_plan_info', 'plan_effective_date DATE');

    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_fsa_plan_extension_done (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes       TEXT
      )
    `);
    db.exec(`INSERT INTO _migrations_fsa_plan_extension_done (notes) VALUES ('v202604.168 — fsa_plan_info +8 HSA-specific cols')`);
  });
  tx();
};
