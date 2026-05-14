'use strict';
/**
 * features/finance/budgets.js
 * Budget routes — mounted under /api/v1/finance/budgets
 *
 *   GET    /                       list budgets + actuals for year/month
 *   POST   /                       create budget
 *   PUT    /:id                    update budget
 *   DELETE /:id                    soft-delete (is_active=0)
 *   GET    /summary?year=&month=   totals only (lightweight)
 *   GET    /history?year=          per-month spent vs limit for the year
 *
 * v.169: rewritten to read the unified `transactions` table directly
 * instead of `finance_transactions` / `imported_transactions` compat
 * views. Adds /summary and /history endpoints used by the Budget tab
 * monthly trend strip.
 *
 * Schema (verified against SCHEMA.md):
 *   budgets:      id, category, monthly_limit, year, month, notes, is_active
 *   transactions: id, account_id, date, description, amount, category,
 *                 is_transfer, source, ... (unified table, mig 130)
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');

router.use(requireAuth);

// ─── helpers ──────────────────────────────────────────────────────

// One source of truth for "category spending in a given month".
// Returns Map<category, spent> for the YYYY-MM month string.
// schema: transactions.date, .amount, .category, .is_transfer
function spentByCategory(monthStr) {
  const rows = db.prepare(`
    SELECT category, COALESCE(SUM(ABS(amount)),0) AS spent
    FROM transactions
    WHERE strftime('%Y-%m', date) = ?
      AND amount < 0
      AND is_transfer = 0
      AND category IS NOT NULL
      AND category != ''
    GROUP BY category
  `).all(monthStr);
  const map = new Map();
  rows.forEach(r => map.set(r.category, r.spent));
  return map;
}

// ─── GET / ────────────────────────────────────────────────────────
// schema: budgets.{category,monthly_limit,year,month,notes,is_active}
router.get('/', (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2,'0')}`;

    const budgets = db.prepare(`
      SELECT id, category, monthly_limit, year, month, notes, is_active, created_at, updated_at
      FROM budgets
      WHERE is_active=1 AND year=?
      ORDER BY monthly_limit DESC
    `).all(year);

    const actualMap = spentByCategory(monthStr);

    const result = budgets.map(b => {
      const spent = actualMap.get(b.category) || 0;
      const remaining = b.monthly_limit - spent;
      const pct = b.monthly_limit > 0
        ? Math.min(100, Math.round((spent / b.monthly_limit) * 100))
        : 0;
      return { ...b, spent, remaining, pct };
    });

    // Categories with spending but no budget set
    const budgetedCats = new Set(budgets.map(b => b.category));
    const unbudgeted = [];
    actualMap.forEach((spent, category) => {
      if (!budgetedCats.has(category)) {
        unbudgeted.push({ category, spent });
      }
    });
    unbudgeted.sort((a, b) => b.spent - a.spent);

    res.json({ budgets: result, unbudgeted, year, month });
  } catch (e) { serverError(res, e); }
});

// ─── POST / ───────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const d = req.body || {};
    if (!d.category) return badRequest(res, 'category required');
    const year = parseInt(d.year) || new Date().getFullYear();
    const r = db.prepare(`
      INSERT OR REPLACE INTO budgets (category, monthly_limit, year, notes)
      VALUES (?,?,?,?)
    `).run(d.category, parseFloat(d.monthly_limit)||0, year, d.notes||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

// ─── PUT /:id ─────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const d = req.body || {};
    const existing = db.prepare('SELECT * FROM budgets WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Budget');
    db.prepare(`
      UPDATE budgets
      SET category=?, monthly_limit=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.category || existing.category,
      d.monthly_limit != null ? parseFloat(d.monthly_limit) : existing.monthly_limit,
      d.notes != null ? d.notes : existing.notes,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ─── DELETE /:id ──────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    db.prepare('UPDATE budgets SET is_active=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ─── GET /summary ─────────────────────────────────────────────────
// Lightweight totals; powers any tile that only needs the headline.
router.get('/summary', (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2,'0')}`;

    const budgets = db.prepare(`
      SELECT category, monthly_limit FROM budgets
      WHERE is_active=1 AND year=?
    `).all(year);

    const actualMap = spentByCategory(monthStr);

    let totalLimit = 0, totalSpent = 0, overCount = 0, nearCount = 0;
    const overCats = [];
    budgets.forEach(b => {
      const spent = actualMap.get(b.category) || 0;
      totalLimit += b.monthly_limit;
      totalSpent += spent;
      if (b.monthly_limit > 0 && spent >= b.monthly_limit) {
        overCount++;
        overCats.push({ category: b.category, over_by: spent - b.monthly_limit });
      } else if (b.monthly_limit > 0 && spent >= b.monthly_limit * 0.8) {
        nearCount++;
      }
    });
    overCats.sort((a, b) => b.over_by - a.over_by);

    res.json({
      year, month,
      budgets_count: budgets.length,
      total_limit: totalLimit,
      total_spent: totalSpent,
      remaining: totalLimit - totalSpent,
      over_count: overCount,
      near_count: nearCount,
      over_top: overCats.slice(0, 3),
      pct: totalLimit > 0 ? Math.min(100, Math.round((totalSpent/totalLimit)*100)) : 0,
    });
  } catch (e) { serverError(res, e); }
});

// ─── GET /history?year= ───────────────────────────────────────────
// For the budget tab's monthly trend strip. Returns 12 months of
// totals (spent vs limit) for the requested year, regardless of how
// many budgets exist per month.
router.get('/history', (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    // Single roll-up over the active budgets — monthly_limit is per
    // category-per-year; one budget row covers all 12 months.
    const limitRow = db.prepare(`
      SELECT COALESCE(SUM(monthly_limit), 0) AS total_limit
      FROM budgets WHERE is_active=1 AND year=?
    `).get(year);
    const monthlyLimit = limitRow ? limitRow.total_limit : 0;

    // Spent per month, only on categories that have a budget.
    const budgetedCats = db.prepare(`
      SELECT DISTINCT category FROM budgets WHERE is_active=1 AND year=?
    `).all(year).map(r => r.category);

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${year}-${String(m).padStart(2,'0')}`;
      let spent = 0;
      if (budgetedCats.length) {
        const placeholders = budgetedCats.map(() => '?').join(',');
        const r = db.prepare(`
          SELECT COALESCE(SUM(ABS(amount)), 0) AS spent
          FROM transactions
          WHERE strftime('%Y-%m', date) = ?
            AND amount < 0
            AND is_transfer = 0
            AND category IN (${placeholders})
        `).get(monthStr, ...budgetedCats);
        spent = r ? r.spent : 0;
      }
      months.push({
        month: m,
        month_str: monthStr,
        spent,
        limit: monthlyLimit,
        pct: monthlyLimit > 0 ? Math.min(100, Math.round((spent/monthlyLimit)*100)) : 0,
      });
    }

    res.json({ year, monthly_limit: monthlyLimit, months });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
