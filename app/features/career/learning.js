// @ts-check
'use strict';
/**
 * career/learning.js — Learning & Development routes
 * Handles career_learning + career_learning_certs tables
 * Mounted at /api/v1/career/learning
 */
const express  = require('express');
const router   = express.Router();
const db       = require('../../db/db');
const { requireAuth }                          = require('../auth/middleware');
const { badRequest, notFound, serverError }    = require('../../shared/errors');
const { saveTagsByName, withTagNames }         = require('../../shared/tags');

// ── Known cert renewal presets ────────────────────────────────
const CERT_PRESETS = {
  'pmp':              { renewal_period_months: 36, ce_hours_required: 60,  issuing_body: 'PMI' },
  'pmi-acp':          { renewal_period_months: 36, ce_hours_required: 30,  issuing_body: 'PMI' },
  'pmi-rmp':          { renewal_period_months: 36, ce_hours_required: 30,  issuing_body: 'PMI' },
  'pmi-pba':          { renewal_period_months: 36, ce_hours_required: 30,  issuing_body: 'PMI' },
  'fac-ppm level i':  { renewal_period_months: 24, ce_hours_required: 40,  issuing_body: 'DAU' },
  'fac-ppm level ii': { renewal_period_months: 24, ce_hours_required: 40,  issuing_body: 'DAU' },
  'fac-ppm level iii':{ renewal_period_months: 24, ce_hours_required: 40,  issuing_body: 'DAU' },
  'fac-ppm i':        { renewal_period_months: 24, ce_hours_required: 40,  issuing_body: 'DAU' },
  'fac-ppm ii':       { renewal_period_months: 24, ce_hours_required: 40,  issuing_body: 'DAU' },
  'fac-ppm iii':      { renewal_period_months: 24, ce_hours_required: 40,  issuing_body: 'DAU' },
  'security+':        { renewal_period_months: 36, ce_hours_required: 50,  issuing_body: 'CompTIA' },
  'csm':              { renewal_period_months: 24, ce_hours_required: 0,   issuing_body: 'Scrum Alliance' },
  'itil foundation':  { renewal_period_months: null, ce_hours_required: 0, issuing_body: 'Axelos' },
  'cissp':            { renewal_period_months: 36, ce_hours_required: 120, issuing_body: 'ISC2' },
  'casp+':            { renewal_period_months: 36, ce_hours_required: 75,  issuing_body: 'CompTIA' },
  'cism':             { renewal_period_months: 36, ce_hours_required: 120, issuing_body: 'ISACA' },
  'cisa':             { renewal_period_months: 36, ce_hours_required: 120, issuing_body: 'ISACA' },
};

function certPreset(name) {
  const key = (name||'').toLowerCase().trim();
  return CERT_PRESETS[key] || null;
}

function addCycleEnd(cert) {
  if (cert.current_cycle_start && cert.renewal_period_months) {
    const s = new Date(cert.current_cycle_start + 'T00:00:00');
    s.setMonth(s.getMonth() + cert.renewal_period_months);
    s.setDate(s.getDate() - 1); // end = day before next cycle
    cert.current_cycle_end = s.toISOString().slice(0, 10);
  }
  return cert;
}

