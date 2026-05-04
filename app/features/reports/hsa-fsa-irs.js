// @ts-check
'use strict';
/**
 * features/reports/hsa-fsa-irs.js
 * v202604.140 — Annual reimbursement report for HSA + LP-FSA.
 *
 * Built to be IRS-audit-ready: every reimbursable expense for the
 * requested year, with provider/vendor, amount, date, eligibility
 * state, mileage breakdown, and any linked EOB. Reimbursement events
 * during the year are listed separately with the receipts they covered.
 *
 * GET /api/v1/reports/hsa-fsa-irs?year=2026[&pot=hsa|fsa|all]
 *
 * Returns JSON. The Reports page renders it; if a printable form is
 * needed later, the same JSON can feed a server-side PDF generator.
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError } = require('../../shared/errors');

router.get('/', (req, res) => {
  try {
    const year = String(parseInt(req.query.year) || new Date().getFullYear());
    const pot  = req.query.pot || 'all';   // 'hsa' | 'fsa' | 'all'
    const out  = { year: Number(year), pot };

    if (pot === 'hsa' || pot === 'all') {
      out.hsa = buildPotSection({
        table: 'hsa_payments',
        eligibleCol: 'hsa_eligible',
        amountCol: 'you_paid',
        otcTable: 'hsa_otc',
        reimbursementTable: 'hsa_reimbursements',
        reimbursementYearCol: 'from_year',
        reimbursementItemTable: 'hsa_reimbursement_items',
        year,
      });
    }
    if (pot === 'fsa' || pot === 'all') {
      out.fsa = buildPotSection({
        table: 'fsa_payments',
        eligibleCol: 'fsa_eligible',
        amountCol: 'amount',
        otcTable: null,
        reimbursementTable: 'fsa_reimbursements',
        reimbursementYearCol: null,  // no from_year column on fsa side
        reimbursementItemTable: 'fsa_reimbursement_items',
        year,
      });
    }

    res.json(out);
  } catch (e) { serverError(res, e); }
});

function buildPotSection(opts) {
  const { table, eligibleCol, amountCol, otcTable,
          reimbursementTable, reimbursementYearCol,
          reimbursementItemTable, year } = opts;

  // Eligible expenses for the year
  const expenses = db.prepare(`
    SELECT
      p.id, p.date, p.${amountCol} AS amount, p.patient,
      p.notes, p.${eligibleCol} AS eligible,
      p.reimbursed, p.reimbursement_date,
      p.eob_claim_id,
      p.parent_payment_id,
      p.mileage_miles,
      c.name AS vendor_name,
      c.contact_type AS vendor_type
    FROM ${table} p
    LEFT JOIN contacts c ON c.id = p.vendor_contact_id
    WHERE strftime('%Y', p.date) = ?
      AND COALESCE(p.status, 'final') = 'final'
    ORDER BY p.date ASC, p.id ASC
  `).all(year);

  // OTC entries for HSA only
  let otc = [];
  if (otcTable) {
    otc = db.prepare(`
      SELECT id, date, store, amount, hsa_eligible AS eligible, reimbursed,
             reimbursement_date, notes
      FROM ${otcTable}
      WHERE strftime('%Y', date) = ?
      ORDER BY date ASC, id ASC
    `).all(year);
  }

  // Mileage subtotals (companion rows have parent_payment_id set)
  const mileage_total = expenses
    .filter(e => e.parent_payment_id != null && e.mileage_miles != null)
    .reduce((s, e) => s + (e.amount || 0), 0);
  const mileage_miles = expenses
    .filter(e => e.parent_payment_id != null && e.mileage_miles != null)
    .reduce((s, e) => s + (e.mileage_miles || 0), 0);

  // Eligible totals
  const eligible_expense_total = expenses
    .filter(e => e.eligible === 1)
    .reduce((s, e) => s + (e.amount || 0), 0);
  const eligible_otc_total = otc
    .filter(o => o.eligible === 1)
    .reduce((s, o) => s + (o.amount || 0), 0);

  // Reimbursement events during the year
  let reimbursements = [];
  try {
    let rSql = `SELECT * FROM ${reimbursementTable}`;
    let rParams = [];
    if (reimbursementYearCol) {
      rSql += ` WHERE ${reimbursementYearCol} = ?`;
      rParams = [Number(year)];
    } else {
      rSql += ` WHERE strftime('%Y', date) = ?`;
      rParams = [year];
    }
    rSql += ' ORDER BY date ASC';
    reimbursements = db.prepare(rSql).all(...rParams);

    // For each reimbursement, fetch the items it covered
    for (const r of reimbursements) {
      try {
        r.items = db.prepare(`
          SELECT * FROM ${reimbursementItemTable} WHERE reimbursement_id = ?
        `).all(r.id);
      } catch { r.items = []; }
    }
  } catch { reimbursements = []; }

  return {
    expenses,
    otc,
    reimbursements,
    totals: {
      eligible_expenses: eligible_expense_total,
      eligible_otc: eligible_otc_total,
      mileage: mileage_total,
      mileage_miles,
      grand_eligible: eligible_expense_total + eligible_otc_total,
    },
  };
}

module.exports = router;
