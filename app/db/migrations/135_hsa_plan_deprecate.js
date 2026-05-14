// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 135 — rename hsa_plan_info → hsa_plan_info_DEPRECATED_v167
//                  (v202604.168)
//
// After mig 134 copied all rows into fsa_plan_info, this rename ensures
// no future code accidentally reads from the old table. Data is
// preserved in the renamed table as a safety net.
//
// To drop the deprecated table entirely once you're confident the
// migration is solid, run (manually, not as a migration):
//   DROP TABLE hsa_plan_info_DEPRECATED_v167;
//
// Companion migs 133 + 134 must run first.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate135(db) {
  const tx = db.transaction(() => {
    const hasOld = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='hsa_plan_info'"
    ).get();
    if (!hasOld) {
      // Already renamed in a prior run.
      db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations_hsa_plan_renamed_done (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT
        )
      `);
      db.exec(`INSERT INTO _migrations_hsa_plan_renamed_done (notes) VALUES ('v202604.168 — hsa_plan_info already renamed; skipped')`);
      return;
    }

    db.exec(`ALTER TABLE hsa_plan_info RENAME TO hsa_plan_info_DEPRECATED_v167`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_hsa_plan_renamed_done (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT
      )
    `);
    db.exec(`INSERT INTO _migrations_hsa_plan_renamed_done (notes) VALUES ('v202604.168 — renamed hsa_plan_info → hsa_plan_info_DEPRECATED_v167 to prevent future reads')`);
  });
  tx();
};
