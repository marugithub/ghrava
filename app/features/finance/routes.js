// @ts-nocheck
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
const { flagRecords } = require('../../shared/needs-review');
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

// ══════════════════════════════════════════════════════════════
// ACCOUNTS — unified table (v202604.151, mig 126)
//   `accounts` replaces both `finance_accounts` and `financial_accounts`.
//   `transactions` replaces both `finance_transactions` and
//   `imported_transactions`. Both manual and file-import paths target
//   these. The `source` column on each row records origin
//   ('manual' | 'imported' | 'merged'); `needs_review` flags rows
//   that need a human eye (typically post-merge).
//
//   No DELETE endpoints — accounts and transactions can only be
//   set inactive. This is enforced because:
//     (a) historical FK refs from holdings, batches, todos
//     (b) deleting an account silently nuking its history was the
//         old CASCADE bug (mig 126 also removed those CASCADEs)
// ══════════════════════════════════════════════════════════════

router.get('/accounts', (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === '1';
    const where = includeInactive ? '' : 'WHERE a.is_active = 1';
    const rows = db.prepare(`
      SELECT a.*,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = a.id) AS tx_total,
        (SELECT COUNT(*) FROM transactions WHERE account_id = a.id) AS tx_count,
        (SELECT COUNT(*) FROM subscriptions WHERE finance_account_id = a.id AND status = 'active') AS linked_subs_count,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions
           WHERE account_id = a.id AND date >= date('now','-30 days')) AS balance_change_30d
      FROM accounts a
      ${where}
      ORDER BY a.sort_order ASC, a.name ASC
    `).all();
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/accounts', (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    // Type is REQUIRED in the unified vocab. Old default 'Checking' kept
    // for back-compat with clients that don't send a type.
    const r = db.prepare(`
      INSERT INTO accounts
        (name, alias, type, institution, last4, owner, currency,
         current_balance, balance_as_of, include_net_worth,
         track_statements, notes, sort_order, source, needs_review)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.name,
      d.alias || null,
      d.type || 'Checking',
      d.institution || null,
      d.last4 || d.account_last4 || null,
      d.owner || null,
      d.currency || 'USD',
      parseFloat(d.current_balance) || 0,
      d.balance_as_of || null,
      d.include_net_worth !== false ? 1 : 0,
      d.track_statements ? 1 : 0,
      d.notes || null,
      parseInt(d.sort_order) || 0,
      'manual',
      0
    );
    saveFamilyMembers(r.lastInsertRowid, 'finance_account', d.family_member_ids || []);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/accounts/:id', (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM accounts WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Account');
    if (d.family_member_ids !== undefined)
      saveFamilyMembers(req.params.id, 'finance_account', d.family_member_ids);
    db.prepare(`
      UPDATE accounts SET
        name=?, alias=?, type=?, institution=?, last4=?, owner=?, currency=?,
        current_balance=?, balance_as_of=?, include_net_worth=?,
        track_statements=?, notes=?, sort_order=?, needs_review=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.name || existing.name,
      d.alias !== undefined ? d.alias : existing.alias,
      d.type || existing.type,
      d.institution !== undefined ? d.institution : existing.institution,
      d.last4 !== undefined ? d.last4 : (d.account_last4 !== undefined ? d.account_last4 : existing.last4),
      d.owner !== undefined ? d.owner : existing.owner,
      d.currency !== undefined ? d.currency : existing.currency,
      d.current_balance !== undefined ? parseFloat(d.current_balance) : existing.current_balance,
      d.balance_as_of !== undefined ? d.balance_as_of : existing.balance_as_of,
      d.include_net_worth !== undefined ? (d.include_net_worth ? 1 : 0) : existing.include_net_worth,
      d.track_statements !== undefined ? (d.track_statements ? 1 : 0) : existing.track_statements,
      d.notes !== undefined ? d.notes : existing.notes,
      d.sort_order !== undefined ? parseInt(d.sort_order) : existing.sort_order,
      d.needs_review !== undefined ? (d.needs_review ? 1 : 0) : existing.needs_review,
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
      UPDATE accounts SET current_balance=?, balance_as_of=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(parseFloat(balance), as_of || new Date().toISOString().slice(0,10), req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// Soft-deactivate only. No DELETE — use PUT { is_active: 0 } or this endpoint.
router.post('/accounts/:id/deactivate', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM accounts WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Account');
    db.prepare('UPDATE accounts SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.post('/accounts/:id/reactivate', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM accounts WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Account');
    db.prepare('UPDATE accounts SET is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
// TRANSACTIONS — unified table (v202604.151, mig 126)
// ══════════════════════════════════════════════════════════════

router.get('/transactions', (req, res) => {
  try {
    const { account_id, year, month, category, source, limit = 100, offset = 0 } = req.query;
    let sql = `
      SELECT t.*, a.name as account_name, a.type as account_type
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE 1=1
    `;
    const params = [];
    if (account_id) { sql += ' AND t.account_id = ?'; params.push(account_id); }
    if (year)       { sql += " AND strftime('%Y', t.date) = ?"; params.push(String(year)); }
    if (month)      { sql += " AND strftime('%Y-%m', t.date) = ?"; params.push(String(month)); }
    if (category)   { sql += ' AND t.category = ?'; params.push(category); }
    if (source)     { sql += ' AND t.source = ?'; params.push(source); }
    sql += ' ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const rows = db.prepare(sql).all(...params).map(r => withTagNames(r, 'finance_transaction'));

    let sumSql = `
      SELECT
        COUNT(*) as total_count,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_credits,
        COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(amount), 0) as net
      FROM transactions t WHERE 1=1
    `;
    const sumParams = [];
    if (account_id) { sumSql += ' AND t.account_id = ?'; sumParams.push(account_id); }
    if (year)       { sumSql += " AND strftime('%Y', t.date) = ?"; sumParams.push(String(year)); }
    if (month)      { sumSql += " AND strftime('%Y-%m', t.date) = ?"; sumParams.push(String(month)); }
    if (category)   { sumSql += ' AND t.category = ?'; sumParams.push(category); }
    if (source)     { sumSql += ' AND t.source = ?'; sumParams.push(source); }
    const summary = db.prepare(sumSql).get(...sumParams);

    res.json({ transactions: rows, summary });
  } catch (e) { serverError(res, e); }
});


// /transactions/unified — backward-compatible. Now just an alias for
// /transactions with optional source filter, since both record types
// live in the same table.
router.get('/transactions/unified', (req, res) => {
  try {
    const { account_id, year, month, search, limit = 200, offset = 0 } = req.query;
    const params = [];
    let sql = `
      SELECT t.*, a.name AS account_name, a.type AS account_type, a.alias AS account_alias
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE 1=1
    `;
    if (account_id) { sql += ' AND t.account_id = ?'; params.push(account_id); }
    if (year)       { sql += " AND strftime('%Y', t.date) = ?"; params.push(String(year)); }
    if (month)      { sql += " AND strftime('%Y-%m', t.date) = ?"; params.push(String(month)); }
    if (search)     { sql += ' AND (t.description LIKE ? OR t.notes LIKE ? OR t.memo LIKE ?)';
                      params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += ' ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const all = db.prepare(sql).all(...params).map(r => withTagNames(r, 'finance_transaction'));

    const total_credits = all.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0);
    const total_debits  = all.reduce((s, t) => s + (t.amount < 0 ? t.amount : 0), 0);
    res.json({
      transactions: all,
      summary: { total_credits, total_debits, net: total_credits + total_debits }
    });
  } catch (e) { serverError(res, e); }
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
    const uncategorized = db.prepare(`
      SELECT id, description FROM transactions
      WHERE source='imported' AND (category IS NULL OR category='')
    `).all();
    let updated = 0;
    const stmt = db.prepare('UPDATE transactions SET category=? WHERE id=?');
    for (const txn of uncategorized) {
      const desc = (txn.description || '').toUpperCase();
      for (const rule of rules) {
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

    // Validation: account exists + active
    const acc = db.prepare(`SELECT id, is_active FROM accounts WHERE id=?`).get(d.account_id);
    if (!acc) return badRequest(res, 'unknown account_id');
    if (!acc.is_active) return badRequest(res, 'account is inactive');

    // Validation: amount is finite number
    const amt = parseFloat(d.amount);
    if (!isFinite(amt)) return badRequest(res, 'amount must be a number');

    // Validation: date is not in far future (1 year)
    const dDate = new Date(d.date);
    if (isNaN(dDate)) return badRequest(res, 'invalid date');
    const yearFromNow = new Date(); yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);
    const needsReview = dDate > yearFromNow ? 1 : 0;

    const r = db.prepare(`
      INSERT INTO transactions
        (account_id, date, description, amount, category, notes, is_reconciled, source, needs_review)
      VALUES (?,?,?,?,?,?,?,'manual',?)
    `).run(
      d.account_id, d.date, d.description,
      amt, d.category || null, d.notes || null,
      d.is_reconciled ? 1 : 0,
      needsReview
    );
    saveFamilyMembers(r.lastInsertRowid, 'finance_transaction', d.family_member_ids || []);
    if (d.tags?.length) saveTagsByName(r.lastInsertRowid, 'finance_transaction', d.tags);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/transactions/:id', (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM transactions WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Transaction');
    db.prepare(`
      UPDATE transactions SET
        account_id=?, date=?, description=?, amount=?, category=?, notes=?,
        is_reconciled=?, needs_review=?
      WHERE id=?
    `).run(
      d.account_id || existing.account_id,
      d.date || existing.date,
      d.description || existing.description,
      d.amount !== undefined ? parseFloat(d.amount) : existing.amount,
      d.category !== undefined ? d.category : existing.category,
      d.notes !== undefined ? d.notes : existing.notes,
      d.is_reconciled !== undefined ? (d.is_reconciled ? 1 : 0) : existing.is_reconciled,
      d.needs_review !== undefined ? (d.needs_review ? 1 : 0) : existing.needs_review,
      req.params.id
    );
    if (d.tags !== undefined) saveTagsByName(parseInt(req.params.id), 'finance_transaction', d.tags);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// No DELETE on transactions either. To remove a manual mistake:
//   - mark needs_review=1 with a note explaining
//   - or roll back the entire batch (POST /import-batches/:id/rollback)
//
// The void endpoint flags the row but keeps it. Use this for individual
// manual mistakes; use batch rollback for bad imports.
router.post('/transactions/:id/void', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM transactions WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Transaction');
    db.prepare(`UPDATE transactions SET needs_review=1, notes=COALESCE(notes,'')||' [VOIDED]' WHERE id=?`)
      .run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// NET WORTH
// ══════════════════════════════════════════════════════════════

router.get('/net-worth/current', (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, name, alias, type, current_balance, include_net_worth, source
      FROM accounts WHERE is_active=1
    `).all();

    const assets      = accounts.filter(a => a.include_net_worth && a.current_balance > 0);
    const liabilities = accounts.filter(a => a.include_net_worth && a.current_balance < 0);
    const totalAssets = assets.reduce((s, a) => s + a.current_balance, 0);
    const totalLiab   = liabilities.reduce((s, a) => s + Math.abs(a.current_balance), 0);

    // Investment holdings market value (now joined to unified accounts)
    const holdingsSummary = db.prepare(`
      SELECT a.id AS account_id, a.name AS nickname, a.alias, a.institution,
             COALESCE(SUM(h.market_value), 0) AS total_value,
             COUNT(h.id) AS positions
      FROM accounts a
      LEFT JOIN holdings h ON h.account_id = a.id
      WHERE a.is_active=1
      GROUP BY a.id
      HAVING positions > 0
    `).all();
    const investmentTotal = holdingsSummary.reduce((s, a) => s + (a.total_value || 0), 0);

    res.json({
      total_assets:      totalAssets,
      total_liabilities: totalLiab,
      investment_total:  investmentTotal,
      net_worth:         totalAssets - totalLiab + investmentTotal,
      accounts,
      investment_accounts: holdingsSummary,
      as_of: new Date().toISOString().slice(0, 10),
    });
  } catch (e) { serverError(res, e); }
});

router.get('/net-worth/snapshots', (req, res) => {
  try {
    // Returns ALL snapshots — never auto-prune. Front end paginates.
    const rows = db.prepare('SELECT * FROM net_worth_snapshots ORDER BY snapshot_date DESC').all();
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/net-worth/snapshot', (req, res) => {
  try {
    const current = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN current_balance > 0 THEN current_balance ELSE 0 END), 0) AS assets,
        COALESCE(SUM(CASE WHEN current_balance < 0 THEN ABS(current_balance) ELSE 0 END), 0) AS liabilities
      FROM accounts WHERE is_active=1 AND include_net_worth=1
    `).get();
    // Add holdings market value to assets side
    let invTotal = 0;
    try {
      const r = db.prepare(`SELECT COALESCE(SUM(market_value),0) AS v FROM holdings`).get();
      invTotal = r?.v || 0;
    } catch {}
    const totalAssets = (current.assets || 0) + invTotal;
    const nw = totalAssets - (current.liabilities || 0);
    const today = req.body.date || new Date().toISOString().slice(0,10);
    let snapshotId = null;
    try {
      const r = db.prepare(`
        INSERT INTO net_worth_snapshots (snapshot_date, total_assets, total_liabilities, net_worth, notes)
        VALUES (?,?,?,?,?)
      `).run(today, totalAssets, current.liabilities, nw, req.body.notes||null);
      snapshotId = r.lastInsertRowid;
    } catch {
      const r = db.prepare(`INSERT INTO net_worth_snapshots (snapshot_date, notes) VALUES (?,?)`)
        .run(today, req.body.notes||null);
      snapshotId = r.lastInsertRowid;
    }
    res.status(201).json({ id: snapshotId, net_worth: nw });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// TRANSACTION CATEGORIES (for dropdown)
// ══════════════════════════════════════════════════════════════
router.get('/categories', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT category FROM transactions
      WHERE category IS NOT NULL AND category != '' ORDER BY category ASC
    `).all();
    res.json(rows.map(r => r.category));
  } catch (e) { serverError(res, e); }
});


// ── Shared category rule matcher ──────────────────────────────
// Used by import-file and recategorize endpoints
function applyCategoryRules(description) {
  const rules = db.prepare(
    'SELECT pattern, category FROM import_category_rules WHERE is_active=1 ORDER BY sort_order'
  ).all();
  const desc = (description || '').toUpperCase();
  for (const rule of rules) {
    const regex = new RegExp('^' + rule.pattern.replace(/%/g,'.*').replace(/_/g,'.') + '$', 'i');
    if (regex.test(desc)) return rule.category;
  }
  return null;
}

// POST /api/v1/finance/transactions/import-file
//
// Multipart upload: `file` + `account_id`. Uses parsers in
// /features/import/parsers.js (13 banks supported). Writes into
// the unified `transactions` table with source='imported', and
// records a batch row so the import can be rolled back.
//
// Dedup: per-row fingerprint = hash(account_id + date + amount + desc).
//   Layer 1 — exact fingerprint match → skipped.
//   Layer 2 — same account + same date + same amount → flagged
//             (still inserted) and needs_review=1.
//
// Categorization: each row runs through `applyCategoryRules` if
//   the parser didn't already assign a category.
const multerFinance = require('multer')({ storage: require('multer').memoryStorage() });
const { parseFile: parseFinanceFile } = require('../import/parsers');
const crypto = require('crypto');
function fingerprint(accountId, date, amount, description) {
  const key = `${accountId}|${date}|${amount}|${(description || '').trim().toUpperCase()}`;
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

router.post('/transactions/import-file', multerFinance.single('file'), (req, res) => {
  try {
    if (!req.file) return badRequest(res, 'No file uploaded');
    const account_id = parseInt(req.body.account_id) || null;
    if (!account_id) return badRequest(res, 'account_id required');

    // Validation: account must exist and be active
    const acc = db.prepare(`SELECT id, is_active FROM accounts WHERE id=?`).get(account_id);
    if (!acc) return badRequest(res, 'unknown account_id');
    if (!acc.is_active) return badRequest(res, 'account is inactive — reactivate before importing');

    let text = req.file.buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    const ext = require('path').extname(req.file.originalname || '').toLowerCase();
    if (['.xlsx','.xls'].includes(ext)) {
      try {
        const XLSX = require('xlsx');
        const wb = XLSX.read(req.file.buffer);
        text = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      } catch (e) { return badRequest(res, 'Could not read Excel file: ' + e.message); }
    }

    const parsed = parseFinanceFile(text, req.file.originalname || 'upload');
    if (parsed.error) return badRequest(res, parsed.error);

    const txns = parsed.transactions || [];
    if (!txns.length) {
      return res.json({ ok: true, imported: 0, skipped: 0, flagged: 0, format: parsed.format, message: 'No transactions found' });
    }

    // Create batch row in unified import_batches (no CASCADE)
    const batch = db.prepare(`
      INSERT INTO import_batches (account_id, filename, format, row_count)
      VALUES (?, ?, ?, ?)
    `).run(account_id, req.file.originalname || 'upload', parsed.format || 'unknown', txns.length);
    const batchId = batch.lastInsertRowid;

    const checkExact = db.prepare(`SELECT id FROM transactions WHERE fingerprint=?`);
    const checkProbable = db.prepare(`
      SELECT id FROM transactions
      WHERE account_id=? AND date=? AND ABS(amount - ?) < 0.01 AND fingerprint != ?
      LIMIT 1
    `);
    const insert = db.prepare(`
      INSERT INTO transactions
        (account_id, batch_id, date, post_date, description, amount, balance,
         category, txn_type, is_transfer, memo, fingerprint, flagged,
         source, needs_review)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'imported',?)
    `);

    let imported = 0, skipped = 0, flagged = 0;
    const doImport = db.transaction(() => {
      for (const t of txns) {
        if (!t.date || t.amount === null || t.amount === undefined) { skipped++; continue; }

        const fp = fingerprint(account_id, t.date, t.amount, t.description);
        if (checkExact.get(fp)) { skipped++; continue; }

        const probable = checkProbable.get(account_id, t.date, t.amount, fp);
        const isFlag = probable ? 1 : 0;

        const cat = t.category || applyCategoryRules(t.description) || null;
        insert.run(
          account_id, batchId, t.date, t.postDate || null,
          t.description, parseFloat(t.amount) || 0, t.balance || null,
          cat, t.type || 'transaction',
          t.is_transfer ? 1 : 0, t.memo || null,
          fp, isFlag,
          isFlag   // flagged rows also need review
        );
        if (isFlag) flagged++;
        imported++;
      }
    });
    doImport();

    res.json({ ok: true, imported, skipped, flagged, format: parsed.format, total: txns.length, batch_id: batchId });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/finance/import-batches — list import history for rollback
router.get('/import-batches', (req, res) => {
  try {
    const { account_id } = req.query;
    const where = account_id ? 'WHERE b.account_id=?' : '';
    const rows = db.prepare(`
      SELECT b.*, a.name AS account_name, a.alias AS account_alias,
        (SELECT COUNT(*) FROM transactions WHERE batch_id = b.id) AS rows_in_db
      FROM import_batches b
      LEFT JOIN accounts a ON a.id = b.account_id
      ${where}
      ORDER BY b.imported_at DESC
      LIMIT 50
    `).all(...(account_id ? [account_id] : []));
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/finance/import-batches/:id/rollback
//   Removes the batch row and every transaction it inserted.
//   This is the ONLY supported way to remove imported rows in bulk.
//   Manual transactions (source='manual') are never affected.
router.post('/import-batches/:id/rollback', requireAuth, (req, res) => {
  try {
    const batch = db.prepare('SELECT * FROM import_batches WHERE id=?').get(req.params.id);
    if (!batch) return notFound(res);
    let removed = 0;
    db.transaction(() => {
      const r = db.prepare(`DELETE FROM transactions WHERE batch_id=? AND source='imported'`).run(req.params.id);
      removed = r.changes;
      db.prepare('DELETE FROM import_batches WHERE id=?').run(req.params.id);
    })();
    res.json({ ok: true, removed });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/finance/transactions/recategorize
// Body: { overwrite: false } — applies rules to null-category rows (or all if overwrite=true)
router.post('/transactions/recategorize', (req, res) => {
  try {
    const overwrite = req.body?.overwrite === true;
    const where = overwrite
      ? 'WHERE 1=1'
      : `WHERE (category IS NULL OR category = '')`;
    const rows = db.prepare(`SELECT id, description FROM transactions ${where}`).all();
    let updated = 0;
    const upd = db.prepare('UPDATE transactions SET category=? WHERE id=?');
    const doUpdate = db.transaction(() => {
      for (const row of rows) {
        const cat = applyCategoryRules(row.description);
        if (cat) { upd.run(cat, row.id); updated++; }
      }
    });
    doUpdate();
    res.json({ ok: true, updated, total: rows.length });
  } catch(e) { serverError(res, e); }
});

// import-csv route removed — use /transactions/import-file (has batch tracking, dedup, rollback)

// Budgets subrouter
router.use('/budgets', require('./budgets'));

// Reports subrouter
router.use('/reports', require('./reports'));



// ── Recurring Transactions ────────────────────────────────────
const { generatePendingTransactions, calculateNextDate } = require('../../shared/recurring-transactions');
const { getPortfolioPerformance, getAssetAllocation, getTopPerformers, takePortfolioSnapshot } = require('../../shared/portfolio-analytics');

router.get('/recurring', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT rt.*, a.name as account_name, a.alias as account_alias
      FROM recurring_transactions rt
      JOIN accounts a ON a.id = rt.account_id
      WHERE rt.is_active = 1 ORDER BY rt.next_date
    `).all();
    res.json(rows);
  } catch(e) { serverError(res, e); }
});

router.post('/recurring', requireAuth, (req, res) => {
  try {
    const { account_id, description, amount, category, frequency, start_date, end_date, notes } = req.body;
    if (!account_id || !description || !amount || !frequency || !start_date) return badRequest(res, 'Missing required fields');
    const nextDate = calculateNextDate(start_date, frequency);
    const r = db.prepare(`INSERT INTO recurring_transactions (account_id,description,amount,category,frequency,start_date,end_date,next_date,notes) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(account_id, description, amount, category||null, frequency, start_date, end_date||null, nextDate, notes||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch(e) { serverError(res, e); }
});

router.put('/recurring/:id', requireAuth, (req, res) => {
  try {
    const { description, amount, category, frequency, end_date, notes, is_active } = req.body;
    db.prepare(`UPDATE recurring_transactions SET description=COALESCE(?,description), amount=COALESCE(?,amount), category=COALESCE(?,category), frequency=COALESCE(?,frequency), end_date=?, notes=?, is_active=COALESCE(?,is_active), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(description, amount, category, frequency, end_date, notes, is_active, req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/recurring/:id', requireAuth, (req, res) => {
  try {
    db.prepare('UPDATE recurring_transactions SET is_active=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.post('/recurring/generate', requireAuth, (req, res) => {
  try { res.json(generatePendingTransactions()); } catch(e) { serverError(res, e); }
});

// Add PUT for category-rules (was missing)
router.put('/category-rules/:id', requireAuth, (req, res) => {
  try {
    const { pattern, category, priority } = req.body;
    if (!pattern || !category) return badRequest(res, 'pattern and category required');
    db.prepare(`UPDATE import_category_rules SET pattern=?, category=?, priority=COALESCE(?,priority), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(pattern.toUpperCase(), category, priority, req.params.id);
    res.json(db.prepare('SELECT * FROM import_category_rules WHERE id=?').get(req.params.id));
  } catch(e) { serverError(res, e); }
});

// Test a description against rules
router.post('/category-rules/test', (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return badRequest(res, 'description required');
    const rules = db.prepare('SELECT * FROM import_category_rules WHERE is_active=1 ORDER BY priority DESC, sort_order').all();
    for (const rule of rules) {
      const pattern = rule.pattern.replace(/%/g,'.*').replace(/_/g,'.');
      try {
        if (new RegExp(pattern, 'i').test(description)) {
          return res.json({ matched: true, rule_id: rule.id, pattern: rule.pattern, category: rule.category });
        }
      } catch {}
    }
    res.json({ matched: false });
  } catch(e) { serverError(res, e); }
});

// ── Investment Portfolio ──────────────────────────────────────
router.get('/portfolio/performance', (req, res) => {
  try {
    const months = parseInt(req.query.months) || 12;
    res.json({
      performance: getPortfolioPerformance(months),
      allocation:  getAssetAllocation(),
      top_gainers: getTopPerformers(5)
    });
  } catch(e) { serverError(res, e); }
});

router.post('/portfolio/snapshot', requireAuth, (req, res) => {
  try { res.json(takePortfolioSnapshot()); } catch(e) { serverError(res, e); }
});

module.exports = router;
