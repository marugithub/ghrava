// @ts-nocheck
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
const { saveFamilyMembers, getFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');

// requireAuth applied per-route on writes only

// ══════════════════════════════════════════════════════════════
// PROPERTIES
// ══════════════════════════════════════════════════════════════

router.get('/properties', (req, res) => {
  try {
    const props = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM attachments WHERE entity_type='property' AND entity_id=p.id) AS attachment_count
      FROM properties p WHERE p.is_active=1 ORDER BY p.property_type, p.nickname
    `).all();
    res.json(props.map(p => withFamilyMembers(withTagNames(p, 'property'), 'property')));
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
         hoa_monthly, property_tax_annual, insurance_annual, insurance_company, insurance_policy, notes,
         mortgage_lender_contact_id, insurance_contact_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(d.nickname, d.property_type||'Primary Residence',
           d.address_street||null, d.address_city||null, d.address_state||null, d.address_zip||null,
           d.purchase_date||null, parseFloat(d.purchase_price)||null, parseFloat(d.current_est_value)||null,
           parseFloat(d.mortgage_balance)||null, d.mortgage_lender||null,
           parseFloat(d.mortgage_rate)||null, parseFloat(d.mortgage_monthly)||null, d.mortgage_end_date||null,
           parseFloat(d.hoa_monthly)||null, parseFloat(d.property_tax_annual)||null,
           parseFloat(d.insurance_annual)||null, d.insurance_company||null, d.insurance_policy||null, d.notes||null,
           d.mortgage_lender_contact_id||null, d.insurance_contact_id||null);
    if (d.tags)           saveTagsByName(r.lastInsertRowid, 'property', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(r.lastInsertRowid, 'property', d.family_member_ids);
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
        mortgage_lender_contact_id=?, insurance_contact_id=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.nickname||existing.nickname, d.property_type||existing.property_type,
           d.address_street||null, d.address_city||null, d.address_state||null, d.address_zip||null,
           d.purchase_date||null, parseFloat(d.purchase_price)||null, parseFloat(d.current_est_value)||null,
           parseFloat(d.mortgage_balance)||null, d.mortgage_lender||null,
           parseFloat(d.mortgage_rate)||null, parseFloat(d.mortgage_monthly)||null, d.mortgage_end_date||null,
           parseFloat(d.hoa_monthly)||null, parseFloat(d.property_tax_annual)||null,
           parseFloat(d.insurance_annual)||null, d.insurance_company||null, d.insurance_policy||null, d.notes||null,
           d.mortgage_lender_contact_id||null, d.insurance_contact_id||null,
           req.params.id);
    clearReview('properties', req.params.id);
    if (d.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'property', d.family_member_ids);
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
    // Attach recent service record and tags to each vehicle.
    // Wrap each enrichment step so a single bad row never crashes the whole list.
    vehicles.forEach(v => {
      try { v.tags = withTagNames(v, 'vehicle').tags || []; }
      catch (e) { v.tags = []; console.error(`[vehicles] tags failed for id=${v.id}:`, e.message); }

      try { v.family_members = withFamilyMembers(v, 'vehicle').family_members || []; }
      catch (e) { v.family_members = []; console.error(`[vehicles] family_members failed for id=${v.id}:`, e.message); }

      try {
        v.last_service = db.prepare(
          'SELECT * FROM vehicle_service WHERE vehicle_id=? ORDER BY service_date DESC LIMIT 1'
        ).get(v.id) || null;
      } catch (e) { v.last_service = null; console.error(`[vehicles] last_service failed for id=${v.id}:`, e.message); }

      try {
        v.upcoming_service = db.prepare(
          'SELECT * FROM vehicle_service WHERE vehicle_id=? AND next_due_date >= date("now") ORDER BY next_due_date ASC LIMIT 1'
        ).get(v.id) || null;
      } catch (e) { v.upcoming_service = null; console.error(`[vehicles] upcoming_service failed for id=${v.id}:`, e.message); }

      try {
        v.attachment_count = db.prepare("SELECT COUNT(*) as cnt FROM attachments WHERE entity_type='vehicle' AND entity_id=?").get(v.id)?.cnt || 0;
      } catch (e) { v.attachment_count = 0; }
    });
    res.json(vehicles);
  } catch (e) { serverError(res, e); }
});

router.post('/vehicles', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.nickname) return badRequest(res, 'nickname required');
    // schema: vehicles has lender_contact_id but NOT insurance_contact_id
    // v.170: removed insurance_contact_id from SQL — column doesn't exist.
    // The insurance company is stored as text in `insurance_company` / `insurance_policy`.
    // If a contact link is needed for the insurance agent, use record_links.
    const r = db.prepare(`
      INSERT INTO vehicles
        (nickname, year, make, model, trim, color, vin, license_plate, state,
         purchase_date, purchase_price, current_est_value, odometer, odometer_date,
         loan_balance, loan_lender, loan_rate, loan_monthly, loan_end_date,
         insurance_company, insurance_policy, insurance_annual,
         registration_expires, inspection_expires, notes,
         lender_contact_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(d.nickname, parseInt(d.year)||null, d.make||null, d.model||null, d.trim||null, d.color||null,
           d.vin||null, d.license_plate||null, d.state||null,
           d.purchase_date||null, parseFloat(d.purchase_price)||null, parseFloat(d.current_est_value)||null,
           parseInt(d.odometer)||null, d.odometer_date||null,
           parseFloat(d.loan_balance)||null, d.loan_lender||null,
           parseFloat(d.loan_rate)||null, parseFloat(d.loan_monthly)||null, d.loan_end_date||null,
           d.insurance_company||null, d.insurance_policy||null, parseFloat(d.insurance_annual)||null,
           d.registration_expires||null, d.inspection_expires||null, d.notes||null,
           d.lender_contact_id||null);
    if (d.tags) saveTagsByName(Number(r.lastInsertRowid), 'vehicle', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(Number(r.lastInsertRowid), 'vehicle', d.family_member_ids);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

router.put('/vehicles/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM vehicles WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Vehicle');
    // schema: see POST — insurance_contact_id doesn't exist
    db.prepare(`
      UPDATE vehicles SET
        nickname=?, year=?, make=?, model=?, trim=?, color=?, vin=?, license_plate=?, state=?,
        purchase_date=?, purchase_price=?, current_est_value=?, odometer=?, odometer_date=?,
        loan_balance=?, loan_lender=?, loan_rate=?, loan_monthly=?, loan_end_date=?,
        insurance_company=?, insurance_policy=?, insurance_annual=?,
        registration_expires=?, inspection_expires=?, notes=?,
        lender_contact_id=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.nickname||existing.nickname, parseInt(d.year)||null, d.make||null, d.model||null,
           d.trim||null, d.color||null, d.vin||null, d.license_plate||null, d.state||null,
           d.purchase_date||null, parseFloat(d.purchase_price)||null, parseFloat(d.current_est_value)||null,
           parseInt(d.odometer)||null, d.odometer_date||null,
           parseFloat(d.loan_balance)||null, d.loan_lender||null,
           parseFloat(d.loan_rate)||null, parseFloat(d.loan_monthly)||null, d.loan_end_date||null,
           d.insurance_company||null, d.insurance_policy||null, parseFloat(d.insurance_annual)||null,
           d.registration_expires||null, d.inspection_expires||null, d.notes||null,
           d.lender_contact_id||null, req.params.id);
    if (d.family_member_ids !== undefined) saveFamilyMembers(Number(req.params.id), 'vehicle', d.family_member_ids);
    if (d.tags !== undefined) saveTagsByName(Number(req.params.id), 'vehicle', d.tags);
    clearReview('vehicles', Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.delete('/vehicles/:id', requireAuth, (req, res) => {
  try {
    clearTags(Number(req.params.id), 'vehicle');
    clearFamilyMembers(Number(req.params.id), 'vehicle');
    db.prepare('UPDATE vehicles SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ── Vehicle Service ──────────────────────────────────────────

router.get('/vehicles/:id/service', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT vs.*, c.name AS contact_name
      FROM vehicle_service vs
      LEFT JOIN contacts c ON c.id = vs.contact_id
      WHERE vs.vehicle_id=?
      ORDER BY vs.service_date DESC
    `).all(req.params.id);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

router.post('/vehicles/:id/service', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.service_date || !d.service_type) return badRequest(res, 'service_date and service_type required');
    const r = db.prepare(`
      INSERT INTO vehicle_service (vehicle_id, service_date, service_type, mileage, cost, shop, contact_id, notes, next_due_date, next_due_miles)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(req.params.id, d.service_date, d.service_type,
           parseInt(d.mileage)||null, parseFloat(d.cost)||null, d.shop||null,
           d.contact_id||null, d.notes||null,
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


// ── CSV Exports ───────────────────────────────────────────────
function escCsv(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvSend(res, rows, headers, filename) {
  const lines = rows.map(r => headers.map(h => escCsv(r[h])).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send([headers.join(','), ...lines].join('\n'));
}

router.get('/vehicles/export/csv', (req, res) => {
  try {
    const rows = db.prepare(`SELECT id,nickname,make,model,year,color,vin,license_plate,
      registration_expires,inspection_expires,purchase_date,purchase_price,notes
      FROM vehicles WHERE is_active=1 ORDER BY make,model`).all();
    csvSend(res, rows, ['id','nickname','make','model','year','color','vin','license_plate',
      'registration_expires','inspection_expires','purchase_date','purchase_price','notes'], 'vehicles.csv');
  } catch(e) { serverError(res, e); }
});

router.get('/vehicles/service/export/csv', (req, res) => {
  try {
    const rows = db.prepare(`SELECT vs.id, v.nickname AS vehicle, vs.service_date,
      vs.service_type, vs.mileage, vs.cost, vs.shop, vs.next_due_date, vs.next_due_miles, vs.notes
      FROM vehicle_service vs JOIN vehicles v ON v.id=vs.vehicle_id
      ORDER BY vs.service_date DESC`).all();
    csvSend(res, rows, ['id','vehicle','service_date','service_type','mileage','cost','shop',
      'next_due_date','next_due_miles','notes'], 'vehicle_service.csv');
  } catch(e) { serverError(res, e); }
});

router.get('/maintenance/export/csv', (req, res) => {
  try {
    const rows = db.prepare(`SELECT pm.id, p.nickname AS property, pm.maint_date,
      pm.category, pm.description, pm.cost, pm.vendor, pm.warranty_expiry, pm.next_due_date, pm.notes
      FROM property_maintenance pm JOIN properties p ON p.id=pm.property_id
      ORDER BY pm.maint_date DESC`).all();
    csvSend(res, rows, ['id','property','maint_date','category','description','cost',
      'vendor','warranty_expiry','next_due_date','notes'], 'property_maintenance.csv');
  } catch(e) { serverError(res, e); }
});

module.exports = router;

// ── Property Maintenance ──────────────────────────────────────
router.get('/properties/:id/maintenance', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT pm.*, c.name AS vendor_name
      FROM property_maintenance pm
      LEFT JOIN contacts c ON c.id = pm.vendor_contact_id
      WHERE pm.property_id=?
      ORDER BY pm.maint_date DESC
    `).all(req.params.id);
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
        (property_id, maint_date, category, description, cost, vendor, vendor_contact_id,
         warranty_expiry, next_due_date, notes, is_completed, completed_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(req.params.id, d.maint_date, d.category, d.description,
           d.cost||null, d.vendor||null, d.vendor_contact_id||null,
           d.warranty_expiry||null, d.next_due_date||null, d.notes||null,
           d.is_completed ? 1 : 0, d.completed_date||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch(e) { serverError(res, e); }
});

router.put('/properties/maintenance/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE property_maintenance SET
        maint_date=?, category=?, description=?, cost=?, vendor=?, vendor_contact_id=?,
        warranty_expiry=?, next_due_date=?, notes=?,
        is_completed=?, completed_date=?
      WHERE id=?
    `).run(d.maint_date, d.category, d.description, d.cost||null,
           d.vendor||null, d.vendor_contact_id||null,
           d.warranty_expiry||null, d.next_due_date||null,
           d.notes||null,
           d.is_completed ? 1 : 0, d.completed_date||null,
           req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// PATCH /properties/maintenance/:id/complete — quick-complete from list
router.patch('/properties/maintenance/:id/complete', requireAuth, (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare('UPDATE property_maintenance SET is_completed=1, completed_date=? WHERE id=?')
      .run(today, req.params.id);
    res.json({ ok: true, completed_date: today });
  } catch(e) { serverError(res, e); }
});

// PATCH /properties/maintenance/:id/reopen — undo completion
router.patch('/properties/maintenance/:id/reopen', requireAuth, (req, res) => {
  try {
    db.prepare('UPDATE property_maintenance SET is_completed=0, completed_date=NULL WHERE id=?')
      .run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/properties/maintenance/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM property_maintenance WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});
