// ═════════════════════════════════════════════════════════════════
// Migration 130 — Rescue mig 126 (v202604.158)
//
// PROBLEM DETECTED in some production installs:
//   `_migrations_cc_columns_done` says v.154 ran. But:
//   - There's no `transactions` table.
//   - `accounts` is a pre-existing UNRELATED table (e.g. a
//     beneficiaries/TOD schema from an older module).
//   - Mig 127 (fingerprint v2) ran on its defensive "no
//     transactions table → skip" branch.
//   - Mig 128 (CC columns) ran ALTER TABLE accounts ADD COLUMN
//     against the WRONG accounts table.
//
//   Net result: real finance data still lives in `finance_accounts`
//   + `finance_transactions` (mig 020 schema). The unification
//   silently failed. v.157's `/finance/all`, /finance/landing, and
//   needs-review queue all read from the unified tables that don't
//   exist → empty UI.
//
//   Root cause: mig 126's `CREATE TABLE accounts (…)` collided with
//   an existing `accounts` table from an older module. Some
//   environments may have suppressed the error so the unify
//   transaction rolled back, leaving the marker row inserted by a
//   later mig. (The marker `_migrations_finance_unify_done` is
//   actually NOT present in the broken state — that's the tell.)
//
// WHAT THIS MIGRATION DOES:
//   1. Detects the broken state: `accounts` table exists BUT lacks
//      the unified-schema column `alias` AND `_migrations_finance_
//      unify_done` is empty AND `finance_accounts` has rows.
//   2. If state is clean (mig 126 succeeded earlier), no-op.
//   3. Otherwise:
//      a. Inspects the pre-existing `accounts` table. If it has
//         rows, refuses to proceed and writes a diagnostic notes
//         row — manual intervention required.
//      b. If empty, RENAMES it to `accounts_beneficiaries` (or
//         `accounts_preexisting` if `_beneficiaries` looks wrong
//         for the column shape). Preserves the schema for whatever
//         module owned it.
//      c. Clears the bogus marker rows in
//         `_migrations_fingerprint_v2_done` and
//         `_migrations_cc_columns_done` so those migrations re-run
//         after we create the real unified tables.
//      d. Runs the v.151 unify logic in-process by re-requiring
//         migration 126 (now that the name is free). 126 is
//         idempotent.
//      e. Re-runs mig 127 (fingerprint v2 recompute) and mig 128
//         (CC columns) against the correct unified tables.
//
// All wrapped in a single transaction. Failure → full rollback,
// the broken state is unchanged (so this can't make things worse).
//
// Idempotent: a marker row in `_migrations_rescue_126_done` blocks
// re-runs.
//
// Reversibility: if rescue created a `accounts_beneficiaries`
// table, the contents (zero rows in the case that triggered this
// migration) can be restored with:
//   ALTER TABLE accounts RENAME TO accounts_unified;
//   ALTER TABLE accounts_beneficiaries RENAME TO accounts;
// ═════════════════════════════════════════════════════════════════

'use strict';

