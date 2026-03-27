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
const { clearReview } = require('../../shared/needs-review');
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
    let sql = 'SELECT * FROM med_medications WHERE 1=1';
    const p = [];
    if (req.query.patient) { sql += ' AND patient=?'; p.push(req.query.patient); }
    if (req.query.status)  { sql += ' AND status=?';  p.push(req.query.status); }
    sql += ' ORDER BY patient, status, name COLLATE NOCASE';
    res.json(db.prepare(sql).all(...p).map(m => withTagNames(m, 'medical_medication')));
  } catch (e) { serverError(res, e); }
});

router.post('/medications', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const info = db.prepare(`
      INSERT INTO med_medications
        (patient, name, dosage, frequency, physician, physician_contact_id, start_date, end_date, status, purpose, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(d.patient||'Self', d.name, d.dosage||null, d.frequency||null,
           d.physician||null, d.physician_contact_id||null,
           d.start_date||null, d.end_date||null, d.status||'Active', d.purpose||null, d.notes||null);
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
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.patient||'Self', d.name, d.dosage||null, d.frequency||null,
           d.physician||null, d.physician_contact_id||null,
           d.start_date||null, d.end_date||null, d.status||'Active', d.purpose||null, d.notes||null,
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
    let sql = 'SELECT * FROM med_conditions WHERE 1=1';
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
        (patient, condition_name, start_date, end_date, physician, physician_contact_id, treatment_notes, status, notes)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(d.patient||'Self', d.condition_name, d.start_date||null, d.end_date||null,
           d.physician||null, d.physician_contact_id||null,
           d.treatment_notes||null, d.status||'Active', d.notes||null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/conditions/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE med_conditions SET patient=?, condition_name=?, start_date=?, end_date=?,
        physician=?, physician_contact_id=?, treatment_notes=?, status=?, notes=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.patient||'Self', d.condition_name, d.start_date||null, d.end_date||null,
           d.physician||null, d.physician_contact_id||null,
           d.treatment_notes||null, d.status||'Active', d.notes||null,
           req.params.id);
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
        (patient, contact_id, visit_date, questions, doctors_response, follow_up_needed, follow_up_date, notes)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(d.patient||'Self', d.contact_id||null, d.visit_date,
           d.questions||null, d.doctors_response||null,
           d.follow_up_needed ? 1 : 0, d.follow_up_date||null, d.notes||null);
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
        notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.patient||'Self', d.contact_id||null, d.visit_date,
           d.questions||null, d.doctors_response||null,
           d.follow_up_needed ? 1 : 0, d.follow_up_date||null, d.notes||null,
           req.params.id);
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

module.exports = router;
