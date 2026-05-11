// @ts-check
'use strict';
/**
 * shared/recurring-transactions.js
 * Auto-generates transactions from recurring templates.
 *
 * v202604.156: switched the INSERT path off the `finance_transactions`
 * compat VIEW (mig 126 made that a non-insertable view, breaking
 * this code path silently) onto the unified `transactions` table.
 * Recurring-generated rows are tagged source='manual' since they
 * conceptually originate from a user-defined template, not an
 * imported file.
 */
const db = require('../db/db');
const { fingerprint } = require('./tx-fingerprint');

function calculateNextDate(currentDate, frequency) {
  const next = new Date(currentDate);
  switch(frequency) {
    case 'daily':     next.setDate(next.getDate() + 1);         break;
    case 'weekly':    next.setDate(next.getDate() + 7);         break;
    case 'biweekly':  next.setDate(next.getDate() + 14);        break;
    case 'monthly':   next.setMonth(next.getMonth() + 1);       break;
    case 'quarterly': next.setMonth(next.getMonth() + 3);       break;
    case 'yearly':    next.setFullYear(next.getFullYear() + 1); break;
  }
  return next.toISOString().slice(0, 10);
}

function generatePendingTransactions() {
  const today = new Date().toISOString().slice(0, 10);
  const configDays = db.prepare(`SELECT value FROM app_config WHERE key = 'auto_generate_recurring_days'`).get()?.value || '30';
  const generateUpTo = new Date();
  generateUpTo.setDate(generateUpTo.getDate() + parseInt(configDays));
  const upToDate = generateUpTo.toISOString().slice(0, 10);

  const pending = db.prepare(`
    SELECT * FROM recurring_transactions
    WHERE is_active = 1 AND next_date <= ?
      AND (end_date IS NULL OR end_date >= next_date)
    ORDER BY next_date
  `).all(upToDate);

  let generated = 0;
  // Unified transactions table (mig 126). Tagged source='manual'
  // since these come from a user-defined template, not an import.
  // Fingerprint is computed so dedup catches accidental re-runs.
  const insertTx = db.prepare(`
    INSERT INTO transactions
      (account_id, date, description, amount, category, notes,
       fingerprint, source, txn_type, needs_review)
    VALUES (?,?,?,?,?,?, ?, 'manual', 'recurring', 0)
  `);
  const updateRecurr = db.prepare(`
    UPDATE recurring_transactions
       SET last_generated = next_date,
           next_date = ?,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
  `);

  const txn = db.transaction(() => {
    for (const rt of pending) {
      if (rt.next_date > today) continue;
      const fp = fingerprint(rt.account_id, rt.next_date, rt.amount, rt.description);
      insertTx.run(
        rt.account_id, rt.next_date, rt.description, rt.amount,
        rt.category, rt.notes || 'Auto-generated from recurring',
        fp
      );
      updateRecurr.run(calculateNextDate(rt.next_date, rt.frequency), rt.id);
      generated++;
    }
  });
  txn();
  return { generated, checked: pending.length };
}

function startScheduler() {
  // Run once at startup (10s delay to let DB settle)
  setTimeout(() => {
    try {
      const result = generatePendingTransactions();
      if (result.generated > 0) console.log(`[Recurring] Startup: generated ${result.generated} transactions`);
    } catch(e) { console.error('[Recurring] Startup error:', e.message); }
  }, 10000);

  // Daily check via interval — only fires at 2 AM
  setInterval(() => {
    const h = new Date().getHours(), m = new Date().getMinutes();
    if (h === 2 && m === 0) {
      try {
        const result = generatePendingTransactions();
        console.log(`[Recurring] Daily: generated ${result.generated} transactions`);
      } catch(e) { console.error('[Recurring] Daily error:', e.message); }
    }
  }, 60000);
}

module.exports = { generatePendingTransactions, calculateNextDate, startScheduler };
