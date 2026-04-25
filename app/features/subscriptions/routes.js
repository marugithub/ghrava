'use strict';
/**
 * features/subscriptions/routes.js
 * Recurring costs tracker.
 * Mounted at /api/v1/subscriptions
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { serverError, badRequest, notFound } = require('../../shared/errors');

// ── List ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    let where = '1=1';
    const params = [];
    if (status && status !== 'all') { where += ' AND s.status=?'; params.push(status); }

    const rows = db.prepare(`
      SELECT s.*,
        c.name AS provider_name,
        fa.name AS account_name
      FROM subscriptions s
      LEFT JOIN contacts c ON c.id = s.provider_contact_id
      LEFT JOIN finance_accounts fa ON fa.id = s.finance_account_id
      WHERE ${where}
      ORDER BY s.next_billing_date ASC, s.name
    `).all(...params);

    // Attach family members
    const memStmt = db.prepare(`
      SELECT sm.family_member_id, fm.display_name
      FROM subscription_members sm
      JOIN family_members fm ON fm.id = sm.family_member_id
      WHERE sm.subscription_id = ?
    `);
    rows.forEach(r => { r.members = memStmt.all(r.id); });

    res.json(rows);
  } catch(e) { serverError(res, e); }
});

// ── Summary (for reports) ────────────────────────────────────
router.get('/summary', (req, res) => {
  try {
    const active = db.prepare("SELECT * FROM subscriptions WHERE status='active'").all();

    let monthly = 0, annual = 0;
    active.forEach(s => {
      const cost = s.cost || 0;
      if (s.billing_cycle === 'monthly')   { monthly += cost; annual += cost * 12; }
      else if (s.billing_cycle === 'annual') { monthly += cost / 12; annual += cost; }
      else if (s.billing_cycle === 'weekly') { monthly += cost * 4.33; annual += cost * 52; }
      else if (s.billing_cycle === 'quarterly') { monthly += cost / 3; annual += cost * 4; }
    });

    // By category
    const byCategory = {};
    active.forEach(s => {
      const cat = s.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = { count: 0, monthly: 0 };
      byCategory[cat].count++;
      const cost = s.cost || 0;
      if (s.billing_cycle === 'monthly') byCategory[cat].monthly += cost;
      else if (s.billing_cycle === 'annual') byCategory[cat].monthly += cost / 12;
      else if (s.billing_cycle === 'weekly') byCategory[cat].monthly += cost * 4.33;
      else if (s.billing_cycle === 'quarterly') byCategory[cat].monthly += cost / 3;
    });

    // Upcoming renewals (next 30 days)
    const soon = new Date(); soon.setDate(soon.getDate() + 30);
    const upcoming = active.filter(s =>
      s.next_billing_date && s.next_billing_date <= soon.toISOString().slice(0,10) &&
      s.next_billing_date >= new Date().toISOString().slice(0,10)
    );

    res.json({
      total_active: active.length,
      monthly_cost: Math.round(monthly * 100) / 100,
      annual_cost:  Math.round(annual  * 100) / 100,
      by_category: byCategory,
      upcoming_renewals: upcoming,
    });
  } catch(e) { serverError(res, e); }
});

// ── CRUD ─────────────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const result = db.prepare(`
      INSERT INTO subscriptions
        (name, category, cost, billing_cycle, next_billing_date, auto_renew,
         finance_account_id, provider_contact_id, status, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.name.trim(), d.category||null, d.cost||null,
      d.billing_cycle||'monthly', d.next_billing_date||null,
      d.auto_renew !== false ? 1 : 0,
      d.finance_account_id||null, d.provider_contact_id||null,
      d.status||'active', d.notes||null
    );
    const id = result.lastInsertRowid;
    if (Array.isArray(d.family_member_ids) && d.family_member_ids.length) {
      const stmt = db.prepare('INSERT INTO subscription_members (subscription_id,family_member_id) VALUES (?,?)');
      d.family_member_ids.forEach(mid => stmt.run(id, mid));
    }
    res.json({ id, ok: true });
  } catch(e) { serverError(res, e); }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE subscriptions SET
        name=?, category=?, cost=?, billing_cycle=?, next_billing_date=?,
        auto_renew=?, finance_account_id=?, provider_contact_id=?, status=?, notes=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.name?.trim(), d.category||null, d.cost||null,
      d.billing_cycle||'monthly', d.next_billing_date||null,
      d.auto_renew !== false ? 1 : 0,
      d.finance_account_id||null, d.provider_contact_id||null,
      d.status||'active', d.notes||null,
      req.params.id
    );
    // Replace members
    db.prepare('DELETE FROM subscription_members WHERE subscription_id=?').run(req.params.id);
    if (Array.isArray(d.family_member_ids) && d.family_member_ids.length) {
      const stmt = db.prepare('INSERT INTO subscription_members (subscription_id,family_member_id) VALUES (?,?)');
      d.family_member_ids.forEach(mid => stmt.run(req.params.id, mid));
    }
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM subscription_members WHERE subscription_id=?').run(req.params.id);
    db.prepare('DELETE FROM subscriptions WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
