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
const { resolvePatient }                = require('../../shared/namematch');
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
    // Check which FK columns exist (added by migration 086)
    const medCols = db.prepare("PRAGMA table_info(med_medications)").all().map(r => r.name);
    const hasPharmacy  = medCols.includes('pharmacy_contact_id');
    const hasFamilyMed = medCols.includes('family_member_id');
    const hasCondition = medCols.includes('condition_id');

    let sql = `SELECT m.*` +
      (hasFamilyMed  ? `, fm.display_name AS family_member_name` : `, NULL AS family_member_name`) +
      (hasPharmacy   ? `, pharm.name AS pharmacy_name` : `, NULL AS pharmacy_name`) +
      (hasCondition  ? `, cond.condition_name AS condition_name_text` : `, NULL AS condition_name_text`) +
      ` FROM med_medications m` +
      (hasFamilyMed  ? ` LEFT JOIN family_members fm   ON fm.id    = m.family_member_id` : ``) +
      (hasPharmacy   ? ` LEFT JOIN contacts pharm      ON pharm.id = m.pharmacy_contact_id` : ``) +
      (hasCondition  ? ` LEFT JOIN med_conditions cond ON cond.id  = m.condition_id` : ``) +
      ` WHERE 1=1`;
    const p = [];
    if (req.query.patient)          { sql += ' AND (m.patient=? OR fm.display_name=?)'; p.push(req.query.patient, req.query.patient); }
    if (req.query.family_member_id && hasFamilyMed) { sql += ' AND m.family_member_id=?'; p.push(req.query.family_member_id); }
    if (req.query.status)           { sql += ' AND m.status=?'; p.push(req.query.status); }
    sql += hasFamilyMed ? ' ORDER BY fm.display_name, m.status, m.name COLLATE NOCASE' : ' ORDER BY m.patient, m.status, m.name COLLATE NOCASE';
    const rows = db.prepare(sql).all(...p).map(m => withTagNames(m, 'medical_medication'));

    // Slice 1 enrichment — additive only, behind table-existence guards so this
    // route still works on a DB that hasn't run migration 119 yet.
    const tableExists = (name) =>
      !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
    const hasJunction = tableExists('med_medication_conditions');
    const hasFills    = tableExists('med_medication_fills');
    const hasLinks    = tableExists('hsa_payment_links');

    if (hasJunction || hasFills || hasLinks) {
      const condStmt = hasJunction ? db.prepare(`
        SELECT c.id, c.condition_name FROM med_medication_conditions mc
        JOIN med_conditions c ON c.id = mc.condition_id
        WHERE mc.medication_id = ?
        ORDER BY c.condition_name COLLATE NOCASE
      `) : null;
      // v202604.146 — also pull quantity (migration 123) when present.
      // Older DBs without the column still get fill_date / days_supply / cost.
      let fillStmt = null;
      let hasQty = false;
      if (hasFills) {
        const fillCols = db.prepare("PRAGMA table_info(med_medication_fills)").all().map(r => r.name);
        hasQty = fillCols.includes('quantity');
        const sel = hasQty
          ? 'fill_date, days_supply, cost, quantity'
          : 'fill_date, days_supply, cost';
        fillStmt = db.prepare(`
          SELECT ${sel} FROM med_medication_fills
          WHERE medication_id = ? ORDER BY fill_date DESC LIMIT 1
        `);
      }
      const ytdStmt = hasLinks ? db.prepare(`
        SELECT COALESCE(SUM(p.you_paid), 0) AS total FROM hsa_payment_links l
        JOIN hsa_payments p ON p.id = l.hsa_payment_id
        WHERE l.entity_type = 'medication' AND l.entity_id = ?
          AND substr(p.date, 1, 4) = strftime('%Y', 'now')
      `) : null;

      for (const m of rows) {
        if (condStmt) m.conditions = condStmt.all(m.id);
        if (fillStmt) {
          const f = fillStmt.get(m.id);
          m.last_filled = f ? f.fill_date : null;
          m.last_fill_cost = f ? f.cost : null;
          m.last_fill_days_supply = f ? f.days_supply : null;
          if (hasQty) m.last_fill_quantity = f ? f.quantity : null;
        }
        if (ytdStmt) m.hsa_ytd = ytdStmt.get(m.id).total;
      }
    }

    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/medications', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');

    // Slice 1: new columns are optional. Defensively check existence so
    // this route works on a DB that hasn't run migration 119 yet.
    const cols = db.prepare("PRAGMA table_info(med_medications)").all().map(r => r.name);
    const hasSliceCols = cols.includes('brand_name');

    let info;
    if (hasSliceCols) {
      info = db.prepare(`
        INSERT INTO med_medications (patient, name, dosage, frequency, physician, physician_contact_id, start_date, end_date, status, purpose, notes,
           family_member_id, pharmacy_contact_id, condition_id,
           rx_number, refills_remaining, next_refill_date, controlled_schedule,
           brand_name, generic_name, form, drug_class,
           take_with_food, time_of_day, interaction_warning)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,
           ?,?,?,?,?,?,?,
           ?,?,?,?,
           ?,?,?)
      `).run(d.patient||'Self', d.name, d.dosage||null, d.frequency||null,
             d.physician||null, d.physician_contact_id||null,
             d.start_date||null, d.end_date||null, d.status||'Active', d.purpose||null, d.notes||null,
             d.family_member_id||null, d.pharmacy_contact_id||null, d.condition_id||null,
             d.rx_number||null, d.refills_remaining!=null?parseInt(d.refills_remaining):null,
             d.next_refill_date||null, d.controlled_schedule||null,
             d.brand_name||null, d.generic_name||null, d.form||null, d.drug_class||null,
             d.take_with_food?1:0, d.time_of_day||null, d.interaction_warning||null);
    } else {
      info = db.prepare(`
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
    }

    // Slice 1: also populate the junction if condition_id was given,
    // and accept an optional condition_ids array for multi-condition.
    const newId = info.lastInsertRowid;
    const junctionExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_medication_conditions'").get();
    if (junctionExists) {
      const linkStmt = db.prepare('INSERT OR IGNORE INTO med_medication_conditions (medication_id, condition_id) VALUES (?, ?)');
      if (d.condition_id) linkStmt.run(newId, d.condition_id);
      if (Array.isArray(d.condition_ids)) {
        for (const cid of d.condition_ids) if (cid) linkStmt.run(newId, cid);
      }
    }

    if (d.tags) saveTagsByName(newId, 'medical_medication', d.tags);

    // v202604.145 — additive: persist generic_of when migration 122 has run.
    // Done as a separate UPDATE so the main INSERT statement above is
    // unchanged and continues to work on a DB without the column.
    if (cols.includes('generic_of') && d.generic_of !== undefined) {
      db.prepare('UPDATE med_medications SET generic_of=? WHERE id=?')
        .run(d.generic_of || null, newId);
    }

    res.status(201).json(withTagNames(db.prepare('SELECT * FROM med_medications WHERE id=?').get(newId), 'medical_medication'));
  } catch (e) { serverError(res, e); }
});

router.put('/medications/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const cols = db.prepare("PRAGMA table_info(med_medications)").all().map(r => r.name);
    const hasSliceCols = cols.includes('brand_name');

    if (hasSliceCols) {
      db.prepare(`
        UPDATE med_medications SET patient=?, name=?, dosage=?, frequency=?, physician=?,
          physician_contact_id=?, start_date=?, end_date=?, status=?, purpose=?, notes=?,
          family_member_id=?, pharmacy_contact_id=?, condition_id=?,
          rx_number=?, refills_remaining=?, next_refill_date=?, controlled_schedule=?,
          brand_name=?, generic_name=?, form=?, drug_class=?,
          take_with_food=?, time_of_day=?, interaction_warning=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(d.patient||'Self', d.name, d.dosage||null, d.frequency||null,
             d.physician||null, d.physician_contact_id||null,
             d.start_date||null, d.end_date||null, d.status||'Active', d.purpose||null, d.notes||null,
             d.family_member_id||null, d.pharmacy_contact_id||null, d.condition_id||null,
             d.rx_number||null, d.refills_remaining!=null?parseInt(d.refills_remaining):null,
             d.next_refill_date||null, d.controlled_schedule||null,
             d.brand_name||null, d.generic_name||null, d.form||null, d.drug_class||null,
             d.take_with_food?1:0, d.time_of_day||null, d.interaction_warning||null,
             req.params.id);
    } else {
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
    }

    // Slice 1: accept condition_ids array for full replacement of junction rows.
    // If condition_ids is not provided, junction is left alone (additive only).
    const junctionExists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_medication_conditions'").get();
    if (junctionExists && Array.isArray(d.condition_ids)) {
      db.prepare('DELETE FROM med_medication_conditions WHERE medication_id=?').run(req.params.id);
      const linkStmt = db.prepare('INSERT OR IGNORE INTO med_medication_conditions (medication_id, condition_id) VALUES (?, ?)');
      for (const cid of d.condition_ids) if (cid) linkStmt.run(req.params.id, cid);
    }

    if (d.tags !== undefined) saveTagsByName(req.params.id, 'medical_medication', d.tags);

    // v202604.145 — additive: persist generic_of when migration 122 has run.
    // Separate UPDATE keeps the main statement above unchanged.
    if (cols.includes('generic_of') && d.generic_of !== undefined) {
      db.prepare('UPDATE med_medications SET generic_of=? WHERE id=?')
        .run(d.generic_of || null, req.params.id);
    }

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

// ══════════════════════════════════════════════════════════════
// SLICE 1 — MEDICATION CONDITIONS JUNCTION
// (multi-condition per medication via med_medication_conditions)
// ══════════════════════════════════════════════════════════════

// GET /api/v1/medical/medications/:id/conditions
router.get('/medications/:id/conditions', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.id, c.condition_name, c.status, mc.created_at AS linked_at
      FROM med_medication_conditions mc
      JOIN med_conditions c ON c.id = mc.condition_id
      WHERE mc.medication_id = ?
      ORDER BY c.condition_name COLLATE NOCASE
    `).all(req.params.id);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/medical/medications/:id/conditions
// Body: { condition_id }
router.post('/medications/:id/conditions', requireAuth, (req, res) => {
  try {
    const { condition_id } = req.body || {};
    if (!condition_id) return badRequest(res, 'condition_id required');
    db.prepare(`
      INSERT OR IGNORE INTO med_medication_conditions (medication_id, condition_id)
      VALUES (?, ?)
    `).run(req.params.id, condition_id);
    res.status(201).json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/medical/medications/:id/conditions/:condId
router.delete('/medications/:id/conditions/:condId', requireAuth, (req, res) => {
  try {
    db.prepare(`
      DELETE FROM med_medication_conditions
      WHERE medication_id = ? AND condition_id = ?
    `).run(req.params.id, req.params.condId);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// SLICE 1 — MEDICATION FILL HISTORY
// (each refill is a row; last_filled = MAX(fill_date) per medication)
// ══════════════════════════════════════════════════════════════

// GET /api/v1/medical/medications/:id/fills
router.get('/medications/:id/fills', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT f.*, c.name AS pharmacy_name
      FROM med_medication_fills f
      LEFT JOIN contacts c ON c.id = f.pharmacy_contact_id
      WHERE f.medication_id = ?
      ORDER BY f.fill_date DESC, f.id DESC
    `).all(req.params.id);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/medical/medications/:id/fills
// Body: { fill_date, days_supply?, pharmacy_contact_id?, cost?, hsa_payment_id?, notes? }
// Side effects:
//   - bumps med_medications.next_refill_date if days_supply provided
//   - decrements refills_remaining if currently > 0
router.post('/medications/:id/fills', requireAuth, (req, res) => {
  try {
    const d = req.body || {};
    if (!d.fill_date) return badRequest(res, 'fill_date required');
    const info = db.prepare(`
      INSERT INTO med_medication_fills
        (medication_id, fill_date, days_supply, pharmacy_contact_id, cost, hsa_payment_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.params.id,
      d.fill_date,
      d.days_supply != null ? parseInt(d.days_supply) : null,
      d.pharmacy_contact_id || null,
      d.cost != null ? parseFloat(d.cost) : null,
      d.hsa_payment_id || null,
      d.notes || null
    );

    // Side effect: update next_refill_date and refills_remaining on the med
    const med = db.prepare('SELECT refills_remaining FROM med_medications WHERE id=?').get(req.params.id);
    if (med) {
      let nextDate = null;
      if (d.days_supply) {
        const fd = new Date(d.fill_date);
        if (!isNaN(fd.getTime())) {
          fd.setDate(fd.getDate() + parseInt(d.days_supply));
          nextDate = fd.toISOString().slice(0, 10);
        }
      }
      const newRefills = (med.refills_remaining != null && med.refills_remaining > 0)
        ? med.refills_remaining - 1
        : med.refills_remaining;
      db.prepare(`
        UPDATE med_medications
           SET next_refill_date = COALESCE(?, next_refill_date),
               refills_remaining = ?,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
      `).run(nextDate, newRefills, req.params.id);
    }

    res.status(201).json(db.prepare('SELECT * FROM med_medication_fills WHERE id=?').get(info.lastInsertRowid));
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/medical/medications/:id/fills/:fillId
router.delete('/medications/:id/fills/:fillId', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM med_medication_fills WHERE id=? AND medication_id=?')
      .run(req.params.fillId, req.params.id);
    res.json({ ok: true });
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
    // Slice 2 (v202604.143) — Card #6 enrichment.
    //
    // The card needs:
    //   - active_meds_count from junction (preferred) or patient-match fallback
    //   - related_visits_count from medical_notes
    //   - hsa_ytd from polymorphic hsa_payment_links (entity_type='condition')
    //   - latest tracked-metric value if a labs/vitals table exists
    //
    // All enrichment is wrapped in table-existence guards so the route still
    // runs on a DB without slice 1 / slice 2 schema additions.
    const condCols = db.prepare("PRAGMA table_info(med_conditions)").all().map(r => r.name);
    const hasFamilyCond  = condCols.includes('family_member_id');
    const hasBodySystem  = condCols.includes('body_system');
    const hasGoal        = condCols.includes('goal');
    const hasMetric      = condCols.includes('tracked_metric');
    const hasState       = condCols.includes('condition_state');
    const tableExists = (name) =>
      !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
    const hasJunction = tableExists('med_medication_conditions');
    const hasLinks    = tableExists('hsa_payment_links');
    const hasLabs     = tableExists('medical_labs') || tableExists('med_labs') || tableExists('vitals');
    // Pick whichever labs table exists — we only read from one, derived view
    const labsTable = tableExists('medical_labs') ? 'medical_labs'
                    : tableExists('med_labs')     ? 'med_labs'
                    : tableExists('vitals')       ? 'vitals'
                    : null;

    let sql = `SELECT c.*, fm.display_name AS family_member_name,
        (SELECT COUNT(*) FROM med_visit_notes v
           WHERE (c.family_member_id IS NOT NULL AND v.family_member_id = c.family_member_id)
              OR v.patient = c.patient
        ) AS related_visits_count
      FROM med_conditions c
      LEFT JOIN family_members fm ON fm.id = c.family_member_id
      WHERE 1=1`;
    const p = [];
    if (req.query.patient) { sql += ' AND patient=?'; p.push(req.query.patient); }
    if (req.query.status)  { sql += ' AND status=?';  p.push(req.query.status); }
    sql += ' ORDER BY patient, status, condition_name COLLATE NOCASE';
    const rows = db.prepare(sql).all(...p);

    // Per-row enrichment
    const medCountByJunction = hasJunction ? db.prepare(`
      SELECT COUNT(DISTINCT mc.medication_id) AS cnt
      FROM med_medication_conditions mc
      JOIN med_medications m ON m.id = mc.medication_id
      WHERE mc.condition_id = ? AND m.status='Active'
    `) : null;
    const medCountByPatient = db.prepare(`
      SELECT COUNT(*) AS cnt FROM med_medications m
      WHERE m.status='Active' AND
            ((? IS NOT NULL AND m.family_member_id = ?) OR m.patient = ?)
    `);
    const medsByJunction = hasJunction ? db.prepare(`
      SELECT m.id, m.name, m.dosage FROM med_medication_conditions mc
      JOIN med_medications m ON m.id = mc.medication_id
      WHERE mc.condition_id = ? AND m.status='Active'
      ORDER BY m.name COLLATE NOCASE LIMIT 5
    `) : null;
    const ytdStmt = hasLinks ? db.prepare(`
      SELECT COALESCE(SUM(p.you_paid), 0) AS total FROM hsa_payment_links l
      JOIN hsa_payments p ON p.id = l.hsa_payment_id
      WHERE l.entity_type = 'condition' AND l.entity_id = ?
        AND substr(p.date, 1, 4) = strftime('%Y', 'now')
    `) : null;
    const latestMetricStmt = (labsTable && hasMetric) ? db.prepare(`
      SELECT value, recorded_at FROM ${labsTable}
      WHERE metric = ?
        AND ((? IS NOT NULL AND family_member_id = ?) OR patient = ?)
      ORDER BY recorded_at DESC LIMIT 1
    `) : null;
    const metricSeriesStmt = (labsTable && hasMetric) ? db.prepare(`
      SELECT value, recorded_at FROM ${labsTable}
      WHERE metric = ?
        AND ((? IS NOT NULL AND family_member_id = ?) OR patient = ?)
      ORDER BY recorded_at DESC LIMIT 12
    `) : null;

    for (const c of rows) {
      // active medication count
      let medCount = 0;
      if (medCountByJunction) {
        medCount = medCountByJunction.get(c.id)?.cnt || 0;
      }
      if (medCount === 0) {
        medCount = medCountByPatient.get(c.family_member_id, c.family_member_id, c.patient)?.cnt || 0;
      }
      c.active_meds_count = medCount;
      // top-N med chips from junction (used by the "On" column on Card #6)
      c.medications = medsByJunction ? medsByJunction.all(c.id) : [];
      // HSA spent on this condition this year
      c.hsa_ytd = ytdStmt ? (ytdStmt.get(c.id)?.total || 0) : 0;
      // Latest reading + small series for sparkline
      if (latestMetricStmt && c.tracked_metric) {
        const latest = latestMetricStmt.get(c.tracked_metric, c.family_member_id, c.family_member_id, c.patient);
        if (latest) c.latest_metric = { value: latest.value, recorded_at: latest.recorded_at };
        if (metricSeriesStmt) {
          const series = metricSeriesStmt.all(c.tracked_metric, c.family_member_id, c.family_member_id, c.patient);
          c.metric_series = series.reverse(); // chronological for the sparkline
        }
      }
    }
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/conditions', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.condition_name) return badRequest(res, 'condition_name required');
    const condCols = db.prepare("PRAGMA table_info(med_conditions)").all().map(r => r.name);
    const hasSlice2 = condCols.includes('body_system');

    if (hasSlice2) {
      const info = db.prepare(`
        INSERT INTO med_conditions
          (patient, condition_name, start_date, end_date, physician, physician_contact_id,
           treatment_notes, status, notes, family_member_id,
           body_system, goal, tracked_metric, condition_state)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(d.patient||'Self', d.condition_name, d.start_date||null, d.end_date||null,
             d.physician||null, d.physician_contact_id||null,
             d.treatment_notes||null, d.status||'Active', d.notes||null,
             d.family_member_id||null,
             d.body_system||null, d.goal||null, d.tracked_metric||null, d.condition_state||null);
      res.status(201).json({ id: info.lastInsertRowid });
    } else {
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
    }
  } catch (e) { serverError(res, e); }
});

router.put('/conditions/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const condCols = db.prepare("PRAGMA table_info(med_conditions)").all().map(r => r.name);
    const hasSlice2 = condCols.includes('body_system');

    if (hasSlice2) {
      db.prepare(`
        UPDATE med_conditions SET patient=?, condition_name=?, start_date=?, end_date=?,
          physician=?, physician_contact_id=?, treatment_notes=?, status=?, notes=?,
          family_member_id=?,
          body_system=?, goal=?, tracked_metric=?, condition_state=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(d.patient||'Self', d.condition_name, d.start_date||null, d.end_date||null,
             d.physician||null, d.physician_contact_id||null,
             d.treatment_notes||null, d.status||'Active', d.notes||null,
             d.family_member_id||null,
             d.body_system||null, d.goal||null, d.tracked_metric||null, d.condition_state||null,
             req.params.id);
    } else {
      db.prepare(`
        UPDATE med_conditions SET patient=?, condition_name=?, start_date=?, end_date=?,
          physician=?, physician_contact_id=?, treatment_notes=?, status=?, notes=?,
          family_member_id=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(d.patient||'Self', d.condition_name, d.start_date||null, d.end_date||null,
             d.physician||null, d.physician_contact_id||null,
             d.treatment_notes||null, d.status||'Active', d.notes||null,
             d.family_member_id||null, req.params.id);
    }
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

function getEobParser() {
  try {
    const row = db.prepare("SELECT value FROM app_config WHERE key = 'eob_parser'").get();
    return row?.value || 'mhbp';
  } catch { return 'mhbp'; }
}

// POST /api/v1/medical/eob/preview  — parse PDF, return summary (no DB write)
router.post('/eob/preview', requireAuth, uploadEob.single('file'), async (req, res) => {
  if (!req.file) return badRequest(res, 'No file uploaded');
  try {
    const parserType = getEobParser();
    if (parserType !== 'mhbp') return res.status(400).json({ ok: false, error: `Parser '${parserType}' not yet implemented` });
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
    const parserType = getEobParser();
    if (parserType !== 'mhbp') return badRequest(res, `Parser '${parserType}' not yet implemented`);
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
          const nameMatch  = resolvePatient(patientRaw);
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

          // v202604.140 — Auto-link this new EOB claim to any unmatched
          // HSA payment that fits (same patient, ±7 days, similar amount).
          // ONLY auto-link when there's exactly one candidate — otherwise
          // flag for manual review via the inbox UI's "EOB candidates"
          // endpoint. Multiple matches = ambiguity, never silent.
          try {
            const cents = Math.round((c.your_share || 0) * 100);
            if (cents > 0 && c.send_date) {
              const candidates = db.prepare(`
                SELECT id FROM hsa_payments
                WHERE eob_claim_id IS NULL
                  AND patient = ?
                  AND ABS(julianday(date) - julianday(?)) <= 7
                  AND ABS(ROUND(you_paid * 100) - ?) <= 100
                  AND COALESCE(status, 'final') = 'final'
              `).all(patientRaw, c.send_date, cents);
              if (candidates.length === 1) {
                db.prepare(`
                  UPDATE hsa_payments SET eob_claim_id = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE id = ?
                `).run(claimId, candidates[0].id);
              }
            }
          } catch (linkErr) {
            // Auto-link is best-effort. Don't fail the import on link errors.
            console.warn('[eob/import] auto-link failed:', linkErr.message);
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
