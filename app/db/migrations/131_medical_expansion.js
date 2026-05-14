// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 131 — medical schema expansion (v202604.166)
//
// Adds the schema needed to land the health_seed.json data (14
// medications + 14 conditions + 26 labs + 8 vitals + 7 diagnostics + 1
// allergy + 6 care team) into the existing med_* tables WITHOUT
// duplicating data — uses the family_members + contacts + med_* tables
// the rest of the app already speaks.
//
// Also captures the EOB fields that 054–057 didn't (NPI, ICD-10, place
// of service, modifiers, claim status, denial codes, prior-auth ref,
// appeal deadline, hsa_eligible) — for non-display purposes (matching,
// appeals, audit).
//
// All changes ADDITIVE. No DROP. No CASCADE. Idempotent on retry. The
// addCol helper swallows "duplicate column" errors so a partial first
// run + clean second run is safe.
//
// AFTER THIS MIGRATION runs, the new endpoint POST /api/v1/medical/
// bulk-seed can accept the health_seed.json shape and insert into the
// expanded tables. See app/features/medical/seed-routes.js.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate131(db) {
  const addCol = (table, sql) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql};`); }
    catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  };
  const tableExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const indexExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(name);

  const tx = db.transaction(() => {

    // ──────────────────────────────────────────────────────────────
    // A. contacts — expose care-team-specific fields
    // ──────────────────────────────────────────────────────────────
    // The flat contacts table (type='medical_provider') is the canonical
    // care-team store. These 6 columns let us capture everything the
    // seed JSON's care_team array carries.
    addCol('contacts', 'credentials       TEXT');        // MD, CRNP, PA-C, NP
    addCol('contacts', 'manages           TEXT');        // free text: what they manage
    addCol('contacts', 'is_primary_pcp    INTEGER DEFAULT 0');
    addCol('contacts', 'portal_url        TEXT');
    addCol('contacts', 'fax               TEXT');
    addCol('contacts', 'npi               TEXT');        // National Provider Identifier (10-digit)

    // ──────────────────────────────────────────────────────────────
    // B. med_conditions — clinical detail beyond name/status/notes
    // ──────────────────────────────────────────────────────────────
    addCol('med_conditions', 'icd10_code     TEXT');     // e.g. I25.1
    addCol('med_conditions', 'severity       TEXT');     // Mild | Moderate | Severe
    addCol('med_conditions', 'source_system  TEXT');     // Ascension Alabama, Samsung Health, manual

    // ──────────────────────────────────────────────────────────────
    // C. med_medications — fields the spec adds beyond what we have
    // ──────────────────────────────────────────────────────────────
    addCol('med_medications', 'dose_unit                  TEXT');   // mg, mcg, mL, IU
    addCol('med_medications', 'route                      TEXT');   // oral, topical, IM, IV
    addCol('med_medications', 'ndc                        TEXT');   // National Drug Code
    addCol('med_medications', 'mail_order                 INTEGER DEFAULT 0');
    addCol('med_medications', 'quantity_total_prescribed  INTEGER'); // total pills/units prescribed
    addCol('med_medications', 'rx_date                    DATE');    // date Rx was written
    addCol('med_medications', 'source_system              TEXT');    // provenance

    // ──────────────────────────────────────────────────────────────
    // D. EOB capture fields — NOT for display, FOR matching/appeals/audit
    // ──────────────────────────────────────────────────────────────
    // Claim level
    addCol('med_eob_claims',   'provider_npi          TEXT');
    addCol('med_eob_claims',   'diagnosis_codes       TEXT');     // JSON array of ICD-10
    addCol('med_eob_claims',   'place_of_service      TEXT');     // POS code (11=office, 22=hospital, 81=lab)
    addCol('med_eob_claims',   'claim_status          TEXT');     // paid|denied|pending|appealed|partial
    addCol('med_eob_claims',   'denial_reason_codes   TEXT');     // JSON array of CARC codes
    addCol('med_eob_claims',   'prior_auth_ref        TEXT');
    addCol('med_eob_claims',   'appeal_deadline       DATE');
    // Service level
    addCol('med_eob_services', 'cpt_modifiers         TEXT');     // JSON array of modifiers (25, 59, etc.)
    addCol('med_eob_services', 'hsa_eligible          INTEGER DEFAULT 1');

    // ──────────────────────────────────────────────────────────────
    // E. NEW TABLE — med_lab_results
    // ──────────────────────────────────────────────────────────────
    // The 26 labs in the seed don't fit visits or condition_metrics
    // naturally — labs have their own reference ranges, panel groupings,
    // and flag (normal/high/low/critical). Standalone time-series.
    if (!tableExists('med_lab_results')) {
      db.exec(`
        CREATE TABLE med_lab_results (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          family_member_id   INTEGER REFERENCES family_members(id),
          patient            TEXT,                  -- fallback name when fm_id null
          panel_name         TEXT,                  -- e.g. "Lipid Panel", "CBC"
          test_name          TEXT NOT NULL,         -- e.g. "Total Cholesterol", "Hemoglobin A1c"
          test_date          DATE NOT NULL,
          value_numeric      REAL,
          value_text         TEXT,                  -- for non-numeric (e.g. "Negative")
          unit               TEXT,
          reference_low      REAL,
          reference_high     REAL,
          reference_text     TEXT,                  -- when range is non-numeric
          flag               TEXT,                  -- normal | low | high | critical | abnormal
          ordering_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
          source_system      TEXT,
          source_visit_id    INTEGER REFERENCES med_visit_notes(id) ON DELETE SET NULL,
          notes              TEXT,
          dedup_hash         TEXT,
          created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`CREATE INDEX idx_lab_family   ON med_lab_results(family_member_id, test_date DESC)`);
      db.exec(`CREATE INDEX idx_lab_test     ON med_lab_results(test_name, test_date DESC)`);
      db.exec(`CREATE INDEX idx_lab_panel    ON med_lab_results(panel_name, test_date DESC)`);
      db.exec(`CREATE UNIQUE INDEX idx_lab_dedup ON med_lab_results(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }

    // ──────────────────────────────────────────────────────────────
    // F. NEW TABLE — med_diagnostics
    // ──────────────────────────────────────────────────────────────
    // EKG, MRI, echo, stress test, colonoscopy results — diagnostic
    // tests without a numeric value (interpretation/impression text).
    if (!tableExists('med_diagnostics')) {
      db.exec(`
        CREATE TABLE med_diagnostics (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          family_member_id   INTEGER REFERENCES family_members(id),
          patient            TEXT,
          test_name          TEXT NOT NULL,         -- "Routine EKG (12-lead)", "Echocardiogram"
          test_type          TEXT,                  -- cardiac | imaging | endoscopy | other
          test_date          DATE,                  -- nullable: pending/recommended tests have no date yet
          status             TEXT DEFAULT 'final',  -- pending | preliminary | final | amended
          impression         TEXT,                  -- doctor's interpretation
          ordering_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
          performing_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
          facility           TEXT,
          source_system      TEXT,
          source_visit_id    INTEGER REFERENCES med_visit_notes(id) ON DELETE SET NULL,
          notes              TEXT,
          dedup_hash         TEXT,
          created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`CREATE INDEX idx_diag_family ON med_diagnostics(family_member_id, test_date DESC)`);
      db.exec(`CREATE INDEX idx_diag_type   ON med_diagnostics(test_type, test_date DESC)`);
      db.exec(`CREATE UNIQUE INDEX idx_diag_dedup ON med_diagnostics(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }

    // ──────────────────────────────────────────────────────────────
    // G. NEW TABLE — med_allergies
    // ──────────────────────────────────────────────────────────────
    // Universal medical field. Even "No Known Drug Allergy" is a
    // record. Severity drives display priority (alerts on med form).
    if (!tableExists('med_allergies')) {
      db.exec(`
        CREATE TABLE med_allergies (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          family_member_id   INTEGER REFERENCES family_members(id),
          patient            TEXT,
          allergen           TEXT NOT NULL,         -- "Penicillin", "Latex", "Peanuts", "NKDA"
          allergen_type      TEXT,                  -- drug | food | environmental | other
          reaction           TEXT,                  -- "hives", "anaphylaxis", "rash"
          severity           TEXT,                  -- mild | moderate | severe | life-threatening
          status             TEXT DEFAULT 'Active', -- Active | Resolved | Historical
          noted_date         DATE,
          source_system      TEXT,
          notes              TEXT,
          dedup_hash         TEXT,
          created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`CREATE INDEX idx_allergy_family ON med_allergies(family_member_id, status)`);
      db.exec(`CREATE UNIQUE INDEX idx_allergy_dedup ON med_allergies(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }

    // ──────────────────────────────────────────────────────────────
    // H. NEW TABLE — med_vitals_readings
    // ──────────────────────────────────────────────────────────────
    // Standalone vitals readings (Samsung Health, home BP cuff, scale).
    // For visit-time readings, med_visit_notes already has the columns
    // (bp_systolic, weight_lb, heart_rate_bpm, temperature_f).
    if (!tableExists('med_vitals_readings')) {
      db.exec(`
        CREATE TABLE med_vitals_readings (
          id                 INTEGER PRIMARY KEY AUTOINCREMENT,
          family_member_id   INTEGER REFERENCES family_members(id),
          patient            TEXT,
          measure_date       DATE NOT NULL,
          measure_time       TIME,
          systolic_bp        INTEGER,
          diastolic_bp       INTEGER,
          heart_rate         INTEGER,
          weight_lbs         REAL,
          height_in          REAL,
          bmi                REAL,
          temperature_f      REAL,
          o2_sat             INTEGER,
          respiratory_rate   INTEGER,
          blood_glucose      REAL,
          source_system      TEXT,                  -- "Samsung Health", "manual", "Ascension Alabama"
          source_visit_id    INTEGER REFERENCES med_visit_notes(id) ON DELETE SET NULL,
          notes              TEXT,
          dedup_hash         TEXT,
          created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`CREATE INDEX idx_vitals_family ON med_vitals_readings(family_member_id, measure_date DESC)`);
      db.exec(`CREATE INDEX idx_vitals_source ON med_vitals_readings(source_system, measure_date DESC)`);
      db.exec(`CREATE UNIQUE INDEX idx_vitals_dedup ON med_vitals_readings(dedup_hash) WHERE dedup_hash IS NOT NULL`);
    }

    // ──────────────────────────────────────────────────────────────
    // I. Marker
    // ──────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_medical_expansion_done (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes       TEXT
      )
    `);
    db.exec(`INSERT INTO _migrations_medical_expansion_done (notes) VALUES ('v202604.166 — contacts +6 / med_conditions +3 / med_medications +7 / med_eob_claims +7 / med_eob_services +2 / med_lab_results NEW / med_diagnostics NEW / med_allergies NEW / med_vitals_readings NEW')`);
  });

  tx();
};
