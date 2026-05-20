// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 144 — med_immunizations table (v202604.181)
//
// Closes one of the two HIGH-priority Medical schema gaps logged in
// BACKLOG.md ("Medical schema — gaps not in v.166"): a dedicated table
// for vaccine records — flu, COVID, tetanus boosters, childhood vaccines
// — needed for travel, school, employer requirements. Distinct from
// med_visit_notes (immunizations are often given by a pharmacy without
// a visit note) and from med_medications (one-time administrations, not
// ongoing prescriptions).
//
// All changes ADDITIVE. No DROP. No CASCADE. Idempotent on retry via
// `IF NOT EXISTS` for the table and `tableExists` guard for indexes.
//
// AFTER THIS MIGRATION runs, the new endpoints
//   POST /api/v1/medical/immunizations
//   GET  /api/v1/medical/immunizations
// (see app/features/medical/routes.js) can read/write the table.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate144(db) {
  const tableExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);

  const tx = db.transaction(() => {

    // ──────────────────────────────────────────────────────────────
    // A. NEW TABLE — med_immunizations
    // ──────────────────────────────────────────────────────────────
    // family_member_id is NOT NULL: every vaccine record is for a
    // specific person (per SHARED-FAM lock + v.181 audit default #1).
    // No FK ON DELETE clause on family_member_id — matches mig 131's
    // pattern (REFERENCES without action → SQLite default NO ACTION;
    // family_members deletes are explicit per DB-NO-CASCADE lock).
    // administered_by_contact_id gets ON DELETE SET NULL to match the
    // mig 131 ordering_contact_id / performing_contact_id pattern.
    if (!tableExists('med_immunizations')) {
      db.exec(`
        CREATE TABLE med_immunizations (
          id                            INTEGER PRIMARY KEY AUTOINCREMENT,
          family_member_id              INTEGER NOT NULL REFERENCES family_members(id),
          vaccine_name                  TEXT NOT NULL,            -- "Influenza (quadrivalent)", "COVID-19 (Pfizer bivalent)", "Tdap"
          date_given                    DATE NOT NULL,
          dose_number                   INTEGER,                  -- 1, 2, booster (3+); nullable for single-dose vaccines
          lot_number                    TEXT,                     -- manufacturer lot # for recall tracking
          administered_by_contact_id    INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
          location_text                 TEXT,                     -- "CVS Pharmacy, 1234 Main St" — free text when no contact row
          next_due_date                 DATE,                     -- when the next dose/booster is due
          notes                         TEXT,
          created_at                    DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at                    DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`CREATE INDEX idx_immun_family ON med_immunizations(family_member_id, date_given DESC)`);
      db.exec(`CREATE INDEX idx_immun_name   ON med_immunizations(vaccine_name, date_given DESC)`);
      db.exec(`CREATE INDEX idx_immun_due    ON med_immunizations(next_due_date) WHERE next_due_date IS NOT NULL`);
    }

    // ──────────────────────────────────────────────────────────────
    // B. Marker
    // ──────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_med_immunizations_done (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes       TEXT
      )
    `);
    db.exec(`INSERT INTO _migrations_med_immunizations_done (notes) VALUES ('v202604.181 — med_immunizations NEW (11 cols, 3 indexes)')`);
  });

  tx();
};
