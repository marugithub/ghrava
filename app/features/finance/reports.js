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

// v.183 — GET /api/v1/finance/reports/top-vendors?year=2025&limit=50
// Drives the Vendor treemap (#26.1.3). Groups the unified transactions
// feed by description (the canonical vendor field per v.171 — there is
// no separate `merchant` column on `transactions`) and ranks by total
// magnitude of negative amounts. Transfers excluded.
//
// Response: { year, vendors: [{vendor, spent, tx_count}, ...],
//             total_spent }. Limit caps result count (default 50,
// max 200).
router.get('/top-vendors', (req, res) => {
  try {
    const year  = req.query.year || new Date().getFullYear().toString();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));

    // schema: transactions.{description, date, amount};
    //         imported_transactions.{description, txn_date, amount, is_transfer}
    const vendors = db.prepare(`
      SELECT
        COALESCE(description, '(no description)') AS vendor,
        ROUND(ABS(SUM(amount)), 2) AS spent,
        COUNT(*) AS tx_count
      FROM (
        SELECT description, amount FROM finance_transactions
          WHERE strftime('%Y', date) = ? AND amount < 0
        UNION ALL
        SELECT description, amount FROM imported_transactions
          WHERE strftime('%Y', txn_date) = ? AND amount < 0
            AND COALESCE(is_transfer, 0) = 0
      )
      GROUP BY COALESCE(description, '(no description)')
      ORDER BY spent DESC
      LIMIT ?
    `).all(year, year, limit);

    const total_spent = vendors.reduce((s, v) => s + (v.spent || 0), 0);
    res.json({ year, vendors, total_spent: Math.round(total_spent * 100) / 100 });
  } catch (e) { serverError(res, e); }
});

