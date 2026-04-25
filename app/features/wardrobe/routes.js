'use strict';
/**
 * features/wardrobe/routes.js
 * Wardrobe module — clothing items (inventory items with wardrobe columns),
 * outfits, planner, wear log, insights.
 * Mounted at /api/v1/wardrobe
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { serverError, badRequest, notFound } = require('../../shared/errors');

// ── Wardrobe items (inventory items filtered to wardrobe categories) ──
const WARDROBE_CATEGORIES = ['Clothing','Shoes','Accessories','Jewelry','Hats','Bags'];

router.get('/items', (req, res) => {
  try {
    const { member_id, category, status, season, occasion } = req.query;
    let where = `i.category IN (${WARDROBE_CATEGORIES.map(()=>'?').join(',')})`;
    const params = [...WARDROBE_CATEGORIES];

    if (member_id) { where += ' AND i.wardrobe_owner_id=?'; params.push(member_id); }
    if (category)  { where += ' AND i.category=?'; params.push(category); }
    if (status)    { where += ' AND i.wardrobe_status=?'; params.push(status); }
    else           { where += " AND (i.wardrobe_status='active' OR i.wardrobe_status IS NULL)"; }

    const rows = db.prepare(`
      SELECT i.*,
        fm.display_name AS owner_name,
        (SELECT COUNT(*) FROM wardrobe_wear_log wl WHERE wl.item_id = i.id) AS times_worn,
        (SELECT MAX(worn_date) FROM wardrobe_wear_log wl WHERE wl.item_id = i.id) AS last_worn,
        (SELECT COUNT(*) FROM attachments WHERE entity_type='item' AND entity_id=i.id) AS attachment_count
      FROM items i
      LEFT JOIN family_members fm ON fm.id = i.wardrobe_owner_id
      WHERE ${where}
      ORDER BY fm.display_name, i.category, i.name
    `).all(...params);

    // Filter by season/occasion tags in JS (JSON arrays)
    let result = rows;
    if (season) {
      result = result.filter(r => {
        if (!r.season_tags) return true; // untagged = all-season
        try { const tags = JSON.parse(r.season_tags); return tags.includes(season) || tags.includes('All-season'); }
        catch { return true; }
      });
    }
    if (occasion) {
      result = result.filter(r => {
        if (!r.occasion_tags) return true;
        try { const tags = JSON.parse(r.occasion_tags); return tags.includes(occasion); }
        catch { return true; }
      });
    }

    res.json(result);
  } catch(e) { serverError(res, e); }
});

router.get('/items/:id', (req, res) => {
  try {
    // Pre-check: must be a wardrobe-scoped item. No is_active filter so the
    // record always displays as-is per our rules.
    const exists = db.prepare(
      `SELECT id, category FROM items WHERE id=?`
    ).get(req.params.id);
    if (!exists) return notFound(res, 'Item');
    if (!WARDROBE_CATEGORIES.includes(exists.category)) {
      // Out of module scope — caller asked the wardrobe route for a non-wardrobe item.
      return notFound(res, 'Item');
    }

    const row = db.prepare(`
      SELECT i.*, fm.display_name AS owner_name,
        (SELECT COUNT(*) FROM wardrobe_wear_log WHERE item_id=i.id) AS times_worn,
        (SELECT MAX(worn_date) FROM wardrobe_wear_log WHERE item_id=i.id) AS last_worn,
        (SELECT COUNT(*) FROM attachments WHERE entity_type='item' AND entity_id=i.id) AS attachment_count
      FROM items i
      LEFT JOIN family_members fm ON fm.id=i.wardrobe_owner_id
      WHERE i.id=?
    `).get(req.params.id);
    if (!row) return notFound(res, 'Item');
    row.primary_photo = db.prepare(
      `SELECT id, thumb_path, original_filename, label
       FROM attachments WHERE entity_type='item' AND entity_id=? AND is_primary_photo=1 AND is_image=1
       LIMIT 1`
    ).get(req.params.id) || null;
    res.json(row);
  } catch(e) { serverError(res, e); }
});

router.put('/items/:id', requireAuth, (req, res) => {
  try {
    const d = req.body || {};

    // Pre-check: confirm item exists AND is in wardrobe scope before updating.
    const existing = db.prepare(
      `SELECT * FROM items WHERE id=?`
    ).get(req.params.id);
    if (!existing) return notFound(res, 'Item');
    if (!WARDROBE_CATEGORIES.includes(existing.category)) {
      return notFound(res, 'Item');
    }

    // Reject category drift outside wardrobe scope.
    if (d.category !== undefined && d.category !== null
        && !WARDROBE_CATEGORIES.includes(d.category)) {
      return badRequest(res, `category must be one of: ${WARDROBE_CATEGORIES.join(', ')}`);
    }

    // Per-field preservation: undefined → keep existing; anything else (including
    // empty string and null) → write through. This lets users intentionally
    // clear nullable fields, which COALESCE-style updates would block.
    const pick = (key) => Object.prototype.hasOwnProperty.call(d, key) ? d[key] : existing[key];

    // Core editable inventory fields surfaced in the wardrobe drawer.
    const name           = pick('name');
    const brand          = pick('brand');
    const category       = pick('category');
    const purchase_price = pick('purchase_price');
    const purchase_date  = pick('purchase_date');
    const notes          = pick('notes');

    // Wardrobe-specific fields.
    const wardrobe_owner_id      = pick('wardrobe_owner_id');
    const wardrobe_sequence      = pick('wardrobe_sequence');
    const wardrobe_nickname      = pick('wardrobe_nickname');
    const season_tags_in         = Object.prototype.hasOwnProperty.call(d, 'season_tags')
      ? (d.season_tags ? JSON.stringify(d.season_tags) : null)
      : existing.season_tags;
    const occasion_tags_in       = Object.prototype.hasOwnProperty.call(d, 'occasion_tags')
      ? (d.occasion_tags ? JSON.stringify(d.occasion_tags) : null)
      : existing.occasion_tags;
    const wardrobe_status        = pick('wardrobe_status') || 'active';
    const wardrobe_status_date   = pick('wardrobe_status_date');
    const wardrobe_status_notes  = pick('wardrobe_status_notes');
    const sold_price             = pick('sold_price');
    const sold_date              = pick('sold_date');
    const sold_platform          = pick('sold_platform');
    const donated_org_contact_id = pick('donated_org_contact_id');
    const donated_fmv            = pick('donated_fmv');
    const discarded_reason       = pick('discarded_reason');

    db.prepare(`
      UPDATE items SET
        name=?, brand=?, category=?, purchase_price=?, purchase_date=?, notes=?,
        wardrobe_owner_id=?, wardrobe_sequence=?, wardrobe_nickname=?,
        season_tags=?, occasion_tags=?,
        wardrobe_status=?, wardrobe_status_date=?, wardrobe_status_notes=?,
        sold_price=?, sold_date=?, sold_platform=?,
        donated_org_contact_id=?, donated_fmv=?,
        discarded_reason=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      name, brand, category, purchase_price, purchase_date, notes,
      wardrobe_owner_id, wardrobe_sequence, wardrobe_nickname,
      season_tags_in, occasion_tags_in,
      wardrobe_status, wardrobe_status_date, wardrobe_status_notes,
      sold_price, sold_date, sold_platform,
      donated_org_contact_id, donated_fmv,
      discarded_reason,
      req.params.id
    );
    // No-op idempotent updates are fine — pre-check already validated scope.
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Outfits ───────────────────────────────────────────────────
router.get('/outfits', (req, res) => {
  try {
    const { member_id } = req.query;
    let where = '1=1';
    const params = [];
    if (member_id) { where += ' AND o.family_member_id=?'; params.push(member_id); }

    const outfits = db.prepare(`
      SELECT o.*, fm.display_name AS owner_name
      FROM wardrobe_outfits o
      LEFT JOIN family_members fm ON fm.id=o.family_member_id
      WHERE ${where}
      ORDER BY o.name
    `).all(...params);

    // Attach items to each outfit
    const itemStmt = db.prepare(`
      SELECT oi.sort_order, i.id, i.name, i.category, i.brand, i.wardrobe_nickname
      FROM wardrobe_outfit_items oi
      JOIN items i ON i.id=oi.item_id
      WHERE oi.outfit_id=?
      ORDER BY oi.sort_order
    `);
    outfits.forEach(o => {
      o.items = itemStmt.all(o.id);
      try { o.season_tags = o.season_tags ? JSON.parse(o.season_tags) : []; } catch { o.season_tags = []; }
      try { o.occasion_tags = o.occasion_tags ? JSON.parse(o.occasion_tags) : []; } catch { o.occasion_tags = []; }
    });

    res.json(outfits);
  } catch(e) { serverError(res, e); }
});

router.post('/outfits', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const result = db.prepare(`
      INSERT INTO wardrobe_outfits (name, family_member_id, occasion_tags, season_tags, notes)
      VALUES (?,?,?,?,?)
    `).run(
      d.name.trim(),
      d.family_member_id||null,
      d.occasion_tags ? JSON.stringify(d.occasion_tags) : null,
      d.season_tags   ? JSON.stringify(d.season_tags)   : null,
      d.notes||null
    );
    // Add items
    if (Array.isArray(d.item_ids)) {
      const stmt = db.prepare('INSERT INTO wardrobe_outfit_items (outfit_id,item_id,sort_order) VALUES (?,?,?)');
      d.item_ids.forEach((itemId, i) => stmt.run(result.lastInsertRowid, itemId, i));
    }
    res.json({ id: result.lastInsertRowid, ok: true });
  } catch(e) { serverError(res, e); }
});

router.put('/outfits/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE wardrobe_outfits SET name=?, family_member_id=?, occasion_tags=?, season_tags=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.name?.trim(), d.family_member_id||null,
      d.occasion_tags ? JSON.stringify(d.occasion_tags) : null,
      d.season_tags   ? JSON.stringify(d.season_tags)   : null,
      d.notes||null, req.params.id
    );
    // Replace items
    if (Array.isArray(d.item_ids)) {
      db.prepare('DELETE FROM wardrobe_outfit_items WHERE outfit_id=?').run(req.params.id);
      const stmt = db.prepare('INSERT INTO wardrobe_outfit_items (outfit_id,item_id,sort_order) VALUES (?,?,?)');
      d.item_ids.forEach((itemId, i) => stmt.run(req.params.id, itemId, i));
    }
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/outfits/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM wardrobe_outfit_items WHERE outfit_id=?').run(req.params.id);
    db.prepare('DELETE FROM wardrobe_outfits WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Planner ───────────────────────────────────────────────────
router.get('/planner', (req, res) => {
  try {
    const { start, end, member_id } = req.query;
    let where = '1=1';
    const params = [];
    if (start) { where += ' AND p.plan_date >= ?'; params.push(start); }
    if (end)   { where += ' AND p.plan_date <= ?'; params.push(end); }
    if (member_id) { where += ' AND p.family_member_id=?'; params.push(member_id); }

    const rows = db.prepare(`
      SELECT p.*, o.name AS outfit_name, fm.display_name AS member_name
      FROM wardrobe_planner p
      LEFT JOIN wardrobe_outfits o ON o.id=p.outfit_id
      LEFT JOIN family_members fm ON fm.id=p.family_member_id
      WHERE ${where}
      ORDER BY p.plan_date, p.id
    `).all(...params);
    res.json(rows);
  } catch(e) { serverError(res, e); }
});

router.post('/planner', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.plan_date) return badRequest(res, 'plan_date required');
    const result = db.prepare(`
      INSERT INTO wardrobe_planner (plan_date, outfit_id, family_member_id, occasion, notes)
      VALUES (?,?,?,?,?)
    `).run(d.plan_date, d.outfit_id||null, d.family_member_id||null, d.occasion||null, d.notes||null);
    res.json({ id: result.lastInsertRowid, ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/planner/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM wardrobe_planner WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Wear log ─────────────────────────────────────────────────
router.post('/wear', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.item_id || !d.worn_date) return badRequest(res, 'item_id and worn_date required');
    const result = db.prepare(`
      INSERT INTO wardrobe_wear_log (item_id, outfit_id, worn_date, family_member_id, notes)
      VALUES (?,?,?,?,?)
    `).run(d.item_id, d.outfit_id||null, d.worn_date, d.family_member_id||null, d.notes||null);
    res.json({ id: result.lastInsertRowid, ok: true });
  } catch(e) { serverError(res, e); }
});

router.get('/wear/:item_id', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT wl.*, fm.display_name AS member_name
      FROM wardrobe_wear_log wl
      LEFT JOIN family_members fm ON fm.id=wl.family_member_id
      WHERE wl.item_id=?
      ORDER BY wl.worn_date DESC
    `).all(req.params.item_id);
    res.json(rows);
  } catch(e) { serverError(res, e); }
});

// ── Insights ─────────────────────────────────────────────────
router.get('/insights', (req, res) => {
  try {
    const { member_id } = req.query;
    const memberCond = member_id ? 'AND i.wardrobe_owner_id=?' : '';
    const params = member_id ? [member_id] : [];

    const baseWhere = `i.category IN (${WARDROBE_CATEGORIES.map(()=>'?').join(',')}) AND (i.wardrobe_status='active' OR i.wardrobe_status IS NULL) ${memberCond}`;
    const allParams = [...WARDROBE_CATEGORIES, ...params];

    const total = db.prepare(`SELECT COUNT(*) n FROM items i WHERE ${baseWhere}`).get(...allParams).n;
    const totalValue = db.prepare(`SELECT COALESCE(SUM(purchase_price),0) v FROM items i WHERE ${baseWhere}`).get(...allParams).v;
    const outfits = db.prepare(`SELECT COUNT(*) n FROM wardrobe_outfits${member_id?' WHERE family_member_id=?':''}`).get(...params).n;

    const neverWorn = db.prepare(`
      SELECT COUNT(*) n FROM items i
      WHERE ${baseWhere}
      AND i.id NOT IN (SELECT DISTINCT item_id FROM wardrobe_wear_log)
    `).get(...allParams).n;

    const notWorn30 = db.prepare(`
      SELECT COUNT(*) n FROM items i
      WHERE ${baseWhere}
      AND (
        i.id NOT IN (SELECT DISTINCT item_id FROM wardrobe_wear_log)
        OR i.id IN (
          SELECT item_id FROM wardrobe_wear_log
          GROUP BY item_id
          HAVING MAX(worn_date) < date('now','-30 days')
        )
      )
    `).get(...allParams).n;

    const mostWorn = db.prepare(`
      SELECT i.id, i.name, i.wardrobe_nickname, i.category, i.brand,
        COUNT(wl.id) AS times_worn,
        ROUND(COALESCE(i.purchase_price,0) / MAX(COUNT(wl.id),1), 2) AS cost_per_wear
      FROM items i
      JOIN wardrobe_wear_log wl ON wl.item_id=i.id
      WHERE ${baseWhere}
      GROUP BY i.id
      ORDER BY times_worn DESC
      LIMIT 5
    `).all(...allParams);

    res.json({ total, total_value: totalValue, outfits, never_worn: neverWorn, not_worn_30: notWorn30, most_worn: mostWorn });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
