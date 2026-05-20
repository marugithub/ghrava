'use strict';
/**
 * features/finance/reports.js
 * Mounted at /api/v1/finance/reports
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError } = require('../../shared/errors');

// GET /api/v1/finance/reports/spending-by-category?year=2025&month=3
// Returns category breakdown for a given period (month optional — omit for full year)
router.get('/spending-by-category', (req, res) => {
  try {
    const year  = req.query.year  || new Date().getFullYear().toString();
    const month = req.query.month || null;

    let dateCond = `strftime('%Y', date) = ?`;
    const params = [year];
    if (month) {
      dateCond += ` AND strftime('%m', date) = ?`;
      params.push(String(month).padStart(2,'0'));
    }

    // Spending by category — UNION banking + investment (B6)
    const unionCond = dateCond.replace('date', 'txn_date');
    const cats = db.prepare(`
      SELECT
        COALESCE(category, 'Uncategorized') AS category,
        ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 2) AS spent,
        ROUND(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 2)      AS income,
        COUNT(*)                                                         AS tx_count
      FROM (
        SELECT category, amount FROM finance_transactions WHERE ${dateCond}
        UNION ALL
        SELECT category, amount FROM imported_transactions WHERE ${unionCond} AND is_transfer=0
      )
      GROUP BY COALESCE(category, 'Uncategorized')
      ORDER BY spent DESC
    `).all(...params, ...params);

    const totals = db.prepare(`
      SELECT
        ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 2) AS total_spent,
        ROUND(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 2)      AS total_income,
        COUNT(*) AS tx_count
      FROM (
        SELECT amount FROM finance_transactions WHERE ${dateCond}
        UNION ALL
        SELECT amount FROM imported_transactions WHERE ${unionCond} AND is_transfer=0
      )
    `).get(...params, ...params);

    res.json({ year, month: month||null, categories: cats, totals });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/finance/reports/monthly-totals?year=2025
// 12-month bar data: spent + income per month
router.get('/monthly-totals', (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear().toString();
    const rows = db.prepare(`
      SELECT
        CAST(strftime('%m', dt) AS INTEGER)                               AS month,
        ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 2)  AS spent,
        ROUND(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 2)       AS income
      FROM (
        SELECT date AS dt, amount FROM finance_transactions
          WHERE strftime('%Y', date) = ?
        UNION ALL
        SELECT txn_date AS dt, amount FROM imported_transactions
          WHERE strftime('%Y', txn_date) = ? AND is_transfer=0
      )
      GROUP BY strftime('%m', dt)
      ORDER BY month ASC
    `).all(year, year);

    // Fill in all 12 months even if no data
    const months = Array.from({length:12},(_,i) => {
      const found = rows.find(r => r.month === i+1);
      return { month: i+1, spent: found?.spent||0, income: found?.income||0 };
    });

    // Previous year for comparison
    const prevYear = String(+year - 1);
    const prevRows = db.prepare(`
      SELECT CAST(strftime('%m', dt) AS INTEGER) AS month,
        ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)), 2) AS spent
      FROM (
        SELECT date AS dt, amount FROM finance_transactions WHERE strftime('%Y', date) = ?
        UNION ALL
        SELECT txn_date AS dt, amount FROM imported_transactions WHERE strftime('%Y', txn_date) = ? AND is_transfer=0
      )
      GROUP BY strftime('%m', dt)
    `).all(prevYear, prevYear);

    months.forEach(m => {
      const prev = prevRows.find(r => r.month === m.month);
      m.prev_spent = prev?.spent || 0;
    });

    res.json({ year, months });
  } catch(e) { serverError(res, e); }
});

// v.183 — GET /api/v1/finance/reports/daily-spend?year=2025
// Drives the Calendar heatmap (#26.1.2). Returns daily aggregates
// across the unified transactions UNION imported_transactions feed,
// excluding transfers, summing the magnitude of negative amounts
// (spend only — incomes don't color the heatmap).
//
// Response: { year, days: [{date, spent, tx_count}, ...], max_spent,
//             total_spent }. Days with zero spend are omitted; the
// frontend fills the calendar grid and treats missing days as 0.
router.get('/daily-spend', (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear().toString();

    // schema: transactions.{date, amount}; imported_transactions.{txn_date, amount, is_transfer}
    const days = db.prepare(`
      SELECT
        dt AS date,
        ROUND(ABS(SUM(amount)), 2) AS spent,
        COUNT(*) AS tx_count
      FROM (
        SELECT date AS dt, amount FROM finance_transactions
          WHERE strftime('%Y', date) = ? AND amount < 0
        UNION ALL
        SELECT txn_date AS dt, amount FROM imported_transactions
          WHERE strftime('%Y', txn_date) = ? AND amount < 0
            AND COALESCE(is_transfer, 0) = 0
      )
      GROUP BY dt
      ORDER BY dt ASC
    `).all(year, year);

    const max_spent   = days.reduce((m, d) => Math.max(m, d.spent || 0), 0);
    const total_spent = days.reduce((s, d) => s + (d.spent || 0), 0);

    res.json({ year, days, max_spent, total_spent: Math.round(total_spent * 100) / 100 });
  } catch (e) { serverError(res, e); }
});

// v.183 — GET /api/v1/finance/reports/txns-on-date?date=YYYY-MM-DD
// Drill-down companion to /daily-spend. Returns every transaction on
// the given date (spend + income, transfers excluded) across the same
// unified feed. Used when the user clicks a calendar heatmap cell.
//
// Response: { date, transactions: [...], total_spent, total_income }.
router.get('/txns-on-date', (req, res) => {
  try {
    const date = req.query.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
    }

    // schema: transactions.{date, description, amount, category};
    //         imported_transactions.{txn_date, description, amount, category, is_transfer}
    const txns = db.prepare(`
      SELECT date, description, amount, category, source
      FROM (
        SELECT date,        description, amount, category, 'finance'  AS source
          FROM finance_transactions WHERE date = ?
        UNION ALL
        SELECT txn_date AS date, description, amount, category, 'imported' AS source
          FROM imported_transactions
          WHERE txn_date = ? AND COALESCE(is_transfer, 0) = 0
      )
      ORDER BY amount ASC
    `).all(date, date);

    const total_spent  = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const total_income = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    res.json({
      date,
      transactions: txns,
      total_spent:  Math.round(total_spent  * 100) / 100,
      total_income: Math.round(total_income * 100) / 100,
    });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/finance/reports/hsa-summary?year=2025
router.get('/hsa-summary', (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear().toString();

    const pool = db.prepare(`
      SELECT
        ROUND(SUM(CASE WHEN hsa_eligible=1 THEN you_paid ELSE 0 END),2)      AS total_eligible,
        ROUND(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=1 THEN you_paid ELSE 0 END),2) AS reimbursed,
        ROUND(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN you_paid ELSE 0 END),2) AS unreimbursed,
        COUNT(CASE WHEN receipt_saved=0 AND hsa_eligible=1 THEN 1 END)        AS missing_receipts,
        COUNT(*) AS total_expenses
      FROM hsa_payments WHERE strftime('%Y',date) = ?
    `).get(year);

    const byCat = db.prepare(`
      SELECT COALESCE(category,'Other') AS category,
        ROUND(SUM(you_paid),2) AS amount, COUNT(*) AS count
      FROM hsa_payments WHERE strftime('%Y',date) = ? AND hsa_eligible=1
      GROUP BY COALESCE(category,'Other') ORDER BY amount DESC
    `).all(year);

    const byMonth = db.prepare(`
      SELECT CAST(strftime('%m',date) AS INTEGER) AS month,
        ROUND(SUM(you_paid),2) AS amount
      FROM hsa_payments WHERE strftime('%Y',date)=? AND hsa_eligible=1
      GROUP BY month ORDER BY month
    `).all(year);

    const months = Array.from({length:12},(_,i) => {
      const f = byMonth.find(r=>r.month===i+1);
      return { month: i+1, amount: f?.amount||0 };
    });

    const visits = db.prepare(`
      SELECT patient, COUNT(*) AS visits
      FROM med_visit_notes WHERE strftime('%Y',visit_date)=?
      GROUP BY patient ORDER BY visits DESC
    `).all(year);

    res.json({ year, pool, by_category: byCat, by_month: months, visits_by_patient: visits });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/finance/reports/net-worth-trend
router.get('/net-worth-trend', (req, res) => {
  try {
    // Manual snapshots (user-entered)
    let snapshots = [];
    try {
      snapshots = db.prepare(`
        SELECT snapshot_date, net_worth, total_assets, total_liabilities
        FROM net_worth_snapshots ORDER BY snapshot_date ASC LIMIT 24
      `).all();
    } catch { /* table may not exist yet */ }

    // C7: Auto snapshots from investment imports (account_snapshots table)
    let investmentHistory = [];
    try {
      investmentHistory = db.prepare(`
        SELECT
          s.snapshot_date,
          fa.nickname AS account_name,
          fa.institution,
          s.balance AS account_balance
        FROM account_snapshots s
        JOIN financial_accounts fa ON fa.id = s.account_id
        ORDER BY s.snapshot_date ASC, fa.nickname ASC
      `).all();
    } catch { /* table may not exist */ }

    // Aggregate investment history by date
    const invByDate = {};
    for (const r of investmentHistory) {
      if (!invByDate[r.snapshot_date]) invByDate[r.snapshot_date] = { date: r.snapshot_date, total: 0, accounts: [] };
      invByDate[r.snapshot_date].total += (r.account_balance || 0);
      invByDate[r.snapshot_date].accounts.push({ name: r.account_name, balance: r.account_balance });
    }
    const investmentTrend = Object.values(invByDate).sort((a,b) => a.date.localeCompare(b.date));

    // Detect whether include_net_worth column exists (may be missing on older DBs)
    const cols = db.prepare("PRAGMA table_info(finance_accounts)").all().map(c => c.name);
    const hasInclude = cols.includes('include_net_worth');
    const hasActive  = cols.includes('is_active');

    const whereActive = hasActive  ? 'WHERE is_active=1' : '';
    const inclFilter  = hasInclude ? 'AND include_net_worth=1' : '';

    const current = db.prepare(`
      SELECT
        ROUND(COALESCE(SUM(CASE WHEN current_balance > 0 ${inclFilter} THEN current_balance ELSE 0 END),0),2) AS assets,
        ROUND(COALESCE(SUM(CASE WHEN current_balance < 0 ${inclFilter} THEN ABS(current_balance) ELSE 0 END),0),2) AS liabilities
      FROM finance_accounts ${whereActive}
    `).get();

    const accounts = db.prepare(`
      SELECT name, type AS account_type, current_balance${hasInclude ? ', include_net_worth' : ', 1 AS include_net_worth'}
      FROM finance_accounts ${whereActive} ORDER BY current_balance DESC
    `).all();

    res.json({
      snapshots,
      investment_trend: investmentTrend,
      current: { ...current, net_worth: (current.assets||0) - (current.liabilities||0) },
      accounts,
    });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/finance/reports/annual-summary?year=2025
router.get('/annual-summary', (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear().toString();
    const prevYear = String(+year - 1);

    const summary = (y) => db.prepare(`
      SELECT
        ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)),2) AS total_spent,
        ROUND(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),2)      AS total_income,
        COUNT(*) AS tx_count,
        COUNT(DISTINCT COALESCE(category,'Uncategorized'))             AS categories_used
      FROM finance_transactions WHERE strftime('%Y',date)=?
    `).get(y);

    const topCats = db.prepare(`
      SELECT COALESCE(category,'Uncategorized') AS category,
        ROUND(ABS(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END)),2) AS spent
      FROM finance_transactions WHERE strftime('%Y',date)=? AND amount < 0
      GROUP BY COALESCE(category,'Uncategorized') ORDER BY spent DESC LIMIT 5
    `).all(year);

    const biggestExpenses = db.prepare(`
      SELECT date, description, amount, category
      FROM finance_transactions WHERE strftime('%Y',date)=? AND amount < 0
      ORDER BY amount ASC LIMIT 10
    `).all(year);

    res.json({
      year,
      current: summary(year),
      previous: summary(prevYear),
      top_categories: topCats,
      biggest_expenses: biggestExpenses,
    });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
