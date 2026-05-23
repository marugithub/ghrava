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
// FINANCE LANDING AGGREGATOR (v202604.154, replaces tile sample data)
// ══════════════════════════════════════════════════════════════
//
// One round-trip → all 6 Overview tiles. Each tile object is keyed
// for the frontend renderer. Schema is intentionally explicit about
// "no_data" so the UI can distinguish "real value of 0" from "we
// don't know".
//
// Tiles:
//   1. net_worth      — total + assets + liabilities + investment +
//                       MoM delta vs prior snapshot, if any.
//   2. cash_flow      — month-to-date credits, debits, net + same-
//                       day-last-month MTD net for compare ("on track").
//   3. credit_cards   — count, total statement balance, total min
//                       payment, soonest payment_due_date.
//   4. bank_accounts  — count + total of Checking + Savings + Cash.
//   5. holdings       — count of distinct positions + total
//                       market_value across all holdings rows.
//   6. hsa_lp_fsa     — current HSA balance (Checking-style if user
//                       has HSA-type accounts) + LP-FSA plan balance.
//
// All tiles are keyed off active accounts only. needs_review rows
// are excluded from the aggregations to avoid surprising sums.

router.get('/landing', (req, res) => {
  try {
    // ──────────────────────────────────────────────────────────────
    // /landing — payload shape contract (v202604.165, locked v.150)
    //
    // The 6 keys (net_worth, cash_flow, credit_cards, bank_accounts,
    // holdings, hsa_lpfsa) and their inner fields are consumed by the
    // tile renderers in app/public/finance.html which were copied
    // byte-identical from app/public/_templates.html #18. Changing
    // either side requires mirroring on the other.
    //
    // See _templates.html #18 (LOCKED v.150) for the visual spec and
    // empty-state behavior. Missing fields → renderer falls through
    // _emptyTile() with $0 + "empty" pill.
    // ──────────────────────────────────────────────────────────────

    // ── Tile 1: Net Worth ───────────────────────────────────────
    // total_assets = positive balances + investments; total_liabilities
    // = abs(negatives). mom_delta computed against the most recent
    // snapshot ≥ ~25 days old. Sparkline = last value per calendar
    // month from net_worth_snapshots for the last 12 months, ascending.
    const accountsForNw = db.prepare(`
      SELECT id, type, current_balance, include_net_worth
      FROM accounts WHERE is_active=1 AND include_net_worth=1
    `).all();
    const positiveAssets = accountsForNw
      .filter(a => a.current_balance > 0)
      .reduce((s, a) => s + a.current_balance, 0);
    const totalLiabilities = accountsForNw
      .filter(a => a.current_balance < 0)
      .reduce((s, a) => s + Math.abs(a.current_balance), 0);
    let investmentTotal = 0;
    try {
      const r = db.prepare(`SELECT COALESCE(SUM(market_value),0) AS v FROM holdings`).get();
      investmentTotal = r?.v || 0;
    } catch {}
    const totalAssets = positiveAssets + investmentTotal;
    const netWorth    = totalAssets - totalLiabilities;

    let momDelta = null;
    try {
      const prior = db.prepare(`
        SELECT net_worth FROM net_worth_snapshots
        WHERE snapshot_date <= date('now','-25 days')
        ORDER BY snapshot_date DESC LIMIT 1
      `).get();
      if (prior?.net_worth != null) momDelta = netWorth - prior.net_worth;
    } catch {}

    // Sparkline: last value of each of the trailing 12 months.
    // Months with no snapshot are simply absent (no zero-padding —
    // the renderer scales bars from the actual min/max).
    let sparkline = [];
    try {
      const rows = db.prepare(`
        SELECT net_worth FROM (
          SELECT net_worth, snapshot_date,
                 ROW_NUMBER() OVER (
                   PARTITION BY strftime('%Y-%m', snapshot_date)
                   ORDER BY snapshot_date DESC
                 ) AS rn
          FROM net_worth_snapshots
          WHERE snapshot_date >= date('now','start of month','-11 months')
        )
        WHERE rn = 1
        ORDER BY snapshot_date ASC
      `).all();
      sparkline = rows.map(r => r.net_worth).filter(v => v != null);
    } catch {}

    // ── Tile 2: Cash Flow ──────────────────────────────────────
    // mtd_in / mtd_out / mtd_net for current calendar month.
    // prior_month_net = full prior month (NOT same-day MTD). ytd_net
    // = year-to-date. Cash-flow accounts only (Checking/Savings/Cash/
    // Credit), excluding transfers.
    const cfMtd = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS credits,
        COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0) AS debits,
        COALESCE(SUM(amount), 0) AS net
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE a.is_active = 1 AND a.type IN ('Checking','Savings','Cash','Credit')
        AND t.is_transfer = 0
        AND strftime('%Y-%m', t.date) = strftime('%Y-%m','now')
    `).get();
    const cfPriorMonth = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS net
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE a.is_active = 1 AND a.type IN ('Checking','Savings','Cash','Credit')
        AND t.is_transfer = 0
        AND strftime('%Y-%m', t.date) = strftime('%Y-%m', date('now','start of month','-1 day'))
    `).get();
    const cfYtd = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS net
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE a.is_active = 1 AND a.type IN ('Checking','Savings','Cash','Credit')
        AND t.is_transfer = 0
        AND strftime('%Y', t.date) = strftime('%Y','now')
    `).get();

    // v.171 — Tile-2 monthly budget target rollup. Sum of all active
    // per-category budgets for the current year, and total MTD spend
    // (debits only) in those budgeted categories. The Overview tile
    // shows a progress line "spent $X of $Y target" so Al sees the
    // headline at a glance without opening the Budgets tab.
    //
    // schema: budgets.{category, monthly_limit, year, is_active}
    // schema: transactions.{date, amount, category, is_transfer}
    const monthBudgetRow = db.prepare(`
      SELECT COALESCE(SUM(monthly_limit), 0) AS total
      FROM budgets
      WHERE is_active = 1
        AND year = CAST(strftime('%Y','now') AS INTEGER)
    `).get();
    const monthBudgetTotal = monthBudgetRow.total || 0;

    const budgetedSpentRow = db.prepare(`
      SELECT COALESCE(SUM(ABS(t.amount)), 0) AS spent
      FROM transactions t
      WHERE t.is_transfer = 0
        AND t.amount < 0
        AND strftime('%Y-%m', t.date) = strftime('%Y-%m','now')
        AND t.category IN (
          SELECT category FROM budgets
          WHERE is_active = 1
            AND year = CAST(strftime('%Y','now') AS INTEGER)
        )
    `).get();
    const monthBudgetSpent = budgetedSpentRow.spent || 0;
    const monthBudgetPct   = monthBudgetTotal > 0
      ? Math.min(999, Math.round((monthBudgetSpent / monthBudgetTotal) * 100))
      : 0;

    // ── Tile 3: Credit Cards ───────────────────────────────────
    // Top 3 by owed (statement_balance ?? abs(current_balance)),
    // others rolled up. util_pct = whole-percent integer (renderer
    // expects 0–100, not 0–1). next_due = soonest payment_due_date.
    const ccs = db.prepare(`
      SELECT id, name, alias, statement_balance, minimum_payment,
             payment_due_date, credit_limit, current_balance
      FROM accounts
      WHERE is_active = 1 AND type = 'Credit'
    `).all();
    const ccRows = ccs.map(a => ({
      label:        a.alias || a.name,
      owed:         a.statement_balance != null ? a.statement_balance : Math.abs(a.current_balance || 0),
      credit_limit: a.credit_limit || null,
      min_payment:  a.minimum_payment || 0,
      due:          a.payment_due_date || null,
    })).map(r => ({
      ...r,
      util: (r.credit_limit > 0) ? Math.round((r.owed / r.credit_limit) * 100) : null,
    })).sort((a, b) => b.owed - a.owed);
    const ccCount     = ccRows.length;
    const ccTotalOwed = ccRows.reduce((s, r) => s + r.owed, 0);
    const ccTotalLimit = ccRows.reduce((s, r) => s + (r.credit_limit || 0), 0);
    const ccUtilPct   = ccTotalLimit > 0 ? Math.round((ccTotalOwed / ccTotalLimit) * 100) : null;
    const ccTop       = ccRows.slice(0, 3).map(r => ({ label: r.label, owed: r.owed, util: r.util }));
    const ccOthers    = ccRows.slice(3);
    const ccSoonest   = ccRows
      .filter(r => r.due)
      .sort((a, b) => new Date(a.due) - new Date(b.due))[0] || null;
    let ccNextDue = null;
    if (ccSoonest) {
      const due  = new Date(ccSoonest.due + 'T00:00:00');
      const now  = new Date(); now.setHours(0,0,0,0);
      const days = Math.round((due - now) / 86400000);
      ccNextDue  = { days, min_payment: ccSoonest.min_payment || 0 };
    }

    // ── Tile 4: Bank Accounts ──────────────────────────────────
    // liquid_total = Checking + Savings + Cash. checking_total /
    // savings_total broken out for rows. Stale = balance_as_of older
    // than 14 days (or NULL). stale_oldest_days = days since the
    // oldest stale account's balance_as_of (null if none stale).
    const STALE_DAYS = 14;
    const banks = db.prepare(`
      SELECT id, name, alias, type, current_balance, balance_as_of
      FROM accounts
      WHERE is_active = 1 AND type IN ('Checking','Savings','Cash')
    `).all();
    const bankCount    = banks.length;
    const liquidTotal  = banks.reduce((s, a) => s + (a.current_balance || 0), 0);
    const checkingTotal = banks.filter(a => a.type === 'Checking').reduce((s, a) => s + (a.current_balance || 0), 0);
    const savingsTotal  = banks.filter(a => a.type === 'Savings').reduce((s, a) => s + (a.current_balance || 0), 0);
    const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
    const banksWithStale = banks.map(a => {
      if (!a.balance_as_of) return { ...a, _staleDays: null };
      const t = new Date(a.balance_as_of + 'T00:00:00').getTime();
      return { ...a, _staleDays: Math.round((todayMs - t) / 86400000) };
    });
    const staleAccts = banksWithStale
      .filter(a => a._staleDays != null && a._staleDays > STALE_DAYS)
      .sort((a, b) => b._staleDays - a._staleDays);
    const staleCount  = staleAccts.length;
    const staleOldest = staleAccts[0] || null;

    // ── Tile 5: Holdings ───────────────────────────────────────
    // Top 3 positions by market_value. gain_pct per position uses
    // gain_loss_pct if stored, else computes from cost_basis. Roll
    // overall gain_pct from totals (mv − cb) / cb × 100.
    let holdingsRows = [];
    try {
      holdingsRows = db.prepare(`
        SELECT h.symbol, h.market_value, h.total_cost_basis, h.cost_basis,
               h.shares, h.gain_loss_pct
        FROM holdings h
        JOIN accounts a ON a.id = h.account_id
        WHERE a.is_active = 1
      `).all();
    } catch {}
    const holdingsCount     = holdingsRows.length;
    const holdingsMarketVal = holdingsRows.reduce((s, h) => s + (h.market_value || 0), 0);
    const holdingsCostBasis = holdingsRows.reduce((s, h) => {
      if (h.total_cost_basis != null) return s + h.total_cost_basis;
      if (h.cost_basis != null && h.shares != null) return s + (h.cost_basis * h.shares);
      return s;
    }, 0);
    const holdingsGainPct = holdingsCostBasis > 0
      ? ((holdingsMarketVal - holdingsCostBasis) / holdingsCostBasis) * 100
      : null;
    const holdingsSorted = holdingsRows.slice().sort((a, b) => (b.market_value || 0) - (a.market_value || 0));
    const holdingsTop = holdingsSorted.slice(0, 3).map(h => {
      let gp = h.gain_loss_pct;
      if (gp == null && h.total_cost_basis > 0 && h.market_value != null) {
        gp = ((h.market_value - h.total_cost_basis) / h.total_cost_basis) * 100;
      }
      return { symbol: h.symbol, market_value: h.market_value || 0, gain_pct: gp != null ? +gp.toFixed(1) : null };
    });
    const holdingsOthers = holdingsSorted.slice(3);
    const holdingsOthersValue = holdingsOthers.reduce((s, h) => s + (h.market_value || 0), 0);

    // ── Tile 6: HSA + LP-FSA (UNREIMBURSED RECEIPT POOL) ────────
    // This is the tax-free withdrawal pool, NOT the HSA account
    // balance. Counts and sums unreimbursed hsa_payments and
    // fsa_payments. lpfsa_deadline_days computed from current-year
    // fsa_plan_info.deadline_date.
    let hsaPool = 0, hsaCount = 0, lpfsaPool = 0, lpfsaCount = 0, lpfsaDeadlineDays = null;
    try {
      const r = db.prepare(`
        SELECT COUNT(*) AS n, COALESCE(SUM(you_paid),0) AS v
        FROM hsa_payments
        WHERE hsa_eligible = 1 AND (reimbursed IS NULL OR reimbursed = 0)
      `).get();
      hsaCount = r?.n || 0;
      hsaPool  = r?.v || 0;
    } catch {}
    try {
      const r = db.prepare(`
        SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS v
        FROM fsa_payments
        WHERE (reimbursed IS NULL OR reimbursed = 0)
      `).get();
      lpfsaCount = r?.n || 0;
      lpfsaPool  = r?.v || 0;
    } catch {}
    try {
      const yr = new Date().getFullYear();
      const r = db.prepare(`
        SELECT deadline_date FROM fsa_plan_info
        WHERE year = ? AND (active IS NULL OR active = 1)
        ORDER BY id DESC LIMIT 1
      `).get(yr);
      if (r?.deadline_date) {
        const deadline = new Date(r.deadline_date + 'T00:00:00');
        const now = new Date(); now.setHours(0,0,0,0);
        const d = Math.round((deadline - now) / 86400000);
        if (d >= 0) lpfsaDeadlineDays = d;
      }
    } catch {}

    res.json({
      generated_at: new Date().toISOString(),
      net_worth: {
        total:              netWorth,
        total_assets:       totalAssets,
        total_liabilities:  totalLiabilities,
        mom_delta:          momDelta,
        sparkline:          sparkline,
      },
      cash_flow: {
        mtd_net:            cfMtd.net,
        mtd_in:             cfMtd.credits,
        mtd_out:            Math.abs(cfMtd.debits),
        prior_month_net:    cfPriorMonth.net,
        ytd_net:            cfYtd.net,
        // v.171 — monthly budget target rollup (Tile-2)
        budget_target:      monthBudgetTotal,
        budget_spent:       monthBudgetSpent,
        budget_pct:         monthBudgetPct,
      },
      credit_cards: {
        count:              ccCount,
        total_owed:         ccTotalOwed,
        util_pct:           ccUtilPct,
        top:                ccTop,
        others_count:       ccOthers.length,
        others_owed:        ccOthers.reduce((s, r) => s + r.owed, 0),
        next_due:           ccNextDue,
      },
      bank_accounts: {
        count:              bankCount,
        liquid_total:       liquidTotal,
        checking_total:     checkingTotal,
        savings_total:      savingsTotal,
        stale_count:        staleCount,
        stale_label:        staleOldest ? (staleOldest.alias || staleOldest.name) : null,
        stale_oldest_days:  staleOldest ? staleOldest._staleDays : null,
      },
      holdings: {
        count:              holdingsCount,
        market_value:       holdingsMarketVal,
        cost_basis:         holdingsCostBasis,
        gain_pct:           holdingsGainPct != null ? +holdingsGainPct.toFixed(1) : null,
        top:                holdingsTop,
        others_count:       holdingsOthers.length,
        others_value:       holdingsOthersValue,
      },
      hsa_lpfsa: {
        total_pool:         hsaPool + lpfsaPool,
        hsa_count:          hsaCount,
        hsa_pool:           hsaPool,
        lpfsa_count:        lpfsaCount,
        lpfsa_pool:         lpfsaPool,
        lpfsa_deadline_days: lpfsaDeadlineDays,
      },
    });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// NEEDS REVIEW (v202604.152)
// ══════════════════════════════════════════════════════════════
// Returns a single payload listing every account + transaction
// flagged with needs_review=1. Drives the banner/queue on
// /finance.html. Saving an account or transaction (PUT) implicitly
// clears the flag — see saveAccount / saveTransaction.
//
// Counts ignore inactive accounts so deactivated rows don't keep
// nagging. The transactions list caps at 200 to keep payload small;
// the count field tells the UI when there are more.

router.get('/needs-review', (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, name, alias, type, institution, last4, source,
             current_balance, balance_as_of
      FROM accounts
      WHERE needs_review = 1 AND is_active = 1
      ORDER BY id ASC
    `).all();

    const txns = db.prepare(`
      SELECT t.id, t.account_id, t.date, t.description, t.amount,
             t.category, t.source, t.flagged,
             a.name AS account_name, a.alias AS account_alias
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE t.needs_review = 1 AND a.is_active = 1
      ORDER BY t.date DESC, t.id DESC
      LIMIT 200
    `).all();

    const txnCount = db.prepare(`
      SELECT COUNT(*) AS n
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      WHERE t.needs_review = 1 AND a.is_active = 1
    `).get()?.n || 0;

    res.json({
      accounts,
      transactions: txns,
      counts: {
        accounts:     accounts.length,
        transactions: txnCount,
        total:        accounts.length + txnCount,
      },
    });
  } catch (e) { serverError(res, e); }
});