// v.183 — GET /api/v1/finance/reports/txns-by-vendor?vendor=NAME&year=YYYY
// Drill-down companion to /top-vendors. Returns every transaction
// where the description matches the given vendor (exact match, case-
// sensitive — matches what /top-vendors GROUP BY produces). Year
// optional; omit to scan all years.
//
// Response: { vendor, year, transactions: [...], total_spent }.
router.get('/txns-by-vendor', (req, res) => {
  try {
    const vendor = req.query.vendor;
    if (!vendor) return res.status(400).json({ error: 'vendor=NAME required' });
    const year = req.query.year || null;

    let where = `description = ?`;
    const params = [vendor];
    let importedWhere = `description = ?`;
    const importedParams = [vendor];
    if (year) {
      where         += ` AND strftime('%Y', date) = ?`;
      params.push(String(year));
      importedWhere += ` AND strftime('%Y', txn_date) = ?`;
      importedParams.push(String(year));
    }

    // schema: transactions.{date, description, amount, category};
    //         imported_transactions.{txn_date, description, amount, category, is_transfer}
    const txns = db.prepare(`
      SELECT date, description, amount, category, source
      FROM (
        SELECT date, description, amount, category, 'finance' AS source
          FROM finance_transactions
          WHERE ${where}
        UNION ALL
        SELECT txn_date AS date, description, amount, category, 'imported' AS source
          FROM imported_transactions
          WHERE ${importedWhere} AND COALESCE(is_transfer, 0) = 0
      )
      ORDER BY date DESC, amount ASC
    `).all(...params, ...importedParams);

    const total_spent = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    res.json({
      vendor,
      year,
      transactions: txns,
      total_spent: Math.round(total_spent * 100) / 100,
    });
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

// v.185 — GET /api/v1/finance/reports/income-by-category-flow?year=YYYY
// Drives the Sankey (#26.1.1). Returns income totals per income-side
// category (amount > 0) and spend totals per expense-side category
// (amount < 0) for the year, across the unified
// finance_transactions UNION imported_transactions feed (transfers
// excluded). The frontend draws ribbons between the two sides;
// because individual rows are not joined income→expense, the flow
// allocation is proportional, not a true paired join.
//
// Response: { year, income: [{category, amount}], expense:
//   [{category, amount}], total_income, total_expense }.
// Categories with zero magnitude are omitted; "Uncategorized" rolls
// up rows whose category is NULL or empty.
router.get('/income-by-category-flow', (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear().toString();

    // schema: finance_transactions.{date, amount, category};
    //         imported_transactions.{txn_date, amount, category, is_transfer}
    const income = db.prepare(`
      SELECT
        COALESCE(NULLIF(category, ''), 'Uncategorized') AS category,
        ROUND(SUM(amount), 2)                            AS amount
      FROM (
        SELECT category, amount FROM finance_transactions
          WHERE strftime('%Y', date) = ? AND amount > 0
        UNION ALL
        SELECT category, amount FROM imported_transactions
          WHERE strftime('%Y', txn_date) = ? AND amount > 0
            AND COALESCE(is_transfer, 0) = 0
      )
      GROUP BY COALESCE(NULLIF(category, ''), 'Uncategorized')
      HAVING SUM(amount) > 0
      ORDER BY amount DESC
    `).all(year, year);

    // schema: finance_transactions.{date, amount, category};
    //         imported_transactions.{txn_date, amount, category, is_transfer}
    const expense = db.prepare(`
      SELECT
        COALESCE(NULLIF(category, ''), 'Uncategorized') AS category,
        ROUND(ABS(SUM(amount)), 2)                       AS amount
      FROM (
        SELECT category, amount FROM finance_transactions
          WHERE strftime('%Y', date) = ? AND amount < 0
        UNION ALL
        SELECT category, amount FROM imported_transactions
          WHERE strftime('%Y', txn_date) = ? AND amount < 0
            AND COALESCE(is_transfer, 0) = 0
      )
      GROUP BY COALESCE(NULLIF(category, ''), 'Uncategorized')
      HAVING SUM(amount) < 0
      ORDER BY amount DESC
    `).all(year, year);

    const total_income  = income .reduce((s, r) => s + (r.amount || 0), 0);
    const total_expense = expense.reduce((s, r) => s + (r.amount || 0), 0);
    res.json({
      year,
      income,
      expense,
      total_income:  Math.round(total_income  * 100) / 100,
      total_expense: Math.round(total_expense * 100) / 100,
    });
  } catch (e) { serverError(res, e); }
});

// v.185 — GET /api/v1/finance/reports/txns-by-category?category=NAME&year=YYYY&month=MM&side=income|expense
// Generic category drill-down used by Sankey ribbon clicks (whole
// year, side-filtered) and small-multiples bar clicks (one month,
// expense side). `category` required; `year`, `month`, `side`
// optional. "Uncategorized" matches rows where category IS NULL OR
// category = ''.
//
// Response: { category, year, month, side, transactions: [...],
//   total_spent, total_income }.
router.get('/txns-by-category', (req, res) => {
  try {
    const category = req.query.category;
    if (!category) return res.status(400).json({ error: 'category=NAME required' });
    const year  = req.query.year  || null;
    const month = req.query.month || null;
    const side  = (req.query.side === 'income' || req.query.side === 'expense') ? req.query.side : null;

    const isUncat = (category === 'Uncategorized');
    const catCond = isUncat
      ? `(category IS NULL OR category = '')`
      : `category = ?`;

    let financeWhere  = catCond;
    let importedWhere = catCond;
    const financeParams  = isUncat ? [] : [category];
    const importedParams = isUncat ? [] : [category];

    if (year) {
      financeWhere  += ` AND strftime('%Y', date) = ?`;
      importedWhere += ` AND strftime('%Y', txn_date) = ?`;
      financeParams .push(String(year));
      importedParams.push(String(year));
    }
    if (month) {
      const mm = String(month).padStart(2, '0');
      financeWhere  += ` AND strftime('%m', date) = ?`;
      importedWhere += ` AND strftime('%m', txn_date) = ?`;
      financeParams .push(mm);
      importedParams.push(mm);
    }
    if (side === 'income') {
      financeWhere  += ` AND amount > 0`;
      importedWhere += ` AND amount > 0`;
    } else if (side === 'expense') {
      financeWhere  += ` AND amount < 0`;
      importedWhere += ` AND amount < 0`;
    }

    // schema: finance_transactions.{date, description, amount, category};
    //         imported_transactions.{txn_date, description, amount, category, is_transfer}
    const txns = db.prepare(`
      SELECT date, description, amount, category, source
      FROM (
        SELECT date, description, amount, category, 'finance' AS source
          FROM finance_transactions
          WHERE ${financeWhere}
        UNION ALL
        SELECT txn_date AS date, description, amount, category, 'imported' AS source
          FROM imported_transactions
          WHERE ${importedWhere} AND COALESCE(is_transfer, 0) = 0
      )
      ORDER BY date DESC, amount ASC
    `).all(...financeParams, ...importedParams);

    const total_spent  = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const total_income = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    res.json({
      category,
      year,
      month,
      side,
      transactions: txns,
      total_spent:  Math.round(total_spent  * 100) / 100,
      total_income: Math.round(total_income * 100) / 100,
    });
  } catch (e) { serverError(res, e); }
});

// v.185 — GET /api/v1/finance/reports/spending-by-category-monthly?year=YYYY&limit=N
// Drives the small-multiples (#26.1.4). Returns the top-N expense
// categories for the year, each with a 12-element monthly array
// (positions 0..11 = Jan..Dec, ABS of net spend). Limit defaults
// to 6, capped at 12 — small-multiples reads best at 6 panels.
// Transfers excluded; income rows excluded (this chart shows
// spending only).
//
// Response: { year, limit, categories: [{category, months: [12]}],
//   total_spent_year }.
router.get('/spending-by-category-monthly', (req, res) => {
  try {
    const year  = req.query.year  || new Date().getFullYear().toString();
    const limit = Math.min(12, Math.max(1, parseInt(req.query.limit || '6', 10)));

    // schema: finance_transactions.{date, amount, category};
    //         imported_transactions.{txn_date, amount, category, is_transfer}
    const rows = db.prepare(`
      SELECT
        COALESCE(NULLIF(category, ''), 'Uncategorized') AS category,
        CAST(strftime('%m', dt) AS INTEGER)              AS month,
        ROUND(ABS(SUM(amount)), 2)                        AS spent
      FROM (
        SELECT date     AS dt, amount, category FROM finance_transactions
          WHERE strftime('%Y', date) = ?       AND amount < 0
        UNION ALL
        SELECT txn_date AS dt, amount, category FROM imported_transactions
          WHERE strftime('%Y', txn_date) = ?   AND amount < 0
            AND COALESCE(is_transfer, 0) = 0
      )
      GROUP BY COALESCE(NULLIF(category, ''), 'Uncategorized'),
               strftime('%m', dt)
    `).all(year, year);

    // Pivot to category → 12-element array, then pick top-N by year total.
    const byCat = new Map();
    for (const r of rows) {
      if (!byCat.has(r.category)) byCat.set(r.category, new Array(12).fill(0));
      byCat.get(r.category)[r.month - 1] = r.spent || 0;
    }
    const ranked = [...byCat.entries()]
      .map(([category, months]) => ({
        category,
        months,
        _total: months.reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b._total - a._total)
      .slice(0, limit)
      .map(({ category, months }) => ({ category, months }));

    const total_spent_year = [...byCat.values()]
      .reduce((s, arr) => s + arr.reduce((t, v) => t + v, 0), 0);

    res.json({
      year,
      limit,
      categories: ranked,
      total_spent_year: Math.round(total_spent_year * 100) / 100,
    });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
