'use strict';
/**
 * features/finance/routes.js
 * Finance module: Gift Cards, Accounts, Transactions, Net Worth
 *
 * Routes:
 *   Gift Cards:
 *     GET    /api/v1/finance/gift-cards
 *     POST   /api/v1/finance/gift-cards
 *     PUT    /api/v1/finance/gift-cards/:id
 *     DELETE /api/v1/finance/gift-cards/:id
 *     PATCH  /api/v1/finance/gift-cards/:id/balance   quick-update balance
 *
 *   Accounts:
 *     GET    /api/v1/finance/accounts
 *     POST   /api/v1/finance/accounts
 *     PUT    /api/v1/finance/accounts/:id
 *     DELETE /api/v1/finance/accounts/:id
 *     PATCH  /api/v1/finance/accounts/:id/balance
 *
 *   Transactions:
 *     GET    /api/v1/finance/transactions?account_id=&year=&category=&limit=
 *     POST   /api/v1/finance/transactions
 *     PUT    /api/v1/finance/transactions/:id
 *     DELETE /api/v1/finance/transactions/:id
 *
 *   Net Worth:
 *     GET    /api/v1/finance/net-worth/current     live calculation from accounts
 *     GET    /api/v1/finance/net-worth/snapshots   history
 *     POST   /api/v1/finance/net-worth/snapshot    save current snapshot
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');
const { saveFamilyMembers, getFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');

// ── All finance routes require auth ──────────────────────────
router.use(requireAuth);

// ══════════════════════════════════════════════════════════════
// GIFT CARDS
// ══════════════════════════════════════════════════════════════

router.get('/gift-cards', (req, res) => {
  try {
    const active = req.query.active !== '0';
    const rows = db.prepare(`
      SELECT * FROM gift_cards
      WHERE is_active = ?
      ORDER BY
        CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
        expiry_date ASC,
        retailer ASC
    `).all(active ? 1 : 0);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/gift-cards', (req, res) => {
  try {
    const d = req.body;
    if (!d.retailer) return badRequest(res, 'retailer required');
    const initial = parseFloat(d.initial_balance) || 0;
    const current = d.current_balance !== undefined ? parseFloat(d.current_balance) : initial;
    const r = db.prepare(`
      INSERT INTO gift_cards (retailer, initial_balance, current_balance, expiry_date, where_stored, notes, card_number, card_pin, in_google_pay, in_samsung_pay, in_apple_pay)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(d.retailer, initial, current, d.expiry_date||null, d.where_stored||'Wallet', d.notes||null, d.card_number||null, d.card_pin||null, d.in_google_pay?1:0, d.in_samsung_pay?1:0, d.in_apple_pay?1:0);

    // Auto-create Todo if expiry_date is set
    let todoId = null;
    if (d.expiry_date) {
      todoId = createExpiryTodo(r.lastInsertRowid, d.retailer, d.expiry_date, current);
      if (todoId) {
        db.prepare('UPDATE gift_cards SET todo_id=? WHERE id=?').run(todoId, r.lastInsertRowid);
      }
    }

    res.status(201).json({ id: r.lastInsertRowid, todo_id: todoId });
  } catch (e) { serverError(res, e); }
});

router.put('/gift-cards/:id', (req, res) => {
  try {
    const d = req.body;
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM gift_cards WHERE id=?').get(id);
    if (!existing) return notFound(res, 'Gift card');

    db.prepare(`
      UPDATE gift_cards SET
        retailer=?, initial_balance=?, current_balance=?, expiry_date=?,
        where_stored=?, notes=?, card_number=?, card_pin=?,
        in_google_pay=?, in_samsung_pay=?, in_apple_pay=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.retailer || existing.retailer,
      parseFloat(d.initial_balance) ?? existing.initial_balance,
      parseFloat(d.current_balance) ?? existing.current_balance,
      d.expiry_date !== undefined ? (d.expiry_date||null) : existing.expiry_date,
      d.where_stored || existing.where_stored,
      d.notes !== undefined ? (d.notes||null) : existing.notes,
      d.card_number !== undefined ? (d.card_number||null) : existing.card_number,
      d.card_pin !== undefined ? (d.card_pin||null) : existing.card_pin,
      d.in_google_pay !== undefined ? (d.in_google_pay?1:0) : existing.in_google_pay,
      d.in_samsung_pay !== undefined ? (d.in_samsung_pay?1:0) : existing.in_samsung_pay,
      d.in_apple_pay !== undefined ? (d.in_apple_pay?1:0) : existing.in_apple_pay,
      id
    );
    // Re-create expiry todo if expiry date changed
    if (d.expiry_date !== undefined && d.expiry_date !== existing.expiry_date && d.expiry_date) {
      const todoId = createExpiryTodo(id, d.retailer||existing.retailer, d.expiry_date, parseFloat(d.current_balance)||existing.current_balance);
      if (todoId) db.prepare('UPDATE gift_cards SET todo_id=? WHERE id=?').run(todoId, id);
    }
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// Quick balance update — most common action
router.patch('/gift-cards/:id/balance', (req, res) => {
  try {
    const { balance } = req.body;
    if (balance === undefined) return badRequest(res, 'balance required');
    const existing = db.prepare('SELECT id FROM gift_cards WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Gift card');
    db.prepare('UPDATE gift_cards SET current_balance=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(parseFloat(balance), req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/gift-cards/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT todo_id FROM gift_cards WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Gift card');
    // Soft delete
    db.prepare('UPDATE gift_cards SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ── Helper: create expiry Todo 30 days before expiry ─────────
function createExpiryTodo(gcId, retailer, expiryDate, balance) {
  try {
    // Check todos table exists
    const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos'").get();
    if (!tbl) return null;

    const exp  = new Date(expiryDate);
    const due  = new Date(exp.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dueStr = due.toISOString().slice(0, 10);
    const balFmt = `$${parseFloat(balance).toFixed(2)}`;

    const r = db.prepare(`
      INSERT INTO todos (title, notes, due_date, priority, status)
      VALUES (?,?,?,'medium','open')
    `).run(
      `Gift card expiring: ${retailer} — ${balFmt}`,
      `Gift card expires on ${expiryDate}. Balance: ${balFmt}. Gift card ID: ${gcId}`,
      dueStr
    );
    return r.lastInsertRowid;
  } catch (e) {
    console.warn('[gift cards] could not create expiry todo:', e.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// ACCOUNTS
// ══════════════════════════════════════════════════════════════

router.get('/accounts', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT a.*,
        (SELECT COALESCE(SUM(amount), 0) FROM finance_transactions WHERE account_id = a.id) AS tx_total,
        (SELECT COUNT(*) FROM finance_transactions WHERE account_id = a.id) AS tx_count
      FROM finance_accounts a
      WHERE a.is_active = 1
      ORDER BY a.sort_order ASC, a.name ASC
    `).all();
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/accounts', (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const r = db.prepare(`
      INSERT INTO finance_accounts
        (name, type, institution, account_last4, current_balance, balance_as_of, include_net_worth, notes, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      d.name, d.type||'Checking', d.institution||null, d.account_last4||null,
      parseFloat(d.current_balance)||0, d.balance_as_of||null,
      d.include_net_worth !== false ? 1 : 0,
      d.notes||null,
      parseInt(d.sort_order)||0
    );
    saveFamilyMembers(r.lastInsertRowid, 'finance_account', d.family_member_ids || []);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/accounts/:id', (req, res) => {
  try {
    const d   = req.body;
    const existing = db.prepare('SELECT * FROM finance_accounts WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Account');
    if (d.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'finance_account', d.family_member_ids);
    db.prepare(`
      UPDATE finance_accounts SET
        name=?, type=?, institution=?, account_last4=?,
        current_balance=?, balance_as_of=?, include_net_worth=?, notes=?, sort_order=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.name||existing.name, d.type||existing.type,
      d.institution!==undefined ? d.institution : existing.institution,
      d.account_last4!==undefined ? d.account_last4 : existing.account_last4,
      d.current_balance!==undefined ? parseFloat(d.current_balance) : existing.current_balance,
      d.balance_as_of!==undefined ? d.balance_as_of : existing.balance_as_of,
      d.include_net_worth!==undefined ? (d.include_net_worth ? 1 : 0) : existing.include_net_worth,
      d.notes!==undefined ? d.notes : existing.notes,
      d.sort_order!==undefined ? parseInt(d.sort_order) : existing.sort_order,
      req.params.id
    );
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.patch('/accounts/:id/balance', (req, res) => {
  try {
    const { balance, as_of } = req.body;
    if (balance === undefined) return badRequest(res, 'balance required');
    db.prepare(`
      UPDATE finance_accounts SET current_balance=?, balance_as_of=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(parseFloat(balance), as_of || new Date().toISOString().slice(0,10), req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/accounts/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM finance_accounts WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Account');
    db.prepare('UPDATE finance_accounts SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════

router.get('/transactions', (req, res) => {
  try {
    const { account_id, year, month, category, limit = 100, offset = 0 } = req.query;
    let sql = `
      SELECT t.*, a.name as account_name, a.type as account_type
      FROM finance_transactions t
      JOIN finance_accounts a ON a.id = t.account_id
      WHERE 1=1
    `;
    const params = [];
    if (account_id) { sql += ' AND t.account_id = ?'; params.push(account_id); }
    if (year)       { sql += " AND strftime('%Y', t.date) = ?"; params.push(String(year)); }
    if (month)      { sql += " AND strftime('%Y-%m', t.date) = ?"; params.push(String(month)); }
    if (category)   { sql += ' AND t.category = ?'; params.push(category); }
    sql += ' ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const rows = db.prepare(sql).all(...params).map(r => withTagNames(r, 'finance_transaction'));

    // Also return summary
    let sumSql = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(amount), 0) as net
      FROM finance_transactions t WHERE 1=1
    `;
    const sumParams = [];
    if (account_id) { sumSql += ' AND t.account_id = ?'; sumParams.push(account_id); }
    if (year)       { sumSql += " AND strftime('%Y', t.date) = ?"; sumParams.push(String(year)); }
    if (month)      { sumSql += " AND strftime('%Y-%m', t.date) = ?"; sumParams.push(String(month)); }
    if (category)   { sumSql += ' AND t.category = ?'; sumParams.push(category); }
    const summary = db.prepare(sumSql).get(...sumParams);

    res.json({ transactions: rows, summary });
  } catch (e) { serverError(res, e); }
});


// GET /api/v1/finance/transactions/unified — merges manual + imported transactions
// Returns both finance_transactions and imported_transactions in one sorted list.
router.get('/transactions/unified', (req, res) => {
  try {
    const { account_id, year, month, search, limit = 200, offset = 0 } = req.query;
    const params = [];
    const impParams = [];

    // Build WHERE for manual transactions
    let manWhere = 'WHERE 1=1';
    if (account_id) { manWhere += ' AND t.account_id=?'; params.push(account_id); }
    if (year)       { manWhere += " AND strftime('%Y',t.date)=?"; params.push(String(year)); }
    if (month)      { manWhere += " AND strftime('%Y-%m',t.date)=?"; params.push(String(month)); }
    if (search)     { manWhere += ' AND (t.description LIKE ? OR t.notes LIKE ?)'; params.push(`%${search}%`,`%${search}%`); }

    // Build WHERE for imported transactions
    let impWhere = 'WHERE t.is_transfer=0';
    if (account_id) { impWhere += ' AND t.account_id=?'; impParams.push(account_id); }
    if (year)       { impWhere += " AND strftime('%Y',t.txn_date)=?"; impParams.push(String(year)); }
    if (month)      { impWhere += " AND strftime('%Y-%m',t.txn_date)=?"; impParams.push(String(month)); }
    if (search)     { impWhere += ' AND t.description LIKE ?'; impParams.push(`%${search}%`); }

    const manTxns = db.prepare(`
      SELECT t.id, t.account_id, t.date, t.description, t.amount,
             t.category, t.notes, t.is_reconciled,
             a.name AS account_name, 'manual' AS source, NULL AS batch_id,
             0 AS flagged, 0 AS is_transfer
      FROM finance_transactions t
      JOIN finance_accounts a ON a.id=t.account_id
      ${manWhere}
    `).all(...params).map(r => withTagNames(r, 'finance_transaction'));

    const impTxns = db.prepare(`
      SELECT t.id, t.account_id, t.txn_date AS date, t.description, t.amount,
             t.category, t.memo AS notes, 0 AS is_reconciled,
             fa.nickname AS account_name, 'imported' AS source, t.batch_id,
             t.flagged, t.is_transfer
      FROM imported_transactions t
      JOIN financial_accounts fa ON fa.id=t.account_id
      ${impWhere}
    `).all(...impParams);

    const all = [...manTxns, ...impTxns]
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    const total_credits = all.reduce((s,t) => s + (t.amount > 0 ? t.amount : 0), 0);
    const total_debits  = all.reduce((s,t) => s + (t.amount < 0 ? t.amount : 0), 0);
    res.json({ transactions: all, summary: { total_credits, total_debits, net: total_credits + total_debits } });
  } catch(e) { serverError(res, e); }
});

// ── Category rules ────────────────────────────────────────────
router.get('/category-rules', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM import_category_rules ORDER BY sort_order').all());
  } catch(e) { serverError(res, e); }
});

router.post('/category-rules', requireAuth, (req, res) => {
  try {
    const { pattern, category, sort_order = 100 } = req.body;
    if (!pattern || !category) return badRequest(res, 'pattern and category required');
    const r = db.prepare('INSERT INTO import_category_rules (pattern, category, sort_order) VALUES (?,?,?)')
      .run(pattern.toUpperCase(), category, sort_order);
    res.status(201).json(db.prepare('SELECT * FROM import_category_rules WHERE id=?').get(r.lastInsertRowid));
  } catch(e) { serverError(res, e); }
});

router.delete('/category-rules/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM import_category_rules WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// POST /api/v1/finance/category-rules/apply — apply rules to uncategorized imported transactions
router.post('/category-rules/apply', requireAuth, (req, res) => {
  try {
    const rules = db.prepare('SELECT * FROM import_category_rules WHERE is_active=1 ORDER BY sort_order').all();
    const uncategorized = db.prepare("SELECT id, description FROM imported_transactions WHERE (category IS NULL OR category='')").all();
    let updated = 0;
    const stmt = db.prepare('UPDATE imported_transactions SET category=? WHERE id=?');
    for (const txn of uncategorized) {
      const desc = (txn.description || '').toUpperCase();
      for (const rule of rules) {
        // Convert SQL LIKE to JS: % = any, _ = single char
        const regex = new RegExp('^' + rule.pattern.replace(/%/g,'.*').replace(/_/g,'.') + '$', 'i');
        if (regex.test(desc)) {
          stmt.run(rule.category, txn.id);
          updated++;
          break;
        }
      }
    }
    res.json({ ok: true, updated, total_uncategorized: uncategorized.length });
  } catch(e) { serverError(res, e); }
});

router.post('/transactions', (req, res) => {
  try {
    const d = req.body;
    if (!d.account_id)   return badRequest(res, 'account_id required');
    if (!d.date)         return badRequest(res, 'date required');
    if (!d.description)  return badRequest(res, 'description required');
    if (d.amount === undefined) return badRequest(res, 'amount required');

    const r = db.prepare(`
      INSERT INTO finance_transactions (account_id, date, description, amount, category, notes, is_reconciled)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      d.account_id, d.date, d.description,
      parseFloat(d.amount), d.category||null, d.notes||null,
      d.is_reconciled ? 1 : 0
    );
    saveFamilyMembers(r.lastInsertRowid, 'finance_transaction', d.family_member_ids || []);
    if (d.tags?.length) saveTagsByName(r.lastInsertRowid, 'finance_transaction', d.tags);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/transactions/:id', (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM finance_transactions WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Transaction');
    db.prepare(`
      UPDATE finance_transactions SET
        account_id=?, date=?, description=?, amount=?, category=?, notes=?, is_reconciled=?
      WHERE id=?
    `).run(
      d.account_id||existing.account_id,
      d.date||existing.date,
      d.description||existing.description,
      d.amount!==undefined ? parseFloat(d.amount) : existing.amount,
      d.category!==undefined ? d.category : existing.category,
      d.notes!==undefined ? d.notes : existing.notes,
      d.is_reconciled!==undefined ? (d.is_reconciled?1:0) : existing.is_reconciled,
      req.params.id
    );
    if (d.tags !== undefined) saveTagsByName(parseInt(req.params.id), 'finance_transaction', d.tags);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/transactions/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM finance_transactions WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Transaction');
    clearFamilyMembers(req.params.id, 'finance_transaction');
    clearTags(req.params.id, 'finance_transaction');
    db.prepare('DELETE FROM finance_transactions WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// NET WORTH
// ══════════════════════════════════════════════════════════════

router.get('/net-worth/current', (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, name, type, current_balance, include_net_worth
      FROM finance_accounts WHERE is_active=1
    `).all();

    const assets      = accounts.filter(a => a.include_net_worth && a.current_balance > 0);
    const liabilities = accounts.filter(a => a.include_net_worth && a.current_balance < 0);
    const totalAssets = assets.reduce((s, a) => s + a.current_balance, 0);
    const totalLiab   = liabilities.reduce((s, a) => s + Math.abs(a.current_balance), 0);

    res.json({
      total_assets:      totalAssets,
      total_liabilities: totalLiab,
      net_worth:         totalAssets - totalLiab,
      accounts,
      as_of: new Date().toISOString().slice(0, 10),
    });
  } catch (e) { serverError(res, e); }
});

router.get('/net-worth/snapshots', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM net_worth_snapshots ORDER BY snapshot_date DESC LIMIT 24').all();
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/net-worth/snapshot', (req, res) => {
  try {
    const current = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) AS assets,
        COALESCE(SUM(CASE WHEN current_balance < 0 THEN ABS(current_balance) ELSE 0 END), 0) AS liabilities
      FROM finance_accounts WHERE is_active=1 AND include_net_worth=1
    `).get();
    const nw = (current.assets || 0) - (current.liabilities || 0);
    const today = req.body.date || new Date().toISOString().slice(0,10);
    const r = db.prepare(`
      INSERT INTO net_worth_snapshots (snapshot_date, total_assets, total_liabilities, net_worth, notes)
      VALUES (?,?,?,?,?)
    `).run(today, current.assets, current.liabilities, nw, req.body.notes||null);
    res.status(201).json({ id: r.lastInsertRowid, net_worth: nw });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// TRANSACTION CATEGORIES (for dropdown)
// ══════════════════════════════════════════════════════════════
router.get('/categories', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT category FROM finance_transactions
      WHERE category IS NOT NULL ORDER BY category ASC
    `).all();
    res.json(rows.map(r => r.category));
  } catch (e) { serverError(res, e); }
});


// POST /api/v1/finance/transactions/import-file
// Multipart: file + account_id — uses same parsers as /api/v1/import
// Writes to finance_transactions (not imported_transactions)
const multerFinance = require('multer')({ storage: require('multer').memoryStorage() });
const { parseFile: parseFinanceFile } = require('../import/parsers');

router.post('/transactions/import-file', multerFinance.single('file'), (req, res) => {
  try {
    if (!req.file) return badRequest(res, 'No file uploaded');
    const account_id = parseInt(req.body.account_id) || null;

    let text = req.file.buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

    // Try XLSX if needed
    let parsed;
    const ext = require('path').extname(req.file.originalname || '').toLowerCase();
    if (['.xlsx','.xls'].includes(ext)) {
      try {
        const XLSX = require('xlsx');
        const wb = XLSX.read(req.file.buffer);
        text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      } catch(e) { return badRequest(res, 'Could not read Excel file: ' + e.message); }
    }

    parsed = parseFinanceFile(text, req.file.originalname || 'upload');
    if (parsed.error) return badRequest(res, parsed.error);

    const txns = parsed.transactions || [];
    if (!txns.length) return res.json({ ok: true, imported: 0, format: parsed.format, message: 'No transactions found' });

    const insert = db.prepare(`
      INSERT OR IGNORE INTO finance_transactions
        (account_id, date, description, amount, category, notes)
      VALUES (?,?,?,?,?,?)
    `);

    const doImport = db.transaction(() => {
      let count = 0;
      for (const t of txns) {
        if (!t.date || t.amount === null || t.amount === undefined) continue;
        insert.run(account_id, t.date, t.description || null,
                   parseFloat(t.amount) || 0, t.category || null, t.memo || null);
        count++;
      }
      return count;
    });

    const imported = doImport();
    res.json({ ok: true, imported, format: parsed.format, total: txns.length });
  } catch(e) { serverError(res, e); }
});

// POST /api/v1/finance/transactions/import-csv
// Body: { account_id, rows: [{date, description, amount, category}] }
router.post('/transactions/import-csv', (req, res) => {
  try {
    const { account_id, rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) return badRequest(res, 'rows array required');
    const insert = db.prepare(`
      INSERT OR IGNORE INTO finance_transactions
        (account_id, date, description, amount, category, notes)
      VALUES (?,?,?,?,?,?)
    `);
    const importMany = db.transaction((items) => {
      let count = 0;
      for (const r of items) {
        if (!r.date || r.amount === undefined) continue;
        insert.run(account_id||null, r.date, r.description||null,
                   parseFloat(r.amount)||0, r.category||null, r.notes||null);
        count++;
      }
      return count;
    });
    const imported = importMany(rows);
    res.json({ ok: true, imported });
  } catch (e) { serverError(res, e); }
});

// Budgets subrouter
router.use('/budgets', require('./budgets'));

// Reports subrouter
router.use('/reports', require('./reports'));

module.exports = router;
