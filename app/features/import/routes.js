/**
 * features/import/routes.js
 * Financial import API — accounts, import batches, holdings, transactions
 */

const express  = require('express');
const multer   = require('multer');
const crypto   = require('crypto');
const path     = require('path');
const router   = express.Router();
const db       = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { parseFile }   = require('./parsers');

// Excel parsing via SheetJS (optional — graceful fallback)
let XLSX;
try { XLSX = require('xlsx'); } catch { XLSX = null; }

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Helpers ────────────────────────────────────────────────────

function ok(res, data)  { res.json({ ok: true, ...data }); }
function err(res, msg, status = 400) { res.status(status).json({ error: msg }); }

function fingerprint(accountId, date, amount, description) {
  const s = `${accountId}|${date}|${amount}|${description.toLowerCase().trim().slice(0,80)}`;
  return crypto.createHash('md5').update(s).digest('hex');
}

function statementMonth(date) {
  if (!date) return null;
  return date.slice(0, 7); // YYYY-MM
}

function classifyTransfer(txn, accountType) {
  // Auto-flag obvious transfers so they're excluded from spending reports
  const desc = (txn.description || '').toLowerCase();
  if (txn.type === 'transfer') return true;
  if (accountType === 'credit_card') {
    if (desc.includes('payment') && desc.includes('thank')) return true;
    if (desc.includes('autopay') || desc.includes('auto pay')) return true;
    if (desc.match(/payment received|online payment|mobile payment/)) return true;
  }
  if (desc.match(/transfer (to|from)|zelle (to|from)|venmo|paypal transfer/)) return true;
  return false;
}

// ── Financial Accounts ─────────────────────────────────────────

router.get('/accounts', (req, res) => {
  const accounts = db.prepare(`
    SELECT fa.*,
      (SELECT COUNT(*) FROM import_batches ib WHERE ib.account_id = fa.id AND ib.status='complete') AS import_count,
      (SELECT MAX(ib.statement_date) FROM import_batches ib WHERE ib.account_id = fa.id AND ib.status='complete') AS last_statement_date
    FROM financial_accounts fa
    WHERE fa.is_active = 1
    ORDER BY fa.institution, fa.nickname
  `).all();
  res.json(accounts);
});