// Clear a transaction's needs_review without going through PUT.
// (PUT requires every field; this is a one-tap "looks fine".)
router.post('/transactions/:id/clear-review', requireAuth, (req, res) => {
  try {
    const r = db.prepare(
      `UPDATE transactions SET needs_review=0 WHERE id=?`
    ).run(req.params.id);
    if (!r.changes) return notFound(res, 'Transaction');
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// Same for accounts.
router.post('/accounts/:id/clear-review', requireAuth, (req, res) => {
  try {
    const r = db.prepare(
      `UPDATE accounts SET needs_review=0, updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(req.params.id);
    if (!r.changes) return notFound(res, 'Account');
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

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
         track_statements, notes, sort_order, source, needs_review,
         credit_limit, statement_balance, minimum_payment,
         payment_due_date, apr, promo_apr, promo_end_date,
         annual_fee, annual_fee_renewal_date, rewards_balance,
         tax_treatment)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?,?,?,?,?)
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
      0,
      // CC-specific (mig 128) — all optional
      d.credit_limit            !== undefined && d.credit_limit            !== '' ? parseFloat(d.credit_limit)            : null,
      d.statement_balance       !== undefined && d.statement_balance       !== '' ? parseFloat(d.statement_balance)       : null,
      d.minimum_payment         !== undefined && d.minimum_payment         !== '' ? parseFloat(d.minimum_payment)         : null,
      d.payment_due_date        || null,
      d.apr                     !== undefined && d.apr                     !== '' ? parseFloat(d.apr)                     : null,
      d.promo_apr               !== undefined && d.promo_apr               !== '' ? parseFloat(d.promo_apr)               : null,
      d.promo_end_date          || null,
      d.annual_fee              !== undefined && d.annual_fee              !== '' ? parseFloat(d.annual_fee)              : null,
      d.annual_fee_renewal_date || null,
      d.rewards_balance         !== undefined && d.rewards_balance         !== '' ? parseFloat(d.rewards_balance)         : null,
      d.tax_treatment || 'taxable',
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

    // Helper: parse numeric field iff sent. '' clears the column.
    const num = (key) => {
      if (!(key in d)) return existing[key];
      if (d[key] === '' || d[key] === null) return null;
      const n = parseFloat(d[key]);
      return isFinite(n) ? n : existing[key];
    };
    // Helper: pass-through string/date field iff sent. '' clears.
    const str = (key) => {
      if (!(key in d)) return existing[key];
      return d[key] === '' ? null : d[key];
    };

    db.prepare(`
      UPDATE accounts SET
        name=?, alias=?, type=?, institution=?, last4=?, owner=?, currency=?,
        current_balance=?, balance_as_of=?, include_net_worth=?,
        track_statements=?, notes=?, sort_order=?, needs_review=?,
        credit_limit=?, statement_balance=?, minimum_payment=?,
        payment_due_date=?, apr=?, promo_apr=?, promo_end_date=?,
        annual_fee=?, annual_fee_renewal_date=?, rewards_balance=?,
        tax_treatment=?,
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
      // CC-specific (mig 128)
      num('credit_limit'),
      num('statement_balance'),
      num('minimum_payment'),
      str('payment_due_date'),
      num('apr'),
      num('promo_apr'),
      str('promo_end_date'),
      num('annual_fee'),
      str('annual_fee_renewal_date'),
      num('rewards_balance'),
      d.tax_treatment !== undefined ? d.tax_treatment : (existing.tax_treatment || 'taxable'),
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

    // v202604.181 — category-change auto-link trigger (#27.1 + #27.2).
    // Import-path triggers were wired in v.167 (see /transactions/import-
    // file). This closes the "user re-categorizes an existing txn to
    // medical" path. Both linkers check for existing record_links rows
    // before creating, so re-firing on repeated edits is safe.
    const newCategory     = d.category !== undefined ? d.category : existing.category;
    const categoryChanged = d.category !== undefined && d.category !== existing.category;
    const isMedical       = typeof newCategory === 'string' && newCategory.toLowerCase() === 'medical';
    if (categoryChanged && isMedical) {
      const txnId = parseInt(req.params.id);
      try { autoLinkHsa.processTransaction(txnId); }
      catch (e) { console.warn('[auto-link-hsa]', e.message); }
      try { autoLinkMedicalVisit.processTransaction(txnId); }
      catch (e) { console.warn('[auto-link-visit]', e.message); }
    }

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
// Dedup (v.153, mig 127):
//   The fingerprint = hash(account_id, date, amount, NORMALIZED_desc)
//   where the normalizer strips trailing reference IDs ("AMAZON.COM
//   *1A2B3C" → "AMAZON.COM"). Same merchant/amount/date now collides
//   even when the bank rotates ref IDs.
//
//   Layer 1 — exact fingerprint match → silent skip. (Same merchant,
//             same amount, same day → already in DB.)
//   Layer 2 — same account, ±$0.01 amount, same normalized desc,
//             ±5 day window → flagged + needs_review (pending → posted
//             scenario; user resolves in needs-review queue).
//
// Categorization: each row runs through `applyCategoryRules` if the
//   parser didn't already assign a category.
const multerFinance = require('multer')({ storage: require('multer').memoryStorage() });
const { parseFile: parseFinanceFile } = require('../import/parsers');
const { fingerprint, normalizeDescription } = require('../../shared/tx-fingerprint');
const { autoLinkTransaction } = require('../../shared/auto-link-subscriptions');
// v202604.167 — additional auto-linkers (#27.1, #27.2, #27.4)
const autoLinkHsa            = require('../../shared/auto-link-hsa');
const autoLinkMedicalVisit   = require('../../shared/auto-link-medical-visit');
const autoLinkSubCategory    = require('../../shared/auto-link-subscription-category');

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
    // schema: import_batches.{account_id, filename, format, row_count}
    // v.170.1: reverted from rows_total — prod column is `row_count`
    const batch = db.prepare(`
      INSERT INTO import_batches (account_id, filename, format, row_count)
      VALUES (?, ?, ?, ?)
    `).run(account_id, req.file.originalname || 'upload', parsed.format || 'unknown', txns.length);
    const batchId = batch.lastInsertRowid;

    const checkExact = db.prepare(`SELECT id FROM transactions WHERE fingerprint=?`);
    // Window check joins on normalized desc — we precompute the
    // normalized form via fingerprint hash equivalence: a row in DB
    // shares our normalized desc iff its fingerprint equals the
    // fingerprint we'd produce on its own date. Cheaper to just match
    // amount + 5-day window + a precomputed norm string. SQLite
    // doesn't have a fast way to call a JS function, so we do the
    // norm filter in JS after a coarse SQL prefilter.
    const coarseWindow = db.prepare(`
      SELECT id, date, description
      FROM transactions
      WHERE account_id = ?
        AND ABS(amount - ?) < 0.01
        AND ABS(julianday(date) - julianday(?)) <= 5
        AND fingerprint != ?
    `);

    const insert = db.prepare(`
      INSERT INTO transactions
        (account_id, batch_id, date, post_date, description, amount, balance,
         category, txn_type, is_transfer, memo, fingerprint, flagged,
         source, needs_review)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'imported',?)
    `);

    let imported = 0, skipped = 0, flagged = 0, autoLinked = 0;
    const doImport = db.transaction(() => {
      for (const t of txns) {
        if (!t.date || t.amount === null || t.amount === undefined) { skipped++; continue; }

        const fp = fingerprint(account_id, t.date, t.amount, t.description);
        if (checkExact.get(fp)) { skipped++; continue; }

        // 5-day window check: any existing row in the window with the
        // same normalized description? If yes, this is likely a
        // pending → posted shift; flag for review rather than silent
        // skip (because the date moved, the user might want to keep
        // both temporarily and resolve later).
        const targetNorm = normalizeDescription(t.description);
        const candidates = coarseWindow.all(account_id, t.amount, t.date, fp);
        const isFlag = candidates.some(c => normalizeDescription(c.description) === targetNorm) ? 1 : 0;

        const cat = t.category || applyCategoryRules(t.description) || null;
        const result = insert.run(
          account_id, batchId, t.date, t.postDate || null,
          t.description, parseFloat(t.amount) || 0, t.balance || null,
          cat, t.type || 'transaction',
          t.is_transfer ? 1 : 0, t.memo || null,
          fp, isFlag,
          isFlag   // flagged rows also need review
        );
        if (isFlag) flagged++;
        imported++;

        // Auto-link to matching subscription (v.157). Best-effort,
        // inside the same transaction so a link failure rolls back
        // alongside its parent import (rare, but consistent).
        try {
          autoLinked += autoLinkTransaction(result.lastInsertRowid, {
            amount: t.amount,
            description: t.description,
            is_transfer: t.is_transfer,
          });
        } catch (e) { /* logged inside helper */ }

        // v202604.167 — additional auto-linkers (#27.1, #27.2, #27.4)
        // All best-effort, errors logged but never block the import.
        try { autoLinkHsa.processTransaction(result.lastInsertRowid); }
        catch (e) { console.warn('[auto-link-hsa]', e.message); }
        try { autoLinkMedicalVisit.processTransaction(result.lastInsertRowid); }
        catch (e) { console.warn('[auto-link-visit]', e.message); }
        try { autoLinkSubCategory.applyOne(result.lastInsertRowid); }
        catch (e) { console.warn('[auto-link-sub-cat]', e.message); }
      }
    });
    doImport();

    res.json({ ok: true, imported, skipped, flagged, auto_linked: autoLinked, format: parsed.format, total: txns.length, batch_id: batchId });
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

// Forecast subrouter (v.169) — cash-flow projection from recurring_transactions
router.use('/forecast', require('./forecast'));



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
    // schema: import_category_rules.pattern, .category, .priority (no updated_at column)
    db.prepare(`UPDATE import_category_rules SET pattern=?, category=?, priority=COALESCE(?,priority) WHERE id=?`)
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

// ══════════════════════════════════════════════════════════════
// RECORD LINKS (v202604.157, mig 129)
// ══════════════════════════════════════════════════════════════
//
// Polymorphic link table. Used by the "All" tab on finance to show
// per-transaction context (subscriptions paid, EOBs reimbursed,
// medical visits attached, etc.).
//
// Type vocabulary (locked v.157; eob table corrected v.169):
//   'transaction'     transactions
//   'subscription'    subscriptions
//   'medical_visit'   med_visit_notes
//   'hsa_payment'     hsa_payments
//   'eob'             med_eob_statements
//   'document'        documents
//
// Adding a new type is a one-line addition to LINK_TYPES on
// frontend + backend; no schema change required.

const LINK_TYPES = new Set([
  'transaction','subscription','medical_visit','hsa_payment','eob','document'
]);

// Display-name resolver for each type. Returns {label, sub, href}.
// Falls back gracefully if a table is missing on older installs.
function resolveLinkLabel(type, id) {
  try {
    switch (type) {
      case 'transaction': {
        const r = db.prepare(`
          SELECT date, description, amount FROM transactions WHERE id=?
        `).get(id);
        return r ? {
          label: r.description || '(no description)',
          sub: `${r.date} · $${Number(r.amount||0).toFixed(2)}`,
          href: `/finance.html#transactions`,
        } : null;
      }
      case 'subscription': {
        // schema: subscriptions.name, .cost (canonical per mig 109b — also `monthly_cost` on prod)
        const r = db.prepare(`
          SELECT name, cost FROM subscriptions WHERE id=?
        `).get(id);
        return r ? {
          label: r.name,
          sub: r.cost != null ? `$${Number(r.cost).toFixed(2)}/mo` : null,
          href: `/subscriptions.html`,
        } : null;
      }
      case 'medical_visit': {
        // schema: med_visit_notes.visit_date, .patient, .physician_contact_id (no `provider` col)
        // join to contacts.name when physician_contact_id is set, else fall back to visit_type/reason
        const r = db.prepare(`
          SELECT v.visit_date, v.patient, v.visit_type, v.reason,
                 c.name AS provider_name
          FROM med_visit_notes v
          LEFT JOIN contacts c ON c.id = v.physician_contact_id
          WHERE v.id=?
        `).get(id);
        if (!r) return null;
        const provider = r.provider_name || r.visit_type || r.reason || '';
        return {
          label: `${r.patient || ''}${provider ? ' — ' + provider : ''}`.trim(),
          sub: r.visit_date,
          href: `/medical.html`,
        };
      }
      case 'hsa_payment': {
        // schema: hsa_payments.date, .provider, .you_paid (no `amount` col)
        const r = db.prepare(`
          SELECT date, provider, you_paid FROM hsa_payments WHERE id=?
        `).get(id);
        return r ? {
          label: r.provider || '(HSA expense)',
          sub: `${r.date} · $${Number(r.you_paid||0).toFixed(2)}`,
          href: `/hsa.html`,
        } : null;
      }
      case 'eob': {
        // schema: table is `med_eob_statements` (no `eobs` table).
        // Columns: insurer, plan_name, member_name, statement_date, period_start, period_end, your_share_total
        const r = db.prepare(`
          SELECT insurer, plan_name, member_name, statement_date, period_start, period_end
          FROM med_eob_statements WHERE id=?
        `).get(id);
        if (!r) return null;
        return {
          label: r.insurer || r.plan_name || r.member_name || '(EOB)',
          sub: r.statement_date || r.period_start || r.period_end,
          href: `/medical.html`,
        };
      }
      case 'document': {
        const r = db.prepare(`SELECT title, category FROM documents WHERE id=?`).get(id);
        return r ? {
          label: r.title,
          sub: r.category,
          href: `/documents.html`,
        } : null;
      }
      default: return null;
    }
  } catch (e) { return null; }
}

// GET /api/v1/finance/links?type=transaction&id=42
// Returns all links touching a record, regardless of which side it's
// stored on. Hydrates the other side's display info.
router.get('/links', (req, res) => {
  try {
    const type = String(req.query.type || '');
    const id   = parseInt(req.query.id);
    if (!LINK_TYPES.has(type) || !id) return badRequest(res, 'type + id required');

    // Bidirectional lookup. Two queries because UNION ALL with
    // CASE columns is ugly here.
    const fromLeft = db.prepare(`
      SELECT id, right_type AS other_type, right_id AS other_id,
             link_kind, notes, created_at
      FROM record_links WHERE left_type=? AND left_id=?
    `).all(type, id);
    const fromRight = db.prepare(`
      SELECT id, left_type AS other_type, left_id AS other_id,
             link_kind, notes, created_at
      FROM record_links WHERE right_type=? AND right_id=?
    `).all(type, id);

    const rows = [...fromLeft, ...fromRight]
      .map(r => ({
        link_id:    r.id,
        other_type: r.other_type,
        other_id:   r.other_id,
        link_kind:  r.link_kind,
        notes:      r.notes,
        created_at: r.created_at,
        display:    resolveLinkLabel(r.other_type, r.other_id),
      }))
      .filter(r => r.display);  // drop orphans (deleted records)

    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/finance/links  (auth)
// Body: { left_type, left_id, right_type, right_id, link_kind?, notes? }
router.post('/links', requireAuth, (req, res) => {
  try {
    const d = req.body || {};
    if (!LINK_TYPES.has(d.left_type) || !LINK_TYPES.has(d.right_type))
      return badRequest(res, 'invalid type');
    const lid = parseInt(d.left_id), rid = parseInt(d.right_id);
    if (!lid || !rid) return badRequest(res, 'left_id + right_id required');
    if (d.left_type === d.right_type && lid === rid)
      return badRequest(res, 'cannot link a record to itself');

    // Canonicalize: sort by (type, id) so symmetric links don't dup.
    // We compare as composite tuples by type then id, so type sort
    // is alphabetical; ties broken by id.
    let lt = d.left_type, li = lid, rt = d.right_type, ri = rid;
    if (lt > rt || (lt === rt && li > ri)) {
      [lt, rt] = [rt, lt]; [li, ri] = [ri, li];
    }

    const kind = d.link_kind || 'manual';
    try {
      const r = db.prepare(`
        INSERT INTO record_links (left_type, left_id, right_type, right_id, link_kind, notes)
        VALUES (?,?,?,?,?,?)
      `).run(lt, li, rt, ri, kind, d.notes || null);
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) {
      // UNIQUE constraint: link already exists. Treat as success
      // (idempotent semantics for manual linking via UI).
      if (/UNIQUE constraint/i.test(e.message)) {
        const ex = db.prepare(`
          SELECT id FROM record_links
          WHERE left_type=? AND left_id=? AND right_type=? AND right_id=? AND link_kind=?
        `).get(lt, li, rt, ri, kind);
        return res.status(200).json({ id: ex?.id, already_exists: true });
      }
      throw e;
    }
  } catch (e) { serverError(res, e); }
});

router.delete('/links/:id', requireAuth, (req, res) => {
  try {
    const r = db.prepare(`DELETE FROM record_links WHERE id=?`).run(req.params.id);
    if (r.changes === 0) return notFound(res, 'Link');
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// /api/v1/finance/all — unified feed for the "All" tab
// ══════════════════════════════════════════════════════════════
//
// Returns recent transactions with their record_links inline (count
// + thumbnails of up to 3 linked records). The feed is paged by
// date DESC; the frontend asks for `?before=YYYY-MM-DD&limit=100`.
//
// This is read-only and intentionally not filtered by source/type —
// the "All" view is the place where everything financial shows up.
//
// Each row carries `link_count` and `links[]` (top 3 by recency).
// The UI shows the count as a badge; expanding the row hits
// GET /links for the full list.
router.get('/all', (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 100, 500);
    const before = req.query.before || null;

    const txns = before
      ? db.prepare(`
          SELECT t.id, t.date, t.description, t.amount, t.category,
                 t.source, t.is_transfer, t.needs_review,
                 t.account_id,
                 COALESCE(a.alias, a.name) AS account_name
          FROM transactions t
          LEFT JOIN accounts a ON a.id = t.account_id
          WHERE t.date < ?
          ORDER BY t.date DESC, t.id DESC LIMIT ?
        `).all(before, limit)
      : db.prepare(`
          SELECT t.id, t.date, t.description, t.amount, t.category,
                 t.source, t.is_transfer, t.needs_review,
                 t.account_id,
                 COALESCE(a.alias, a.name) AS account_name
          FROM transactions t
          LEFT JOIN accounts a ON a.id = t.account_id
          ORDER BY t.date DESC, t.id DESC LIMIT ?
        `).all(limit);

    if (!txns.length) return res.json({ items: [], next_before: null });

    // Bulk link fetch — one query for all transactions in the page.
    const ids = txns.map(t => t.id);
    const placeholders = ids.map(() => '?').join(',');
    const links = db.prepare(`
      SELECT id, left_type, left_id, right_type, right_id, link_kind, created_at
      FROM record_links
      WHERE (left_type='transaction'  AND left_id  IN (${placeholders}))
         OR (right_type='transaction' AND right_id IN (${placeholders}))
      ORDER BY created_at DESC
    `).all(...ids, ...ids);

    // Group by txn id.
    const byTxn = new Map();
    for (const l of links) {
      const txnId    = l.left_type  === 'transaction' ? l.left_id    : l.right_id;
      const otherTy  = l.left_type  === 'transaction' ? l.right_type : l.left_type;
      const otherId  = l.left_type  === 'transaction' ? l.right_id   : l.left_id;
      if (!byTxn.has(txnId)) byTxn.set(txnId, []);
      byTxn.get(txnId).push({
        link_id:    l.id,
        other_type: otherTy,
        other_id:   otherId,
        link_kind:  l.link_kind,
        // resolveLinkLabel is N+1 but capped by `limit * 3` worst case
        // — at 500 transactions × 3 links = 1500 hits, ms-scale.
        display:    resolveLinkLabel(otherTy, otherId),
      });
    }

    const items = txns.map(t => {
      const all = (byTxn.get(t.id) || []).filter(l => l.display);
      return {
        ...t,
        link_count: all.length,
        links:      all.slice(0, 3),
      };
    });

    const last = txns[txns.length - 1];
    res.json({
      items,
      next_before: last ? last.date : null,
    });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
