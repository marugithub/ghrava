// @ts-nocheck
/**
 * features/import/routes.js  (v202604.151)
 *
 * Financial import API mounted at /api/v1/import/*. Both this and
 * /api/v1/finance/transactions/import-file write into the same
 * unified `accounts` + `transactions` tables (mig 126).
 *
 * Endpoints:
 *   GET    /accounts                — list active accounts
 *   POST   /accounts                — create account (alias on creation)
 *   PUT    /accounts/:id            — update account
 *   POST   /accounts/:id/deactivate — soft delete
 *   POST   /preview                 — parse a file, show duplicates
 *   POST   /confirm                 — commit a parsed file
 *   GET    /transactions            — list imported rows
 *   PATCH  /transactions/:id        — recategorize / mark transfer / clear flag
 *   GET    /holdings                — list holdings + summary
 *   GET    /net-worth               — historical net worth from snapshots
 *   GET    /batches                 — import batch history
 *   POST   /batches/:id/rollback    — undo a batch
 *   GET    /spending                — category breakdown
 *   GET    /missing-statements      — months without imports per tracked account
 *
 * No DELETE on /accounts. Use POST /accounts/:id/deactivate.
 * No DELETE on /batches. Use POST /batches/:id/rollback.
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const router   = express.Router();
const db       = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { parseFile }   = require('./parsers');
const { fingerprint, normalizeDescription } = require('../../shared/tx-fingerprint');
const { autoLinkTransaction } = require('../../shared/auto-link-subscriptions');

let XLSX;
try { XLSX = require('xlsx'); } catch { XLSX = null; }

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Helpers ────────────────────────────────────────────────────

function err(res, msg, status = 400) { res.status(status).json({ error: msg }); }

function classifyTransfer(txn, accountType) {
  const desc = (txn.description || '').toLowerCase();
  if (txn.type === 'transfer') return true;
  if (accountType === 'Credit') {
    if (desc.includes('payment') && desc.includes('thank')) return true;
    if (desc.includes('autopay') || desc.includes('auto pay')) return true;
    if (desc.match(/payment received|online payment|mobile payment/)) return true;
  }
  if (desc.match(/transfer (to|from)|zelle (to|from)|venmo|paypal transfer/)) return true;
  return false;
}

// ── Accounts (unified table) ───────────────────────────────────

router.get('/accounts', (req, res) => {
  const accounts = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM import_batches ib WHERE ib.account_id = a.id) AS import_count,
      (SELECT MAX(ib.statement_date) FROM import_batches ib WHERE ib.account_id = a.id) AS last_statement_date
    FROM accounts a
    WHERE a.is_active = 1
    ORDER BY a.institution, a.name
  `).all();
  res.json(accounts);
});

router.post('/accounts', requireAuth, (req, res) => {
  const { name, alias, type, institution, owner, last4, notes, track_statements } = req.body;
  if (!name?.trim()) return err(res, 'name is required');
  if (!institution?.trim()) return err(res, 'institution is required');
  if (!type) return err(res, 'type is required');

  const r = db.prepare(`
    INSERT INTO accounts (name, alias, type, institution, owner, last4, notes,
                          track_statements, source, needs_review)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'imported', 0)
  `).run(
    name.trim(),
    alias?.trim() || null,
    type,
    institution.trim(),
    owner || null,
    last4 ? String(last4).slice(-4) : null,
    notes || null,
    track_statements !== false ? 1 : 0
  );
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/accounts/:id', requireAuth, (req, res) => {
  const { name, alias, type, institution, owner, last4, notes, track_statements, is_active } = req.body;
  const existing = db.prepare('SELECT * FROM accounts WHERE id=?').get(req.params.id);
  if (!existing) return err(res, 'Account not found', 404);

  db.prepare(`
    UPDATE accounts SET name=?, alias=?, type=?, institution=?, owner=?, last4=?,
      notes=?, track_statements=?, is_active=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    name?.trim() || existing.name,
    alias !== undefined ? (alias?.trim() || null) : existing.alias,
    type || existing.type,
    institution?.trim() || existing.institution,
    owner !== undefined ? owner : existing.owner,
    last4 !== undefined ? (last4 ? String(last4).slice(-4) : null) : existing.last4,
    notes !== undefined ? notes : existing.notes,
    track_statements !== undefined ? (track_statements ? 1 : 0) : existing.track_statements,
    is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
    req.params.id
  );
  res.json({ ok: true });
});

router.post('/accounts/:id/deactivate', requireAuth, (req, res) => {
  const r = db.prepare('UPDATE accounts SET is_active=0 WHERE id=?').run(req.params.id);
  if (!r.changes) return err(res, 'Account not found', 404);
  res.json({ ok: true });
});

// ── Preview ────────────────────────────────────────────────────

router.post('/preview', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return err(res, 'No file uploaded');

  let text;
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (['.xlsx', '.xls'].includes(ext)) {
    if (!XLSX) return err(res, 'Excel support not available — upload CSV instead');
    try {
      const wb = XLSX.read(req.file.buffer);
      text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    } catch (e) { return err(res, 'Could not read Excel file: ' + e.message); }
  } else {
    text = req.file.buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  }

  const parsed = parseFile(text, req.file.originalname);
  const accountId = parseInt(req.body.account_id) || 0;

  const fps = parsed.transactions.map(t => fingerprint(accountId, t.date, t.amount, t.description));
  const existing = fps.length
    ? db.prepare(
        `SELECT fingerprint FROM transactions WHERE fingerprint IN (${fps.map(() => '?').join(',')})`
      ).all(...fps).map(r => r.fingerprint)
    : [];
  const existingSet = new Set(existing);

  const preview = parsed.transactions.slice(0, 20).map(t => ({
    ...t,
    isDuplicate: existingSet.has(fingerprint(accountId, t.date, t.amount, t.description)),
  }));

  res.json({
    format:           parsed.format,
    statementDate:    parsed.statementDate,
    totalRows:        parsed.transactions.length,
    duplicates:       existing.length,
    newRows:          parsed.transactions.length - existing.length,
    positions:        parsed.positions?.length || 0,
    preview,
    previewPositions: parsed.positions?.slice(0, 10) || [],
    error:            parsed.error || null,
  });
});

// ── Confirm ────────────────────────────────────────────────────

router.post('/confirm', requireAuth, upload.single('file'), (req, res) => {
  const accountId = parseInt(req.body.account_id);
  if (!accountId) return err(res, 'account_id required');

  const account = db.prepare('SELECT * FROM accounts WHERE id=?').get(accountId);
  if (!account) return err(res, 'Account not found', 404);
  if (!account.is_active) return err(res, 'Account is inactive — reactivate before importing');

  let text;
  const ext = path.extname(req.file?.originalname || '').toLowerCase();
  if (['.xlsx', '.xls'].includes(ext)) {
    if (!XLSX) return err(res, 'Excel support unavailable');
    try {
      const wb = XLSX.read(req.file.buffer);
      text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    } catch (e) { return err(res, e.message); }
  } else {
    text = req.file.buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  }

  const parsed = parseFile(text, req.file?.originalname || 'upload');

  const batchId = db.prepare(`
    INSERT INTO import_batches (account_id, filename, statement_date, format, row_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    accountId, req.file?.originalname || 'upload',
    parsed.statementDate, parsed.format, parsed.transactions.length
  ).lastInsertRowid;

  let inserted = 0, skipped = 0, flagged = 0;
  const categoryRules = db.prepare(
    'SELECT * FROM import_category_rules WHERE is_active=1 ORDER BY sort_order'
  ).all();

  // Coarse SQL prefilter for the 5-day window — same account, same
  // amount (±$0.01), date within ±5 days, different fingerprint. The
  // JS-side filter then keeps only candidates whose normalized desc
  // matches the input row. This is the v.153 pending → posted check.
  const coarseWindow = db.prepare(`
    SELECT id, date, description
    FROM transactions
    WHERE account_id = ?
      AND ABS(amount - ?) < 0.01
      AND ABS(julianday(date) - julianday(?)) <= 5
      AND fingerprint != ?
  `);

  const doImport = db.transaction(() => {
    for (const t of parsed.transactions) {
      if (!t.date || t.amount === null) continue;
      const fp = fingerprint(accountId, t.date, t.amount, t.description);

      const exists = db.prepare('SELECT id FROM transactions WHERE fingerprint=?').get(fp);
      if (exists) { skipped++; continue; }

      const targetNorm = normalizeDescription(t.description);
      const candidates = coarseWindow.all(accountId, t.amount, t.date, fp);
      const probable = candidates.some(c => normalizeDescription(c.description) === targetNorm);

      const isTransfer = classifyTransfer(t, account.type);

      let autoCategory = t.category || null;
      if (!autoCategory) {
        const desc = (t.description || '').toUpperCase();
        for (const rule of categoryRules) {
          const regex = new RegExp('^' + rule.pattern.replace(/%/g,'.*').replace(/_/g,'.') + '$', 'i');
          if (regex.test(desc)) { autoCategory = rule.category; break; }
        }
      }

      const result = db.prepare(`
        INSERT INTO transactions
          (account_id, batch_id, date, post_date, description, amount, balance,
           category, txn_type, is_transfer, memo, fingerprint, flagged,
           source, needs_review)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'imported',?)
      `).run(
        accountId, batchId, t.date, t.postDate || null, t.description,
        t.amount, t.balance || null, autoCategory,
        t.type || 'transaction', isTransfer ? 1 : 0,
        t.memo || null, fp, probable ? 1 : 0,
        probable ? 1 : 0
      );

      if (probable) flagged++;
      inserted++;

      // v.157 auto-link to matching subscription (best-effort).
      try {
        autoLinkTransaction(result.lastInsertRowid, {
          amount: t.amount,
          description: t.description,
          is_transfer: isTransfer,
        });
      } catch (e) { /* logged inside helper */ }
    }

    // Upsert holdings
    for (const p of (parsed.positions || [])) {
      if (!p.symbol || !p.shares) continue;
      const existingH = db.prepare(
        `SELECT id FROM holdings WHERE account_id=? AND symbol=?`
      ).get(accountId, p.symbol);

      if (existingH) {
        db.prepare(`
          UPDATE holdings SET
            name=?, asset_type=?, shares=?, price=?, market_value=?,
            total_cost_basis=?, gain_loss_dollar=?, gain_loss_pct=?,
            day_change_dollar=?, day_change_pct=?,
            week52_low=?, week52_high=?, reinvest_dividends=?,
            as_of_date=?, updated_at=CURRENT_TIMESTAMP
          WHERE id=?
        `).run(
          p.name || null, p.assetType || 'stock',
          p.shares, p.price || null, p.marketValue || null,
          p.totalCostBasis || null,
          p.gainLossDollar || null, p.gainLossPct || null,
          p.dayChangeDollar || null, p.dayChangePct || null,
          p.week52Low || null, p.week52High || null,
          p.reinvestDividends ? 1 : 0,
          parsed.statementDate || null,
          existingH.id
        );
      } else {
        db.prepare(`
          INSERT INTO holdings (
            account_id, symbol, name, asset_type, shares, price, market_value,
            total_cost_basis, gain_loss_dollar, gain_loss_pct,
            day_change_dollar, day_change_pct,
            week52_low, week52_high, reinvest_dividends, as_of_date
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          accountId, p.symbol, p.name || null, p.assetType || 'stock',
          p.shares, p.price || null, p.marketValue || null,
          p.totalCostBasis || null,
          p.gainLossDollar || null, p.gainLossPct || null,
          p.dayChangeDollar || null, p.dayChangePct || null,
          p.week52Low || null, p.week52High || null,
          p.reinvestDividends ? 1 : 0,
          parsed.statementDate || null
        );
      }
    }
  });

  try {
    doImport();
    res.json({ ok: true, batchId, inserted, skipped, flagged, positions: parsed.positions?.length || 0 });
  } catch (e) {
    err(res, 'Import failed: ' + e.message, 500);
  }
});

// ── Transactions (imported source) ─────────────────────────────

router.get('/transactions', (req, res) => {
  const { account_id, from, to, search, type, limit = 100, offset = 0, include_transfers } = req.query;
  const wheres = [`t.source = 'imported'`];
  const params = [];

  if (account_id) { wheres.push('t.account_id = ?'); params.push(account_id); }
  if (from)       { wheres.push('t.date >= ?');      params.push(from); }
  if (to)         { wheres.push('t.date <= ?');      params.push(to); }
  if (search)     { wheres.push('(t.description LIKE ? OR t.memo LIKE ?)');
                    params.push(`%${search}%`, `%${search}%`); }
  if (type)       { wheres.push('t.txn_type = ?');   params.push(type); }
  if (!include_transfers || include_transfers === 'false') {
                    wheres.push('t.is_transfer = 0'); }

  const where = 'WHERE ' + wheres.join(' AND ');
  const rows = db.prepare(`
    SELECT t.*, a.name AS account_nickname, a.alias AS account_alias,
           a.institution, a.type AS account_type
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    ${where}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  const total = db.prepare(
    `SELECT COUNT(*) AS n FROM transactions t ${where}`
  ).get(...params)?.n || 0;

  res.json({ transactions: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
});

router.patch('/transactions/:id', requireAuth, (req, res) => {
  const { category, is_transfer, flagged, txn_type, needs_review } = req.body;
  const sets = [], vals = [];
  if (category     !== undefined) { sets.push('category=?');     vals.push(category); }
  if (is_transfer  !== undefined) { sets.push('is_transfer=?');  vals.push(is_transfer ? 1 : 0); }
  if (flagged      !== undefined) { sets.push('flagged=?');      vals.push(flagged ? 1 : 0); }
  if (txn_type     !== undefined) { sets.push('txn_type=?');     vals.push(txn_type); }
  if (needs_review !== undefined) { sets.push('needs_review=?'); vals.push(needs_review ? 1 : 0); }
  if (!sets.length) return err(res, 'Nothing to update');
  db.prepare(`UPDATE transactions SET ${sets.join(',')} WHERE id=?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

// ── Holdings ───────────────────────────────────────────────────

router.get('/holdings', (req, res) => {
  const { account_id } = req.query;
  const where = account_id ? 'WHERE h.account_id = ?' : '';
  const params = account_id ? [account_id] : [];

  const holdings = db.prepare(`
    SELECT h.*, a.name AS account_nickname, a.alias AS account_alias,
           a.institution, a.type AS account_type
    FROM holdings h
    JOIN accounts a ON a.id = h.account_id
    ${where}
    ORDER BY h.market_value DESC, h.symbol
  `).all(...params);

  const summary = db.prepare(`
    SELECT h.account_id, a.name AS nickname, a.alias, a.institution,
      COUNT(*) AS positions,
      SUM(h.market_value)     AS total_value,
      SUM(h.total_cost_basis) AS total_cost
    FROM holdings h
    JOIN accounts a ON a.id = h.account_id
    ${where}
    GROUP BY h.account_id
  `).all(...params);

  res.json({ holdings, summary });
});

// ── Net worth (historical from snapshots) ──────────────────────

router.get('/net-worth', (req, res) => {
  const accounts = db.prepare(`
    SELECT a.id, a.name AS nickname, a.alias, a.institution, a.type AS account_type,
      s.balance, s.snapshot_date
    FROM accounts a
    LEFT JOIN account_snapshots s ON s.id = (
      SELECT id FROM account_snapshots WHERE account_id = a.id ORDER BY snapshot_date DESC LIMIT 1
    )
    WHERE a.is_active = 1
    ORDER BY a.type, a.name
  `).all();

  const timeline = db.prepare(`
    SELECT snapshot_date,
      SUM(CASE WHEN a.type != 'Credit' THEN COALESCE(s.balance, 0) ELSE 0 END) AS assets,
      SUM(CASE WHEN a.type  = 'Credit' THEN ABS(COALESCE(s.balance, 0)) ELSE 0 END) AS liabilities
    FROM account_snapshots s
    JOIN accounts a ON a.id = s.account_id
    GROUP BY snapshot_date
    ORDER BY snapshot_date ASC
  `).all().map(r => ({ ...r, net_worth: r.assets - r.liabilities }));

  const latest = timeline.length ? timeline[timeline.length - 1] : { assets: 0, liabilities: 0, net_worth: 0 };
  res.json({ accounts, timeline, latest });
});

// ── Batches ────────────────────────────────────────────────────

router.get('/batches', (req, res) => {
  const { account_id } = req.query;
  const where = account_id ? 'WHERE ib.account_id = ?' : '';
  const params = account_id ? [account_id] : [];
  const rows = db.prepare(`
    SELECT ib.*, a.name AS nickname, a.alias, a.institution,
      (SELECT COUNT(*) FROM transactions WHERE batch_id = ib.id) AS rows_in_db
    FROM import_batches ib
    JOIN accounts a ON a.id = ib.account_id
    ${where}
    ORDER BY ib.imported_at DESC
    LIMIT 100
  `).all(...params);
  res.json(rows);
});

router.post('/batches/:id/rollback', requireAuth, (req, res) => {
  const batch = db.prepare('SELECT * FROM import_batches WHERE id=?').get(req.params.id);
  if (!batch) return err(res, 'Batch not found', 404);
  let removed = 0, snapshotsRemoved = 0;
  db.transaction(() => {
    const r = db.prepare(`DELETE FROM transactions WHERE batch_id=? AND source='imported'`).run(req.params.id);
    removed = r.changes;
    try {
      const s = db.prepare('DELETE FROM account_snapshots WHERE batch_id=?').run(req.params.id);
      snapshotsRemoved = s.changes;
    } catch {}
    db.prepare('DELETE FROM import_batches WHERE id=?').run(req.params.id);
    const remaining = db.prepare('SELECT COUNT(*) AS n FROM import_batches WHERE account_id=?')
      .get(batch.account_id);
    if (remaining.n === 0) {
      db.prepare('DELETE FROM holdings WHERE account_id=?').run(batch.account_id);
    }
  })();
  res.json({ ok: true, removed, snapshotsRemoved });
});

// ── Spending breakdown ─────────────────────────────────────────

router.get('/spending', (req, res) => {
  const { account_id, from, to } = req.query;
  const wheres = [`t.source = 'imported'`, 't.is_transfer = 0', 't.amount < 0'];
  const params = [];
  if (account_id) { wheres.push('t.account_id = ?'); params.push(account_id); }
  if (from)       { wheres.push('t.date >= ?');      params.push(from); }
  if (to)         { wheres.push('t.date <= ?');      params.push(to); }

  const where = 'WHERE ' + wheres.join(' AND ');
  const rows = db.prepare(`
    SELECT COALESCE(t.category, 'Uncategorized') AS label,
      COUNT(*) AS count,
      ROUND(SUM(ABS(t.amount)), 2) AS total
    FROM transactions t
    ${where}
    GROUP BY label ORDER BY total DESC
  `).all(...params);

  res.json(rows);
});

// ── Missing statement todos ────────────────────────────────────
//
// detectMissingStatements() is reused by:
//   1. GET /missing-statements (this endpoint) — for the finance UI
//      banner.
//   2. shared/autoTodos.js (v.155) — feeds an `auto_type='missing_statement'`
//      todo per missing month so they show up in the daily todo list.
//
// "Missing" = an active account with track_statements=1 has no
// import_batch with statement_date in that month. Looks back N
// months (default 3).

function detectMissingStatements(monthsBack = 3) {
  // Defensive: on installs where mig 126 hasn't successfully run yet,
  // `accounts` may be the pre-existing beneficiaries shape without
  // `name`/`alias`/`is_active`/`track_statements`. Return empty
  // instead of throwing — autoTodos calls this in a hot loop and a
  // throw spams the log.
  try {
    const cols = db.prepare(`PRAGMA table_info(accounts)`).all().map(c => c.name);
    const required = ['name','alias','is_active','track_statements','institution'];
    if (!required.every(c => cols.includes(c))) {
      return [];
    }
  } catch { return []; }

  const accounts = db.prepare(`
    SELECT id, name, alias, institution
    FROM accounts WHERE is_active = 1 AND track_statements = 1
  `).all();

  const missing = [];
  const now = new Date();

  for (const acct of accounts) {
    const imported = db.prepare(`
      SELECT DISTINCT strftime('%Y-%m', statement_date) AS m
      FROM import_batches
      WHERE account_id = ? AND statement_date IS NOT NULL
    `).all(acct.id).map(r => r.m);
    const importedSet = new Set(imported);

    for (let i = 1; i <= monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!importedSet.has(month)) {
        missing.push({
          account_id:  acct.id,
          name:        acct.name,
          alias:       acct.alias,
          institution: acct.institution,
          month,
          month_label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
        });
      }
    }
  }
  return missing;
}

router.get('/missing-statements', (req, res) => {
  res.json(detectMissingStatements(3));
});

// Exported alongside the router so autoTodos can pull it without a
// circular dependency on the route file's auth wrapper.
module.exports = router;
module.exports.detectMissingStatements = detectMissingStatements;
