// @ts-check
'use strict';
// ═════════════════════════════════════════════════════════════════
// shared/networth-scheduler.js  (v202604.157)
//
// Auto-snapshots `net_worth_snapshots` once per day so tile 1's
// "MoM delta" pill on the Finance Overview has data to compare to
// without depending on Al remembering to click the snapshot button.
//
// Design choices:
//   - One snapshot per calendar date (idempotent: re-running same
//     day overwrites, never duplicates).
//   - Runs 30 seconds after server boot (lets DB settle), then
//     hourly checks whether the most recent snapshot is older than
//     20 hours — if so, takes a new one. Lazy daily cadence avoids
//     pinning a 3 AM clock that could miss restarts.
//   - Reuses the same math as POST /net-worth/snapshot. Assets +
//     holdings market_value; liabilities; active+include_net_worth=1
//     accounts only.
//   - Skips if no eligible accounts (no point snapshotting zeros).
//   - Errors logged, never thrown — must not crash the server.
//
// Idempotence via UPSERT-by-date: snapshot_date is the natural key.
// Some installs have UNIQUE INDEX, some don't; we handle both with
// a SELECT-then-UPDATE-or-INSERT pattern.
// ═════════════════════════════════════════════════════════════════

const db = require('../db/db');

function todayStr() { return new Date().toISOString().slice(0, 10); }

function computeNetWorth() {
  const acc = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) AS assets,
      COALESCE(SUM(CASE WHEN current_balance < 0 THEN ABS(current_balance) ELSE 0 END), 0) AS liabilities,
      COUNT(*) AS n
    FROM accounts WHERE is_active = 1 AND include_net_worth = 1
  `).get();
  let inv = 0;
  try {
    const r = db.prepare(`SELECT COALESCE(SUM(market_value),0) AS v FROM holdings`).get();
    inv = r?.v || 0;
  } catch {}
  const totalAssets = (acc.assets || 0) + inv;
  const liab        = acc.liabilities || 0;
  return {
    assets:      totalAssets,
    liabilities: liab,
    net_worth:   totalAssets - liab,
    n_accounts:  acc.n || 0,
  };
}

function takeSnapshot(opts = {}) {
  const date = opts.date || todayStr();
  const nw = computeNetWorth();
  if (!opts.force && nw.n_accounts === 0) {
    return { skipped: true, reason: 'no eligible accounts' };
  }
  // UPSERT-by-date pattern. Some schemas have UNIQUE INDEX on
  // snapshot_date, some don't — handle both.
  const existing = db.prepare(
    `SELECT id FROM net_worth_snapshots WHERE snapshot_date = ?`
  ).get(date);

  if (existing) {
    db.prepare(`
      UPDATE net_worth_snapshots
         SET total_assets = ?, total_liabilities = ?, net_worth = ?,
             notes = COALESCE(?, notes)
       WHERE id = ?
    `).run(nw.assets, nw.liabilities, nw.net_worth,
            opts.notes || '[auto-snapshot]', existing.id);
    return { id: existing.id, ...nw, action: 'updated' };
  }

  try {
    const r = db.prepare(`
      INSERT INTO net_worth_snapshots
        (snapshot_date, total_assets, total_liabilities, net_worth, notes)
      VALUES (?,?,?,?,?)
    `).run(date, nw.assets, nw.liabilities, nw.net_worth,
            opts.notes || '[auto-snapshot]');
    return { id: r.lastInsertRowid, ...nw, action: 'inserted' };
  } catch (e) {
    // Defensive fallback: older schemas may have NOT NULL constraints
    // missing one or more value columns — degrade gracefully.
    const r = db.prepare(`
      INSERT INTO net_worth_snapshots (snapshot_date, notes) VALUES (?,?)
    `).run(date, opts.notes || '[auto-snapshot]');
    return { id: r.lastInsertRowid, ...nw, action: 'inserted-partial', warn: e.message };
  }
}

function shouldSnapshot() {
  try {
    const last = db.prepare(`
      SELECT snapshot_date FROM net_worth_snapshots
      ORDER BY snapshot_date DESC LIMIT 1
    `).get();
    if (!last) return true;
    // If the latest snapshot is from today, skip. Otherwise take one.
    // We don't compare hours — calendar day is the unit.
    return last.snapshot_date < todayStr();
  } catch (e) {
    console.error('[networth-scheduler] shouldSnapshot check failed:', e.message);
    return false;
  }
}

function tick() {
  try {
    if (!shouldSnapshot()) return;
    const r = takeSnapshot();
    if (r.skipped) {
      // Silent: avoids log spam on installs with no accounts yet.
      return;
    }
    console.log(`[NetWorth] Auto-snapshot ${r.action}: nw=$${(r.net_worth||0).toFixed(2)}`);
  } catch (e) { console.error('[NetWorth] tick error:', e.message); }
}

function startScheduler() {
  // First check 30s after boot — lets migrations/other startup work
  // finish so the snapshot reflects the real post-restart state.
  setTimeout(tick, 30000);
  // Hourly check thereafter. Picks up the new day whenever it
  // happens, no clock-pinning required.
  setInterval(tick, 60 * 60 * 1000);
}

module.exports = { startScheduler, takeSnapshot, computeNetWorth, shouldSnapshot };
