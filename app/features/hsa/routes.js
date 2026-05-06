// @ts-nocheck
/**
 * features/hsa/routes.js
 * PRIVATE module — requireAuth on all write routes.
 * Mirrors the spec from HDHP_Tracking_Workbook_v5.xlsx logic exactly.
 *
 * Plan Info · Payments · OTC · Reimbursements · Summary · CSV Export
 */
'use strict';

const express     = require('express');
const router      = express.Router();
const db          = require('../../db/db');
const { requireAuth }        = require('../auth/middleware');
const { notFound, badRequest, serverError } = require('../../shared/errors');
const { saveFamilyMembers, getFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');
const { saveTagsByName, withTagNames, clearTags } = require('../../shared/tags');
const { clearReview } = require('../../shared/needs-review');

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function yearOf(dateStr) {
  return dateStr ? parseInt(dateStr.slice(0, 4), 10) : new Date().getFullYear();
}

function currentYear() {
  return new Date().getFullYear();
}

/** Full calculated HSA summary for a plan year */
function buildSummary(year) {
  const plan = db.prepare('SELECT * FROM hsa_plan_info WHERE plan_year = ?').get(year) || {};

  // Payments: split deductible-applicable (Out of Pocket) from total out-of-pocket
  const payRow = db.prepare(`
    SELECT
      COALESCE(SUM(you_paid), 0)                                              AS total_oop,
      COALESCE(SUM(CASE WHEN payment_type='Out of Pocket' THEN you_paid ELSE 0 END), 0) AS deductible_applied,
      COALESCE(SUM(CASE WHEN hsa_eligible=1 THEN you_paid ELSE 0 END), 0)    AS total_eligible,
      COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN you_paid ELSE 0 END), 0) AS unreimbursed_eligible
    FROM hsa_payments
    WHERE strftime('%Y', date) = ?
  `).get(String(year));

  const otcRow = db.prepare(`
    SELECT
      COALESCE(SUM(amount), 0)                                                AS total_otc,
      COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN amount ELSE 0 END), 0) AS unreimbursed_otc
    FROM hsa_otc
    WHERE strftime('%Y', date) = ?
  `).get(String(year));

  const reimbRow = db.prepare(
    'SELECT COALESCE(SUM(total_amount),0) AS total FROM hsa_reimbursements WHERE from_year = ?'
  ).get(year);

  const unreimbursedPool = (payRow.unreimbursed_eligible || 0) + (otcRow.unreimbursed_otc || 0);

  return {
    year,
    plan,
    contributions: {
      self:      plan.hsa_contribution_self     || 0,
      employer:  plan.hsa_contribution_employer || 0,
      total:    (plan.hsa_contribution_self     || 0) + (plan.hsa_contribution_employer || 0),
      irs_limit: plan.irs_limit_family || plan.irs_limit_self_only || 0,
    },
    deductible: {
      individual:         plan.individual_deductible || 0,
      family:             plan.family_deductible     || 0,
      applied:            payRow.deductible_applied  || 0,  // Out of Pocket payments only
    },
    oop: {
      individual:         plan.individual_oop_max    || 0,
      family:             plan.family_oop_max        || 0,
      applied:            (payRow.total_oop || 0) + (otcRow.total_otc || 0),  // all payments + OTC
    },
    expenses: {
      total_eligible:  payRow.total_eligible || 0,
      total_otc:       otcRow.total_otc      || 0,
      unreimbursed_pool: unreimbursedPool,
    },
    total_reimbursed_ytd: reimbRow.total || 0,
  };
}

function escCsv(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

// ══════════════════════════════════════════════════════════════
// PLAN INFO
// ══════════════════════════════════════════════════════════════

// GET /api/v1/hsa/plan
// ── All routes require authentication (HSA data is sensitive) ──
router.use(requireAuth);

router.get('/plan', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM hsa_plan_info ORDER BY plan_year DESC').all());
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/hsa/plan/:year
router.get('/plan/:year', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM hsa_plan_info WHERE plan_year = ?').get(req.params.year);
    if (!row) return notFound(res, 'Plan year not found');
    res.json(row);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/hsa/plan
router.post('/plan', (req, res) => {
  try {
    const d = req.body;
    if (!d.plan_year) return badRequest(res, 'plan_year required');
    const info = db.prepare(`
      INSERT INTO hsa_plan_info
        (plan_year, plan_name, insurance_carrier, individual_deductible, family_deductible,
         individual_oop_max, family_oop_max, hsa_contribution_self, hsa_contribution_employer,
         irs_limit_self_only, irs_limit_family, plan_effective_date, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.plan_year, d.plan_name||null, d.insurance_carrier||null,
      d.individual_deductible||0, d.family_deductible||0,
      d.individual_oop_max||0,    d.family_oop_max||0,
      d.hsa_contribution_self||0, d.hsa_contribution_employer||0,
      d.irs_limit_self_only||0,   d.irs_limit_family||0,
      d.plan_effective_date||null, d.notes||null
    );
    saveFamilyMembers(info.lastInsertRowid, 'hsa_payment', d.family_member_ids || []);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// PUT /api/v1/hsa/plan/:id
router.put('/plan/:id', (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE hsa_plan_info SET
        plan_year=?, plan_name=?, insurance_carrier=?,
        individual_deductible=?, family_deductible=?,
        individual_oop_max=?, family_oop_max=?,
        hsa_contribution_self=?, hsa_contribution_employer=?,
        irs_limit_self_only=?, irs_limit_family=?,
        plan_effective_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.plan_year, d.plan_name||null, d.insurance_carrier||null,
      d.individual_deductible||0, d.family_deductible||0,
      d.individual_oop_max||0,    d.family_oop_max||0,
      d.hsa_contribution_self||0, d.hsa_contribution_employer||0,
      d.irs_limit_self_only||0,   d.irs_limit_family||0,
      d.plan_effective_date||null, d.notes||null, req.params.id
    );
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// SUMMARY (calculated — never stored)
// ══════════════════════════════════════════════════════════════

// GET /api/v1/hsa/summary?year=2026
router.get('/summary', (req, res) => {
  try {
    const year = parseInt(req.query.year) || currentYear();
    res.json(buildSummary(year));
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// MULTI-YEAR UNREIMBURSED POOL
// GET /api/v1/hsa/pool
// Returns unreimbursed eligible amounts grouped by year — the
// "carry-forward" pool showing how much can still be withdrawn
// tax-free from each past year.
// ══════════════════════════════════════════════════════════════
router.get('/pool', (req, res) => {
  try {
    const payByYear = db.prepare(`
      SELECT
        strftime('%Y', date) AS year,
        COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN you_paid ELSE 0 END), 0) AS unreimbursed
      FROM hsa_payments
      GROUP BY strftime('%Y', date)
      HAVING unreimbursed > 0
      ORDER BY year DESC
    `).all();

    const otcByYear = db.prepare(`
      SELECT
        strftime('%Y', date) AS year,
        COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN amount ELSE 0 END), 0) AS unreimbursed
      FROM hsa_otc
      GROUP BY strftime('%Y', date)
      HAVING unreimbursed > 0
      ORDER BY year DESC
    `).all();

    // Merge by year
    const byYear = {};
    payByYear.forEach(r => { byYear[r.year] = (byYear[r.year] || 0) + r.unreimbursed; });
    otcByYear.forEach(r => { byYear[r.year] = (byYear[r.year] || 0) + r.unreimbursed; });

    const pool = Object.entries(byYear)
      .map(([year, amount]) => ({ year: parseInt(year), amount }))
      .sort((a, b) => b.year - a.year);

    const total = pool.reduce((s, r) => s + r.amount, 0);
    res.json({ pool, total });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// PAYMENTS (medical expenses)
// ══════════════════════════════════════════════════════════════

// GET /api/v1/hsa/payments?year=2026&reimbursed=0&patient=Self&category=Doctor
router.get('/payments', (req, res) => {
  try {
    const year = req.query.year || currentYear();
    let sql = `SELECT * FROM hsa_payments WHERE strftime('%Y', date) = ?`;
    const p = [String(year)];
    if (req.query.reimbursed !== undefined && req.query.reimbursed !== '') {
      sql += ' AND reimbursed = ?'; p.push(req.query.reimbursed);
    }
    if (req.query.patient)  { sql += ' AND patient = ?';  p.push(req.query.patient); }
    if (req.query.category) { sql += ' AND category = ?'; p.push(req.query.category); }
    sql += ' ORDER BY date DESC, id DESC';
    res.json(db.prepare(sql).all(...p).map(r => withTagNames(withFamilyMembers(r, 'hsa_payment'), 'hsa_payment')));
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/hsa/payments/:id
router.get('/payments/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM hsa_payments WHERE id = ?').get(req.params.id);
    if (!row) return notFound(res, 'Payment not found');
    res.json(row);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/hsa/payments
router.post('/payments', (req, res) => {
  try {
    const d = req.body;
    if (!d.date) return badRequest(res, 'date required');
    const info = db.prepare(`
      INSERT INTO hsa_payments
        (date, patient, provider, category, payment_type, total_bill, insurance_paid, you_paid,
         hsa_eligible, receipt_saved, reimbursed, reimbursement_date, notes, provider_contact_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.date, d.patient||'Self', d.provider||null, d.category||null, d.payment_type||null,
      d.total_bill||0, d.insurance_paid||0, d.you_paid||0,
      d.hsa_eligible !== false ? 1 : 0,
      d.receipt_saved ? 1 : 0,
      d.reimbursed ? 1 : 0, d.reimbursement_date||null, d.notes||null, d.provider_contact_id||null
    );
    saveFamilyMembers(info.lastInsertRowid, 'hsa_payment', d.family_member_ids || []);
    if (d.tags?.length) saveTagsByName(info.lastInsertRowid, 'hsa_payment', d.tags);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// PUT /api/v1/hsa/payments/:id
router.put('/payments/:id', (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE hsa_payments SET
        date=?, patient=?, provider=?, category=?, payment_type=?,
        total_bill=?, insurance_paid=?, you_paid=?,
        hsa_eligible=?, receipt_saved=?,
        reimbursed=?, reimbursement_date=?, notes=?, provider_contact_id=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.date, d.patient||'Self', d.provider||null, d.category||null, d.payment_type||null,
      d.total_bill||0, d.insurance_paid||0, d.you_paid||0,
      d.hsa_eligible !== false ? 1 : 0,
      d.receipt_saved ? 1 : 0,
      d.reimbursed ? 1 : 0, d.reimbursement_date||null, d.notes||null,
      d.provider_contact_id||null, req.params.id
    );
    if (d.tags !== undefined) saveTagsByName(parseInt(req.params.id), 'hsa_payment', d.tags);
    clearReview('hsa_payments', req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/hsa/payments/:id
router.delete('/payments/:id', (req, res) => {
  try {
    clearFamilyMembers(req.params.id, 'hsa_payment');
    clearTags(req.params.id, 'hsa_payment');
    db.prepare('DELETE FROM hsa_payments WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/hsa/payments/export/csv
router.get('/payments/export/csv', (req, res) => {
  try {
    const year = req.query.year || currentYear();
    const rows = db.prepare(`SELECT * FROM hsa_payments WHERE strftime('%Y', date)=? ORDER BY date`).all(String(year));
    const headers = ['id','date','patient','provider','category','payment_type',
                     'total_bill','insurance_paid','you_paid','hsa_eligible',
                     'receipt_saved','reimbursed','reimbursement_date','notes'];
    const lines = rows.map(r => headers.map(h => escCsv(r[h])).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="hsa_payments_${year}.csv"`);
    res.send([headers.join(','), ...lines].join('\n'));
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// SLICE 1 — HSA PAYMENT LINKS (polymorphic)
// One payment can link to many entities. Same shape as
// record_family_members. Used for: receipt → medication, visit,
// condition, etc. Allowlisted entity_types only.
// ══════════════════════════════════════════════════════════════

const ALLOWED_LINK_TYPES = new Set(['medication', 'visit', 'condition', 'eob_claim']);

// GET /api/v1/hsa/payments/:id/links
router.get('/payments/:id/links', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, hsa_payment_id, entity_type, entity_id, created_at
      FROM hsa_payment_links
      WHERE hsa_payment_id = ?
      ORDER BY entity_type, entity_id
    `).all(req.params.id);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/hsa/payments/:id/links
// Body: { entity_type, entity_id }
router.post('/payments/:id/links', (req, res) => {
  try {
    const { entity_type, entity_id } = req.body || {};
    if (!entity_type || !entity_id) return badRequest(res, 'entity_type and entity_id required');
    if (!ALLOWED_LINK_TYPES.has(entity_type)) {
      return badRequest(res, `entity_type must be one of: ${Array.from(ALLOWED_LINK_TYPES).join(', ')}`);
    }
    const info = db.prepare(`
      INSERT OR IGNORE INTO hsa_payment_links (hsa_payment_id, entity_type, entity_id)
      VALUES (?, ?, ?)
    `).run(req.params.id, entity_type, entity_id);
    res.status(201).json({ ok: true, id: info.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/hsa/payments/:id/links/:linkId
router.delete('/payments/:id/links/:linkId', (req, res) => {
  try {
    db.prepare(`
      DELETE FROM hsa_payment_links WHERE id = ? AND hsa_payment_id = ?
    `).run(req.params.linkId, req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/hsa/links/by-entity?entity_type=medication&entity_id=42
// Returns the payments linked to a given entity. Used by the medication
// card to show its receipts list, and by other modules wanting reverse lookup.
router.get('/links/by-entity', (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) return badRequest(res, 'entity_type and entity_id required');
    if (!ALLOWED_LINK_TYPES.has(entity_type)) {
      return badRequest(res, `entity_type must be one of: ${Array.from(ALLOWED_LINK_TYPES).join(', ')}`);
    }
    const rows = db.prepare(`
      SELECT p.id, p.date, p.amount, p.you_paid, p.provider, p.category, p.notes,
             l.id AS link_id, l.created_at AS linked_at
      FROM hsa_payment_links l
      JOIN hsa_payments p ON p.id = l.hsa_payment_id
      WHERE l.entity_type = ? AND l.entity_id = ?
      ORDER BY p.date DESC
    `).all(entity_type, entity_id);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// OTC PURCHASES
// ══════════════════════════════════════════════════════════════

// GET /api/v1/hsa/otc?year=2026&reimbursed=0
router.get('/otc', (req, res) => {
  try {
    const year = req.query.year || currentYear();
    let sql = `SELECT * FROM hsa_otc WHERE strftime('%Y', date) = ?`;
    const p = [String(year)];
    if (req.query.reimbursed !== undefined && req.query.reimbursed !== '') {
      sql += ' AND reimbursed = ?'; p.push(req.query.reimbursed);
    }
    sql += ' ORDER BY date DESC, id DESC';
    res.json(db.prepare(sql).all(...p));
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/hsa/otc/:id
router.get('/otc/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM hsa_otc WHERE id = ?').get(req.params.id);
    if (!row) return notFound(res, 'OTC record not found');
    res.json(row);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/hsa/otc
router.post('/otc', (req, res) => {
  try {
    const d = req.body;
    if (!d.date || !d.item_name) return badRequest(res, 'date and item_name required');
    const info = db.prepare(`
      INSERT INTO hsa_otc
        (date, item_name, otc_category, store, amount, quantity,
         hsa_eligible, receipt_saved, reimbursed, reimbursement_date, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.date, d.item_name, d.otc_category||'OTC Medicine', d.store||null,
      d.amount||0, d.quantity||1,
      d.hsa_eligible !== false ? 1 : 0,
      d.receipt_saved ? 1 : 0,
      d.reimbursed ? 1 : 0, d.reimbursement_date||null, d.notes||null
    );
    saveFamilyMembers(info.lastInsertRowid, 'hsa_payment', d.family_member_ids || []);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// PUT /api/v1/hsa/otc/:id
router.put('/otc/:id', (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE hsa_otc SET
        date=?, item_name=?, otc_category=?, store=?, amount=?, quantity=?,
        hsa_eligible=?, receipt_saved=?,
        reimbursed=?, reimbursement_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.date, d.item_name, d.otc_category||'OTC Medicine', d.store||null,
      d.amount||0, d.quantity||1,
      d.hsa_eligible !== false ? 1 : 0,
      d.receipt_saved ? 1 : 0,
      d.reimbursed ? 1 : 0, d.reimbursement_date||null, d.notes||null,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/hsa/otc/:id
router.delete('/otc/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM hsa_otc WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/hsa/otc/export/csv
router.get('/otc/export/csv', (req, res) => {
  try {
    const year = req.query.year || currentYear();
    const rows = db.prepare(`SELECT * FROM hsa_otc WHERE strftime('%Y', date)=? ORDER BY date`).all(String(year));
    const headers = ['id','date','item_name','otc_category','store','amount','quantity',
                     'hsa_eligible','receipt_saved','reimbursed','reimbursement_date','notes'];
    const lines = rows.map(r => headers.map(h => escCsv(r[h])).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="hsa_otc_${year}.csv"`);
    res.send([headers.join(','), ...lines].join('\n'));
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// UNREIMBURSED POOL — list of eligible, not-yet-reimbursed items
// Used to populate the reimbursement entry drawer
// ══════════════════════════════════════════════════════════════

// GET /api/v1/hsa/unreimbursed?year=2026
router.get('/unreimbursed', (req, res) => {
  try {
    const year = req.query.year || currentYear();
    const yearStr = String(year);
    const payments = db.prepare(`
      SELECT id, date, patient, provider AS label, you_paid AS amount, 'payment' AS expense_type
      FROM hsa_payments
      WHERE hsa_eligible=1 AND reimbursed=0 AND strftime('%Y', date)=?
      ORDER BY date
    `).all(yearStr);
    const otc = db.prepare(`
      SELECT id, date, 'Self' AS patient, item_name AS label, amount, 'otc' AS expense_type
      FROM hsa_otc
      WHERE hsa_eligible=1 AND reimbursed=0 AND strftime('%Y', date)=?
      ORDER BY date
    `).all(yearStr);
    const combined = [...payments, ...otc].sort((a, b) => a.date.localeCompare(b.date));
    res.json({ payments, otc, combined, total: combined.reduce((s, r) => s + r.amount, 0) });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// REIMBURSEMENTS
// ══════════════════════════════════════════════════════════════

// GET /api/v1/hsa/reimbursements
router.get('/reimbursements', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM hsa_reimbursements ORDER BY reimbursement_date DESC').all();
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/hsa/reimbursements
// Body: { reimbursement_date, total_amount, from_year, method, notes, items: [{expense_type, expense_id, amount}] }
router.post('/reimbursements', (req, res) => {
  try {
    const d = req.body;
    if (!d.reimbursement_date) return badRequest(res, 'reimbursement_date required');

    const insertReimb = db.prepare(`
      INSERT INTO hsa_reimbursements (reimbursement_date, total_amount, from_year, method, notes)
      VALUES (?,?,?,?,?)
    `);
    const insertItem   = db.prepare(`
      INSERT INTO hsa_reimbursement_items (reimbursement_id, expense_type, expense_id, amount)
      VALUES (?,?,?,?)
    `);
    const markPayment  = db.prepare(`UPDATE hsa_payments SET reimbursed=1, reimbursement_date=?, reimbursement_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
    const markOtc      = db.prepare(`UPDATE hsa_otc SET reimbursed=1, reimbursement_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);

    const txn = db.transaction(() => {
      const info = insertReimb.run(
        d.reimbursement_date, d.total_amount||0,
        d.from_year || currentYear(), d.method||'ACH', d.notes||null
      );
      const reimbId = info.lastInsertRowid;
      if (Array.isArray(d.items)) {
        for (const item of d.items) {
          insertItem.run(reimbId, item.expense_type, item.expense_id, item.amount||0);
          if (item.expense_type === 'payment') markPayment.run(d.reimbursement_date, reimbId, item.expense_id);
          if (item.expense_type === 'otc')     markOtc.run(d.reimbursement_date, item.expense_id);
        }
      }
      return reimbId;
    });

    const reimbId = txn();
    res.status(201).json({ id: reimbId });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/hsa/reimbursements/:id — unmarks all linked expenses
router.delete('/reimbursements/:id', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM hsa_reimbursement_items WHERE reimbursement_id=?').all(req.params.id);
    const txn = db.transaction(() => {
      for (const item of items) {
        if (item.expense_type === 'payment')
          db.prepare('UPDATE hsa_payments SET reimbursed=0, reimbursement_date=NULL, reimbursement_id=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(item.expense_id);
        if (item.expense_type === 'otc')
          db.prepare('UPDATE hsa_otc SET reimbursed=0, reimbursement_date=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(item.expense_id);
      }
      db.prepare('DELETE FROM hsa_reimbursements WHERE id=?').run(req.params.id);
    });
    txn();
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;

// ════════════════════════════════════════════════════════════════════
// v202604.140 — INBOX + VAULT + LP-FSA ENDPOINTS
// ════════════════════════════════════════════════════════════════════
//
// HISTORY: This module was previously a singleton "HSA expenses tracker"
// with no concept of inbox queue, no LP-FSA, and no link to EOBs.
// v140 adds all three. Old endpoints above remain working; new ones
// go below to keep blast radius small.

const dedupe = require('../../shared/dedupe');
const lifecycle = require('../../shared/attach-lifecycle');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Multer for in-app receipt uploads. Stores temporarily in os tmp,
// then we hash + move to inbox using the same code path as the watcher.
const inboxUpload = multer({
  dest: '/tmp/ghrava-inbox',
  limits: { fileSize: 20 * 1024 * 1024 },  // 20MB cap, per design
});

// ── VAULT ─────────────────────────────────────────────────────────
//
// GET /api/v1/hsa/vault?pot=hsa  (or pot=fsa)
//
// Returns the headline "reimbursement vault" numbers for the page-top tile:
//   { total, count, oldest_date, all_eligible, none_reimbursed }
router.get('/vault', (req, res) => {
  try {
    const pot = req.query.pot === 'fsa' ? 'fsa' : 'hsa';
    const table = pot === 'fsa' ? 'fsa_payments' : 'hsa_payments';
    const eligibleCol = pot === 'fsa' ? 'fsa_eligible' : 'hsa_eligible';
    const amountCol   = pot === 'fsa' ? 'amount' : 'you_paid';

    // For HSA, vault = unreimbursed eligible payments + unreimbursed eligible OTC
    // For FSA, vault = unreimbursed eligible payments only (no separate OTC table)
    const r = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN ${eligibleCol}=1 AND reimbursed=0 THEN ${amountCol} ELSE 0 END), 0) AS total,
        SUM(CASE WHEN ${eligibleCol}=1 AND reimbursed=0 THEN 1 ELSE 0 END) AS count,
        MIN(CASE WHEN ${eligibleCol}=1 AND reimbursed=0 THEN date END) AS oldest_date,
        SUM(CASE WHEN ${eligibleCol}=0 THEN 1 ELSE 0 END) AS needs_review_count
      FROM ${table}
      WHERE COALESCE(status, 'final') = 'final'
    `).get();

    let otcTotal = 0, otcCount = 0;
    if (pot === 'hsa') {
      const otc = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN amount ELSE 0 END), 0) AS t,
          SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN 1 ELSE 0 END) AS c
        FROM hsa_otc
      `).get();
      otcTotal = otc.t || 0;
      otcCount = otc.c || 0;
    }

    // FSA-specific deadline info from active plan
    let deadline = null, mustUseAmount = 0;
    if (pot === 'fsa') {
      const plan = db.prepare(`
        SELECT deadline_date FROM fsa_plan_info
        WHERE active=1 AND deadline_date IS NOT NULL
        ORDER BY year DESC LIMIT 1
      `).get();
      if (plan) {
        deadline = plan.deadline_date;
        mustUseAmount = r.total + otcTotal;
      }
    }

    res.json({
      pot,
      total: (r.total || 0) + otcTotal,
      count: (r.count || 0) + otcCount,
      oldest_date: r.oldest_date,
      needs_review_count: r.needs_review_count || 0,
      deadline,
      must_use_amount: mustUseAmount,
    });
  } catch (e) { serverError(res, e); }
});

// ── INBOX ─────────────────────────────────────────────────────────
//
// GET /api/v1/hsa/inbox
//
// Returns the list of draft records waiting for review (across HSA + FSA
// + EOB orphans). Each item has just enough info for the banner count
// and the review-modal stack.
router.get('/inbox', (req, res) => {
  try {
    const items = [];

    // HSA drafts
    const hsaDrafts = db.prepare(`
      SELECT p.id, p.date, p.amount, p.you_paid, p.patient, p.provider,
             p.inbox_attachment_id, p.created_at,
             a.file_name, a.file_path, a.mime_type, a.id AS attachment_id
      FROM hsa_payments p
      LEFT JOIN attachments a ON a.id = p.inbox_attachment_id
      WHERE p.status = 'draft'
      ORDER BY p.created_at DESC
    `).all();
    hsaDrafts.forEach(r => items.push({
      kind: 'receipt',
      pot: 'hsa',
      record_id: r.id,
      attachment_id: r.attachment_id,
      file_name: r.file_name,
      mime_type: r.mime_type,
      created_at: r.created_at,
      status_pill: 'needs_review',
    }));

    // FSA drafts
    const fsaDrafts = db.prepare(`
      SELECT p.id, p.date, p.amount, p.patient,
             p.inbox_attachment_id, p.created_at,
             a.file_name, a.file_path, a.mime_type, a.id AS attachment_id
      FROM fsa_payments p
      LEFT JOIN attachments a ON a.id = p.inbox_attachment_id
      WHERE p.status = 'draft'
      ORDER BY p.created_at DESC
    `).all();
    fsaDrafts.forEach(r => items.push({
      kind: 'receipt',
      pot: 'fsa',
      record_id: r.id,
      attachment_id: r.attachment_id,
      file_name: r.file_name,
      mime_type: r.mime_type,
      created_at: r.created_at,
      status_pill: 'needs_review',
    }));

    res.json({ items, count: items.length });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/hsa/inbox/:id  — full detail for one draft (for the modal)
router.get('/inbox/:pot/:id', (req, res) => {
  try {
    const pot = req.params.pot === 'fsa' ? 'fsa' : 'hsa';
    const table = pot === 'fsa' ? 'fsa_payments' : 'hsa_payments';
    const row = db.prepare(`
      SELECT p.*, a.file_name, a.mime_type, a.id AS attachment_id
      FROM ${table} p
      LEFT JOIN attachments a ON a.id = p.inbox_attachment_id
      WHERE p.id = ? AND p.status = 'draft'
    `).get(req.params.id);
    if (!row) return notFound(res, 'Draft not found');
    res.json({ pot, ...row });
  } catch (e) { serverError(res, e); }
});

// ── PROMOTE DRAFT TO FINAL ────────────────────────────────────────
//
// POST /api/v1/hsa/inbox/:pot/:id/save
// Body: { date, vendor_contact_id, amount, patient, hsa_eligible, notes,
//         force_duplicate? }
// Returns: { ok:true, id } OR { duplicate_of, warning } (409)
router.post('/inbox/:pot/:id/save', (req, res) => {
  try {
    const pot = req.params.pot === 'fsa' ? 'fsa' : 'hsa';
    const table = pot === 'fsa' ? 'fsa_payments' : 'hsa_payments';
    const eligibleCol = pot === 'fsa' ? 'fsa_eligible' : 'hsa_eligible';
    const draftId = req.params.id;
    const d = req.body || {};

    if (!d.date)        return badRequest(res, 'date required');
    if (d.amount == null) return badRequest(res, 'amount required');

    const draft = db.prepare(`SELECT id, status FROM ${table} WHERE id = ?`).get(draftId);
    if (!draft) return notFound(res, 'Draft not found');
    if (draft.status !== 'draft') return badRequest(res, 'Not a draft');

    // Smart dedup unless force_duplicate is set
    if (!d.force_duplicate) {
      const dupId = dedupe.findReceiptDuplicate({
        pot, date: d.date, vendor_contact_id: d.vendor_contact_id,
        amount: d.amount, patient: d.patient,
      });
      if (dupId && dupId !== Number(draftId)) {
        return res.status(409).json({
          duplicate_of: dupId,
          warning: dedupe.warningFor('receipt', dupId,
            `From ${d.date}, $${Number(d.amount).toFixed(2)}.`),
        });
      }
    }

    // Promote: fill in fields, set status='final'
    if (pot === 'hsa') {
      db.prepare(`
        UPDATE hsa_payments SET
          date = ?, vendor_contact_id = ?, you_paid = ?, total_bill = ?,
          patient = ?, provider = ?, hsa_eligible = ?, notes = ?,
          status = 'final', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        d.date, d.vendor_contact_id || null, d.amount, d.amount,
        d.patient || 'Self', d.provider || null,
        d.hsa_eligible ? 1 : 0, d.notes || null, draftId
      );
    } else {
      db.prepare(`
        UPDATE fsa_payments SET
          date = ?, vendor_contact_id = ?, amount = ?,
          patient = ?, fsa_eligible = ?, notes = ?,
          status = 'final'
        WHERE id = ?
      `).run(
        d.date, d.vendor_contact_id || null, d.amount,
        d.patient || 'Self', d.fsa_eligible ? 1 : 0, d.notes || null, draftId
      );
    }

    res.json({ ok: true, id: Number(draftId), pot });
  } catch (e) { serverError(res, e); }
});

// ── REJECT DRAFT ──────────────────────────────────────────────────
//
// POST /api/v1/hsa/inbox/:pot/:id/reject
// Marks file as rejected ("not medical"), moves file to _rejected/,
// deletes the draft row.
router.post('/inbox/:pot/:id/reject', (req, res) => {
  try {
    const pot = req.params.pot === 'fsa' ? 'fsa' : 'hsa';
    const table = pot === 'fsa' ? 'fsa_payments' : 'hsa_payments';
    const draftId = req.params.id;

    const draft = db.prepare(`
      SELECT p.id, p.status, p.inbox_attachment_id, a.file_path
      FROM ${table} p
      LEFT JOIN attachments a ON a.id = p.inbox_attachment_id
      WHERE p.id = ?
    `).get(draftId);
    if (!draft) return notFound(res, 'Draft not found');
    if (draft.status !== 'draft') return badRequest(res, 'Not a draft');

    const txn = db.transaction(() => {
      // Move file to _rejected/ if it exists
      if (draft.file_path && fs.existsSync(draft.file_path)) {
        try { lifecycle.moveToRejected(draft.file_path); }
        catch (e) { console.warn('[hsa/inbox/reject] file move failed:', e.message); }
      }
      // Delete attachment row
      if (draft.inbox_attachment_id) {
        db.prepare('DELETE FROM attachments WHERE id = ?').run(draft.inbox_attachment_id);
      }
      // Delete draft row
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(draftId);
    });
    txn();

    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ── IN-APP RECEIPT UPLOAD ─────────────────────────────────────────
//
// POST /api/v1/hsa/inbox/upload
// Multipart form, field 'files' (multiple). Each file:
//   1. Hashed
//   2. Moved into module folder using hash-prefix naming
//   3. Inserted into attachments table (entity_type='draft')
//   4. Draft row created in hsa_payments (or fsa_payments) with status='draft'
// Returns: { ok:true, drafts: [{ pot, record_id, attachment_id, file_name }] }
router.post('/inbox/upload', inboxUpload.array('files', 20), (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return badRequest(res, 'no files uploaded');
    }
    const pot = req.body.pot === 'fsa' ? 'fsa' : 'hsa';
    const targetModule = 'hsa';  // both pots share the hsa folder for now
    const targetTable  = pot === 'fsa' ? 'fsa_payments' : 'hsa_payments';
    const drafts = [];

    for (const f of req.files) {
      const fullHash = lifecycle.hashFileSync(f.path);

      // Hash dedup against existing attachments (look for hash prefix in path)
      const dup = db.prepare(`
        SELECT id FROM attachments WHERE file_path LIKE ? LIMIT 1
      `).get(`%/${fullHash.slice(0,8)}_%`);
      if (dup) {
        // Clean up tmp file and skip
        try { fs.unlinkSync(f.path); } catch {}
        drafts.push({ duplicate_of_attachment: dup.id, file_name: f.originalname });
        continue;
      }

      // Move into module folder
      const newPath = lifecycle.moveToModule(f.path, targetModule, fullHash, f.originalname);

      // Insert attachment placeholder
      const attRes = db.prepare(`
        INSERT INTO attachments (entity_type, entity_id, attachment_type, file_name, file_path, file_size, mime_type, label)
        VALUES ('draft', NULL, 'upload', ?, ?, ?, ?, 'Inbox draft')
      `).run(f.originalname, newPath, f.size, f.mimetype);
      const attachmentId = attRes.lastInsertRowid;

      // Insert draft row
      let draftId;
      if (pot === 'hsa') {
        const r = db.prepare(`
          INSERT INTO hsa_payments (date, you_paid, status, inbox_attachment_id, hsa_eligible, patient)
          VALUES (date('now'), 0, 'draft', ?, 0, 'Self')
        `).run(attachmentId);
        draftId = r.lastInsertRowid;
      } else {
        const r = db.prepare(`
          INSERT INTO fsa_payments (date, amount, status, inbox_attachment_id, fsa_eligible, patient)
          VALUES (date('now'), 0, 'draft', ?, 0, 'Self')
        `).run(attachmentId);
        draftId = r.lastInsertRowid;
      }

      // Backfill attachment to point at draft
      const entityType = pot === 'hsa' ? 'hsa_payment' : 'fsa_payment';
      db.prepare(`
        UPDATE attachments SET entity_type=?, entity_id=? WHERE id=?
      `).run(entityType, draftId, attachmentId);

      drafts.push({
        pot, record_id: draftId, attachment_id: attachmentId,
        file_name: f.originalname,
      });
    }

    res.json({ ok: true, drafts });
  } catch (e) { serverError(res, e); }
});

// ── EOB → HSA AUTO-MATCH ──────────────────────────────────────────
//
// GET /api/v1/hsa/payments/:id/eob-candidates
// Returns possible matching EOB claims (same patient, ±7 days, similar amount).
// Used by the inbox modal to suggest links.
router.get('/payments/:id/eob-candidates', (req, res) => {
  try {
    const p = db.prepare(`
      SELECT id, date, you_paid, patient FROM hsa_payments WHERE id = ?
    `).get(req.params.id);
    if (!p) return notFound(res, 'Payment not found');

    const cents = Math.round((p.you_paid || 0) * 100);
    const candidates = db.prepare(`
      SELECT DISTINCT c.id, c.patient, c.provider, s.service_date, c.your_share
      FROM med_eob_claims c
      JOIN med_eob_services s ON s.claim_id = c.id
      WHERE c.patient = ?
        AND ABS(julianday(s.service_date) - julianday(?)) <= 7
        AND ABS(ROUND(c.your_share * 100) - ?) <= 100
      ORDER BY ABS(julianday(s.service_date) - julianday(?))
      LIMIT 5
    `).all(p.patient, p.date, cents, p.date);

    res.json({ payment: p, candidates });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/hsa/payments/:id/link-eob   { eob_claim_id }
router.post('/payments/:id/link-eob', (req, res) => {
  try {
    const eobClaimId = req.body.eob_claim_id;
    if (!eobClaimId) return badRequest(res, 'eob_claim_id required');
    const claim = db.prepare('SELECT id FROM med_eob_claims WHERE id = ?').get(eobClaimId);
    if (!claim) return notFound(res, 'EOB claim not found');
    db.prepare(`
      UPDATE hsa_payments SET eob_claim_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(eobClaimId, req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ── LP-FSA PAYMENTS (mirror of HSA payments, simpler) ─────────────

router.get('/fsa/payments', (req, res) => {
  try {
    const year = req.query.year || currentYear();
    let sql = `SELECT * FROM fsa_payments WHERE strftime('%Y', date) = ? AND COALESCE(status,'final') = 'final'`;
    const p = [String(year)];
    if (req.query.patient) { sql += ' AND patient = ?'; p.push(req.query.patient); }
    sql += ' ORDER BY date DESC, id DESC';
    res.json(db.prepare(sql).all(...p));
  } catch (e) { serverError(res, e); }
});

router.post('/fsa/payments', (req, res) => {
  try {
    const d = req.body;
    if (!d.date) return badRequest(res, 'date required');

    if (!d.force_duplicate) {
      const dupId = dedupe.findReceiptDuplicate({
        pot: 'fsa', date: d.date, vendor_contact_id: d.vendor_contact_id,
        amount: d.amount, patient: d.patient,
      });
      if (dupId) {
        return res.status(409).json({
          duplicate_of: dupId,
          warning: dedupe.warningFor('receipt', dupId,
            `From ${d.date}, $${Number(d.amount).toFixed(2)}.`),
        });
      }
    }

    const r = db.prepare(`
      INSERT INTO fsa_payments
        (date, vendor_contact_id, amount, patient, category,
         fsa_eligible, reimbursed, notes, status)
      VALUES (?,?,?,?,?,?,?,?, 'final')
    `).run(
      d.date, d.vendor_contact_id || null, d.amount || 0,
      d.patient || 'Self', d.category || null,
      d.fsa_eligible ? 1 : 0, d.reimbursed ? 1 : 0, d.notes || null
    );
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/fsa/payments/:id', (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE fsa_payments SET
        date=?, vendor_contact_id=?, amount=?, patient=?, category=?,
        fsa_eligible=?, reimbursed=?, reimbursement_date=?, notes=?
      WHERE id=?
    `).run(
      d.date, d.vendor_contact_id || null, d.amount,
      d.patient, d.category, d.fsa_eligible ? 1 : 0,
      d.reimbursed ? 1 : 0, d.reimbursement_date || null, d.notes || null,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/fsa/payments/:id', (req, res) => {
  try {
    // Move attachment to _orphans/ if any
    const row = db.prepare(`
      SELECT p.inbox_attachment_id, a.file_path
      FROM fsa_payments p LEFT JOIN attachments a ON a.id = p.inbox_attachment_id
      WHERE p.id = ?
    `).get(req.params.id);
    if (row && row.file_path && fs.existsSync(row.file_path)) {
      try { lifecycle.moveToOrphans(row.file_path); } catch {}
    }
    db.prepare('DELETE FROM fsa_payments WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.get('/fsa/plan', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM fsa_plan_info ORDER BY year DESC').all());
  } catch (e) { serverError(res, e); }
});

router.post('/fsa/plan', (req, res) => {
  try {
    const d = req.body;
    if (!d.year) return badRequest(res, 'year required');
    const r = db.prepare(`
      INSERT INTO fsa_plan_info
        (year, plan_type, plan_name, custodian, annual_limit,
         contributions, employer_contribution, deadline_date,
         carryover_amount, active, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(year, plan_type) DO UPDATE SET
        plan_name=excluded.plan_name, custodian=excluded.custodian,
        annual_limit=excluded.annual_limit,
        contributions=excluded.contributions,
        employer_contribution=excluded.employer_contribution,
        deadline_date=excluded.deadline_date,
        carryover_amount=excluded.carryover_amount,
        active=excluded.active, notes=excluded.notes
    `).run(
      d.year, d.plan_type || 'limited_purpose', d.plan_name || null,
      d.custodian || null, d.annual_limit || null,
      d.contributions || 0, d.employer_contribution || 0,
      d.deadline_date || null, d.carryover_amount || 0,
      d.active === false ? 0 : 1, d.notes || null
    );
    res.json({ ok: true, id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// ── MILEAGE COMPANION ROW ─────────────────────────────────────────
//
// POST /api/v1/hsa/payments/:id/mileage   { miles }
// Creates a companion row tied to the parent HSA payment, valued at
// miles × IRS rate for the parent's date-year.
router.post('/payments/:id/mileage', (req, res) => {
  try {
    const miles = Number(req.body.miles);
    if (!miles || miles <= 0) return badRequest(res, 'miles must be > 0');

    const parent = db.prepare(`
      SELECT id, date, patient FROM hsa_payments WHERE id = ?
    `).get(req.params.id);
    if (!parent) return notFound(res, 'Parent payment not found');

    const year = parseInt(String(parent.date).slice(0, 4), 10);
    const rate = db.prepare(`
      SELECT rate_cents FROM irs_mileage_rates
      WHERE year = ? AND category = 'medical'
        AND ? BETWEEN start_date AND COALESCE(end_date, '9999-12-31')
      ORDER BY start_date DESC LIMIT 1
    `).get(year, parent.date);
    const cents = rate ? rate.rate_cents : 21;  // fallback to current rate
    const amount = Math.round(miles * cents) / 100;

    const r = db.prepare(`
      INSERT INTO hsa_payments
        (date, patient, you_paid, total_bill, hsa_eligible, mileage_miles,
         parent_payment_id, category, status, notes)
      VALUES (?, ?, ?, ?, 1, ?, ?, 'Mileage', 'final', ?)
    `).run(
      parent.date, parent.patient, amount, amount, miles,
      parent.id, `Mileage companion: ${miles}mi × $${(cents/100).toFixed(2)}/mi`
    );
    res.json({ ok: true, id: r.lastInsertRowid, amount });
  } catch (e) { serverError(res, e); }
});
