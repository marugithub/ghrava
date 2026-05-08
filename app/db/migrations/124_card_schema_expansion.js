// Migration 124 — card-driven schema expansion
//
// One additive migration covers all four card types (Med / Cond / Visit / EOB)
// plus the universal dedup + needs-review pipeline.
//
// ─── A. Visit fields ─────────────────────────────────────────
// med_visit_notes is currently a "questions/notes" record. The Visit card
// needs structured time, location, type, vitals, and a contact-FK
// physician (matching how meds and conditions resolve their physician).
//
// ─── B. EOB dedup + import provenance ────────────────────────
// med_eob_statements + claims gain file_hash and dedup_hash so the
// watcher can silent-skip identical files and the ingest layer can
// route record-level collisions to needs-review.
//
// ─── C. Medication dose change history ───────────────────────
// New table med_medication_dose_changes — one row per dosage change.
// Card eyebrow shows "Dose changed Apr 2026" when the latest is recent.
// Reactivate flow writes here when the user accepts a different dose.
//
// ─── D. Condition time-series metrics ────────────────────────
// New table med_condition_metrics — per-reading rows (BP, A1C, LDL, etc.)
// Drives the sparkline + hero number on the Condition card.
// Note: Conditions can have ONE current reading per metric per day
//       (UNIQUE(condition_id, metric_name, measured_on)) — no double-entry,
//       updates overwrite. Multiple metrics per condition are allowed
//       (BP and pulse on the same condition row, for example).
//
// ─── E. Pending review queue ─────────────────────────────────
// Universal queue that the dedup gate, parser, and reactivate flow all
// write to. Each row carries a JSON payload + reason + proposed_action.
// Auto-creates a Todo when source != 'manual' (so the user sees an alert
// in the existing alerts pipeline, not just a buried admin page).
//
// ─── F. Dedup hashes on existing tables ──────────────────────
// med_medications, med_conditions, med_visit_notes get dedup_hash
// columns + indexes. The hash is computed from the natural key
// (patient + name + dosage for meds; patient + name for conditions;
//  patient + provider + date + start_time for visits) at write time.
//
// All additive. Idempotent. Safe to re-run. No CASCADE anywhere.
// Field mappings logged here for UPGRADE_NOTES.md (kept in sync separately).

