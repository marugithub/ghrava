// @ts-check
'use strict';
/**
 * features/maintenance/routes.js
 * Unified maintenance hub across property, vehicles, and inventory.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError } = require('../../shared/errors');

// GET /api/v1/maintenance/upcoming — next 90 days across all modules
router.get('/upcoming', (req, res) => {
  try {
    const days  = parseInt(req.query.days) || 90;
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + days*86400000).toISOString().slice(0,10);
    const items = [];

    // Property maintenance
    db.prepare(`
      SELECT pm.id, pm.category, pm.description, pm.next_due_date, pm.cost,
             p.nickname as entity_name, 'property' as source
      FROM property_maintenance pm
      JOIN properties p ON p.id = pm.property_id
      WHERE pm.next_due_date IS NOT NULL AND pm.next_due_date <= ?
        AND (pm.is_completed IS NULL OR pm.is_completed = 0)
      ORDER BY pm.next_due_date
    `).all(until).forEach(r => items.push({...r, href: '/property.html'}));

    // Vehicle service
    db.prepare(`
      SELECT vs.id, vs.service_type as category, vs.service_type as description,
             vs.next_due_date, vs.cost,
             (v.year || ' ' || v.make || ' ' || v.model) as entity_name, 'vehicle' as source
      FROM vehicle_service vs
      JOIN vehicles v ON v.id = vs.vehicle_id
      WHERE vs.next_due_date IS NOT NULL AND vs.next_due_date <= ?
      ORDER BY vs.next_due_date
    `).all(until).forEach(r => items.push({...r, href: '/property.html'}));

    // Item maintenance
    db.prepare(`
      SELECT iml.id, iml.maintenance_type as category, iml.description,
             iml.next_due_date, iml.cost,
             i.name as entity_name, 'item' as source
      FROM item_maintenance_log iml
      JOIN items i ON i.id = iml.item_id AND i.is_active = 1
      WHERE iml.next_due_date IS NOT NULL AND iml.next_due_date <= ?
      ORDER BY iml.next_due_date
    `).all(until).forEach(r => items.push({...r, href: '/inventory.html'}));

    items.sort((a,b) => (a.next_due_date||'').localeCompare(b.next_due_date||''));
    res.json({ items, total: items.length, days });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/maintenance/summary — counts + overdue
router.get('/summary', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const overdueProperty = db.prepare(`SELECT COUNT(*) as n FROM property_maintenance WHERE next_due_date < ? AND (is_completed IS NULL OR is_completed=0)`).get(today)?.n || 0;
    const overdueVehicle  = db.prepare(`SELECT COUNT(*) as n FROM vehicle_service WHERE next_due_date < ?`).get(today)?.n || 0;
    const overdueItem     = db.prepare(`SELECT COUNT(*) as n FROM item_maintenance_log WHERE next_due_date < ?`).get(today)?.n || 0;
    const due30Property   = db.prepare(`SELECT COUNT(*) as n FROM property_maintenance WHERE next_due_date BETWEEN ? AND date(?,'+30 days') AND (is_completed IS NULL OR is_completed=0)`).get(today,today)?.n || 0;
    const due30Vehicle    = db.prepare(`SELECT COUNT(*) as n FROM vehicle_service WHERE next_due_date BETWEEN ? AND date(?,'+30 days')`).get(today,today)?.n || 0;
    res.json({
      overdue: overdueProperty + overdueVehicle + overdueItem,
      due_30_days: due30Property + due30Vehicle,
      by_source: { property: overdueProperty, vehicle: overdueVehicle, item: overdueItem }
    });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