router.post('/accounts', requireAuth, (req, res) => {
  const { nickname, institution, account_type, owner, last_four, notes, track_statements } = req.body;
  if (!nickname?.trim()) return err(res, 'Nickname is required');
  if (!institution?.trim()) return err(res, 'Institution is required');
  if (!account_type) return err(res, 'Account type is required');

  const r = db.prepare(`
    INSERT INTO financial_accounts (nickname, institution, account_type, owner, last_four, notes, track_statements)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nickname.trim(), institution.trim(), account_type, owner || null,
         last_four ? last_four.slice(-4) : null, notes || null, track_statements !== false ? 1 : 0);

  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/accounts/:id', requireAuth, (req, res) => {
  const { nickname, institution, account_type, owner, last_four, notes, track_statements, is_active } = req.body;
  if (!nickname?.trim()) return err(res, 'Nickname is required');
  db.prepare(`
    UPDATE financial_accounts SET nickname=?, institution=?, account_type=?, owner=?, last_four=?,
      notes=?, track_statements=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(nickname.trim(), institution.trim(), account_type, owner || null,
         last_four ? last_four.slice(-4) : null, notes || null,
         track_statements !== false ? 1 : 0, is_active !== false ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/accounts/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE financial_accounts SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Preview before import ──────────────────────────────────────

router.post('/preview', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return err(res, 'No file uploaded');

  let text;
  const ext = path.extname(req.file.originalname).toLowerCase();

  if (['.xlsx', '.xls'].includes(ext)) {
    if (!XLSX) return err(res, 'Excel support not available — upload CSV instead');
    try {
      const wb = XLSX.read(req.file.buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      text = XLSX.utils.sheet_to_csv(ws);
    } catch(e) { return err(res, 'Could not read Excel file: ' + e.message); }
  } else {
    text = req.file.buffer.toString('utf-8');
    // Handle BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  }

  const parsed = parseFile(text, req.file.originalname);

  // Check for existing fingerprints to show duplicate count in preview
  const fps = parsed.transactions.map(t =>
    fingerprint(req.body.account_id || 0, t.date, t.amount, t.description)
  );
  const existing = fps.length
    ? db.prepare(`SELECT fingerprint FROM imported_transactions WHERE fingerprint IN (${fps.map(()=>'?').join(',')})`)
        .all(...fps).map(r => r.fingerprint)
    : [];
  const existingSet = new Set(existing);

  const preview = parsed.transactions.slice(0, 20).map(t => ({
    ...t,
    isDuplicate: existingSet.has(fingerprint(req.body.account_id || 0, t.date, t.amount, t.description)),
  }));

  res.json({
    format:        parsed.format,
    statementDate: parsed.statementDate,
    totalRows:     parsed.transactions.length,
    duplicates:    existing.length,
    newRows:       parsed.transactions.length - existing.length,
    positions:     parsed.positions?.length || 0,
    preview,
    previewPositions: parsed.positions?.slice(0, 10) || [],
    error:         parsed.error || null,
    _text:         undefined, // don't leak raw text
  });
});

// ── Confirm import ─────────────────────────────────────────────

router.post('/confirm', requireAuth, upload.single('file'), (req, res) => {
  const accountId = parseInt(req.body.account_id);
  if (!accountId) return err(res, 'account_id required');

  const account = db.prepare('SELECT * FROM financial_accounts WHERE id=?').get(accountId);
  if (!account) return err(res, 'Account not found', 404);

  let text;
  const ext = path.extname(req.file?.originalname || '').toLowerCase();
  if (['.xlsx','.xls'].includes(ext)) {
    if (!XLSX) return err(res, 'Excel support unavailable');
    try {
      const wb = XLSX.read(req.file.buffer);
      text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    } catch(e) { return err(res, e.message); }
  } else {
    text = req.file.buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  }

  const parsed = parseFile(text, req.file?.originalname || 'upload');

  // Create batch record
  const batchId = db.prepare(`
    INSERT INTO import_batches (account_id, filename, statement_date, statement_month, format, rows_total, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).run(accountId, req.file?.originalname || 'upload', parsed.statementDate,
         statementMonth(parsed.statementDate), parsed.format,
         parsed.transactions.length).lastInsertRowid;

  let inserted = 0, skipped = 0, flagged = 0;

  // Insert transactions in a transaction
  // Load category rules once before the import loop
  const categoryRules = db.prepare('SELECT * FROM import_category_rules WHERE is_active=1 ORDER BY sort_order').all();

  const doImport = db.transaction(() => {
    for (const t of parsed.transactions) {
      if (!t.date || t.amount === null) continue;
      const fp = fingerprint(accountId, t.date, t.amount, t.description);

      // Check exact duplicate
      const exists = db.prepare('SELECT id FROM imported_transactions WHERE fingerprint=?').get(fp);
      if (exists) { skipped++; continue; }

      // Check probable duplicate (same date + amount, different description)
      const probable = db.prepare(`
        SELECT id FROM imported_transactions
        WHERE account_id=? AND txn_date=? AND ABS(amount - ?)< 0.01 AND fingerprint != ?
        LIMIT 1
      `).get(accountId, t.date, t.amount, fp);

      const isTransfer = classifyTransfer(t, account.account_type);

      // Auto-categorize using rules if no category from parser
      let autoCategory = t.category || null;
      if (!autoCategory) {
        const desc = (t.description || '').toUpperCase();
        for (const rule of categoryRules) {
          const regex = new RegExp('^' + rule.pattern.replace(/%/g,'.*').replace(/_/g,'.') + '$', 'i');
          if (regex.test(desc)) { autoCategory = rule.category; break; }
        }
      }

      db.prepare(`
        INSERT INTO imported_transactions
          (account_id, batch_id, txn_date, post_date, description, amount, balance,
           category, txn_type, is_transfer, memo, fingerprint, flagged)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(accountId, batchId, t.date, t.postDate || null, t.description,
             t.amount, t.balance || null, autoCategory,
             t.type || 'transaction', isTransfer ? 1 : 0,
             t.memo || null, fp, probable ? 1 : 0);

      if (probable) flagged++;
      inserted++;
    }

    // Upsert holdings/positions
    for (const p of (parsed.positions || [])) {
      if (!p.symbol || !p.shares) continue;
      db.prepare(`
        INSERT INTO holdings (account_id, symbol, name, asset_type, shares, cost_basis, price, price_date, market_value, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(account_id, symbol) DO UPDATE SET
          name=excluded.name, shares=excluded.shares, cost_basis=COALESCE(excluded.cost_basis, cost_basis),
          price=excluded.price, price_date=excluded.price_date,
          market_value=excluded.market_value, updated_at=CURRENT_TIMESTAMP
      `).run(accountId, p.symbol, p.name || null, p.assetType || 'stock',
             p.shares, p.costBasis || null, p.price || null,
             parsed.statementDate || null, p.marketValue || null);
    }

    // Record account snapshot (ending balance)
    if (parsed.statementDate) {
      // For brokerage: use sum of market values. For cash: last balance in file.
      let balance = null;
      if (parsed.positions?.length) {
        const total = db.prepare(`
          SELECT COALESCE(SUM(market_value), 0) AS total FROM holdings WHERE account_id=?
        `).get(accountId)?.total;
        balance = total || null;
      } else {
        // Use the last known running balance, or sum of transactions
        const lastRow = db.prepare(`
          SELECT balance FROM imported_transactions
          WHERE account_id=? AND batch_id=? AND balance IS NOT NULL
          ORDER BY txn_date DESC LIMIT 1
        `).get(accountId, batchId);
        balance = lastRow?.balance ?? null;
      }

      if (balance !== null) {
        // Credit cards are liabilities — store as negative
        if (account.account_type === 'credit_card') balance = -Math.abs(balance);
        db.prepare(`
          INSERT INTO account_snapshots (account_id, snapshot_date, balance, batch_id)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(account_id, snapshot_date) DO UPDATE SET balance=excluded.balance, batch_id=excluded.batch_id
        `).run(accountId, parsed.statementDate, balance, batchId);
      }
    }

    // Update batch status
    db.prepare(`
      UPDATE import_batches SET status='complete', rows_inserted=?, rows_skipped=?, rows_flagged=?
      WHERE id=?
    `).run(inserted, skipped, flagged, batchId);
  });

  try {
    doImport();
    res.json({ ok:true, batchId, inserted, skipped, flagged, positions: parsed.positions?.length || 0 });
  } catch(e) {
    db.prepare("UPDATE import_batches SET status='error', error_message=? WHERE id=?").run(e.message, batchId);
    err(res, 'Import failed: ' + e.message, 500);
  }
});

// ── Transactions ───────────────────────────────────────────────

router.get('/transactions', (req, res) => {
  const { account_id, from, to, search, type, limit = 100, offset = 0, include_transfers } = req.query;
  const wheres = [];
  const params = [];

  if (account_id) { wheres.push('t.account_id = ?'); params.push(account_id); }
  if (from) { wheres.push('t.txn_date >= ?'); params.push(from); }
  if (to)   { wheres.push('t.txn_date <= ?'); params.push(to); }
  if (search) { wheres.push('(t.description LIKE ? OR t.memo LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (type) { wheres.push('t.txn_type = ?'); params.push(type); }
  if (!include_transfers || include_transfers === 'false') { wheres.push('t.is_transfer = 0'); }

  const where = wheres.length ? 'WHERE ' + wheres.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT t.*, fa.nickname AS account_nickname, fa.institution, fa.account_type
    FROM imported_transactions t
    JOIN financial_accounts fa ON fa.id = t.account_id
    ${where}
    ORDER BY t.txn_date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  const total = db.prepare(`
    SELECT COUNT(*) AS n FROM imported_transactions t ${where}
  `).get(...params)?.n || 0;

  res.json({ transactions: rows, total, limit: parseInt(limit), offset: parseInt(offset) });
});

// Update transaction (category, is_transfer, flagged resolution)
router.patch('/transactions/:id', requireAuth, (req, res) => {
  const { category, is_transfer, flagged, txn_type } = req.body;
  const sets = [], vals = [];
  if (category !== undefined)    { sets.push('category=?');    vals.push(category); }
  if (is_transfer !== undefined) { sets.push('is_transfer=?'); vals.push(is_transfer ? 1 : 0); }
  if (flagged !== undefined)     { sets.push('flagged=?');     vals.push(flagged ? 1 : 0); }
  if (txn_type !== undefined)    { sets.push('txn_type=?');    vals.push(txn_type); }
  if (!sets.length) return err(res, 'Nothing to update');
  db.prepare(`UPDATE imported_transactions SET ${sets.join(',')} WHERE id=?`).run(...vals, req.params.id);
  res.json({ ok: true });
});

// ── Holdings / Positions ───────────────────────────────────────

router.get('/holdings', (req, res) => {
  const { account_id } = req.query;
  const where = account_id ? 'WHERE h.account_id = ?' : '';
  const params = account_id ? [account_id] : [];

  const holdings = db.prepare(`
    SELECT h.*, fa.nickname AS account_nickname, fa.institution, fa.account_type
    FROM holdings h
    JOIN financial_accounts fa ON fa.id = h.account_id
    ${where}
    ORDER BY h.market_value DESC NULLS LAST, h.symbol
  `).all(...params);

  // Summary by account
  const summary = db.prepare(`
    SELECT h.account_id, fa.nickname, fa.institution,
      COUNT(*) AS positions,
      SUM(h.market_value) AS total_value,
      SUM(h.shares * h.cost_basis) AS total_cost
    FROM holdings h
    JOIN financial_accounts fa ON fa.id = h.account_id
    ${where}
    GROUP BY h.account_id
  `).all(...params);

  res.json({ holdings, summary });
});

// ── Net Worth Snapshot ─────────────────────────────────────────

router.get('/net-worth', (req, res) => {
  // Per-account latest snapshots
  const accounts = db.prepare(`
    SELECT fa.id, fa.nickname, fa.institution, fa.account_type,
      s.balance, s.snapshot_date
    FROM financial_accounts fa
    LEFT JOIN account_snapshots s ON s.id = (
      SELECT id FROM account_snapshots WHERE account_id = fa.id ORDER BY snapshot_date DESC LIMIT 1
    )
    WHERE fa.is_active = 1
    ORDER BY fa.account_type, fa.nickname
  `).all();

  // Net worth over time — all snapshots grouped by date
  const timeline = db.prepare(`
    SELECT snapshot_date,
      SUM(CASE WHEN fa.account_type != 'credit_card' THEN COALESCE(s.balance,0) ELSE 0 END) AS assets,
      SUM(CASE WHEN fa.account_type  = 'credit_card' THEN ABS(COALESCE(s.balance,0)) ELSE 0 END) AS liabilities
    FROM account_snapshots s
    JOIN financial_accounts fa ON fa.id = s.account_id
    GROUP BY snapshot_date
    ORDER BY snapshot_date ASC
  `).all().map(r => ({
    ...r,
    net_worth: r.assets - r.liabilities,
  }));

  const latest = timeline.length ? timeline[timeline.length - 1] : { assets:0, liabilities:0, net_worth:0 };

  res.json({ accounts, timeline, latest });
});

// ── Import history ─────────────────────────────────────────────

router.get('/batches', (req, res) => {
  const { account_id } = req.query;
  const where = account_id ? 'WHERE ib.account_id = ?' : '';
  const params = account_id ? [account_id] : [];
  const rows = db.prepare(`
    SELECT ib.*, fa.nickname, fa.institution
    FROM import_batches ib
    JOIN financial_accounts fa ON fa.id = ib.account_id
    ${where}
    ORDER BY ib.imported_at DESC
    LIMIT 100
  `).all(...params);
  res.json(rows);
});

router.delete('/batches/:id', requireAuth, (req, res) => {
  // Roll back a batch — delete its transactions and snapshots
  const batch = db.prepare('SELECT * FROM import_batches WHERE id=?').get(req.params.id);
  if (!batch) return err(res, 'Batch not found', 404);
  db.transaction(() => {
    db.prepare('DELETE FROM imported_transactions WHERE batch_id=?').run(req.params.id);
    db.prepare('DELETE FROM account_snapshots WHERE batch_id=?').run(req.params.id);
    db.prepare('DELETE FROM import_batches WHERE id=?').run(req.params.id);
  })();
  res.json({ ok: true });
});

// ── Spending summary ───────────────────────────────────────────

router.get('/spending', (req, res) => {
  const { account_id, from, to, group_by = 'category' } = req.query;
  const wheres = ['t.is_transfer = 0', 't.amount < 0']; // expenses only
  const params = [];
  if (account_id) { wheres.push('t.account_id = ?'); params.push(account_id); }
  if (from) { wheres.push('t.txn_date >= ?'); params.push(from); }
  if (to)   { wheres.push('t.txn_date <= ?'); params.push(to); }

  const where = 'WHERE ' + wheres.join(' AND ');
  const rows = db.prepare(`
    SELECT COALESCE(t.category, 'Uncategorized') AS label,
      COUNT(*) AS count,
      ROUND(SUM(ABS(t.amount)), 2) AS total
    FROM imported_transactions t
    ${where}
    GROUP BY label ORDER BY total DESC
  `).all(...params);

  res.json(rows);
});

// ── Missing statement todos ────────────────────────────────────

router.get('/missing-statements', (req, res) => {
  // For each account with track_statements=1, find months with no import
  const accounts = db.prepare(`
    SELECT * FROM financial_accounts WHERE is_active=1 AND track_statements=1
  `).all();

  const missing = [];
  const now = new Date();

  for (const acct of accounts) {
    const imported = db.prepare(`
      SELECT DISTINCT statement_month FROM import_batches
      WHERE account_id=? AND status='complete' AND statement_month IS NOT NULL
    `).all(acct.id).map(r => r.statement_month);

    const importedSet = new Set(imported);

    // Check last 3 months
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!importedSet.has(month)) {
        missing.push({
          account_id:   acct.id,
          nickname:     acct.nickname,
          institution:  acct.institution,
          month,
          month_label:  d.toLocaleString('default', { month:'long', year:'numeric' }),
        });
      }
    }
  }

  res.json(missing);
});

module.exports = router;