module.exports = function (db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql}`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };
  const tableExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const indexExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(name);

  const tx = db.transaction(() => {

    // ── A. Visit fields ─────────────────────────────────────
    addCol('med_visit_notes', 'start_time            TEXT');
    addCol('med_visit_notes', 'duration_min          INTEGER');
    addCol('med_visit_notes', 'visit_location        TEXT');
    addCol('med_visit_notes', 'visit_type            TEXT');
    addCol('med_visit_notes', 'physician_contact_id  INTEGER REFERENCES contacts(id) ON DELETE SET NULL');
    // Vitals — a small fixed set on the visit row itself. Avoids a
    // child table for the common case (one BP per visit). Repeat readings
    // within a visit go to med_condition_metrics keyed to the relevant
    // condition; visit-level vitals are the snapshot taken at check-in.
    addCol('med_visit_notes', 'bp_systolic           INTEGER');
    addCol('med_visit_notes', 'bp_diastolic          INTEGER');
    addCol('med_visit_notes', 'weight_lb             REAL');
    addCol('med_visit_notes', 'temperature_f         REAL');
    addCol('med_visit_notes', 'heart_rate_bpm        INTEGER');
    addCol('med_visit_notes', 'visit_cost_oop        REAL');
    addCol('med_visit_notes', 'reason                TEXT');

    // ── B. EOB import provenance ────────────────────────────
    addCol('med_eob_statements', 'file_hash      TEXT');
    addCol('med_eob_statements', 'dedup_hash     TEXT');
    addCol('med_eob_statements', 'auto_imported  INTEGER DEFAULT 0');
    addCol('med_eob_claims',     'dedup_hash     TEXT');

    // ── F. Dedup hashes on the three other domains ──────────
    addCol('med_medications',    'dedup_hash     TEXT');
    addCol('med_conditions',     'dedup_hash     TEXT');
    addCol('med_visit_notes',    'dedup_hash     TEXT');

    // ── C. Dose changes ─────────────────────────────────────
    if (!tableExists('med_medication_dose_changes')) {
      db.exec(`
        CREATE TABLE med_medication_dose_changes (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          medication_id   INTEGER NOT NULL REFERENCES med_medications(id),
          old_dosage      TEXT,
          new_dosage      TEXT,
          changed_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
          changed_by      TEXT DEFAULT 'manual',
          notes           TEXT
        )
      `);
    }
    if (!indexExists('idx_dose_changes_med')) {
      db.exec(`CREATE INDEX idx_dose_changes_med ON med_medication_dose_changes(medication_id, changed_at DESC)`);
    }

    // ── D. Condition metrics ────────────────────────────────
    if (!tableExists('med_condition_metrics')) {
      db.exec(`
        CREATE TABLE med_condition_metrics (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          condition_id    INTEGER NOT NULL REFERENCES med_conditions(id),
          metric_name     TEXT NOT NULL,
          value_numeric   REAL,
          value_text      TEXT,
          unit            TEXT,
          measured_on     DATE NOT NULL,
          measured_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
          source          TEXT DEFAULT 'manual',
          source_visit_id INTEGER REFERENCES med_visit_notes(id),
          notes           TEXT
        )
      `);
    }
    if (!indexExists('idx_cond_metrics_lookup')) {
      db.exec(`CREATE INDEX idx_cond_metrics_lookup ON med_condition_metrics(condition_id, metric_name, measured_on DESC)`);
    }
    if (!indexExists('idx_cond_metrics_unique')) {
      db.exec(`CREATE UNIQUE INDEX idx_cond_metrics_unique ON med_condition_metrics(condition_id, metric_name, measured_on)`);
    }

    // ── E. Pending review queue ─────────────────────────────
    if (!tableExists('med_pending_review')) {
      db.exec(`
        CREATE TABLE med_pending_review (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          source          TEXT NOT NULL,
          entity_type     TEXT NOT NULL,
          proposed_action TEXT NOT NULL,
          payload         TEXT NOT NULL,
          existing_id     INTEGER,
          dedup_hash      TEXT,
          file_hash       TEXT,
          reason          TEXT,
          status          TEXT DEFAULT 'open',
          created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at     DATETIME,
          resolution      TEXT,
          todo_id         INTEGER
        )
      `);
    }
    if (!indexExists('idx_pending_review_open')) {
      db.exec(`CREATE INDEX idx_pending_review_open ON med_pending_review(status, created_at DESC)`);
    }
    if (!indexExists('idx_pending_review_entity')) {
      db.exec(`CREATE INDEX idx_pending_review_entity ON med_pending_review(entity_type, existing_id)`);
    }

    // ── G. Indexes for the dedup hashes we just added ───────
    if (!indexExists('idx_med_med_dedup')) {
      db.exec(`CREATE INDEX idx_med_med_dedup ON med_medications(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }
    if (!indexExists('idx_med_cond_dedup')) {
      db.exec(`CREATE INDEX idx_med_cond_dedup ON med_conditions(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }
    if (!indexExists('idx_med_visit_dedup')) {
      db.exec(`CREATE INDEX idx_med_visit_dedup ON med_visit_notes(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }
    if (!indexExists('idx_med_eob_filehash')) {
      db.exec(`CREATE INDEX idx_med_eob_filehash ON med_eob_statements(file_hash) WHERE file_hash IS NOT NULL`);
    }
    if (!indexExists('idx_med_eob_dedup')) {
      db.exec(`CREATE INDEX idx_med_eob_dedup ON med_eob_statements(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }
    if (!indexExists('idx_med_eob_claim_dedup')) {
      db.exec(`CREATE INDEX idx_med_eob_claim_dedup ON med_eob_claims(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }
  });

  tx();
};
