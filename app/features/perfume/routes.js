'use strict';
/**
 * features/perfume/routes.js
 * Perfume module — fragrance inventory, layering sets, outfit pairings.
 * Mounted at /api/v1/perfume
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { serverError, badRequest, notFound } = require('../../shared/errors');

// ── Perfumes ──────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { member_id, status, season, occasion } = req.query;
    let where = '1=1';
    const params = [];
    if (member_id) { where += ' AND p.owner_family_member_id=?'; params.push(member_id); }
    if (status)    { where += ' AND p.status=?'; params.push(status); }
    else           { where += " AND p.status='active'"; }

    const rows = db.prepare(`
      SELECT p.*, fm.display_name AS owner_name,
        -- v202604.119: surface primary-photo attachment id for the card hero.
        -- Same pattern as wardrobe items. Falls back to first image if no
        -- primary marked.
        (SELECT id FROM attachments
           WHERE entity_type='perfume' AND entity_id=p.id AND is_image=1 AND is_primary_photo=1
           LIMIT 1) AS primary_photo_id,
        (SELECT id FROM attachments
           WHERE entity_type='perfume' AND entity_id=p.id AND is_image=1
           ORDER BY sort_order, created_at LIMIT 1) AS first_photo_id
      FROM perfumes p
      LEFT JOIN family_members fm ON fm.id=p.owner_family_member_id
      WHERE ${where}
      ORDER BY p.brand, p.name
    `).all(...params);

    // Parse JSON arrays
    let result = rows.map(r => {
      try { r.scent_family  = r.scent_family  ? JSON.parse(r.scent_family)  : []; } catch { r.scent_family=[]; }
      try { r.season_tags   = r.season_tags   ? JSON.parse(r.season_tags)   : []; } catch { r.season_tags=[]; }
      try { r.occasion_tags = r.occasion_tags ? JSON.parse(r.occasion_tags) : []; } catch { r.occasion_tags=[]; }
      return r;
    });

    if (season) result = result.filter(r => !r.season_tags.length || r.season_tags.includes(season) || r.season_tags.includes('All-season'));
    if (occasion) result = result.filter(r => !r.occasion_tags.length || r.occasion_tags.includes(occasion));

    res.json(result);
  } catch(e) { serverError(res, e); }
});

router.get('/:id', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT p.*, fm.display_name AS owner_name
      FROM perfumes p
      LEFT JOIN family_members fm ON fm.id=p.owner_family_member_id
      WHERE p.id=?
    `).get(req.params.id);
    if (!row) return notFound(res, 'Perfume');
    try { row.scent_family  = row.scent_family  ? JSON.parse(row.scent_family)  : []; } catch { row.scent_family=[]; }
    try { row.season_tags   = row.season_tags   ? JSON.parse(row.season_tags)   : []; } catch { row.season_tags=[]; }
    try { row.occasion_tags = row.occasion_tags ? JSON.parse(row.occasion_tags) : []; } catch { row.occasion_tags=[]; }
    res.json(row);
  } catch(e) { serverError(res, e); }
});

router.post('/', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const result = db.prepare(`
      INSERT INTO perfumes (
        name, brand, concentration, top_notes, middle_notes, base_notes,
        scent_family, season_tags, occasion_tags, gender, size_ml, amount_level,
        purchase_price, purchase_date, purchased_from, owner_family_member_id,
        rating, notes, status, barcode, fragella_id, fragella_data, fragella_cached_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.name.trim(), d.brand||null, d.concentration||null,
      d.top_notes||null, d.middle_notes||null, d.base_notes||null,
      d.scent_family   ? JSON.stringify(d.scent_family)   : null,
      d.season_tags    ? JSON.stringify(d.season_tags)    : null,
      d.occasion_tags  ? JSON.stringify(d.occasion_tags)  : null,
      d.gender||null, d.size_ml||null, d.amount_level||'Full',
      d.purchase_price||null, d.purchase_date||null, d.purchased_from||null,
      d.owner_family_member_id||null, d.rating||null, d.notes||null,
      d.status||'active', d.barcode||null,
      d.fragella_id||null, d.fragella_data ? JSON.stringify(d.fragella_data) : null,
      d.fragella_cached_at||null
    );
    res.json({ id: result.lastInsertRowid, ok: true });
  } catch(e) { serverError(res, e); }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE perfumes SET
        name=?, brand=?, concentration=?, top_notes=?, middle_notes=?, base_notes=?,
        scent_family=?, season_tags=?, occasion_tags=?, gender=?, size_ml=?, amount_level=?,
        purchase_price=?, purchase_date=?, purchased_from=?, owner_family_member_id=?,
        rating=?, notes=?, status=?, barcode=?,
        fragella_id=?, fragella_data=?, fragella_cached_at=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.name?.trim(), d.brand||null, d.concentration||null,
      d.top_notes||null, d.middle_notes||null, d.base_notes||null,
      d.scent_family   ? JSON.stringify(d.scent_family)   : null,
      d.season_tags    ? JSON.stringify(d.season_tags)    : null,
      d.occasion_tags  ? JSON.stringify(d.occasion_tags)  : null,
      d.gender||null, d.size_ml||null, d.amount_level||'Full',
      d.purchase_price||null, d.purchase_date||null, d.purchased_from||null,
      d.owner_family_member_id||null, d.rating||null, d.notes||null,
      d.status||'active', d.barcode||null,
      d.fragella_id||null, d.fragella_data ? JSON.stringify(d.fragella_data) : null,
      d.fragella_cached_at||null,
      req.params.id
    );
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM perfume_layer_items WHERE perfume_id=?').run(req.params.id);
    db.prepare('DELETE FROM perfume_outfit_pairs WHERE perfume_id=?').run(req.params.id);
    db.prepare('DELETE FROM perfumes WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Fragella lookup (with DB cache) ──────────────────────────
router.get('/lookup/fragella', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return badRequest(res, 'q required');

    // Check cache first
    const cached = db.prepare(`
      SELECT fragella_data, fragella_cached_at FROM perfumes
      WHERE fragella_data IS NOT NULL AND name LIKE ? LIMIT 1
    `).get(`%${q}%`);

    // Also check a dedicated cache table approach — look for exact match in existing perfumes
    const cacheKey = q.toLowerCase().trim();
    const cacheRow = db.prepare(`
      SELECT fragella_data FROM perfumes
      WHERE fragella_id IS NOT NULL AND LOWER(name) LIKE ? AND fragella_cached_at IS NOT NULL
      LIMIT 1
    `).get(`%${cacheKey}%`);

    const apiKey = process.env.FRAGELLA_API_KEY;
    if (!apiKey) return res.json({ error: 'FRAGELLA_API_KEY not configured', results: [] });

    const url = `https://api.fragella.com/api/v1/fragrances?search=${encodeURIComponent(q)}&limit=5`;
    const resp = await fetch(url, { headers: { 'x-api-key': apiKey } });
    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: `Fragella error: ${err.slice(0,200)}`, results: [] });
    }
    const data = await resp.json();
    res.json({ results: data.fragrances || data.results || data || [] });
  } catch(e) { serverError(res, e); }
});

// ── Layers ────────────────────────────────────────────────────
router.get('/layers/all', (req, res) => {
  try {
    const { member_id } = req.query;
    let where = '1=1';
    const params = [];
    if (member_id) { where += ' AND l.owner_family_member_id=?'; params.push(member_id); }

    const layers = db.prepare(`
      SELECT l.*, fm.display_name AS owner_name
      FROM perfume_layers l
      LEFT JOIN family_members fm ON fm.id=l.owner_family_member_id
      WHERE ${where} ORDER BY l.name
    `).all(...params);

    const itemStmt = db.prepare(`
      SELECT li.*, p.name AS perfume_name, p.brand, p.concentration
      FROM perfume_layer_items li
      JOIN perfumes p ON p.id=li.perfume_id
      WHERE li.layer_id=?
      ORDER BY li.application_order
    `);
    layers.forEach(l => { l.items = itemStmt.all(l.id); });
    res.json(layers);
  } catch(e) { serverError(res, e); }
});

router.post('/layers', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const result = db.prepare(`
      INSERT INTO perfume_layers (name, owner_family_member_id, season_tags, occasion_tags, notes)
      VALUES (?,?,?,?,?)
    `).run(d.name.trim(), d.owner_family_member_id||null,
      d.season_tags ? JSON.stringify(d.season_tags) : null,
      d.occasion_tags ? JSON.stringify(d.occasion_tags) : null, d.notes||null);

    if (Array.isArray(d.items)) {
      const stmt = db.prepare('INSERT INTO perfume_layer_items (layer_id,perfume_id,application_order,amount_note) VALUES (?,?,?,?)');
      d.items.forEach((item, i) => stmt.run(result.lastInsertRowid, item.perfume_id, item.application_order||i+1, item.amount_note||null));
    }
    res.json({ id: result.lastInsertRowid, ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/layers/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM perfume_layer_items WHERE layer_id=?').run(req.params.id);
    db.prepare('DELETE FROM perfume_layers WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
