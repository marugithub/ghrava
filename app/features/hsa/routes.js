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
    res.json(db.prepare(sql).all(...p));
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
         hsa_eligible, receipt_saved, receipt_location, reimbursed, reimbursement_date, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.date, d.patient||'Self', d.provider||null, d.category||null, d.payment_type||null,
      d.total_bill||0, d.insurance_paid||0, d.you_paid||0,
      d.hsa_eligible !== false ? 1 : 0,
      d.receipt_saved ? 1 : 0, d.receipt_location||null,
      d.reimbursed ? 1 : 0, d.reimbursement_date||null, d.notes||null
    );
    saveFamilyMembers(info.lastInsertRowid, 'hsa_payment', d.family_member_ids || []);
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
        hsa_eligible=?, receipt_saved=?, receipt_location=?,
        reimbursed=?, reimbursement_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.date, d.patient||'Self', d.provider||null, d.category||null, d.payment_type||null,
      d.total_bill||0, d.insurance_paid||0, d.you_paid||0,
      d.hsa_eligible !== false ? 1 : 0,
      d.receipt_saved ? 1 : 0, d.receipt_location||null,
      d.reimbursed ? 1 : 0, d.reimbursement_date||null, d.notes||null,
      req.params.id
    );
    clearReview('hsa_payments', req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/hsa/payments/:id
router.delete('/payments/:id', (req, res) => {
  try {
    clearFamilyMembers(req.params.id, 'hsa_payment');
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
                     'receipt_saved','receipt_location','reimbursed','reimbursement_date','notes'];
    const lines = rows.map(r => headers.map(h => escCsv(r[h])).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="hsa_payments_${year}.csv"`);
    res.send([headers.join(','), ...lines].join('\n'));
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
         hsa_eligible, receipt_saved, receipt_location, reimbursed, reimbursement_date, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.date, d.item_name, d.otc_category||'OTC Medicine', d.store||null,
      d.amount||0, d.quantity||1,
      d.hsa_eligible !== false ? 1 : 0,
      d.receipt_saved ? 1 : 0, d.receipt_location||null,
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
        hsa_eligible=?, receipt_saved=?, receipt_location=?,
        reimbursed=?, reimbursement_date=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.date, d.item_name, d.otc_category||'OTC Medicine', d.store||null,
      d.amount||0, d.quantity||1,
      d.hsa_eligible !== false ? 1 : 0,
      d.receipt_saved ? 1 : 0, d.receipt_location||null,
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
                     'hsa_eligible','receipt_saved','receipt_location','reimbursed','reimbursement_date','notes'];
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
    const markPayment  = db.prepare(`UPDATE hsa_payments SET reimbursed=1, reimbursement_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`);
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
          if (item.expense_type === 'payment') markPayment.run(d.reimbursement_date, item.expense_id);
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
          db.prepare('UPDATE hsa_payments SET reimbursed=0, reimbursement_date=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(item.expense_id);
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
