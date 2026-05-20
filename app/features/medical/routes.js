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
const dedup    = require('./dedup');

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
      `, (SELECT COUNT(*) FROM attachments WHERE entity_type='med_medication' AND entity_id=m.id) AS attachment_count` +
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
    const hasDoseChg  = tableExists('med_medication_dose_changes');

    if (hasJunction || hasFills || hasLinks || hasDoseChg) {
      const condStmt = hasJunction ? db.prepare(`
        SELECT c.id, c.condition_name FROM med_medication_conditions mc
        JOIN med_conditions c ON c.id = mc.condition_id
        WHERE mc.medication_id = ?
        ORDER BY c.condition_name COLLATE NOCASE
      `) : null;
      // v202604.146 — also pull quantity (migration 123) when present.
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
      // v202604.147 — last dose change for the eyebrow "↻ Dose updated" pill.
      const doseStmt = hasDoseChg ? db.prepare(`
        SELECT changed_at FROM med_medication_dose_changes
         WHERE medication_id = ?
         ORDER BY changed_at DESC LIMIT 1
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
        if (doseStmt) {
          const dc = doseStmt.get(m.id);
          m.last_dose_change_at = dc ? dc.changed_at : null;
        }
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
    const hasDedup     = cols.includes('dedup_hash');

    // ── v202604.147 — Dedup gate ───────────────────────────────
    // Skip the gate when the caller explicitly opts out (used by the
    // resolution endpoint when the user clicked "Insert as new" after
    // seeing the prompt). All normal traffic goes through the gate.
    if (hasDedup && !d._skip_dedup) {
      const hash = dedup.medicationHash(d);
      const existing = dedup.findByHash(db, 'med_medications', hash);
      if (existing) {
        const existingActive = ['Active','As Needed','Monitoring'].includes(existing.status);
        const existingDiscont = ['Discontinued','Resolved','Completed'].includes(existing.status);
        // Same dose + active → identical → silent skip (return existing)
        if (existingActive && (existing.dosage || '') === (d.dosage || '')) {
          return res.status(200).json({
            ...existing,
            _dedup: 'identical',
            _message: 'A matching active medication already exists.'
          });
        }
        // Discontinued match → reactivate prompt path. Return 409 with
        // candidate so the client can show the dialog.
        if (existingDiscont) {
          return res.status(409).json({
            _dedup: 'reactivate_match',
            existing: existing,
            proposed_dosage: d.dosage || existing.dosage,
            message: `Found discontinued ${existing.name} for this person. Reactivate that record (preserves history)?`,
          });
        }
      }

      // Hash miss → look for an active row with the same patient + drug
      // name but a different dose. That's the "Lipitor 10mg → 20mg"
      // scenario where the user is adjusting dosage. Hash differs because
      // it's keyed on dose. Surface as a dose_change prompt.
      const whoCol = d.family_member_id != null ? 'family_member_id' : 'patient';
      const whoVal = d.family_member_id != null ? d.family_member_id : (d.patient || 'Self');
      const activeSameName = db.prepare(`
        SELECT * FROM med_medications
         WHERE ${whoCol} = ? AND name = ? COLLATE NOCASE
           AND status IN ('Active','As Needed','Monitoring')
      `).get(whoVal, d.name);
      if (activeSameName && (activeSameName.dosage || '') !== (d.dosage || '')) {
        return res.status(409).json({
          _dedup: 'dose_change',
          existing: activeSameName,
          proposed_dosage: d.dosage,
          message: `${activeSameName.name} already exists at ${activeSameName.dosage}. Update the dose to ${d.dosage} on the same record?`,
        });
      }

      // Also catch: hash miss but a discontinued row exists at a *different*
      // dose for the same drug (the user is reactivating a previous Rx
      // even though they're prescribed a different dose now).
      const discontSameName = db.prepare(`
        SELECT * FROM med_medications
         WHERE ${whoCol} = ? AND name = ? COLLATE NOCASE
           AND status IN ('Discontinued','Resolved','Completed')
         ORDER BY end_date DESC, id DESC LIMIT 1
      `).get(whoVal, d.name);
      if (discontSameName) {
        return res.status(409).json({
          _dedup: 'reactivate_match',
          existing: discontSameName,
          proposed_dosage: d.dosage || discontSameName.dosage,
          message: `Found discontinued ${discontSameName.name} (last at ${discontSameName.dosage || 'no dose'}) for this person. Reactivate that record${(d.dosage && d.dosage !== discontSameName.dosage) ? ' and update to ' + d.dosage : ''}?`,
        });
      }
    }

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
    if (cols.includes('generic_of') && d.generic_of !== undefined) {
      db.prepare('UPDATE med_medications SET generic_of=? WHERE id=?')
        .run(d.generic_of || null, newId);
    }

    // v202604.147 — store the natural-key hash for future dedup lookups.
    if (hasDedup) {
      const row = db.prepare('SELECT * FROM med_medications WHERE id=?').get(newId);
      const h = dedup.medicationHash(row);
      db.prepare('UPDATE med_medications SET dedup_hash=? WHERE id=?').run(h, newId);
    }

    res.status(201).json(withTagNames(db.prepare('SELECT * FROM med_medications WHERE id=?').get(newId), 'medical_medication'));
  } catch (e) { serverError(res, e); }
});

router.put('/medications/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const cols = db.prepare("PRAGMA table_info(med_medications)").all().map(r => r.name);
    const hasSliceCols = cols.includes('brand_name');
    const hasDedup     = cols.includes('dedup_hash');

    // v202604.147 — log dose change before mutation if dosage is changing.
    // Driven by the dose_changes table (migration 124). Source flag lets
    // us distinguish manual edits from parser-merge resolutions later.
    const beforeRow = db.prepare('SELECT dosage FROM med_medications WHERE id=?').get(req.params.id);
    if (beforeRow && d.dosage !== undefined && (beforeRow.dosage || '') !== (d.dosage || '')) {
      const hasDoseTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_medication_dose_changes'").get();
      if (hasDoseTable) {
        db.prepare(`
          INSERT INTO med_medication_dose_changes (medication_id, old_dosage, new_dosage, changed_by)
          VALUES (?,?,?,?)
        `).run(req.params.id, beforeRow.dosage || null, d.dosage || null, d._change_source || 'manual');
      }
    }

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
    if (cols.includes('generic_of') && d.generic_of !== undefined) {
      db.prepare('UPDATE med_medications SET generic_of=? WHERE id=?')
        .run(d.generic_of || null, req.params.id);
    }

    // v202604.147 — recompute dedup_hash since dosage / patient / name may have changed.
    if (hasDedup) {
      const row = db.prepare('SELECT * FROM med_medications WHERE id=?').get(req.params.id);
      if (row) {
        const h = dedup.medicationHash(row);
        db.prepare('UPDATE med_medications SET dedup_hash=? WHERE id=?').run(h, req.params.id);
      }
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

    // v202604.147 — column-aware insert. Migration 123 added quantity,
    // prescriber_contact_id, brand_dispensed, you_paid_oop, insurance_covered,
    // rx_number, refill_seq. Build the INSERT dynamically so this still
    // works on a DB that hasn't run 123 yet.
    const fillCols = db.prepare("PRAGMA table_info(med_medication_fills)").all().map(r => r.name);
    const baseCols = ['medication_id','fill_date','days_supply','pharmacy_contact_id','cost','hsa_payment_id','notes'];
    const baseVals = [
      req.params.id, d.fill_date,
      d.days_supply != null ? parseInt(d.days_supply) : null,
      d.pharmacy_contact_id || null,
      d.cost != null ? parseFloat(d.cost) : null,
      d.hsa_payment_id || null,
      d.notes || null,
    ];
    const extraCols = [];
    const extraVals = [];
    const maybeAdd = (col, val) => {
      if (fillCols.includes(col)) { extraCols.push(col); extraVals.push(val); }
    };
    maybeAdd('quantity',              d.quantity              != null ? Number(d.quantity)              : null);
    maybeAdd('prescriber_contact_id', d.prescriber_contact_id != null ? parseInt(d.prescriber_contact_id) : null);
    maybeAdd('brand_dispensed',       d.brand_dispensed       || null);
    maybeAdd('you_paid_oop',          d.you_paid_oop          != null ? Number(d.you_paid_oop)          : null);
    maybeAdd('insurance_covered',     d.insurance_covered     != null ? Number(d.insurance_covered)     : null);
    maybeAdd('rx_number',             d.rx_number             || null);
    maybeAdd('refill_seq',            d.refill_seq            != null ? parseInt(d.refill_seq)          : null);

    const cols = [...baseCols, ...extraCols];
    const vals = [...baseVals, ...extraVals];
    const placeholders = cols.map(() => '?').join(',');
    const info = db.prepare(
      `INSERT INTO med_medication_fills (${cols.join(',')}) VALUES (${placeholders})`
    ).run(...vals);

    // Side effect: update next_refill_date and refills_remaining on the med.
    // v202604.147 — auto-decrement happens here. Spec: clicking "Order refill"
    // / logging a fill decrements refills_remaining by 1 (floor 0). Resets the
    // doses-left bar visually because last_filled refreshes too.
    const med = db.prepare('SELECT refills_remaining, rx_number FROM med_medications WHERE id=?').get(req.params.id);
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
      // If the fill carried a different rx_number than what's on the med
      // (renewal), update it. Otherwise leave med.rx_number alone.
      const rxToUse = (d.rx_number && d.rx_number !== med.rx_number) ? d.rx_number : null;
      db.prepare(`
        UPDATE med_medications
           SET next_refill_date = COALESCE(?, next_refill_date),
               refills_remaining = ?,
               rx_number = COALESCE(?, rx_number),
               updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
      `).run(nextDate, newRefills, rxToUse, req.params.id);
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
    // v202604.147 — prefer the new med_condition_metrics table (written by
    // the inline reading panel on the condition card) over older `labs`
    // shapes. Fall back to whichever exists.
    const hasNewMetrics = tableExists('med_condition_metrics');
    const hasLabs     = tableExists('medical_labs') || tableExists('med_labs') || tableExists('vitals');
    const labsTable = tableExists('medical_labs') ? 'medical_labs'
                    : tableExists('med_labs')     ? 'med_labs'
                    : tableExists('vitals')       ? 'vitals'
                    : null;

    let sql = `SELECT c.*, fm.display_name AS family_member_name,
        (SELECT COUNT(*) FROM med_visit_notes v
           WHERE (c.family_member_id IS NOT NULL AND v.family_member_id = c.family_member_id)
              OR v.patient = c.patient
        ) AS related_visits_count,
        (SELECT COUNT(*) FROM attachments
           WHERE entity_type='med_condition' AND entity_id=c.id) AS attachment_count
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
    // v202604.147 — readers for the new med_condition_metrics table.
    // Keyed by condition_id rather than patient+metric, so they're more
    // reliable. Used preferentially when the table exists and has rows.
    const newLatestStmt = hasNewMetrics ? db.prepare(`
      SELECT value_numeric, value_text, unit, measured_on
        FROM med_condition_metrics
       WHERE condition_id = ? ${hasMetric ? 'AND metric_name = COALESCE(?, metric_name)' : ''}
       ORDER BY measured_on DESC LIMIT 1
    `) : null;
    const newSeriesStmt = hasNewMetrics ? db.prepare(`
      SELECT value_numeric, value_text, unit, measured_on
        FROM med_condition_metrics
       WHERE condition_id = ? ${hasMetric ? 'AND metric_name = COALESCE(?, metric_name)' : ''}
       ORDER BY measured_on DESC LIMIT 12
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
      // v202604.147 — try med_condition_metrics first (always keyed by
      // condition.id, no patient-text fuzziness). Fall back to labs table
      // for backward compat with pre-.147 data.
      let metricResolved = false;
      if (newLatestStmt) {
        const params = hasMetric ? [c.id, c.tracked_metric || null] : [c.id];
        const latestNew = newLatestStmt.get(...params);
        if (latestNew) {
          const v = latestNew.value_numeric != null ? latestNew.value_numeric : latestNew.value_text;
          c.latest_metric = { value: v, unit: latestNew.unit, recorded_at: latestNew.measured_on };
          if (newSeriesStmt) {
            const sParams = hasMetric ? [c.id, c.tracked_metric || null] : [c.id];
            const series = newSeriesStmt.all(...sParams).map(r => ({
              value: r.value_numeric != null ? r.value_numeric : r.value_text,
              recorded_at: r.measured_on,
            }));
            c.metric_series = series.reverse();
          }
          metricResolved = true;
        }
      }
      if (!metricResolved && latestMetricStmt && c.tracked_metric) {
        const latest = latestMetricStmt.get(c.tracked_metric, c.family_member_id, c.family_member_id, c.patient);
        if (latest) c.latest_metric = { value: latest.value, recorded_at: latest.recorded_at };
        if (metricSeriesStmt) {
          const series = metricSeriesStmt.all(c.tracked_metric, c.family_member_id, c.family_member_id, c.patient);
          c.metric_series = series.reverse();
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
    const hasDedup  = condCols.includes('dedup_hash');

    // v202604.147 — dedup gate. Conditions are one-per-person-per-name,
    // so a hash collision is always identical → silent skip (return existing).
    if (hasDedup && !d._skip_dedup) {
      const hash = dedup.conditionHash(d);
      const existing = dedup.findByHash(db, 'med_conditions', hash);
      if (existing) {
        return res.status(200).json({
          ...existing,
          _dedup: 'identical',
          _message: 'A matching condition already exists for this person.'
        });
      }
    }

    let newId;
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
      newId = info.lastInsertRowid;
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
      newId = info.lastInsertRowid;
    }

    if (hasDedup) {
      const row = db.prepare('SELECT * FROM med_conditions WHERE id=?').get(newId);
      const h = dedup.conditionHash(row);
      db.prepare('UPDATE med_conditions SET dedup_hash=? WHERE id=?').run(h, newId);
    }

    res.status(201).json({ id: newId });
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

    // v202604.147 — recompute dedup_hash since patient/name may have changed.
    if (condCols.includes('dedup_hash')) {
      const row = db.prepare('SELECT * FROM med_conditions WHERE id=?').get(req.params.id);
      if (row) {
        const h = dedup.conditionHash(row);
        db.prepare('UPDATE med_conditions SET dedup_hash=? WHERE id=?').run(h, req.params.id);
      }
    }

    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/conditions/:id', requireAuth, (req, res) => {
  try {
    // v202604.149 — clear junctions before delete (no CASCADE per arch rule)
    try { db.prepare('DELETE FROM med_visit_conditions WHERE condition_id=?').run(req.params.id); } catch(e) {}
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
    // v202604.149 — visit list enrichment for unified card view.
    //   - family_member_name (avatar label on card)
    //   - attachment_count (paperclip badge)
    //   - linked_conditions array (chips on the card)
    // Guarded so route still runs even if the junction table hasn't
    // been migrated yet on a particular DB.
    const tableExists = (name) =>
      !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
    const hasJunction  = tableExists('med_visit_conditions');
    const hasFamily    = !!db.prepare("PRAGMA table_info(med_visit_notes)").all()
                          .find(c => c.name === 'family_member_id');

    let sql = `
      SELECT n.*, c.name AS physician_name, c.specialty, c.company AS practice_name,
        ${hasFamily ? 'fm.display_name AS family_member_name,' : 'NULL AS family_member_name,'}
        (SELECT COUNT(*) FROM attachments
           WHERE entity_type='med_visit' AND entity_id=n.id) AS attachment_count
      FROM med_visit_notes n
      LEFT JOIN contacts c ON c.id = n.contact_id
      ${hasFamily ? 'LEFT JOIN family_members fm ON fm.id = n.family_member_id' : ''}
      WHERE 1=1
    `;
    const params = [];
    if (req.query.patient)    { sql += ' AND n.patient=?';          params.push(req.query.patient); }
    if (req.query.follow_up)  { sql += ' AND n.follow_up_needed=?'; params.push(req.query.follow_up); }
    sql += ' ORDER BY n.visit_date DESC, n.id DESC';

    const rows = db.prepare(sql).all(...params);

    // Linked conditions per visit (small array of {id, name})
    const linkStmt = hasJunction ? db.prepare(`
      SELECT mc.id, mc.condition_name AS name
        FROM med_visit_conditions vc
        JOIN med_conditions mc ON mc.id = vc.condition_id
       WHERE vc.visit_id = ?
       ORDER BY mc.condition_name COLLATE NOCASE
    `) : null;
    for (const r of rows) {
      r.linked_conditions = linkStmt ? linkStmt.all(r.id) : [];
    }

    res.json(rows.map(n => withTagNames(n, 'medical_visit')));
  } catch (e) { serverError(res, e); }
});

router.post('/notes', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.visit_date) return badRequest(res, 'visit_date required');
    const visitCols = db.prepare("PRAGMA table_info(med_visit_notes)").all().map(r => r.name);
    const hasNewFields = visitCols.includes('start_time');
    const hasDedup     = visitCols.includes('dedup_hash');

    // v202604.147 — dedup gate. Visit hash includes start_time so two
    // follow-ups same day same provider don't collide.
    if (hasDedup && hasNewFields && !d._skip_dedup) {
      const hash = dedup.visitHash(d);
      const existing = dedup.findByHash(db, 'med_visit_notes', hash);
      if (existing) {
        return res.status(409).json({
          _dedup: 'strong_match',
          existing: existing,
          message: 'A visit at this time with this provider already exists. Update the existing record instead?'
        });
      }
    }

    let info;
    if (hasNewFields) {
      info = db.prepare(`
        INSERT INTO med_visit_notes
          (patient, contact_id, physician_contact_id, visit_date, start_time, duration_min,
           visit_location, visit_type, reason,
           questions, doctors_response, follow_up_needed, follow_up_date, notes,
           bp_systolic, bp_diastolic, weight_lb, temperature_f, heart_rate_bpm, visit_cost_oop,
           family_member_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(d.patient||'Self', d.contact_id||null, d.physician_contact_id||null,
             d.visit_date, d.start_time||null, d.duration_min||null,
             d.visit_location||null, d.visit_type||null, d.reason||null,
             d.questions||null, d.doctors_response||null,
             d.follow_up_needed ? 1 : 0, d.follow_up_date||null, d.notes||null,
             d.bp_systolic||null, d.bp_diastolic||null, d.weight_lb||null,
             d.temperature_f||null, d.heart_rate_bpm||null, d.visit_cost_oop||null,
             d.family_member_id||null);
    } else {
      info = db.prepare(`
        INSERT INTO med_visit_notes
          (patient, contact_id, visit_date, questions, doctors_response, follow_up_needed, follow_up_date, notes, family_member_id)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).run(d.patient||'Self', d.contact_id||null, d.visit_date,
             d.questions||null, d.doctors_response||null,
             d.follow_up_needed ? 1 : 0, d.follow_up_date||null, d.notes||null,
             d.family_member_id||null);
    }

    const newId = info.lastInsertRowid;
    if (d.tags) saveTagsByName(newId, 'medical_visit', d.tags);

    // v202604.149 — visit ↔ condition junction. Body may include
    // linked_condition_ids: [int, ...]. Replace the set wholesale
    // (POST has no prior set, so just inserts).
    try {
      if (Array.isArray(d.linked_condition_ids) &&
          db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_visit_conditions'").get()) {
        const ins = db.prepare('INSERT OR IGNORE INTO med_visit_conditions(visit_id,condition_id) VALUES (?,?)');
        for (const cid of d.linked_condition_ids) {
          if (cid != null) ins.run(newId, +cid);
        }
      }
    } catch(e) { /* table may not exist yet */ }

    if (hasDedup) {
      const row = db.prepare('SELECT * FROM med_visit_notes WHERE id=?').get(newId);
      const h = dedup.visitHash(row);
      db.prepare('UPDATE med_visit_notes SET dedup_hash=? WHERE id=?').run(h, newId);
    }

    res.status(201).json(withTagNames(db.prepare('SELECT * FROM med_visit_notes WHERE id=?').get(newId), 'medical_visit'));
  } catch (e) { serverError(res, e); }
});

router.put('/notes/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const visitCols = db.prepare("PRAGMA table_info(med_visit_notes)").all().map(r => r.name);
    const hasNewFields = visitCols.includes('start_time');
    const hasDedup     = visitCols.includes('dedup_hash');

    if (hasNewFields) {
      db.prepare(`
        UPDATE med_visit_notes SET patient=?, contact_id=?, physician_contact_id=?,
          visit_date=?, start_time=?, duration_min=?, visit_location=?, visit_type=?, reason=?,
          questions=?, doctors_response=?, follow_up_needed=?, follow_up_date=?, notes=?,
          bp_systolic=?, bp_diastolic=?, weight_lb=?, temperature_f=?, heart_rate_bpm=?, visit_cost_oop=?,
          family_member_id=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(d.patient||'Self', d.contact_id||null, d.physician_contact_id||null,
             d.visit_date, d.start_time||null, d.duration_min||null,
             d.visit_location||null, d.visit_type||null, d.reason||null,
             d.questions||null, d.doctors_response||null,
             d.follow_up_needed ? 1 : 0, d.follow_up_date||null, d.notes||null,
             d.bp_systolic||null, d.bp_diastolic||null, d.weight_lb||null,
             d.temperature_f||null, d.heart_rate_bpm||null, d.visit_cost_oop||null,
             d.family_member_id||null, req.params.id);
    } else {
      db.prepare(`
        UPDATE med_visit_notes SET patient=?, contact_id=?, visit_date=?,
          questions=?, doctors_response=?, follow_up_needed=?, follow_up_date=?,
          notes=?, family_member_id=?, updated_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(d.patient||'Self', d.contact_id||null, d.visit_date,
             d.questions||null, d.doctors_response||null,
             d.follow_up_needed ? 1 : 0, d.follow_up_date||null, d.notes||null,
             d.family_member_id||null, req.params.id);
    }

    if (d.tags !== undefined) saveTagsByName(req.params.id, 'medical_visit', d.tags);

    // v202604.149 — visit ↔ condition junction. Replace-set semantics:
    // if the body includes linked_condition_ids (even an empty array),
    // wipe and rewrite. If undefined, leave the set untouched.
    try {
      if (Array.isArray(d.linked_condition_ids) &&
          db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_visit_conditions'").get()) {
        db.prepare('DELETE FROM med_visit_conditions WHERE visit_id=?').run(req.params.id);
        const ins = db.prepare('INSERT OR IGNORE INTO med_visit_conditions(visit_id,condition_id) VALUES (?,?)');
        for (const cid of d.linked_condition_ids) {
          if (cid != null) ins.run(req.params.id, +cid);
        }
      }
    } catch(e) { /* table may not exist yet */ }

    if (hasDedup) {
      const row = db.prepare('SELECT * FROM med_visit_notes WHERE id=?').get(req.params.id);
      if (row) {
        const h = dedup.visitHash(row);
        db.prepare('UPDATE med_visit_notes SET dedup_hash=? WHERE id=?').run(h, req.params.id);
      }
    }

    clearReview('med_visit_notes', req.params.id);
    res.json(withTagNames(db.prepare('SELECT * FROM med_visit_notes WHERE id=?').get(req.params.id), 'medical_visit'));
  } catch (e) { serverError(res, e); }
});

router.delete('/notes/:id', requireAuth, (req, res) => {
  try {
    clearTags(req.params.id, 'medical_visit');
    // v202604.149 — clear visit↔condition junction (no FK CASCADE per arch rule)
    try { db.prepare('DELETE FROM med_visit_conditions WHERE visit_id=?').run(req.params.id); } catch(e) {}
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

// ════════════════════════════════════════════════════════════════════
// v202604.166 — Read endpoints for new tables from migration 131:
//   med_lab_results / med_diagnostics / med_allergies / med_vitals_readings
//
// All public GETs (consistent with rest of module). Each accepts an
// optional ?family_member_id filter. Sorted newest-first. Limit param
// caps result size at 500 by default.
// ════════════════════════════════════════════════════════════════════

function _filterByFm(req) {
  const fmId = req.query.family_member_id;
  if (!fmId) return { sql: '', params: [] };
  return { sql: ' WHERE family_member_id = ?', params: [Number(fmId)] };
}

router.get('/labs', (req, res) => {
  try {
    const { sql, params } = _filterByFm(req);
    const limit = Math.min(500, parseInt(req.query.limit || '500', 10));
    const rows = db.prepare(
      `SELECT * FROM med_lab_results${sql} ORDER BY test_date DESC, id DESC LIMIT ${limit}`
    ).all(...params);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.get('/diagnostics', (req, res) => {
  try {
    const { sql, params } = _filterByFm(req);
    const limit = Math.min(500, parseInt(req.query.limit || '500', 10));
    const rows = db.prepare(
      `SELECT * FROM med_diagnostics${sql} ORDER BY test_date DESC, id DESC LIMIT ${limit}`
    ).all(...params);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.get('/allergies', (req, res) => {
  try {
    const { sql, params } = _filterByFm(req);
    const limit = Math.min(500, parseInt(req.query.limit || '500', 10));
    const rows = db.prepare(
      `SELECT * FROM med_allergies${sql} ORDER BY status = 'Active' DESC, noted_date DESC, id DESC LIMIT ${limit}`
    ).all(...params);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.get('/vitals', (req, res) => {
  try {
    const { sql, params } = _filterByFm(req);
    const limit = Math.min(500, parseInt(req.query.limit || '500', 10));
    const rows = db.prepare(
      `SELECT * FROM med_vitals_readings${sql} ORDER BY measure_date DESC, id DESC LIMIT ${limit}`
    ).all(...params);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// ════════════════════════════════════════════════════════════════════
//  IMMUNIZATIONS — v202604.181 (mig 144)
//
//  Vaccine records: flu, COVID, tetanus boosters, childhood vaccines.
//  Distinct from med_visit_notes (pharmacy-administered shots have no
//  visit) and med_medications (one-time administrations, not ongoing).
//  GET is public per AUTH-OPEN-GET; POST requires session.
// ════════════════════════════════════════════════════════════════════

router.get('/immunizations', (req, res) => {
  try {
    const { sql, params } = _filterByFm(req);
    const limit = Math.min(500, parseInt(req.query.limit || '500', 10));
    // schema: med_immunizations.{id, family_member_id, vaccine_name, date_given,
    //   dose_number, lot_number, administered_by_contact_id, location_text,
    //   next_due_date, notes, created_at, updated_at}
    // Order: upcoming due dates first (booster reminders), then most-recent shots.
    const rows = db.prepare(
      `SELECT * FROM med_immunizations${sql}
       ORDER BY (next_due_date IS NULL), next_due_date ASC, date_given DESC, id DESC
       LIMIT ${limit}`
    ).all(...params);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/immunizations', requireAuth, (req, res) => {
  try {
    const d = req.body || {};
    if (!d.family_member_id) return badRequest(res, 'family_member_id required');
    if (!d.vaccine_name)     return badRequest(res, 'vaccine_name required');
    if (!d.date_given)       return badRequest(res, 'date_given required');

    // schema: med_immunizations insert — all 9 user-settable fields.
    // created_at / updated_at default to CURRENT_TIMESTAMP at the table level.
    const info = db.prepare(`
      INSERT INTO med_immunizations (
        family_member_id, vaccine_name, date_given, dose_number, lot_number,
        administered_by_contact_id, location_text, next_due_date, notes
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      parseInt(d.family_member_id), d.vaccine_name, d.date_given,
      d.dose_number != null ? parseInt(d.dose_number) : null,
      d.lot_number || null,
      d.administered_by_contact_id != null ? parseInt(d.administered_by_contact_id) : null,
      d.location_text || null, d.next_due_date || null, d.notes || null
    );
    const row = db.prepare('SELECT * FROM med_immunizations WHERE id=?').get(info.lastInsertRowid);
    res.status(201).json(row);
  } catch (e) { serverError(res, e); }
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

    // ── v202604.147 — File-level hash gate ──────────────────────
    // Same PDF dropped twice → silent skip. Cheapest layer, runs before parse.
    const stmtCols = db.prepare("PRAGMA table_info(med_eob_statements)").all().map(r => r.name);
    const hasFileHash = stmtCols.includes('file_hash');
    const fileHash = hasFileHash ? dedup.fileHash(req.file.buffer) : null;
    if (hasFileHash && fileHash) {
      const sameFile = db.prepare('SELECT id, statement_date FROM med_eob_statements WHERE file_hash=? LIMIT 1')
        .get(fileHash);
      if (sameFile) {
        return res.json({
          ok: true, imported: 0, skipped: 1,
          _dedup: 'identical_file',
          message: `This exact file was already imported (statement ${sameFile.statement_date}).`
        });
      }
    }

    const { parseEobPdf } = require('./eob-parser');
    const statements = await parseEobPdf(req.file.buffer, req.file.originalname);
    if (!statements.length) return badRequest(res, 'No MHBP statements detected');

    // Optional filter: only import selected dates
    let selected = null;
    try { selected = JSON.parse(req.body.selected_dates || 'null'); } catch {}

    let imported = 0, skipped = 0, queued = 0;
    const nameFlags = [];

    const doImport = db.transaction(() => {
      for (const s of statements) {
        if (!s.statement_date || !s.member_id) { skipped++; continue; }
        if (selected && !selected.includes(s.statement_date)) { skipped++; continue; }

        // ── Record-level dedup ───────────────────────────────────
        // Statement key = insurer + member_id + statement_date.
        // Identical statement key with different file → it's a re-issued
        // EOB; queue for review rather than silent-skip or duplicate.
        const sHash = dedup.eobStatementHash(s);
        const exists = db.prepare(
          'SELECT id, file_hash FROM med_eob_statements WHERE statement_date=? AND member_id=?'
        ).get(s.statement_date, s.member_id);
        if (exists) {
          // Same record key, same file hash → silent skip (we already
          // caught this above as a file-level dedup; defensive double-check).
          if (hasFileHash && fileHash && exists.file_hash === fileHash) {
            skipped++; continue;
          }
          // Same record key, different file → queue for review.
          dedup.queueReview(db, {
            source: req.body._source || 'manual_eob',
            entity_type: 'eob_statement',
            proposed_action: 'review_resissue',
            payload: s,
            existing_id: exists.id,
            dedup_hash: sHash,
            file_hash: fileHash,
            reason: `Re-issued EOB for ${s.statement_date} member ${s.member_id} — file differs from already-imported version`,
          });
          queued++; continue;
        }

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

        // v202604.147 — record provenance + dedup hash on the new row.
        if (hasFileHash) {
          db.prepare(`
            UPDATE med_eob_statements
               SET file_hash = ?, dedup_hash = ?, auto_imported = ?
             WHERE id = ?
          `).run(fileHash, sHash, (req.body._source === 'watcher') ? 1 : 0, stmtId);
        }

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
          // v202604.147 — claim-level dedup hash for cross-EOB joinability.
          {
            const claimCols = db.prepare("PRAGMA table_info(med_eob_claims)").all().map(r => r.name);
            if (claimCols.includes('dedup_hash')) {
              const cHash = dedup.eobClaimHash({ patient: patientRaw, claim_id: c.claim_id, send_date: c.send_date });
              db.prepare('UPDATE med_eob_claims SET dedup_hash=? WHERE id=?').run(cHash, claimId);
            }
          }
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

          // v202604.167 — also run the new record_links-based matcher
          // (#27.3). This sits alongside the legacy eob_claim_id auto-
          // link above: legacy writes one column on hsa_payments; the
          // new matcher writes a record_links row that the review-pill
          // surface watches. HIGH-confidence matches link silently;
          // MEDIUM matches surface in the floating "Needs review" pill.
          // See _templates.html #27 for the locked pattern.
          try {
            const eobHsaMatcher = require('./eob-hsa-matcher');
            // Load the just-inserted claim row with all columns the
            // matcher expects (service_date OR statement_date fallback).
            const claimRow = db.prepare('SELECT * FROM med_eob_claims WHERE id=?').get(claimId);
            if (claimRow) eobHsaMatcher.processEobClaim(claimRow);
          } catch (matcherErr) {
            console.warn('[eob/import] new matcher failed:', matcherErr.message);
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
    res.json({ ok: true, imported, skipped, queued, name_flags: nameFlags });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/medical/eob  — list all statements
router.get('/eob', (req, res) => {
  try {
    // v202604.149 — list-page enrichment.
    //   - attachment_count (paperclip badge on card)
    //   - family_member_ids: JSON array of distinct claim.family_member_id
    //     values, lets the All-tab person filter narrow EOBs that
    //     mention any selected member, even though the statement row
    //     itself doesn't have a single owner.
    const stmts = db.prepare(`
      SELECT s.*,
        COUNT(DISTINCT c.id) AS claims_count,
        GROUP_CONCAT(DISTINCT REPLACE(c.patient, SUBSTR(c.patient, INSTR(c.patient,' (')), '')) AS patients,
        (SELECT COUNT(*) FROM attachments
           WHERE entity_type='med_eob_statement' AND entity_id=s.id) AS attachment_count
      FROM med_eob_statements s
      LEFT JOIN med_eob_claims c ON c.eob_id = s.id
      GROUP BY s.id
      ORDER BY s.statement_date DESC
    `).all();
    // Pull per-statement member rollup separately to avoid mixing GROUP_CONCAT contexts.
    const memberStmt = db.prepare(`
      SELECT DISTINCT family_member_id FROM med_eob_claims
       WHERE eob_id=? AND family_member_id IS NOT NULL
    `);
    for (const s of stmts) {
      try {
        s.family_member_ids = memberStmt.all(s.id).map(r => r.family_member_id);
      } catch(e) { s.family_member_ids = []; }
    }
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

// ══════════════════════════════════════════════════════════════
//  v202604.147 — REACTIVATE / DEDUP RESOLUTION / METRICS / PENDING
//  All routes below are surface for the Visit / Condition / Medication
//  card flows. Documented inline.
// ══════════════════════════════════════════════════════════════

// POST /api/v1/medical/medications/:id/reactivate
//   Used after the user accepts the reactivate prompt returned by POST
//   /medications when a discontinued match was found. Body:
//     { dosage?: string, discontinue_id?: number }
//
//   Effects:
//     - Sets the target medication to status='Active', clears end_date
//     - If dosage changed, updates dosage and writes a med_medication_dose_changes row
//     - If discontinue_id is set, marks that other medication as Discontinued
//     - Recomputes dedup_hash on the reactivated row
router.post('/medications/:id/reactivate', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { dosage, discontinue_id } = req.body || {};
    const cols = db.prepare("PRAGMA table_info(med_medications)").all().map(r => r.name);
    const hasDedup = cols.includes('dedup_hash');

    const target = db.prepare('SELECT * FROM med_medications WHERE id=?').get(id);
    if (!target) return notFound(res, 'Medication not found');

    db.transaction(() => {
      // Log dose change if applicable
      const newDose = dosage != null ? dosage : target.dosage;
      const hasDoseTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_medication_dose_changes'").get();
      if (hasDoseTable && (target.dosage || '') !== (newDose || '')) {
        db.prepare(`
          INSERT INTO med_medication_dose_changes (medication_id, old_dosage, new_dosage, changed_by, notes)
          VALUES (?,?,?,?,?)
        `).run(id, target.dosage || null, newDose || null, 'reactivate',
               'Reactivated previously discontinued medication');
      }
      // Reactivate
      db.prepare(`
        UPDATE med_medications
           SET status='Active', end_date=NULL, dosage=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=?
      `).run(newDose || null, id);
      // Optional: discontinue another active record (the one being replaced)
      if (discontinue_id) {
        const today = new Date().toISOString().slice(0,10);
        db.prepare(`
          UPDATE med_medications
             SET status='Discontinued', end_date=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?
        `).run(today, discontinue_id);
        // Recompute its dedup hash too
        if (hasDedup) {
          const r2 = db.prepare('SELECT * FROM med_medications WHERE id=?').get(discontinue_id);
          if (r2) {
            const h = dedup.medicationHash(r2);
            db.prepare('UPDATE med_medications SET dedup_hash=? WHERE id=?').run(h, discontinue_id);
          }
        }
      }
      // Recompute dedup hash on the reactivated row (dose may have changed)
      if (hasDedup) {
        const r = db.prepare('SELECT * FROM med_medications WHERE id=?').get(id);
        const h = dedup.medicationHash(r);
        db.prepare('UPDATE med_medications SET dedup_hash=? WHERE id=?').run(h, id);
      }
    })();

    res.json({ ok: true, id, dosage: dosage || target.dosage });
  } catch (e) { serverError(res, e); }
});

// ── Condition metrics CRUD ────────────────────────────────────────
//
// Per-reading rows (BP, A1C, LDL...) that drive the sparkline + hero
// number on the Condition card. Unique on (condition_id, metric_name,
// measured_on) — duplicate readings for the same day overwrite via PUT.

// GET /api/v1/medical/conditions/:id/metrics?metric=bp&limit=30
router.get('/conditions/:id/metrics', (req, res) => {
  try {
    const cid = parseInt(req.params.id);
    const { metric, limit } = req.query;
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_condition_metrics'").get()) {
      return res.json({ metrics: [] });
    }
    let sql = 'SELECT * FROM med_condition_metrics WHERE condition_id=?';
    const params = [cid];
    if (metric) { sql += ' AND metric_name=?'; params.push(metric); }
    sql += ' ORDER BY measured_on DESC, id DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
    const rows = db.prepare(sql).all(...params);
    res.json({ metrics: rows });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/medical/conditions/:id/metrics
//   Body: { metric_name, value_numeric?, value_text?, unit?, measured_on, notes? }
//   Same-day duplicate: replaces (UPSERT semantics on the unique index).
router.post('/conditions/:id/metrics', requireAuth, (req, res) => {
  try {
    const cid = parseInt(req.params.id);
    const d = req.body || {};
    if (!d.metric_name || !d.measured_on) return badRequest(res, 'metric_name and measured_on required');

    const exists = db.prepare(`
      SELECT id FROM med_condition_metrics
       WHERE condition_id=? AND metric_name=? AND measured_on=?
    `).get(cid, d.metric_name, d.measured_on);

    if (exists) {
      db.prepare(`
        UPDATE med_condition_metrics
           SET value_numeric=?, value_text=?, unit=?, notes=?,
               source=?, source_visit_id=?, measured_at=CURRENT_TIMESTAMP
         WHERE id=?
      `).run(d.value_numeric != null ? Number(d.value_numeric) : null,
             d.value_text || null, d.unit || null, d.notes || null,
             d.source || 'manual', d.source_visit_id || null, exists.id);
      return res.json({ id: exists.id, updated: true });
    }
    const info = db.prepare(`
      INSERT INTO med_condition_metrics
        (condition_id, metric_name, value_numeric, value_text, unit, measured_on, source, source_visit_id, notes)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(cid, d.metric_name,
           d.value_numeric != null ? Number(d.value_numeric) : null,
           d.value_text || null, d.unit || null, d.measured_on,
           d.source || 'manual', d.source_visit_id || null, d.notes || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/medical/conditions/:cid/metrics/:mid
router.delete('/conditions/:cid/metrics/:mid', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM med_condition_metrics WHERE id=? AND condition_id=?')
      .run(req.params.mid, req.params.cid);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ── Pending review queue surface ──────────────────────────────────

// GET /api/v1/medical/pending-review
//   Query: ?status=open|resolved (default open), ?entity_type=, ?limit=50
router.get('/pending-review', (req, res) => {
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_pending_review'").get()) {
      return res.json({ items: [], total: 0 });
    }
    const status = req.query.status || 'open';
    const entity_type = req.query.entity_type;
    const limit = parseInt(req.query.limit) || 50;
    let sql = 'SELECT * FROM med_pending_review WHERE status=?';
    const params = [status];
    if (entity_type) { sql += ' AND entity_type=?'; params.push(entity_type); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    const items = db.prepare(sql).all(...params).map(r => ({
      ...r,
      payload: (() => { try { return JSON.parse(r.payload); } catch { return null; } })(),
    }));
    const total = db.prepare(`SELECT COUNT(*) AS n FROM med_pending_review WHERE status='open'`).get().n;
    res.json({ items, total });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/medical/pending-review/:id/resolve
//   Body: { resolution: 'merge'|'insert'|'discard', merge_into_id? }
router.post('/pending-review/:id/resolve', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { resolution, merge_into_id } = req.body || {};
    if (!['merge', 'insert', 'discard', 'reactivate'].includes(resolution)) {
      return badRequest(res, 'resolution must be one of: merge, insert, discard, reactivate');
    }

    const item = db.prepare('SELECT * FROM med_pending_review WHERE id=?').get(id);
    if (!item) return notFound(res, 'Pending review not found');
    if (item.status !== 'open') return badRequest(res, 'Already resolved');

    db.prepare(`
      UPDATE med_pending_review
         SET status='resolved', resolved_at=CURRENT_TIMESTAMP, resolution=?
       WHERE id=?
    `).run(resolution, id);

    // Mark linked todo done if any
    if (item.todo_id) {
      try {
        const todoCols = db.prepare("PRAGMA table_info(todos)").all().map(r => r.name);
        if (todoCols.includes('status')) {
          db.prepare('UPDATE todos SET status=? WHERE id=?').run('done', item.todo_id);
        }
      } catch {}
    }

    res.json({ ok: true, id, resolution });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/medical/pending-review/count — fast banner counter
router.get('/pending-review-count', (req, res) => {
  try {
    res.json({ count: dedup.openReviewCount(db) });
  } catch (e) { res.json({ count: 0 }); }
});

// ── Dose change history ───────────────────────────────────────────

// GET /api/v1/medical/medications/:id/dose-changes
router.get('/medications/:id/dose-changes', (req, res) => {
  try {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='med_medication_dose_changes'").get()) {
      return res.json({ changes: [] });
    }
    const changes = db.prepare(`
      SELECT * FROM med_medication_dose_changes
       WHERE medication_id=? ORDER BY changed_at DESC
    `).all(req.params.id);
    res.json({ changes });
  } catch (e) { serverError(res, e); }
});

// ── Backfill dedup hashes for existing rows ──────────────────────
//
// One-shot endpoint. Useful right after migration 124 lands.
// POST /api/v1/medical/dedup/backfill
router.post('/dedup/backfill', requireAuth, (req, res) => {
  try {
    let updated = { medications: 0, conditions: 0, visits: 0, eob_statements: 0, eob_claims: 0 };

    const checkCol = (table, col) => {
      const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(r => r.name);
      return cols.includes(col);
    };

    if (checkCol('med_medications', 'dedup_hash')) {
      const rows = db.prepare('SELECT * FROM med_medications WHERE dedup_hash IS NULL').all();
      const upd = db.prepare('UPDATE med_medications SET dedup_hash=? WHERE id=?');
      db.transaction(() => {
        for (const r of rows) { upd.run(dedup.medicationHash(r), r.id); updated.medications++; }
      })();
    }
    if (checkCol('med_conditions', 'dedup_hash')) {
      const rows = db.prepare('SELECT * FROM med_conditions WHERE dedup_hash IS NULL').all();
      const upd = db.prepare('UPDATE med_conditions SET dedup_hash=? WHERE id=?');
      db.transaction(() => {
        for (const r of rows) { upd.run(dedup.conditionHash(r), r.id); updated.conditions++; }
      })();
    }
    if (checkCol('med_visit_notes', 'dedup_hash') && checkCol('med_visit_notes', 'start_time')) {
      const rows = db.prepare('SELECT * FROM med_visit_notes WHERE dedup_hash IS NULL').all();
      const upd = db.prepare('UPDATE med_visit_notes SET dedup_hash=? WHERE id=?');
      db.transaction(() => {
        for (const r of rows) { upd.run(dedup.visitHash(r), r.id); updated.visits++; }
      })();
    }
    if (checkCol('med_eob_statements', 'dedup_hash')) {
      const rows = db.prepare('SELECT * FROM med_eob_statements WHERE dedup_hash IS NULL').all();
      const upd = db.prepare('UPDATE med_eob_statements SET dedup_hash=? WHERE id=?');
      db.transaction(() => {
        for (const r of rows) { upd.run(dedup.eobStatementHash(r), r.id); updated.eob_statements++; }
      })();
    }
    if (checkCol('med_eob_claims', 'dedup_hash')) {
      const rows = db.prepare('SELECT * FROM med_eob_claims WHERE dedup_hash IS NULL').all();
      const upd = db.prepare('UPDATE med_eob_claims SET dedup_hash=? WHERE id=?');
      db.transaction(() => {
        for (const r of rows) { upd.run(dedup.eobClaimHash(r), r.id); updated.eob_claims++; }
      })();
    }
    res.json({ ok: true, updated });
  } catch (e) { serverError(res, e); }
});
