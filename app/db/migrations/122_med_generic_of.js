// Migration 122 — additive: med_medications.generic_of TEXT
//
// When the prescribed medication is a generic (e.g. "Atorvastatin"),
// store the recognizable brand-name equivalent (e.g. "Lipitor") so the
// card renders "Generic of Lipitor" under the hero name. NULL when the
// bottle already shows the brand name (no subline).
//
// Additive only. Idempotent. Safe to re-run.

module.exports = function (db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql}`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };

  const tx = db.transaction(() => {
    addCol('med_medications', 'generic_of TEXT');
  });

  tx();
};
