// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 145 — med_procedures table (v202604.181)
//
// Closes the second HIGH-priority Medical schema gap from BACKLOG.md
// ("Medical schema — gaps not in v.166"). Surgeries, colonoscopies,
// mammograms, cardiac catheterizations — one-time scheduled events
// distinct from visits (which are routine appointments) and from
// diagnostics (which are tests with an interpretation, not procedures).
//
// procedure_date is NULLABLE because planned-but-not-yet-scheduled
// procedures exist ("Al needs a colonoscopy this year — date TBD").
// Matches mig 131's med_diagnostics.test_date nullable pattern.
//
// All changes ADDITIVE. No DROP. No CASCADE. Idempotent on retry.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate145(db) {
  const tableExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);

  const tx = db.transaction(() => {

    // ──────────────────────────────────────────────────────────────
    // A. NEW TABLE — med_procedures
    // ──────────────────────────────────────────────────────────────
    // family_member_id NOT NULL: every procedure record is for a
    // specific person. No FK ON DELETE clause — matches mig 131 pattern
    // + DB-NO-CASCADE lock (family_members deletes are explicit).
    // provider_contact_id + related_condition_id get ON DELETE SET NULL
    // so deleting a provider or condition doesn't lose the procedure.
    //
    // Enum-like columns (procedure_type, status) use TEXT without CHECK
    // constraints — matches existing med_* style (med_diagnostics.status,
    // med_allergies.severity, etc.). App layer enforces:
    //   procedure_type: elective | scheduled | emergency
    //   status:         planned  | completed | cancelled  (default: planned)
    if (!tableExists('med_procedures')) {
      db.exec(`
        CREATE TABLE med_procedures (
          id                    INTEGER PRIMARY KEY AUTOINCREMENT,
          family_member_id      INTEGER NOT NULL REFERENCES family_members(id),
          procedure_name        TEXT NOT NULL,            -- "Colonoscopy", "Cardiac catheterization", "Cataract surgery (left eye)"
          procedure_date        DATE,                     -- nullable: planned-but-not-yet-scheduled procedures
          provider_contact_id   INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
          facility_text         TEXT,                     -- "Ascension Alabama, Birmingham" — free text when no facility row
          procedure_type        TEXT,                     -- elective | scheduled | emergency
          status                TEXT DEFAULT 'planned',   -- planned | completed | cancelled
          outcome_notes         TEXT,                     -- post-procedure summary, complications, follow-up
          related_condition_id  INTEGER REFERENCES med_conditions(id) ON DELETE SET NULL,
          created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`CREATE INDEX idx_proc_family    ON med_procedures(family_member_id, procedure_date DESC)`);
      db.exec(`CREATE INDEX idx_proc_status    ON med_procedures(status, procedure_date DESC)`);
      db.exec(`CREATE INDEX idx_proc_condition ON med_procedures(related_condition_id) WHERE related_condition_id IS NOT NULL`);
    }

    // ──────────────────────────────────────────────────────────────
    // B. Marker
    // ──────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_med_procedures_done (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes       TEXT
      )
    `);
    db.exec(`INSERT INTO _migrations_med_procedures_done (notes) VALUES ('v202604.181 — med_procedures NEW (11 cols, 3 indexes)')`);
  });

  tx();
};
