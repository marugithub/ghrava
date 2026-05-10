// ═════════════════════════════════════════════════════════════════
// Migration 128 — Credit-card-specific columns on accounts (v202604.154)
//
// Strictly additive — only adds columns that don't exist yet. No
// data is moved or deleted. Idempotent: each column add is wrapped
// in a try/catch so re-running the migration is safe.
//
// New columns (all on `accounts`, all NULL by default):
//   credit_limit                REAL    — for Credit type
//   statement_balance           REAL    — last statement total
//   minimum_payment             REAL    — current minimum due
//   payment_due_date            DATE    — current cycle due date
//   apr                         REAL    — purchase APR
//   promo_apr                   REAL    — intro/promo APR if any
//   promo_end_date              DATE    — when promo APR expires
//   annual_fee                  REAL    — yearly card fee
//   annual_fee_renewal_date     DATE    — when fee posts each year
//   rewards_balance             REAL    — current cashback / points
//
// These are surfaced on the credit-card tile (tile 3) and on the
// account drawer when type='Credit'. Loan and Mortgage types reuse
// some fields (payment_due_date, minimum_payment) but keep the
// nullable approach so each type populates what makes sense.
//
// This migration also leaves room for future fields (statement_close_date,
// rewards_program_name, etc.) — skipped for now to keep the surface
// small.
// ═════════════════════════════════════════════════════════════════

'use strict';

module.exports = function (db) {
  const COLUMNS = [
    ['credit_limit',            'REAL'],
    ['statement_balance',       'REAL'],
    ['minimum_payment',         'REAL'],
    ['payment_due_date',        'DATE'],
    ['apr',                     'REAL'],
    ['promo_apr',               'REAL'],
    ['promo_end_date',          'DATE'],
    ['annual_fee',              'REAL'],
    ['annual_fee_renewal_date', 'DATE'],
    ['rewards_balance',         'REAL'],
  ];

  // Defensive: skip entirely if accounts table doesn't exist (mig 126
  // hasn't run yet). Idempotence guard via marker table avoids
  // reprobing column existence on every restart.
  const haveAccounts = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='accounts'`
  ).get();
  if (!haveAccounts) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations_cc_columns_done (
      done_at DATETIME DEFAULT CURRENT_TIMESTAMP, version TEXT
    );
  `);
  const already = db.prepare(`SELECT 1 FROM _migrations_cc_columns_done LIMIT 1`).get();
  if (already) return;

  // Use ALTER TABLE ADD COLUMN per field; ignore "duplicate column"
  // errors so this also recovers if a previous partial run got
  // halfway. Each column is independent so a partial failure leaves
  // accounts in a sensible state.
  for (const [name, type] of COLUMNS) {
    try {
      db.exec(`ALTER TABLE accounts ADD COLUMN ${name} ${type};`);
    } catch (e) {
      if (!/duplicate column/i.test(e.message)) throw e;
    }
  }

  // Helpful index on payment_due_date for tile 3 ("earliest due").
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_payment_due
             ON accounts(payment_due_date) WHERE payment_due_date IS NOT NULL;`);
  } catch (e) { /* old SQLite without partial-index support — ignore */ }

  db.prepare(
    `INSERT INTO _migrations_cc_columns_done (version) VALUES ('202604.154')`
  ).run();
};
