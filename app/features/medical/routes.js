// @ts-nocheck
/**
 * features/medical/routes.js
 * PRIVATE module — requireAuth on all write routes.
 * Medications · Conditions · Physicians · Visit Notes
 */
'use strict';

const express  = require('express');
const router   = express.Router();
const db       = require('../../db/db');
const { requireAuth }        = require('../auth/middleware');
const { notFound, badRequest, serverError } = require('../../shared/errors');
const { clearReview, flagRecord } = require('../../shared/needs-review');
const { resolveAndFlag }                = require('../../shared/namematch');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');

function escCsv(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

// ══════════════════════════════════════════════════════════════
// MEDICATIONS
// ══════════════════════════════════════════════════════════════

// GET /api/v1/medical/medications?patient=Self&status=Active
router.get('/medications', (req, res) => {
  try {
    let sql = `
      SELECT m.*, fm.display_name AS family_member_name,
        pharm.name AS pharmacy_name,
        cond.condition_name AS condition_name_text
      FROM med_medications m
      LEFT JOIN family_members fm   ON fm.id    = m.family_member_id
      LEFT JOIN contacts pharm      ON pharm.id = m.pharmacy_contact_id
      LEFT JOIN med_conditions cond ON cond.id  = m.condition_id
      WHERE 1=1`;
    const p = [];
    if (req.query.patient)          { sql += ' AND (m.patient=? OR fm.display_name=?)'; p.push(req.query.patient, req.query.patient); }
    if (req.query.family_member_id) { sql += ' AND m.family_member_id=?'; p.push(req.query.family_member_id); }
    if (req.query.status)           { sql += ' AND m.status=?'; p.push(req.query.status); }
    sql += ' ORDER BY fm.display_name, m.status, m.name COLLATE NOCASE';
    res.json(db.prepare(sql).all(...p).map(m => withTagNames(m, 'medical_medication')));
  } catch (e) { serverError(res, e); }
});

router.post('/medications', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const info = db.prepare(`
      INSERT INTO med_medications (patient, name, dosage, frequency, physician, physician_contact_id, start_date, end_date, status, purpose, notes,
         family_member_id, pharmacy_contact_id, condition_id,
         rx_number, refills_remaining, next_refill_date, controlled_schedule)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,
         ?,?,?,?,?,?,?)
    `).run(d.patient||'Self', d.name, d.dosage||null, d.frequency||null,
           d.physician||null, d.physician_contact_id||null,
           d.start_date||null, d.end_date||null, d.status||'Active', d.purpose||null, d.notes||null,
           d.family_member_id||null, d.pharmacy_contact_id||null, d.condition_id||null,
           d.rx_number||null, d.refills_remaining!=null?parseInt(d.refills_remaining):null,
           d.next_refill_date||null, d.controlled_schedule||null);
    if (d.tags) saveTagsByName(info.lastInsertRowid, 'medical_medication', d.tags);
    res.status(201).json(withTagNames(db.prepare('SELECT * FROM med_medications WHERE id=?').get(info.lastInsertRowid), 'medical_medication'));
  } catch (e) { serverError(res, e); }
});

router.put('/medications/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE med_medications SET patient=?, name=?, dosage=?, frequency=?, physician=?,
        physician_contact_id=?, start_date=?, end_date=?, status=?, purpose=?, notes=?,
        family_member_id=?, pharmacy_contact_id=?, condition_id=?,
        rx_number=?, refills_remaining=?, next_refill_date=?, controlled_schedule=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.patient||'Self', d.name, d.dosage||null, d.frequency||null,
           d.physician||null, d.physician_contact_id||null,
           d.start_date||null, d.end_date||null, d.status||'Active', d.purpose||null, d.notes||null,
           d.family_member_id||null, d.pharmacy_contact_id||null, d.condition_id||null,
           d.rx_number||null, d.refills_remaining!=null?parseInt(d.refills_remaining):null,
           d.next_refill_date||null, d.controlled_schedule||null,
           req.params.id);
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'medical_medication', d.tags);
    clearReview('med_medications', req.params.id);
    res.json(withTagNames(db.prepare('SELECT * FROM med_medications WHERE id=?').get(req.params.id), 'medical_medication'));
  } catch (e) { serverError(res, e); }
});

