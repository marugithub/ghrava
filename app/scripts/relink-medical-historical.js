#!/usr/bin/env node
// scripts/relink-medical-historical.js  —  v202604.181
//
// Backfill walker for the two medical auto-linkers:
//   #27.1  shared/auto-link-hsa.js          (txn ↔ hsa_payment)
//   #27.2  shared/auto-link-medical-visit.js (txn ↔ medical_visit)
//
// These linkers were wired on the import path in v.167 (every NEW
// transaction triggers them). v.181 added the category-change trigger
// for live edits. This script closes the third gap: every transaction
// that already exists in the DB at the moment this script lands.
//
// Both linkers are idempotent — they use createLink() which writes via
// INSERT … ON CONFLICT (left_type,left_id,right_type,right_id,link_kind)
// DO NOTHING (app/shared/auto-link.js:15-19). Running this script
// repeatedly never double-links; rows already covered are no-ops.
//
// Side effect to be aware of: the HSA linker CREATES a new hsa_payment
// row when a transaction lands on an HSA account and no matching
// payment exists yet (auto-link-hsa.js:71). That's intentional and
// matches the v.167 import-time behavior — but means this script can
// add to hsa_payments, not just to record_links.
//
// Usage (inside container):
//   docker exec -it ghrava node /app/scripts/relink-medical-historical.js
//
//   # Limit to one account:
//   docker exec -it ghrava node /app/scripts/relink-medical-historical.js \
//     --account-id 7
//
//   # Limit to transactions on/after a date:
//   docker exec -it ghrava node /app/scripts/relink-medical-historical.js \
//     --since 2025-01-01
//
// Safe to re-run. Cheap: ~1ms per transaction (mostly SQLite reads).

'use strict';

const path = require('path');

// Locate the app root so this script works whether invoked from /app
// (container default) or any working directory.
const APP_ROOT = path.resolve(__dirname, '..');
process.chdir(APP_ROOT);

const db                 = require(path.join(APP_ROOT, 'db', 'db'));
const autoLinkHsa        = require(path.join(APP_ROOT, 'shared', 'auto-link-hsa'));
const autoLinkVisit      = require(path.join(APP_ROOT, 'shared', 'auto-link-medical-visit'));

function arg(name, def) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  return process.argv[i + 1];
}

const ACCOUNT_ID = arg('--account-id', null);
const SINCE      = arg('--since', null);
const BATCH_SIZE = parseInt(arg('--batch', '500'), 10);
const VERBOSE    = process.argv.includes('--verbose');

// ─────────────────────────────────────────────────────────────────────
// Build the query. We page by id ascending so re-runs after a partial
// crash are predictable (last id seen is the resume point).
// schema: transactions.{id, account_id, date, description, amount, category}
// ─────────────────────────────────────────────────────────────────────
const whereClauses = ['t.id > ?'];
const params       = [/* lastId placeholder, filled per page */];
if (ACCOUNT_ID) { whereClauses.push('t.account_id = ?'); params.push(parseInt(ACCOUNT_ID, 10)); }
if (SINCE)      { whereClauses.push('t.date >= ?');       params.push(SINCE); }

const pageStmt = db.prepare(`
  SELECT t.id
  FROM transactions t
  WHERE ${whereClauses.join(' AND ')}
  ORDER BY t.id ASC
  LIMIT ?
`);

// ─────────────────────────────────────────────────────────────────────
// Count totals up front so the user knows scope before the run starts.
// ─────────────────────────────────────────────────────────────────────
const countWhere = whereClauses.slice(1); // drop the t.id > ? placeholder
const countParams = params.slice(1);
const totalStmt = db.prepare(`
  SELECT COUNT(*) AS n
  FROM transactions t
  ${countWhere.length ? 'WHERE ' + countWhere.join(' AND ') : ''}
`);
const total = totalStmt.get(...countParams).n;

console.log(`relink-medical-historical: ${total} transaction(s) to scan` +
  (ACCOUNT_ID ? ` [account_id=${ACCOUNT_ID}]` : '') +
  (SINCE      ? ` [since ${SINCE}]`            : '') +
  ` — batches of ${BATCH_SIZE}`);

if (total === 0) {
  console.log('Nothing to do. Exiting.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────
// Walk transactions in id-ascending batches, calling both linkers.
// Tally per outcome so the final summary tells Al what changed.
// ─────────────────────────────────────────────────────────────────────
const totals = {
  scanned:        0,
  hsa_linked:     0,
  hsa_skipped:    0,
  visit_linked:   0,
  visit_skipped:  0,
  errors:         0,
};

let lastId = 0;
let batchNum = 0;
const startedAt = Date.now();

while (true) {
  const batchParams = [lastId, ...params.slice(1), BATCH_SIZE];
  const rows = pageStmt.all(...batchParams);
  if (rows.length === 0) break;

  batchNum++;
  const batchStart = totals.scanned + 1;

  for (const { id } of rows) {
    totals.scanned++;
    lastId = id;

    // HSA linker. Idempotent: skips if not an HSA account; ON CONFLICT
    // DO NOTHING on the record_links insert.
    try {
      const r = autoLinkHsa.processTransaction(id);
      if (r && r.linked) totals.hsa_linked++;
      else               totals.hsa_skipped++;
    } catch (e) {
      totals.errors++;
      if (VERBOSE) console.warn(`  [hsa]   txn ${id}: ${e.message}`);
    }

    // Medical-visit linker. Idempotent for the same reason.
    try {
      const r = autoLinkVisit.processTransaction(id);
      if (r && r.linked) totals.visit_linked++;
      else               totals.visit_skipped++;
    } catch (e) {
      totals.errors++;
      if (VERBOSE) console.warn(`  [visit] txn ${id}: ${e.message}`);
    }
  }

  console.log(
    `  batch ${batchNum.toString().padStart(3)}  ` +
    `txn ${batchStart}-${totals.scanned}/${total}  ` +
    `hsa=${totals.hsa_linked}  visit=${totals.visit_linked}  ` +
    `errors=${totals.errors}`
  );

  if (rows.length < BATCH_SIZE) break;
}

const elapsedMs = Date.now() - startedAt;
console.log('');
console.log('Done.');
console.log(`  scanned:       ${totals.scanned}`);
console.log(`  hsa linked:    ${totals.hsa_linked}   (skipped: ${totals.hsa_skipped})`);
console.log(`  visit linked:  ${totals.visit_linked}   (skipped: ${totals.visit_skipped})`);
console.log(`  errors:        ${totals.errors}`);
console.log(`  elapsed:       ${(elapsedMs / 1000).toFixed(1)}s`);

process.exit(totals.errors > 0 ? 1 : 0);
