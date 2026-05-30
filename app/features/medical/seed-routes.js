// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// features/medical/seed-routes.js  —  v202604.166
//
// POST /api/v1/medical/bulk-seed
//
// Accepts the health_seed.json shape (top-level keys: patient,
// care_team, conditions, medications, labs, vitals, diagnostics,
// allergies) and maps each section into Ghrava's existing tables,
// NOT into parallel health_* tables.
//
// Idempotent. Every row is dedup'd by a deterministic hash so re-
// running the same seed produces zero new rows.
//
// Patient mapping: by display_name → family_members.id (or accept
// family_member_id explicitly). Spec is single-patient; this endpoint
// supports any of Algir / Zarna / Arnav / Risha — call once per
// member with their own JSON.
//
// Returns: per-section counts {inserted, skipped, mapped_family_id}.
// ─────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');
const crypto = require('crypto');

function hashKey(parts) {
  return crypto.createHash('sha256')
    .update(parts.map(p => String(p == null ? '' : p).toLowerCase().trim()).join('|'))
    .digest('hex').slice(0, 16);
}

function resolveFamilyMember(seed) {
  // 1. explicit family_member_id wins
  if (seed.family_member_id) {
    const row = db.prepare(`SELECT id, display_name FROM family_members WHERE id = ?`).get(seed.family_member_id);
    if (row) return row;
  }
  // 2. patient.name match (case-insensitive, last-name fallback)
  const name = (seed.patient && seed.patient.name) || seed.patient_name || null;
  if (!name) return null;
  let row = db.prepare(`SELECT id, display_name FROM family_members WHERE LOWER(display_name) = LOWER(?)`).get(name);
  if (row) return row;
  // Try first-word match (e.g. "Algir Soni" → "Algir")
  const firstWord = name.split(/\s+/)[0];
  if (firstWord) {
    row = db.prepare(`SELECT id, display_name FROM family_members WHERE LOWER(display_name) = LOWER(?)`).get(firstWord);
    if (row) return row;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Per-section importers. Each returns {inserted, skipped}.
// All run inside a single transaction in the route handler.
// ─────────────────────────────────────────────────────────────────────

function importCareTeam(rows, fmId, patient) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0, skipped = 0;
  // contacts schema (verified against mig 001 + mig 010 + mig 131):
  //   contact_type (NOT 'type'), name, company (NOT 'practice_name'),
  //   phone_primary (NOT 'phone'), email, address, specialty,
  //   credentials, manages, is_primary_pcp, portal_url, fax, npi
  // Medical providers use contact_type='Medical' (capitalized).
  const findContact = db.prepare(`
    SELECT id FROM contacts
    WHERE LOWER(name) = LOWER(?)
      AND COALESCE(LOWER(company), '') = COALESCE(LOWER(?), '')
    LIMIT 1
  `);
  const insertContact = db.prepare(`
    INSERT INTO contacts (
      name, contact_type, specialty, company, address, phone_primary, fax,
      credentials, manages, is_primary_pcp, portal_url, npi,
      created_at, updated_at
    ) VALUES (?, 'Medical', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  for (const r of rows) {
    if (!r || !r.name) { skipped++; continue; }
    const existing = findContact.get(r.name, r.practice || null);
    if (existing) { skipped++; continue; }
    insertContact.run(
      r.name,
      r.role || r.specialty || null,
      r.practice || null,
      r.address || null,
      r.phone || null,
      r.fax || null,
      r.credentials || null,
      r.manages || null,
      r.is_primary ? 1 : 0,
      r.portal_url || null,
      r.npi || null,
    );
    inserted++;
  }
  return { inserted, skipped };
}

function importConditions(rows, fmId, patient) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0, skipped = 0;
  const findByHash = db.prepare(`SELECT id FROM med_conditions WHERE dedup_hash = ?`);
  const insertCond = db.prepare(`
    INSERT INTO med_conditions (
      family_member_id, patient, condition_name, status, start_date,
      icd10_code, severity, source_system, notes, dedup_hash,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  for (const r of rows) {
    if (!r || !r.name) { skipped++; continue; }
    const hash = hashKey([fmId, r.name]);
    if (findByHash.get(hash)) { skipped++; continue; }
    insertCond.run(
      fmId,
      patient,
      r.name,
      r.status || 'Active',
      r.first_noted || r.start_date || null,
      r.icd10_code || null,
      r.severity || null,
      r.source_system || null,
      r.notes || null,
      hash,
    );
    inserted++;
  }
  return { inserted, skipped };
}

function importMedications(rows, fmId, patient) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0, skipped = 0;
  const findByHash = db.prepare(`SELECT id FROM med_medications WHERE dedup_hash = ?`);
  const insertMed = db.prepare(`
    INSERT INTO med_medications (
      family_member_id, patient, name, brand_name, generic_name,
      dosage, dose_unit, route, frequency, status, rx_date,
      ndc, mail_order, quantity_total_prescribed, purpose, notes,
      source_system, dedup_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  for (const r of rows) {
    if (!r || !r.name) { skipped++; continue; }
    const dosage = r.dose && r.dose_unit ? `${r.dose} ${r.dose_unit}` : (r.dose || null);
    const hash = hashKey([fmId, r.name, dosage]);
    if (findByHash.get(hash)) { skipped++; continue; }
    insertMed.run(
      fmId, patient,
      r.name,
      r.brand_name || null,
      r.generic_name || null,
      dosage,
      r.dose_unit || null,
      r.route || null,
      r.frequency || null,
      // Map seed status → med_medications.status CHECK constraint vocab
      ({ 'active':'Active', 'completed':'Completed', 'stopped':'Discontinued',
         'prn':'As Needed', 'unknown':'Active', 'discontinued':'Discontinued' })[String(r.status||'').toLowerCase()] || 'Active',
      r.rx_date || null,
      r.ndc || null,
      r.mail_order ? 1 : 0,
      r.quantity || null,
      r.purpose || null,
      r.notes || null,
      r.source_system || null,
      hash,
    );
    inserted++;
  }
  return { inserted, skipped };
}

function importLabs(rows, fmId, patient) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0, skipped = 0;
  const findByHash = db.prepare(`SELECT id FROM med_lab_results WHERE dedup_hash = ?`);
  const insertLab = db.prepare(`
    INSERT INTO med_lab_results (
      family_member_id, patient, panel_name, test_name, test_date,
      value_numeric, value_text, unit, reference_low, reference_high,
      flag, source_system, notes, dedup_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  for (const r of rows) {
    if (!r || !r.test_name) { skipped++; continue; }
    const hash = hashKey([fmId, r.test_name, r.test_date, r.value_numeric ?? r.value]);
    if (findByHash.get(hash)) { skipped++; continue; }
    insertLab.run(
      fmId, patient,
      r.panel_name || null,
      r.test_name,
      r.test_date,
      r.value_numeric != null ? r.value_numeric : (isFinite(Number(r.value)) ? Number(r.value) : null),
      r.value_text || (r.value_numeric == null && !isFinite(Number(r.value)) ? r.value : null),
      r.unit || null,
      r.reference_low ?? null,
      r.reference_high ?? null,
      r.flag || null,
      r.source_system || null,
      r.notes || null,
      hash,
    );
    inserted++;
  }
  return { inserted, skipped };
}

function importVitals(rows, fmId, patient) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0, skipped = 0;
  const findByHash = db.prepare(`SELECT id FROM med_vitals_readings WHERE dedup_hash = ?`);
  const insertVital = db.prepare(`
    INSERT INTO med_vitals_readings (
      family_member_id, patient, measure_date,
      systolic_bp, diastolic_bp, heart_rate, weight_lbs, height_in,
      bmi, temperature_f, o2_sat, respiratory_rate, blood_glucose,
      source_system, notes, dedup_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  for (const r of rows) {
    if (!r || !r.measure_date) { skipped++; continue; }
    const hash = hashKey([fmId, r.measure_date, r.systolic_bp, r.diastolic_bp, r.weight_lbs]);
    if (findByHash.get(hash)) { skipped++; continue; }
    insertVital.run(
      fmId, patient,
      r.measure_date,
      r.systolic_bp ?? null,
      r.diastolic_bp ?? null,
      r.heart_rate ?? null,
      r.weight_lbs ?? null,
      r.height_in ?? null,
      r.bmi ?? null,
      r.temperature_f ?? null,
      r.o2_sat ?? null,
      r.respiratory_rate ?? null,
      r.blood_glucose ?? null,
      r.source_system || null,
      r.notes || null,
      hash,
    );
    inserted++;
  }
  return { inserted, skipped };
}

function importDiagnostics(rows, fmId, patient) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0, skipped = 0;
  const findByHash = db.prepare(`SELECT id FROM med_diagnostics WHERE dedup_hash = ?`);
  const insertDiag = db.prepare(`
    INSERT INTO med_diagnostics (
      family_member_id, patient, test_name, test_type, test_date,
      status, impression, facility, source_system, notes, dedup_hash,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  for (const r of rows) {
    if (!r || !r.test_name) { skipped++; continue; }
    const hash = hashKey([fmId, r.test_name, r.test_date]);
    if (findByHash.get(hash)) { skipped++; continue; }
    insertDiag.run(
      fmId, patient,
      r.test_name,
      r.test_type || null,
      r.test_date,
      r.status || 'final',
      r.impression || null,
      r.facility || null,
      r.source_system || null,
      r.notes || null,
      hash,
    );
    inserted++;
  }
  return { inserted, skipped };
}

function importAllergies(rows, fmId, patient) {
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0, skipped = 0;
  const findByHash = db.prepare(`SELECT id FROM med_allergies WHERE dedup_hash = ?`);
  const insertAllergy = db.prepare(`
    INSERT INTO med_allergies (
      family_member_id, patient, allergen, allergen_type, reaction,
      severity, status, noted_date, source_system, notes, dedup_hash,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);
  for (const r of rows) {
    if (!r || !r.allergen) { skipped++; continue; }
    const hash = hashKey([fmId, r.allergen]);
    if (findByHash.get(hash)) { skipped++; continue; }
    insertAllergy.run(
      fmId, patient,
      r.allergen,
      r.allergen_type || null,
      r.reaction || null,
      r.severity || null,
      r.status || 'Active',
      r.noted_date || null,
      r.source_system || null,
      r.notes || null,
      hash,
    );
    inserted++;
  }
  return { inserted, skipped };
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/v1/medical/bulk-seed
// Body: full health_seed.json contents.
// requireAuth — this is a write that touches every medical table.
// ─────────────────────────────────────────────────────────────────────
router.post('/bulk-seed', requireAuth, (req, res) => {
  try {
    const seed = req.body || {};
    const fm = resolveFamilyMember(seed);
    if (!fm) {
      return badRequest(res,
        'Could not resolve family member. Provide family_member_id in body, ' +
        'OR ensure patient.name matches a family_members.display_name.');
    }

    // Allow optional dry-run for safety
    const dryRun = req.query.dry_run === '1' || req.body._dry_run === true;
    if (dryRun) {
      return res.json({
        dry_run: true,
        mapped_family_id: fm.id,
        mapped_family_name: fm.display_name,
        counts: {
          care_team:    Array.isArray(seed.care_team)    ? seed.care_team.length    : 0,
          conditions:   Array.isArray(seed.conditions)   ? seed.conditions.length   : 0,
          medications:  Array.isArray(seed.medications)  ? seed.medications.length  : 0,
          labs:         Array.isArray(seed.labs)         ? seed.labs.length         : 0,
          vitals:       Array.isArray(seed.vitals)       ? seed.vitals.length       : 0,
          diagnostics:  Array.isArray(seed.diagnostics)  ? seed.diagnostics.length  : 0,
          allergies:    Array.isArray(seed.allergies)    ? seed.allergies.length    : 0,
        },
      });
    }

    const results = db.transaction(() => ({
      care_team:    importCareTeam(seed.care_team || [], fm.id, fm.display_name),
      conditions:   importConditions(seed.conditions || [], fm.id, fm.display_name),
      medications:  importMedications(seed.medications || [], fm.id, fm.display_name),
      labs:         importLabs(seed.labs || [], fm.id, fm.display_name),
      vitals:       importVitals(seed.vitals || [], fm.id, fm.display_name),
      diagnostics:  importDiagnostics(seed.diagnostics || [], fm.id, fm.display_name),
      allergies:    importAllergies(seed.allergies || [], fm.id, fm.display_name),
    }))();

    res.json({
      ok:                  true,
      mapped_family_id:    fm.id,
      mapped_family_name:  fm.display_name,
      results,
      total_inserted:      Object.values(results).reduce((s, r) => s + (r.inserted || 0), 0),
      total_skipped:       Object.values(results).reduce((s, r) => s + (r.skipped || 0), 0),
    });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
