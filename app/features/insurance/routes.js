'use strict';
/**
 * features/insurance/routes.js
 * Insurance policy tracker with renewal chain history.
 * Mounted at /api/v1/insurance
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { serverError, badRequest, notFound } = require('../../shared/errors');

// ── List ─────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, type } = req.query;
    let where = '1=1';
    const params = [];
    if (status && status !== 'all') { where += ' AND p.status=?'; params.push(status); }
    if (type)   { where += ' AND p.policy_type=?'; params.push(type); }

    const rows = db.prepare(`
      SELECT p.*,
        prov.name AS provider_name,
        agent.name AS agent_name,
        v.year || ' ' || v.make || ' ' || v.model AS vehicle_name,
        prop.address_street AS property_name
      FROM insurance_policies p
      LEFT JOIN contacts prov  ON prov.id  = p.provider_contact_id
      LEFT JOIN contacts agent ON agent.id = p.agent_contact_id
      LEFT JOIN vehicles v     ON v.id     = p.vehicle_id
      LEFT JOIN properties prop ON prop.id = p.property_id
      WHERE ${where}
      ORDER BY p.coverage_end_date ASC, p.policy_type
    `).all(...params);

    // Attach members
    const memStmt = db.prepare(`
      SELECT pm.family_member_id, fm.display_name
      FROM insurance_policy_members pm
      JOIN family_members fm ON fm.id = pm.family_member_id
      WHERE pm.policy_id = ?
    `);
    rows.forEach(r => { r.members = memStmt.all(r.id); });

    res.json(rows);
  } catch(e) { serverError(res, e); }
});

// ── Policy chain (all records for same group) ────────────────
router.get('/chain/:group_id', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.*, prov.name AS provider_name
      FROM insurance_policies p
      LEFT JOIN contacts prov ON prov.id = p.provider_contact_id
      WHERE p.policy_group_id = ?
      ORDER BY p.coverage_start_date DESC
    `).all(req.params.group_id);
    res.json(rows);
  } catch(e) { serverError(res, e); }
});

// ── Summary ───────────────────────────────────────────────────
router.get('/summary', (req, res) => {
  try {
    const now   = new Date().toISOString().slice(0,10);
    const soon  = new Date(Date.now() + 60*24*60*60*1000).toISOString().slice(0,10);

    const active   = db.prepare("SELECT COUNT(*) n FROM insurance_policies WHERE status='active'").get().n;
    const expiring = db.prepare("SELECT COUNT(*) n FROM insurance_policies WHERE status='active' AND coverage_end_date BETWEEN ? AND ?").get(now, soon).n;
    const expired  = db.prepare("SELECT COUNT(*) n FROM insurance_policies WHERE status='active' AND coverage_end_date < ?").get(now).n;

    // Annual premium total
    const premiums = db.prepare("SELECT premium_amount, premium_frequency FROM insurance_policies WHERE status='active' AND premium_amount IS NOT NULL").all();
    let annual = 0;
    premiums.forEach(p => {
      if (p.premium_frequency === 'monthly')     annual += p.premium_amount * 12;
      else if (p.premium_frequency === 'semi-annual') annual += p.premium_amount * 2;
      else if (p.premium_frequency === 'quarterly')   annual += p.premium_amount * 4;
      else annual += p.premium_amount; // annual
    });

    // By type
    const byType = db.prepare(`
      SELECT policy_type, COUNT(*) as count,
        SUM(CASE WHEN premium_frequency='monthly' THEN premium_amount*12
                 WHEN premium_frequency='semi-annual' THEN premium_amount*2
                 WHEN premium_frequency='quarterly' THEN premium_amount*4
                 ELSE COALESCE(premium_amount,0) END) AS annual_cost
      FROM insurance_policies WHERE status='active'
      GROUP BY policy_type ORDER BY policy_type
    `).all();

    res.json({ active, expiring_60d: expiring, expired_active: expired, annual_premium: Math.round(annual), by_type: byType });
  } catch(e) { serverError(res, e); }
});

// ── CRUD ─────────────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.policy_type || !d.coverage_start_date) return badRequest(res, 'policy_type and coverage_start_date required');

    // Auto-assign policy_group_id if not provided (new policy chain)
    const result = db.prepare(`
      INSERT INTO insurance_policies
        (policy_group_id, policy_type, provider_contact_id, agent_contact_id,
         policy_number, coverage_start_date, coverage_end_date,
         premium_amount, premium_frequency, deductible, coverage_limit,
         coverage_details, vehicle_id, property_id, status, alert_days_before, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.policy_group_id||null, d.policy_type, d.provider_contact_id||null, d.agent_contact_id||null,
      d.policy_number||null, d.coverage_start_date, d.coverage_end_date||null,
      d.premium_amount||null, d.premium_frequency||'annual',
      d.deductible||null, d.coverage_limit||null,
      d.coverage_details||null, d.vehicle_id||null, d.property_id||null,
      d.status||'active', d.alert_days_before||60, d.notes||null
    );
    const id = result.lastInsertRowid;

    // If no group_id, use own ID as group root
    if (!d.policy_group_id) {
      db.prepare('UPDATE insurance_policies SET policy_group_id=? WHERE id=?').run(id, id);
    }

    // Members
    if (Array.isArray(d.family_member_ids) && d.family_member_ids.length) {
      const stmt = db.prepare('INSERT INTO insurance_policy_members (policy_id,family_member_id) VALUES (?,?)');
      d.family_member_ids.forEach(mid => stmt.run(id, mid));
    }
    res.json({ id, ok: true });
  } catch(e) { serverError(res, e); }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE insurance_policies SET
        policy_type=?, provider_contact_id=?, agent_contact_id=?,
        policy_number=?, coverage_start_date=?, coverage_end_date=?,
        premium_amount=?, premium_frequency=?, deductible=?, coverage_limit=?,
        coverage_details=?, vehicle_id=?, property_id=?,
        status=?, alert_days_before=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.policy_type, d.provider_contact_id||null, d.agent_contact_id||null,
      d.policy_number||null, d.coverage_start_date, d.coverage_end_date||null,
      d.premium_amount||null, d.premium_frequency||'annual',
      d.deductible||null, d.coverage_limit||null,
      d.coverage_details||null, d.vehicle_id||null, d.property_id||null,
      d.status||'active', d.alert_days_before||60, d.notes||null,
      req.params.id
    );
    db.prepare('DELETE FROM insurance_policy_members WHERE policy_id=?').run(req.params.id);
    if (Array.isArray(d.family_member_ids) && d.family_member_ids.length) {
      const stmt = db.prepare('INSERT INTO insurance_policy_members (policy_id,family_member_id) VALUES (?,?)');
      d.family_member_ids.forEach(mid => stmt.run(req.params.id, mid));
    }
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// Renew — creates a new record in same chain, marks old as expired
router.post('/:id/renew', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const old = db.prepare('SELECT * FROM insurance_policies WHERE id=?').get(req.params.id);
    if (!old) return notFound(res, 'Policy');

    // Mark old as expired
    db.prepare("UPDATE insurance_policies SET status='expired', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);

    // Create renewal record in same chain
    const result = db.prepare(`
      INSERT INTO insurance_policies
        (policy_group_id, policy_type, provider_contact_id, agent_contact_id,
         policy_number, coverage_start_date, coverage_end_date,
         premium_amount, premium_frequency, deductible, coverage_limit,
         coverage_details, vehicle_id, property_id, status, alert_days_before, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      old.policy_group_id, old.policy_type,
      d.provider_contact_id||old.provider_contact_id,
      d.agent_contact_id||old.agent_contact_id,
      d.policy_number||old.policy_number,
      d.coverage_start_date||old.coverage_end_date,
      d.coverage_end_date||null,
      d.premium_amount||old.premium_amount,
      d.premium_frequency||old.premium_frequency,
      d.deductible||old.deductible,
      d.coverage_limit||old.coverage_limit,
      d.coverage_details||old.coverage_details,
      old.vehicle_id, old.property_id,
      'active', old.alert_days_before, d.notes||null
    );

    // Copy members to new record
    const members = db.prepare('SELECT family_member_id FROM insurance_policy_members WHERE policy_id=?').all(req.params.id);
    if (members.length) {
      const stmt = db.prepare('INSERT INTO insurance_policy_members (policy_id,family_member_id) VALUES (?,?)');
      members.forEach(m => stmt.run(result.lastInsertRowid, m.family_member_id));
    }
    res.json({ id: result.lastInsertRowid, ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM insurance_policy_members WHERE policy_id=?').run(req.params.id);
    db.prepare('DELETE FROM insurance_policies WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
