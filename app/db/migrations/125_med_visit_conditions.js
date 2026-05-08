// Migration 125 — visit ↔ condition junction (v202604.149)
//
// Purpose:
//   A medical visit is often "for" one or more conditions
//   (e.g. an internist visit for hypertension + cholesterol). The
//   visit card preview shows these as tag chips on the card. To
//   support that we need a many-to-many junction table and a way for
//   the form to capture the link.
//
//   Mirrors the existing `med_medication_conditions` junction:
//   - composite primary key (visit_id, condition_id)
//   - no foreign keys (per architecture rule: never CASCADE)
//   - additive only
//
// Idempotent. Old visits without links render with no chips, same
// as before; new visits gain a "Linked conditions" multi-select.

module.exports = function (db) {
  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS med_visit_conditions (
        visit_id     INTEGER NOT NULL,
        condition_id INTEGER NOT NULL,
        PRIMARY KEY (visit_id, condition_id)
      );
    `);
    // Lookup index so the visit-card render path can fetch all
    // conditions for a visit in one shot.
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_med_visit_conditions_visit
               ON med_visit_conditions(visit_id);`);
    } catch (e) {}
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_med_visit_conditions_cond
               ON med_visit_conditions(condition_id);`);
    } catch (e) {}
  });
  tx();
};
