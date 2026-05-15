'use strict';
/**
 * features/finance/forecast.js
 * Cash-flow forecast — mounted under /api/v1/finance/forecast
 *
 *   GET /?days=30|60|90
 *
 * Projects the next N days of cash flow from active rows in
 * `recurring_transactions`. Today is day 0; forecast covers the
 * inclusive window [today, today+N-1]. Returns:
 *
 *   {
 *     generated_at, days, start_date, end_date,
 *     summary: { total_income, total_expenses, net,
 *                projected_lowest, projected_lowest_date,
 *                starting_balance, ending_balance, count },
 *     daily:   [ { date, income, expenses, net, running_balance,
 *                  items: [{ id, description, amount, category,
 *                            account_id, account_name, frequency }] }, ... ]
 *   }
 *
 * Starting balance is the sum of current_balance on active liquid
 * accounts (type IN Checking/Savings/Cash/HSA) — credit cards and
 * loans excluded since they're not cash. Frontend can override with
 * ?starting_balance=N for what-if scenarios.
 *
 * Schema (verified against SCHEMA.md):
 *   recurring_transactions: id, account_id, description, amount,
 *     category, frequency, start_date, end_date, next_date,
 *     last_generated, is_active
 *   accounts: id, name, type, is_active, current_balance
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { serverError } = require('../../shared/errors');

router.use(requireAuth);

// Liquid types — included in starting balance for cash forecast
const LIQUID_TYPES = new Set(['Checking', 'Savings', 'Cash', 'HSA']);

// Advance a YYYY-MM-DD date string by the given frequency. Returns
// the next ISO date. Mirrors recurring-transactions.js' rules.
function advanceDate(isoDate, frequency) {
  const d = new Date(isoDate + 'T00:00:00Z');
  const f = (frequency || '').toLowerCase();
  switch (f) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1); break;
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7); break;
    case 'biweekly':
    case 'bi-weekly':
    case 'fortnightly':
      d.setUTCDate(d.getUTCDate() + 14); break;
    case 'semimonthly':
    case 'semi-monthly': {
      // 1st → 15th, 15th → 1st of next month
      const day = d.getUTCDate();
      if (day < 15) { d.setUTCDate(15); }
      else { d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(1); }
      break;
    }
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1); break;
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3); break;
    case 'semiannual':
    case 'semi-annual':
      d.setUTCMonth(d.getUTCMonth() + 6); break;
    case 'annual':
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1); break;
    default:
      // Unknown frequency — bail out by jumping past the window
      d.setUTCFullYear(d.getUTCFullYear() + 10);
  }
  return d.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// schema: recurring_transactions (mig pre-119) + accounts (mig 130)
router.get('/', (req, res) => {
  try {
    let days = parseInt(req.query.days, 10);
    if (!Number.isFinite(days) || days < 1) days = 30;
    if (days > 365) days = 365; // hard cap
    const start = todayISO();
    const startD = new Date(start + 'T00:00:00Z');
    const endD = new Date(startD);
    endD.setUTCDate(endD.getUTCDate() + (days - 1));
    const end = endD.toISOString().slice(0, 10);

    // ── Starting balance ───────────────────────────────────────
    let startingBalance;
    if (req.query.starting_balance != null && req.query.starting_balance !== '') {
      startingBalance = parseFloat(req.query.starting_balance) || 0;
    } else {
      const sbRow = db.prepare(`
        SELECT COALESCE(SUM(current_balance), 0) AS bal
        FROM accounts
        WHERE is_active = 1
          AND type IN ('Checking','Savings','Cash','HSA')
      `).get();
      startingBalance = sbRow ? sbRow.bal : 0;
    }

    // ── Pull active recurrences + their account names ──────────
    const recs = db.prepare(`
      SELECT r.id, r.account_id, r.description, r.amount, r.category,
             r.frequency, r.start_date, r.end_date, r.next_date,
             r.last_generated, r.is_active,
             a.name AS account_name, a.type AS account_type
      FROM recurring_transactions r
      LEFT JOIN accounts a ON a.id = r.account_id
      WHERE r.is_active = 1
    `).all();

    // ── Walk each recurrence forward across the window ─────────
    // daily[date] = { income, expenses, items[] }
    const daily = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(startD);
      d.setUTCDate(d.getUTCDate() + i);
      daily[d.toISOString().slice(0, 10)] = { income: 0, expenses: 0, items: [] };
    }

    for (const r of recs) {
      // Start from the row's next_date (or start_date as fallback)
      let cur = r.next_date || r.start_date;
      if (!cur) continue;

      // If next_date is already in the past, fast-forward to today.
      // We're forecasting future cash flow, not reconstructing missed
      // occurrences (recurring-transactions.js handles backfills).
      let safety = 0;
      while (cur < start && safety++ < 5000) {
        cur = advanceDate(cur, r.frequency);
      }

      // Walk forward, stopping at window end or row's end_date
      safety = 0;
      while (cur <= end && safety++ < 1000) {
        if (r.end_date && cur > r.end_date) break;
        if (!daily[cur]) break; // outside window
        const amt = Number(r.amount) || 0;
        const item = {
          id: r.id,
          description: r.description,
          amount: amt,
          category: r.category,
          account_id: r.account_id,
          account_name: r.account_name,
          frequency: r.frequency,
        };
        if (amt >= 0) daily[cur].income += amt;
        else daily[cur].expenses += Math.abs(amt);
        daily[cur].items.push(item);
        cur = advanceDate(cur, r.frequency);
      }
    }

    // ── Roll up to array form with running balance ─────────────
    let running = startingBalance;
    let totalIncome = 0, totalExpenses = 0, count = 0;
    let lowest = startingBalance, lowestDate = start;

    const dailyArr = Object.keys(daily).sort().map(date => {
      const d = daily[date];
      const net = d.income - d.expenses;
      running += net;
      totalIncome += d.income;
      totalExpenses += d.expenses;
      count += d.items.length;
      if (running < lowest) { lowest = running; lowestDate = date; }
      return {
        date,
        income: round2(d.income),
        expenses: round2(d.expenses),
        net: round2(net),
        running_balance: round2(running),
        items: d.items.map(i => ({ ...i, amount: round2(i.amount) })),
      };
    });

    res.json({
      generated_at: new Date().toISOString(),
      days,
      start_date: start,
      end_date: end,
      summary: {
        starting_balance: round2(startingBalance),
        ending_balance: round2(running),
        total_income: round2(totalIncome),
        total_expenses: round2(totalExpenses),
        net: round2(totalIncome - totalExpenses),
        projected_lowest: round2(lowest),
        projected_lowest_date: lowestDate,
        count,
      },
      daily: dailyArr,
    });
  } catch (e) { serverError(res, e); }
});

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = router;