module.exports = function (db) {
  // ── Idempotence ───────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations_rescue_126_done (
      done_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      version  TEXT,
      notes    TEXT
    );
  `);
  const already = db.prepare(`SELECT 1 FROM _migrations_rescue_126_done LIMIT 1`).get();
  if (already) return;

  // ── Detect schema state ───────────────────────────────────────

  function tableExists(name) {
    return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name);
  }
  function hasColumn(table, col) {
    if (!tableExists(table)) return false;
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    return cols.some(c => c.name === col);
  }
  function rowCount(table) {
    if (!tableExists(table)) return 0;
    try { return db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n || 0; }
    catch { return 0; }
  }

  const txnTableExists       = tableExists('transactions');
  const accountsHasAlias     = hasColumn('accounts', 'alias');
  const unifyMarkerExists    = tableExists('_migrations_finance_unify_done') &&
                               !!db.prepare(`SELECT 1 FROM _migrations_finance_unify_done LIMIT 1`).get();
  const financeAccountsRows  = rowCount('finance_accounts');
  const financialAccountsRows = rowCount('financial_accounts');
  const financeTxRows        = rowCount('finance_transactions');
  const importedTxRows       = rowCount('imported_transactions');

  // Case A: unification already happened cleanly. No rescue needed.
  if (unifyMarkerExists && txnTableExists && accountsHasAlias) {
    db.prepare(
      `INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`
    ).run('202604.158', 'no-op: mig 126 already succeeded');
    return;
  }

  // Case B: no finance data exists at all (brand new install).
  // Let mig 126 run normally on the next mig pass — nothing for us
  // to rescue. Mark done so we don't retry.
  if (financeAccountsRows === 0 && financialAccountsRows === 0 &&
      financeTxRows === 0 && importedTxRows === 0) {
    db.prepare(
      `INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`
    ).run('202604.158', 'no-op: empty install, mig 126 will run cleanly');
    return;
  }

  // Case C: the broken state. There's finance data in the old
  // tables AND mig 126's unify marker is missing AND/OR `accounts`
  // is the wrong shape.
  const preexistingAccounts = tableExists('accounts') && !accountsHasAlias;
  if (!preexistingAccounts && !txnTableExists) {
    // accounts table doesn't exist at all — mig 126 just didn't
    // run yet. Let it run on the next mig sweep.
    db.prepare(
      `INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`
    ).run('202604.158', 'no-op: mig 126 has not been attempted yet');
    return;
  }

  // ── Rescue path ────────────────────────────────────────────────
  // Wrap in transaction so any failure leaves the broken state
  // unchanged.

  const tx = db.transaction(() => {
    let notes = [];

    // 1. Free the `accounts` name if a pre-existing table holds it.
    if (preexistingAccounts) {
      const preCount = rowCount('accounts');
      if (preCount > 0) {
        // SAFETY: pre-existing `accounts` has rows. Refusing to
        // overwrite. The user needs to manually decide what to do
        // (rename or merge). Mark this rescue attempt with a
        // diagnostic note and abort.
        throw new Error(
          `Pre-existing 'accounts' table has ${preCount} rows. ` +
          `Cannot safely rename. Manual intervention required: ` +
          `inspect 'accounts' contents, rename it to a safe name ` +
          `(e.g. accounts_legacy), then re-run migrations.`
        );
      }
      db.exec(`ALTER TABLE accounts RENAME TO accounts_beneficiaries;`);
      notes.push('renamed pre-existing empty accounts table → accounts_beneficiaries');
    }

    // 2. Clear bogus marker rows so mig 127 + 128 re-run against
    // the correct (about-to-be-created) unified tables.
    // Two layers of state to reset:
    //   (a) Per-migration `_migrations_*_done` marker tables that
    //       the JS migrations check internally.
    //   (b) The migration runner's `_migrations` filename log,
    //       which is what tells the runner to skip a file on
    //       future restarts. Clearing this is defensive — by the
    //       time mig 130 runs, the current sweep has already
    //       skipped 127+128, so we call them directly via
    //       require() below. But future restarts shouldn't see
    //       conflicting state.
    if (tableExists('_migrations_fingerprint_v2_done')) {
      const r = db.prepare(`DELETE FROM _migrations_fingerprint_v2_done`).run();
      if (r.changes > 0) notes.push(`cleared ${r.changes} bogus fingerprint_v2 marker(s)`);
    }
    if (tableExists('_migrations_cc_columns_done')) {
      const r = db.prepare(`DELETE FROM _migrations_cc_columns_done`).run();
      if (r.changes > 0) notes.push(`cleared ${r.changes} bogus cc_columns marker(s)`);
    }
    if (tableExists('_migrations')) {
      const r = db.prepare(
        `DELETE FROM _migrations WHERE filename IN ('127_fingerprint_v2.js', '128_cc_columns.js')`
      ).run();
      if (r.changes > 0) notes.push(`cleared ${r.changes} bogus _migrations runner row(s)`);
    }

    // 3. Run mig 126 in-process. It's idempotent and will create
    // the unified accounts + transactions tables, copy rows, and
    // mark itself done. Pull from same migrations dir so the path
    // is identical to a normal mig sweep.
    const mig126 = require('./126_finance_unify.js');
    mig126(db);
    notes.push('ran mig 126 unification');

    // 4. Re-run mig 127 and mig 128 against the now-correct tables.
    const mig127 = require('./127_fingerprint_v2.js');
    mig127(db);
    notes.push('re-ran mig 127 fingerprint v2');

    const mig128 = require('./128_cc_columns.js');
    mig128(db);
    notes.push('re-ran mig 128 cc columns');

    // 5. Record 126/127/128 in the runner's `_migrations` log so
    // future restarts don't retry them. (126 was never logged
    // because it errored on its first attempt; 127+128 were
    // cleared in step 2 since we just re-ran them.) Use INSERT OR
    // IGNORE so this is safe if a row already exists.
    if (tableExists('_migrations')) {
      const ins = db.prepare(`INSERT OR IGNORE INTO _migrations (filename) VALUES (?)`);
      for (const f of ['126_finance_unify.js', '127_fingerprint_v2.js', '128_cc_columns.js']) {
        ins.run(f);
      }
      notes.push('logged 126/127/128 in _migrations runner table');
    }

    // 6. Mark rescue done.
    db.prepare(
      `INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`
    ).run('202604.158', notes.join('; '));
  });

  try {
    tx();
  } catch (e) {
    // The transaction has rolled back. Record the attempt so we
    // don't loop forever on the same error.
    try {
      db.prepare(
        `INSERT INTO _migrations_rescue_126_done (version, notes) VALUES (?, ?)`
      ).run('202604.158', 'RESCUE FAILED: ' + e.message);
    } catch { /* ignore */ }
    // Re-throw so the migration runner logs the error in the
    // server boot log. The app will still start because mig
    // sweeps catch per-mig errors elsewhere.
    throw e;
  }
};