router.delete('/medications/:id', requireAuth, (req, res) => {
  try {
    clearTags(req.params.id, 'medical_medication');
    db.prepare('DELETE FROM med_medications WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.get('/medications/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM med_medications ORDER BY patient, name').all();
    const h = ['id','patient','name','dosage','frequency','physician','start_date','end_date','status','purpose','notes'];
    const lines = rows.map(r => h.map(k => escCsv(r[k])).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="medications.csv"');
    res.send([h.join(','), ...lines].join('\n'));
  } catch (e) { serverError(res, e); }
});

router.get('/conditions/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM med_conditions ORDER BY patient, status, condition_name').all();
    const h = ['id','patient','condition_name','status','start_date','diagnosed_date','notes'];
    const lines = rows.map(r => h.map(k => escCsv(r[k])).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="conditions.csv"');
    res.send([h.join(','), ...lines].join('\n'));
  } catch (e) { serverError(res, e); }
});

router.get('/notes/export/csv', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT n.id, n.visit_date, n.patient, c.name AS physician, c.specialty,
             n.questions, n.doctors_response, n.follow_up_needed, n.follow_up_date, n.notes
      FROM med_visit_notes n
      LEFT JOIN contacts c ON c.id = n.contact_id
      ORDER BY n.visit_date DESC
    `).all();
    const h = ['id','visit_date','patient','physician','specialty','questions','doctors_response','follow_up_needed','follow_up_date','notes'];
    const lines = rows.map(r => h.map(k => escCsv(r[k])).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="visit_notes.csv"');
    res.send([h.join(','), ...lines].join('\n'));
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// CONDITIONS
// ══════════════════════════════════════════════════════════════

// GET /api/v1/medical/conditions?patient=Self&status=Active
router.get('/conditions', (req, res) => {
  try {
    let sql = `SELECT c.*, fm.display_name AS family_member_name
      FROM med_conditions c
      LEFT JOIN family_members fm ON fm.id = c.family_member_id
      WHERE 1=1`;
    const p = [];
    if (req.query.patient) { sql += ' AND patient=?'; p.push(req.query.patient); }
    if (req.query.status)  { sql += ' AND status=?';  p.push(req.query.status); }
    sql += ' ORDER BY patient, status, condition_name COLLATE NOCASE';
    res.json(db.prepare(sql).all(...p));
  } catch (e) { serverError(res, e); }
});

router.post('/conditions', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.condition_name) return badRequest(res, 'condition_name required');
    const info = db.prepare(`
      INSERT INTO med_conditions
        (patient, condition_name, start_date, end_date, physician, physician_contact_id,
         treatment_notes, status, notes, family_member_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(d.patient||'Self', d.condition_name, d.start_date||null, d.end_date||null,
           d.physician||null, d.physician_contact_id||null,
           d.treatment_notes||null, d.status||'Active', d.notes||null,
           d.family_member_id||null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/conditions/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE med_conditions SET patient=?, condition_name=?, start_date=?, end_date=?,
        physician=?, physician_contact_id=?, treatment_notes=?, status=?, notes=?,
        family_member_id=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.patient||'Self', d.condition_name, d.start_date||null, d.end_date||null,
           d.physician||null, d.physician_contact_id||null,
           d.treatment_notes||null, d.status||'Active', d.notes||null,
           d.family_member_id||null, req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/conditions/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM med_conditions WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// VISIT NOTES
// ══════════════════════════════════════════════════════════════

// GET /api/v1/medical/notes?patient=Self&follow_up=1
// Joins physician name/specialty from contacts table.
router.get('/notes', (req, res) => {
  try {
    let sql = `
      SELECT n.*, c.name AS physician_name, c.specialty, c.company AS practice_name
      FROM med_visit_notes n
      LEFT JOIN contacts c ON c.id = n.contact_id
      WHERE 1=1
    `;
    const params = [];
    if (req.query.patient)    { sql += ' AND n.patient=?';          params.push(req.query.patient); }
    if (req.query.follow_up)  { sql += ' AND n.follow_up_needed=?'; params.push(req.query.follow_up); }
    sql += ' ORDER BY n.visit_date DESC, n.id DESC';
    res.json(db.prepare(sql).all(...params).map(n => withTagNames(n, 'medical_visit')));
  } catch (e) { serverError(res, e); }
});

router.post('/notes', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.visit_date) return badRequest(res, 'visit_date required');
    const info = db.prepare(`
      INSERT INTO med_visit_notes
        (patient, contact_id, visit_date, questions, doctors_response, follow_up_needed, follow_up_date, notes, family_member_id)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(d.patient||'Self', d.contact_id||null, d.visit_date,
           d.questions||null, d.doctors_response||null,
           d.follow_up_needed ? 1 : 0, d.follow_up_date||null, d.notes||null,
           d.family_member_id||null);
    if (d.tags) saveTagsByName(info.lastInsertRowid, 'medical_visit', d.tags);
    res.status(201).json(withTagNames(db.prepare('SELECT * FROM med_visit_notes WHERE id=?').get(info.lastInsertRowid), 'medical_visit'));
  } catch (e) { serverError(res, e); }
});

router.put('/notes/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE med_visit_notes SET patient=?, contact_id=?, visit_date=?,
        questions=?, doctors_response=?, follow_up_needed=?, follow_up_date=?,
        notes=?, family_member_id=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.patient||'Self', d.contact_id||null, d.visit_date,
           d.questions||null, d.doctors_response||null,
           d.follow_up_needed ? 1 : 0, d.follow_up_date||null, d.notes||null,
           d.family_member_id||null, req.params.id);
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'medical_visit', d.tags);
    clearReview('med_visit_notes', req.params.id);
    res.json(withTagNames(db.prepare('SELECT * FROM med_visit_notes WHERE id=?').get(req.params.id), 'medical_visit'));
  } catch (e) { serverError(res, e); }
});

router.delete('/notes/:id', requireAuth, (req, res) => {
  try {
    clearTags(req.params.id, 'medical_visit');
    db.prepare('DELETE FROM med_visit_notes WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/medical/summary — per-person summary card data
router.get('/summary', (req, res) => {
  try {
    const family = db.prepare('SELECT * FROM family_members ORDER BY is_primary_user DESC, display_name').all();
    const result = family.map(member => {
      const name = member.display_name;
      const conditions = db.prepare(`
        SELECT id, condition_name, status, start_date, physician
        FROM med_conditions WHERE patient=?
        ORDER BY status ASC, condition_name
      `).all(name);
      const medications = db.prepare(`
        SELECT id, name, dosage, frequency, status
        FROM med_medications WHERE patient=?
        ORDER BY status ASC, name
      `).all(name);
      const recentVisits = db.prepare(`
        SELECT id, visit_date, questions AS reason, doctors_response AS summary, contact_id
        FROM med_visit_notes WHERE patient=?
        ORDER BY visit_date DESC LIMIT 3
      `).all(name);
      return {
        member,
        conditions,
        medications,
        recent_visits: recentVisits,
        counts: {
          conditions: conditions.filter(c => c.status === 'Active').length,
          medications: medications.filter(m => m.status === 'Active').length,
          visits: recentVisits.length,
        }
      };
    });
    res.json(result);
  } catch (e) { serverError(res, e); }
});


// ── GET /api/v1/medical/interactions/:patientId ───────────────
// Returns RxNorm interaction data for all active meds for a patient.
// Called from the frontend as a non-blocking badge check.
// Free API — no key required: rxnav.nlm.nih.gov
router.get('/interactions/:familyMemberId', async (req, res) => {
  try {
    const meds = db.prepare(`
      SELECT id, name, dosage FROM med_medications
      WHERE family_member_id=? AND status='Active'
    `).all(req.params.familyMemberId);

    if (meds.length < 2) return res.json({ interactions: [], count: 0 });

    // Resolve each drug name to an RxCUI
    const https = require('https');
    const rxGet = (url) => new Promise((resolve) => {
      https.get(url, { headers: { 'User-Agent': 'Ghrava/1.0' } }, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => {
          try { resolve(JSON.parse(d)); } catch { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });

    // Get RxCUIs
    const cuis = [];
    for (const med of meds) {
      const name = med.name.replace(/\s+\d+.*$/, '').trim();
      const data = await rxGet(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=1`);
      const cui = data?.idGroup?.rxnormId?.[0];
      if (cui) cuis.push({ med, cui });
    }

    if (cuis.length < 2) return res.json({ interactions: [], count: 0 });

    // Check interactions
    const cuiList = cuis.map(c => c.cui).join('+');
    const iData = await rxGet(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${cuiList}`);
    const pairs = iData?.fullInteractionTypeGroup?.[0]?.fullInteractionType || [];

    const interactions = pairs.map(p => ({
      drug1: p.minConcept?.[0]?.name,
      drug2: p.minConcept?.[1]?.name,
      severity: p.interactionPair?.[0]?.severity || 'unknown',
      description: p.interactionPair?.[0]?.description || '',
    }));

    const high = interactions.filter(i => i.severity?.toLowerCase() === 'high');
    res.json({
      interactions,
      count: interactions.length,
      high_count: high.length,
    });
  } catch(e) { res.json({ interactions: [], count: 0, error: e.message }); }
});

module.exports = router;

// ══════════════════════════════════════════════════════════════
//  EOB IMPORT — MHBP (local pdf-parse, no API calls)
// ══════════════════════════════════════════════════════════════

const multer = require('multer');
const uploadEob = multer({ storage: multer.memoryStorage() });

// POST /api/v1/medical/eob/preview  — parse PDF, return summary (no DB write)
router.post('/eob/preview', requireAuth, uploadEob.single('file'), async (req, res) => {
  if (!req.file) return badRequest(res, 'No file uploaded');
  try {
    const { parseEobPdf } = require('./eob-parser');
    const statements = await parseEobPdf(req.file.buffer, req.file.originalname);
    if (!statements.length) return res.json({ ok: false, error: 'No MHBP statements detected in file' });

    // Check which are already in DB
    const preview = statements.map(s => {
      const exists = s.statement_date && s.member_id
        ? db.prepare('SELECT id FROM med_eob_statements WHERE statement_date=? AND member_id=?')
            .get(s.statement_date, s.member_id)
        : null;
      return {
        statement_date: s.statement_date,
        member_name:    s.member_name,
        member_id:      s.member_id,
        plan_name:      s.plan_name,
        claims_count:   s.claims?.length || 0,
        patients:       [...new Set((s.claims||[]).map(c => c.patient.split(' (')[0]))].join(', '),
        plan_paid:      s.plan_paid_total,
        your_share:     s.your_share_total,
        already_imported: !!exists,
      };
    });
    res.json({ ok: true, statements: preview });
  } catch(e) { serverError(res, e); }
});

// POST /api/v1/medical/eob/import  — parse + write to DB
// Body (multipart): file + selected_dates (JSON array of statement_date strings to import)
router.post('/eob/import', requireAuth, uploadEob.single('file'), async (req, res) => {
  if (!req.file) return badRequest(res, 'No file uploaded');
  try {
    const { parseEobPdf } = require('./eob-parser');
    const statements = await parseEobPdf(req.file.buffer, req.file.originalname);
    if (!statements.length) return badRequest(res, 'No MHBP statements detected');

    // Optional filter: only import selected dates
    let selected = null;
    try { selected = JSON.parse(req.body.selected_dates || 'null'); } catch {}

    let imported = 0, skipped = 0;
    const nameFlags = [];

    const doImport = db.transaction(() => {
      for (const s of statements) {
        if (!s.statement_date || !s.member_id) { skipped++; continue; }
        if (selected && !selected.includes(s.statement_date)) { skipped++; continue; }

        // Dedup
        const exists = db.prepare('SELECT id FROM med_eob_statements WHERE statement_date=? AND member_id=?')
          .get(s.statement_date, s.member_id);
        if (exists) { skipped++; continue; }

        // Insert statement
        const stmtId = db.prepare(`
          INSERT INTO med_eob_statements
            (insurer,plan_name,group_name,member_id,group_number,member_name,
             statement_date,period_start,period_end,
             amount_billed,allowed_amount,pending_not_payable,deductible_applied,
             copay_total,coinsurance_total,plan_paid_total,your_share_total,
             amount_saved,healthfund_applied,
             deductible_annual,deductible_used,deductible_remaining,
             oop_max_annual,oop_used,oop_remaining,
             healthfund_total,healthfund_used,healthfund_remaining,source_filename)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          s.insurer||'MHBP', s.plan_name||null, s.group_name||null,
          s.member_id, s.group_number||null, s.member_name||null,
          s.statement_date, s.period_start||null, s.period_end||null,
          s.amount_billed||null, s.allowed_amount||null, s.pending_not_payable||null,
          s.deductible_applied||null, s.copay_total||null, s.coinsurance_total||null,
          s.plan_paid_total||null, s.your_share_total||null,
          s.amount_saved||null, s.healthfund_applied||null,
          s.deductible_annual||null, s.deductible_used||null, s.deductible_remaining||null,
          s.oop_max_annual||null, s.oop_used||null, s.oop_remaining||null,
          s.healthfund_total||null, s.healthfund_used||null, s.healthfund_remaining||null,
          s.source_filename||null
        ).lastInsertRowid;

        // Insert claims — resolve patient name to family_member_id (S3/A9)
        for (const c of (s.claims || [])) {
          const patientRaw = c.patient || 'Unknown';
          const nameMatch  = resolveAndFlag(patientRaw, null, null); // flag after insert
          const claimId = db.prepare(`
            INSERT INTO med_eob_claims
              (eob_id,patient,family_member_id,claim_id,received_date,provider,network_status,send_date,
               amount_billed,member_rate,pending_not_payable,applied_to_deductible,
               copay,plan_paid,fund_paid,coinsurance,your_share)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            stmtId, patientRaw, nameMatch.id||null, c.claim_id||null, c.received_date||null,
            c.provider||null, c.network_status||null, c.send_date||null,
            c.amount_billed||null, c.member_rate||null, c.pending_not_payable||null,
            c.applied_to_deductible||null, c.copay||null, c.plan_paid||null,
            c.fund_paid||null, c.coinsurance||null, c.your_share||null
          ).lastInsertRowid;
          // Flag if name wasn't an exact match
          if (nameMatch.confidence !== 'exact') {
            const reason = nameMatch.confidence === 'none'
              ? `Patient not matched: "\${patientRaw}"`
              : nameMatch.confidence === 'ambiguous'
                ? `Patient ambiguous: "\${patientRaw}" → \${nameMatch.candidates.map(x=>x.display_name).join(', ')}`
                : `Patient auto-matched: "\${patientRaw}" → "\${nameMatch.display_name}"`;
            const cat = nameMatch.confidence === 'exact' ? 'data_quality' : 'name_unmatched';
            try { flagRecord('med_eob_claims', claimId, reason, cat); } catch {}
          }

          // Insert service lines
          for (const sv of (c.services || [])) {
            db.prepare(`
              INSERT INTO med_eob_services
                (claim_id,service_description,service_code,service_date,
                 amount_billed,member_rate,plan_share,your_share)
              VALUES (?,?,?,?,?,?,?,?)
            `).run(
              claimId, sv.service_description||null, sv.service_code||null,
              sv.service_date||null, sv.amount_billed||null, sv.member_rate||null,
              sv.plan_share||null, sv.your_share||null
            );
          }
        }

        // Insert balance rows
        for (const b of (s.balances || [])) {
          db.prepare(`
            INSERT INTO med_eob_balances (eob_id,person,balance_type,annual_limit,amount_used,amount_remaining)
            VALUES (?,?,?,?,?,?)
          `).run(stmtId, b.person, b.balance_type, b.annual_limit||null, b.amount_used||null, b.amount_remaining||null);
        }

        imported++;
      }
    });
    doImport();
    res.json({ ok: true, imported, skipped, name_flags: nameFlags });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/medical/eob  — list all statements
router.get('/eob', (req, res) => {
  try {
    const stmts = db.prepare(`
      SELECT s.*,
        COUNT(DISTINCT c.id) AS claims_count,
        GROUP_CONCAT(DISTINCT REPLACE(c.patient, SUBSTR(c.patient, INSTR(c.patient,' (')), '')) AS patients
      FROM med_eob_statements s
      LEFT JOIN med_eob_claims c ON c.eob_id = s.id
      GROUP BY s.id
      ORDER BY s.statement_date DESC
    `).all();
    res.json(stmts);
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/medical/eob/:id  — statement + claims + services
router.get('/eob/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM med_eob_statements WHERE id=?').get(req.params.id);
    if (!stmt) return notFound(res);
    const claims = db.prepare('SELECT * FROM med_eob_claims WHERE eob_id=? ORDER BY id').all(stmt.id);
    for (const c of claims) {
      c.services = db.prepare('SELECT * FROM med_eob_services WHERE claim_id=? ORDER BY service_date').all(c.id);
    }
    stmt.claims = claims;
    stmt.balances = db.prepare('SELECT * FROM med_eob_balances WHERE eob_id=? ORDER BY person,balance_type').all(stmt.id);
    res.json(stmt);
  } catch(e) { serverError(res, e); }
});

// DELETE /api/v1/medical/eob/:id
router.delete('/eob/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const s = db.prepare('SELECT id FROM med_eob_statements WHERE id=?').get(id);
    if (!s) return notFound(res);
    // Explicit deletes (no ON DELETE CASCADE per architecture rule)
    const claimIds = db.prepare('SELECT id FROM med_eob_claims WHERE eob_id=?').all(id).map(r => r.id);
    for (const cid of claimIds) {
      db.prepare('DELETE FROM med_eob_services WHERE claim_id=?').run(cid);
    }
    db.prepare('DELETE FROM med_eob_claims WHERE eob_id=?').run(id);
    db.prepare('DELETE FROM med_eob_balances WHERE eob_id=?').run(id);
    db.prepare('DELETE FROM med_eob_statements WHERE id=?').run(id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});
