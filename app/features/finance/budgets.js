'use strict';
/**
 * features/finance/budgets.js
 * Budget routes — mounted under /api/v1/finance/budgets
 *
 * GET  /                     list budgets + actuals for year/month
 * POST /                     create budget
 * PUT  /:id                  update budget
 * DELETE /:id                delete budget
 * GET  /summary?year=&month= spending vs budget summary
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');

router.use(requireAuth);

// GET /api/v1/finance/budgets?year=&month=
router.get('/', (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const monthStr = `${year}-${String(month).padStart(2,'0')}`;

    const budgets = db.prepare(`
      SELECT * FROM budgets WHERE is_active=1 AND year=?
      ORDER BY monthly_limit DESC
    `).all(year);

    // Get actual spending from finance_transactions for this month
    const actuals = db.prepare(`
      SELECT category, COALESCE(SUM(ABS(amount)),0) AS spent
      FROM finance_transactions
      WHERE strftime('%Y-%m', date) = ?
        AND amount < 0
        AND category IS NOT NULL
      GROUP BY category
    `).all(monthStr);

    const actualMap = {};
    actuals.forEach(a => { actualMap[a.category] = a.spent; });

    const result = budgets.map(b => ({
      ...b,
      spent: actualMap[b.category] || 0,
      remaining: b.monthly_limit - (actualMap[b.category] || 0),
      pct: b.monthly_limit > 0 ? Math.min(100, Math.round(((actualMap[b.category]||0) / b.monthly_limit) * 100)) : 0,
    }));

    // Also include categories with spending but no budget
    const unbudgeted = actuals.filter(a => !budgets.find(b => b.category === a.category));

    res.json({ budgets: result, unbudgeted, year, month });
  } catch (e) { serverError(res, e); }
});

router.post('/', (req, res) => {
  try {
    const d = req.body;
    if (!d.category) return badRequest(res, 'category required');
    const year = parseInt(d.year) || new Date().getFullYear();
    const r = db.prepare(`
      INSERT OR REPLACE INTO budgets (category, monthly_limit, year, notes)
      VALUES (?,?,?,?)
    `).run(d.category, parseFloat(d.monthly_limit)||0, year, d.notes||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/:id', (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM budgets WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Budget');
    db.prepare(`
      UPDATE budgets SET category=?, monthly_limit=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(d.category||existing.category, parseFloat(d.monthly_limit)??existing.monthly_limit,
           d.notes||null, req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare('UPDATE budgets SET is_active=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
