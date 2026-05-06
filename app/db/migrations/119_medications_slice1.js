// Migration 119 — Slice 1: Medications schema additions
// =====================================================
// Locked decisions from chat 2026-05-06:
//   1. Multi-condition: junction table med_medication_conditions
//      (deprecates the singular condition_id column over time, but doesn't drop it)
//   2. HSA <-> entity link: polymorphic hsa_payment_links
//      (entity_type + entity_id pattern, same shape as record_family_members)
//   3. Fill history: new table med_medication_fills
//   4. New columns on med_medications: brand_name, generic_name, form,
//      drug_class, take_with_food, time_of_day, interaction_warning
//   5. Backfill family_member_id from patient TEXT where display_name matches
//
// Safety:
//   - Pure additive. No DROP TABLE, no DELETE, no destructive changes.
//   - addCol() is idempotent — re-running this migration is safe.
//   - JS migration (not .sql) so try/catch handles partial-run states.
//   - No ON DELETE CASCADE anywhere (per project rules).

module.exports = function slice1Medications(db) {
  // Helper: idempotent column add. Survives "duplicate column" if a partial
  // earlier run already added it. Anything else throws.
  function addCol(table, column, type) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }

  // ── New columns on med_medications ────────────────────────────────
  addCol('med_medications', 'brand_name',          'TEXT');
  addCol('med_medications', 'generic_name',        'TEXT');
  addCol('med_medications', 'form',                'TEXT');
  addCol('med_medications', 'drug_class',          'TEXT');
  addCol('med_medications', 'take_with_food',      'INTEGER DEFAULT 0');
  addCol('med_medications', 'time_of_day',         'TEXT');
  addCol('med_medications', 'interaction_warning', 'TEXT');

  // ── Multi-condition junction ──────────────────────────────────────
  // Replaces the single condition_id column for cards that need multi.
  // The single column stays — no destructive cleanup.
  db.exec(`
    CREATE TABLE IF NOT EXISTS med_medication_conditions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id INTEGER NOT NULL REFERENCES med_medications(id),
      condition_id  INTEGER NOT NULL REFERENCES med_conditions(id),
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_mmc_med  ON med_medication_conditions(medication_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_mmc_cond ON med_medication_conditions(condition_id)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_mmc_unique ON med_medication_conditions(medication_id, condition_id)`);

  // Backfill the junction from any existing single-condition_id values
  // so existing meds with one condition appear in the new junction without re-entry.
  db.exec(`
    INSERT OR IGNORE INTO med_medication_conditions (medication_id, condition_id)
    SELECT id, condition_id
      FROM med_medications
     WHERE condition_id IS NOT NULL
  `);

  // ── HSA payment links (polymorphic) ───────────────────────────────
  // Same shape as record_family_members. One HSA payment can link to
  // many entities (a med + the visit it was prescribed at + the
  // condition it treats — three rows from one payment).
  db.exec(`
    CREATE TABLE IF NOT EXISTS hsa_payment_links (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      hsa_payment_id  INTEGER NOT NULL REFERENCES hsa_payments(id),
      entity_type     TEXT    NOT NULL,
      entity_id       INTEGER NOT NULL,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hpl_payment ON hsa_payment_links(hsa_payment_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hpl_entity  ON hsa_payment_links(entity_type, entity_id)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_hpl_unique ON hsa_payment_links(hsa_payment_id, entity_type, entity_id)`);

  // ── Medication fill history ───────────────────────────────────────
  // Each refill is a row. last_filled comes from MAX(fill_date) per medication.
  // hsa_payment_id links to the HSA payment this fill was paid from (optional).
  db.exec(`
    CREATE TABLE IF NOT EXISTS med_medication_fills (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      medication_id       INTEGER NOT NULL REFERENCES med_medications(id),
      fill_date           DATE    NOT NULL,
      days_supply         INTEGER,
      pharmacy_contact_id INTEGER REFERENCES contacts(id),
      cost                REAL,
      hsa_payment_id      INTEGER REFERENCES hsa_payments(id),
      notes               TEXT,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_mmf_med  ON med_medication_fills(medication_id, fill_date DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_mmf_date ON med_medication_fills(fill_date)`);

  // ── Backfill family_member_id from patient TEXT ───────────────────
  // Only fills NULL values, never overwrites. Match is case-insensitive
  // on display_name. Rows whose patient text doesn't match any family
  // member stay NULL — that's fine (orphans show in fallback rendering).
  db.exec(`
    UPDATE med_medications
       SET family_member_id = (
         SELECT id FROM family_members
          WHERE LOWER(display_name) = LOWER(med_medications.patient)
          LIMIT 1
       )
     WHERE family_member_id IS NULL
       AND patient IS NOT NULL
       AND patient != ''
  `);
  db.exec(`
    UPDATE med_conditions
       SET family_member_id = (
         SELECT id FROM family_members
          WHERE LOWER(display_name) = LOWER(med_conditions.patient)
          LIMIT 1
       )
     WHERE family_member_id IS NULL
       AND patient IS NOT NULL
       AND patient != ''
  `);
};