// ── GET /api/v1/career/learning ───────────────────────────────
router.get('/', (req, res) => {
  try {
    const { type, search, cert_id, in_cycle } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (type)   { where += ' AND l.learning_type=?'; params.push(type); }
    if (search) { where += ' AND (l.title LIKE ? OR l.provider LIKE ? OR l.description LIKE ?)';
                  params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (cert_id) { where += ' AND EXISTS (SELECT 1 FROM career_learning_certs lc2 WHERE lc2.learning_id=l.id AND lc2.certification_id=?)'; params.push(cert_id); }

    const certIdParam = cert_id ? parseInt(/** @type {string} */(cert_id)) : null;
    const rows = db.prepare(`
      SELECT l.*, ct.name AS instructor_name,
        (SELECT GROUP_CONCAT(c.name, ', ')
         FROM career_learning_certs lc
         JOIN career_certifications c ON c.id = lc.certification_id
         WHERE lc.learning_id = l.id) AS linked_certs,
        (SELECT COALESCE(SUM(lc.hours_applied), 0)
         FROM career_learning_certs lc WHERE lc.learning_id = l.id) AS hours_linked,
        (SELECT lc.hours_applied FROM career_learning_certs lc
         WHERE lc.learning_id = l.id AND lc.certification_id = ${certIdParam || 'NULL'}) AS hours_applied_to_cert,
        (SELECT COUNT(*) FROM attachments WHERE entity_type='career_learning' AND entity_id=l.id) AS attachment_count
      FROM career_learning l
      LEFT JOIN contacts ct ON ct.id = l.instructor_contact_id
      ${where}
      ORDER BY l.start_date DESC, l.created_at DESC
    `).all(...params).map(r => withTagNames(r, 'career_learning'));
    // Filter to current cycle if requested
    let result = rows;
    if (cert_id && in_cycle) {
      const cert = /** @type {{current_cycle_start:string|null,current_cycle_end:string|null}|null} */ (db.prepare('SELECT current_cycle_start, current_cycle_end FROM career_certifications WHERE id=?').get(cert_id));
      if (cert && cert.current_cycle_start) {
        result = rows.filter(r =>
          r.start_date >= (cert.current_cycle_start || '') &&
          (!cert.current_cycle_end || r.start_date <= cert.current_cycle_end)
        );
      }
    }

    res.json(result);
  } catch(e) { serverError(res, e); }
});

// ── GET /api/v1/career/learning/:id ──────────────────────────
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT l.*, ct.name AS instructor_name
      FROM career_learning l
      LEFT JOIN contacts ct ON ct.id = l.instructor_contact_id
      WHERE l.id=?
    `).get(req.params.id);
    if (!row) return notFound(res, 'Learning record');

    const certs = db.prepare(`
      SELECT lc.*, c.name AS cert_name, c.issuing_body
      FROM career_learning_certs lc
      JOIN career_certifications c ON c.id = lc.certification_id
      WHERE lc.learning_id = ?
    `).all(req.params.id);

    res.json({ ...withTagNames(row, 'career_learning'), cert_links: certs });
  } catch(e) { serverError(res, e); }
});

// ── POST /api/v1/career/learning ──────────────────────────────
router.post('/', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.title?.trim()) return badRequest(res, 'title required');

    const r = db.prepare(`
      INSERT INTO career_learning
        (title, learning_type, provider, start_date, end_date, hours_total,
         location, url, cost, description, notes, instructor_contact_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.title.trim(), d.learning_type || 'Course', d.provider || null,
      d.start_date || null, d.end_date || null,
      d.hours_total != null ? parseFloat(d.hours_total) : null,
      d.location || null, d.url || null,
      d.cost != null ? parseFloat(d.cost) : null,
      d.description || null, d.notes || null,
      d.instructor_contact_id || null
    );
    const newId = Number(r.lastInsertRowid);

    if (d.tags) saveTagsByName(newId, 'career_learning', d.tags);
    saveCertLinks(newId, d.cert_links || []);

    res.status(201).json(db.prepare('SELECT * FROM career_learning WHERE id=?').get(newId));
  } catch(e) { serverError(res, e); }
});

// ── PUT /api/v1/career/learning/:id ──────────────────────────
router.put('/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const existing = /** @type {import('../../shared/types').CareerLearning|null} */ (db.prepare('SELECT * FROM career_learning WHERE id=?').get(req.params.id));
    if (!existing) return notFound(res, 'Learning record');

    db.prepare(`
      UPDATE career_learning SET
        title=?, learning_type=?, provider=?, start_date=?, end_date=?,
        hours_total=?, location=?, url=?, cost=?, description=?, notes=?,
        instructor_contact_id=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.title?.trim() ?? existing.title,
      d.learning_type ?? existing.learning_type,
      d.provider ?? existing.provider,
      d.start_date ?? existing.start_date,
      d.end_date ?? existing.end_date,
      d.hours_total != null ? parseFloat(d.hours_total) : existing.hours_total,
      d.location ?? existing.location,
      d.url ?? existing.url,
      d.cost != null ? parseFloat(d.cost) : existing.cost,
      d.description ?? existing.description,
      d.notes ?? existing.notes,
      d.instructor_contact_id !== undefined ? (d.instructor_contact_id || null) : existing.instructor_contact_id,
      req.params.id
    );

    if (d.tags !== undefined) saveTagsByName(Number(req.params.id), 'career_learning', d.tags);
    if (d.cert_links !== undefined) saveCertLinks(Number(req.params.id), d.cert_links);

    res.json(db.prepare('SELECT * FROM career_learning WHERE id=?').get(req.params.id));
  } catch(e) { serverError(res, e); }
});

// ── DELETE /api/v1/career/learning/:id ───────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  try {
    if (!db.prepare('SELECT 1 FROM career_learning WHERE id=?').get(req.params.id))
      return notFound(res, 'Learning record');
    db.prepare('DELETE FROM career_learning_certs WHERE learning_id=?').run(req.params.id);
    db.prepare('DELETE FROM career_learning WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── GET /api/v1/career/learning/cert-preset?name=PMP ─────────
router.get('/cert-preset', (req, res) => {
  const preset = certPreset(req.query.name || '');
  res.json(preset || {});
});

// ── Helper: save cert links ───────────────────────────────────
function saveCertLinks(learningId, links) {
  db.prepare('DELETE FROM career_learning_certs WHERE learning_id=?').run(learningId);
  const ins = db.prepare(`
    INSERT OR IGNORE INTO career_learning_certs
      (learning_id, certification_id, hours_applied, ce_category, notes)
    VALUES (?,?,?,?,?)
  `);
  const txn = db.transaction(() => {
    for (const lk of links) {
      if (!lk.certification_id) continue;
      ins.run(learningId, lk.certification_id,
        lk.hours_applied != null ? parseFloat(lk.hours_applied) : null,
        lk.ce_category || null, lk.notes || null);
    }
  });
  txn();
}

module.exports = { router, certPreset, addCycleEnd };
