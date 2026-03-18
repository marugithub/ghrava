'use strict';
/**
 * features/property/routes.js
 *
 * Tracks real estate properties and vehicles, plus their maintenance/service history.
 *
 * Data model:
 *   properties     — address, type, purchase info, mortgage rate
 *   vehicles       — year/make/model, VIN, purchase info
 *   vehicle_service    — oil changes, inspections, repairs (linked to vehicle)
 *   property_maintenance — HVAC, roof, plumbing work (linked to property)
 *
 * Category dropdowns backed by dropdown_options:
 *   property_type, property_maintenance_category, vehicle_service_type
 *
 * Tags: properties → entity_type='property', vehicles → entity_type='vehicle'
 *
 * Public routes:   GET /properties  GET /vehicles  GET /vehicles/:id/service
 *                  GET /properties/:id/maintenance
 * Auth-required:   All writes
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');

// requireAuth applied per-route on writes only

// ══════════════════════════════════════════════════════════════
// PROPERTIES
// ══════════════════════════════════════════════════════════════

router.get('/properties', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM properties WHERE is_active=1 ORDER BY property_type, nickname').all().map(p => withTagNames(p, 'property')));
  } catch (e) { serverError(res, e); }
});

router.post('/properties', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.nickname) return badRequest(res, 'nickname required');
    const r = db.prepare(`
      INSERT INTO properties
        (nickname, property_type, address_street, address_city, address_state, address_zip,
         purchase_date, purchase_price, current_est_value,
         mortgage_balance, mortgage_lender, mortgage_rate, mortgage_monthly, mortgage_end_date,
         hoa_monthly, property_tax_annual, insurance_annual, insurance_company, insurance_policy, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(d.nickname, d.property_type||'Primary Residence',
           d.address_street||null, d.address_city||null, d.address_state||null, d.address_zip||null,
           d.purchase_date||null, parseFloat(d.purchase_price)||null, parseFloat(d.current_est_value)||null,
           parseFloat(d.mortgage_balance)||null, d.mortgage_lender||null,
           parseFloat(d.mortgage_rate)||null, parseFloat(d.mortgage_monthly)||null, d.mortgage_end_date||null,
           parseFloat(d.hoa_monthly)||null, parseFloat(d.property_tax_annual)||null,
           parseFloat(d.insurance_annual)||null, d.insurance_company||null, d.insurance_policy||null, d.notes||null);
    if (d.tags) saveTagsByName(r.lastInsertRowid, 'property', d.tags);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/properties/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM properties WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Property');
    db.prepare(`
      UPDATE properties SET
        nickname=?, property_type=?, address_street=?, address_city=?, address_state=?, address_zip=?,
        purchase_date=?, purchase_price=?, current_est_value=?,
        mortgage_balance=?, mortgage_lender=?, mortgage_rate=?, mortgage_monthly=?, mortgage_end_date=?,
        hoa_monthly=?, property_tax_annual=?, insurance_annual=?, insurance_company=?, insurance_policy=?, notes=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.nickname||existing.nickname, d.property_type||existing.property_type,
           d.address_street||null, d.address_city||null, d.address_state||null, d.address_zip||null,
           d.purchase_date||null, parseFloat(d.purchase_price)||null, parseFloat(d.current_est_value)||null,
           parseFloat(d.mortgage_balance)||null, d.mortgage_lender||null,
           parseFloat(d.mortgage_rate)||null, parseFloat(d.mortgage_monthly)||null, d.mortgage_end_date||null,
           parseFloat(d.hoa_monthly)||null, parseFloat(d.property_tax_annual)||null,
           parseFloat(d.insurance_annual)||null, d.insurance_company||null, d.insurance_policy||null, d.notes||null,
           req.params.id);
    clearReview('properties', req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/properties/:id', requireAuth, (req, res) => {
  try {
    clearTags(req.params.id, 'property');
    db.prepare('UPDATE properties SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// VEHICLES
// ══════════════════════════════════════════════════════════════

router.get('/vehicles', (req, res) => {
  try {
    const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active=1 ORDER BY year DESC, make, model').all();
    // Attach recent service record and tags to each vehicle
    vehicles.forEach(v => {
      v.tags = withTagNames(v, 'vehicle').tags;
      v.last_service = db.prepare(
        'SELECT * FROM vehicle_service WHERE vehicle_id=? ORDER BY service_date DESC LIMIT 1'
      ).get(v.id) || null;
      v.upcoming_service = db.prepare(
        'SELECT * FROM vehicle_service WHERE vehicle_id=? AND next_due_date >= date("now") ORDER BY next_due_date ASC LIMIT 1'
      ).get(v.id) || null;
    });
    res.json(vehicles);
  } catch (e) { serverError(res, e); }
});

router.post('/vehicles', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.nickname) return badRequest(res, 'nickname required');
    const r = db.prepare(`
      INSERT INTO vehicles
        (nickname, year, make, model, trim, color, vin, license_plate, state,
         purchase_date, purchase_price, current_est_value, odometer, odometer_date,
         loan_balance, loan_lender, loan_rate, loan_monthly, loan_end_date,
         insurance_company, insurance_policy, insurance_annual,
         registration_expires, inspection_expires, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(d.nickname, parseInt(d.year)||null, d.make||null, d.model||null, d.trim||null, d.color||null,
           d.vin||null, d.license_plate||null, d.state||null,
           d.purchase_date||null, parseFloat(d.purchase_price)||null, parseFloat(d.current_est_value)||null,
           parseInt(d.odometer)||null, d.odometer_date||null,
           parseFloat(d.loan_balance)||null, d.loan_lender||null,
           parseFloat(d.loan_rate)||null, parseFloat(d.loan_monthly)||null, d.loan_end_date||null,
           d.insurance_company||null, d.insurance_policy||null, parseFloat(d.insurance_annual)||null,
           d.registration_expires||null, d.inspection_expires||null, d.notes||null);
    if (d.tags) saveTagsByName(r.lastInsertRowid, 'vehicle', d.tags);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/vehicles/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM vehicles WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Vehicle');
    db.prepare(`
      UPDATE vehicles SET
        nickname=?, year=?, make=?, model=?, trim=?, color=?, vin=?, license_plate=?, state=?,
        purchase_date=?, purchase_price=?, current_est_value=?, odometer=?, odometer_date=?,
        loan_balance=?, loan_lender=?, loan_rate=?, loan_monthly=?, loan_end_date=?,
        insurance_company=?, insurance_policy=?, insurance_annual=?,
        registration_expires=?, inspection_expires=?, notes=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.nickname||existing.nickname, parseInt(d.year)||null, d.make||null, d.model||null,
           d.trim||null, d.color||null, d.vin||null, d.license_plate||null, d.state||null,
           d.purchase_date||null, parseFloat(d.purchase_price)||null, parseFloat(d.current_est_value)||null,
           parseInt(d.odometer)||null, d.odometer_date||null,
           parseFloat(d.loan_balance)||null, d.loan_lender||null,
           parseFloat(d.loan_rate)||null, parseFloat(d.loan_monthly)||null, d.loan_end_date||null,
           d.insurance_company||null, d.insurance_policy||null, parseFloat(d.insurance_annual)||null,
           d.registration_expires||null, d.inspection_expires||null, d.notes||null, req.params.id);
    clearReview('vehicles', req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/vehicles/:id', requireAuth, (req, res) => {
  try {
    clearTags(req.params.id, 'vehicle');
    db.prepare('UPDATE vehicles SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ── Vehicle Service ──────────────────────────────────────────

router.get('/vehicles/:id/service', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM vehicle_service WHERE vehicle_id=? ORDER BY service_date DESC'
    ).all(req.params.id);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/vehicles/:id/service', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.service_date || !d.service_type) return badRequest(res, 'service_date and service_type required');
    const r = db.prepare(`
      INSERT INTO vehicle_service (vehicle_id, service_date, service_type, mileage, cost, shop, notes, next_due_date, next_due_miles)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(req.params.id, d.service_date, d.service_type,
           parseInt(d.mileage)||null, parseFloat(d.cost)||null, d.shop||null, d.notes||null,
           d.next_due_date||null, parseInt(d.next_due_miles)||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.delete('/vehicles/service/:serviceId', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM vehicle_service WHERE id=?').run(req.params.serviceId);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;

// ── Property Maintenance ──────────────────────────────────────
router.get('/properties/:id/maintenance', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM property_maintenance WHERE property_id=? ORDER BY maint_date DESC'
    ).all(req.params.id);
    res.json(rows);
  } catch(e) { serverError(res, e); }
});

router.post('/properties/:id/maintenance', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.maint_date || !d.category || !d.description)
      return badRequest(res, 'maint_date, category and description required');
    const r = db.prepare(`
      INSERT INTO property_maintenance
        (property_id, maint_date, category, description, cost, vendor, vendor_contact_id, warranty_expiry, next_due_date, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(req.params.id, d.maint_date, d.category, d.description,
           d.cost||null, d.vendor||null, d.vendor_contact_id||null,
           d.warranty_expiry||null, d.next_due_date||null, d.notes||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch(e) { serverError(res, e); }
});

router.put('/properties/maintenance/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE property_maintenance SET
        maint_date=?, category=?, description=?, cost=?, vendor=?, vendor_contact_id=?,
        warranty_expiry=?, next_due_date=?, notes=?
      WHERE id=?
    `).run(d.maint_date, d.category, d.description, d.cost||null,
           d.vendor||null, d.vendor_contact_id||null,
           d.warranty_expiry||null, d.next_due_date||null,
           d.notes||null, req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/properties/maintenance/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM property_maintenance WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});
