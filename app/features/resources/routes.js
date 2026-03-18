/**
 * features/resources/routes.js
 * PRIVATE writes, PUBLIC reads.
 * Tags use the central tags + taggables tables — same system as every other module.
 * entity_type = 'resource' in taggables.
 */
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../auth/middleware');
const db = require('../../db/db');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');
const { notFound, badRequest, serverError } = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');

// ── Tag helpers (central tags + taggables) ────────────────────


/** Attach tag names to a resource (replaces existing) */

/** Attach tag objects to a resource row */
function attachTags(resource) {
  if (!resource) return resource;
  const rows = db.prepare(`
    SELECT t.name FROM tags t
    JOIN taggables tb ON t.id = tb.tag_id
    WHERE tb.entity_type = 'resource' AND tb.entity_id = ?
    ORDER BY t.name
  `).all(resource.id);
  resource.tags = rows.map(r => r.name);
  return resource;
}

// ══════════════════════════════════════════════════════════════
// LIST  GET /api/v1/resources
// ══════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  try {
    const { q, category, tag, favorite } = req.query;
    let sql = 'SELECT * FROM resources WHERE 1=1';
    const params = [];
    if (q) {
      sql += ' AND (name LIKE ? OR description LIKE ? OR access_note LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (favorite === '1') { sql += ' AND is_favorite = 1'; }
    if (tag) {
      sql += ` AND id IN (
        SELECT tb.entity_id FROM taggables tb
        JOIN tags t ON t.id = tb.tag_id
        WHERE tb.entity_type = 'resource' AND t.name = ?
      )`;
      params.push(tag.toLowerCase());
    }
    sql += ' ORDER BY is_favorite DESC, sort_order ASC, name ASC';
    const rows = db.prepare(sql).all(...params).map(r => attachTags(r));
    res.json(rows);
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// CATEGORIES  GET /api/v1/resources/categories
// ══════════════════════════════════════════════════════════════
router.get('/categories', (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT category, COUNT(*) as count FROM resources
      WHERE category IS NOT NULL
      GROUP BY category ORDER BY count DESC, category ASC
    `).all());
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// TAGS USED BY RESOURCES  GET /api/v1/resources/tags
// Returns only tags that are attached to at least one resource
// ══════════════════════════════════════════════════════════════
router.get('/tags', (req, res) => {
  try {
    res.json(db.prepare(`
      SELECT t.name AS tag, COUNT(*) AS count
      FROM tags t
      JOIN taggables tb ON t.id = tb.tag_id
      WHERE tb.entity_type = 'resource'
      GROUP BY t.id ORDER BY count DESC, t.name ASC
    `).all());
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// GET ONE  GET /api/v1/resources/:id
// ══════════════════════════════════════════════════════════════
router.get('/:id', (req, res) => {
  try {
    const r = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
    if (!r) return notFound(res, 'Resource');
    res.json(attachTags(r));
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// CREATE  POST /api/v1/resources
// ══════════════════════════════════════════════════════════════
// ── All routes below require authentication ──────────────
router.use(requireAuth);

router.post('/', (req, res) => {
  try {
    const { name, description, url, link_type, category, access_note, is_favorite, tags } = req.body;
    if (!name?.trim()) return badRequest(res, 'name is required');
    const r = db.prepare(`
      INSERT INTO resources (name, description, url, link_type, category, access_note, is_favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), description?.trim()||null, url?.trim()||null,
           link_type||'website', category?.trim()||null,
           access_note?.trim()||null, is_favorite?1:0);
    saveTagsByName(r.lastInsertRowid, 'resource', tags || []);
    res.status(201).json(attachTags(db.prepare('SELECT * FROM resources WHERE id=?').get(r.lastInsertRowid)));
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// UPDATE  PUT /api/v1/resources/:id
// ══════════════════════════════════════════════════════════════
router.put('/:id', (req, res) => {
  try {
    const { name, description, url, link_type, category, access_note, is_favorite, tags } = req.body;
    if (!name?.trim()) return badRequest(res, 'name is required');
    if (!db.prepare('SELECT id FROM resources WHERE id=?').get(req.params.id)) return notFound(res, 'Resource');
    db.prepare(`
      UPDATE resources SET name=?,description=?,url=?,link_type=?,category=?,
        access_note=?,is_favorite=?,updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(name.trim(), description?.trim()||null, url?.trim()||null,
           link_type||'website', category?.trim()||null,
           access_note?.trim()||null, is_favorite?1:0, req.params.id);
    saveTagsByName(req.params.id, 'resource', tags || []);
    clearReview('resources', req.params.id);
    res.json(attachTags(db.prepare('SELECT * FROM resources WHERE id=?').get(req.params.id)));
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// TOGGLE FAVORITE  PATCH /api/v1/resources/:id/favorite
// ══════════════════════════════════════════════════════════════
router.patch('/:id/favorite', (req, res) => {
  try {
    const r = db.prepare('SELECT id, is_favorite FROM resources WHERE id=?').get(req.params.id);
    if (!r) return notFound(res, 'Resource');
    const v = r.is_favorite ? 0 : 1;
    db.prepare('UPDATE resources SET is_favorite=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(v, req.params.id);
    res.json({ is_favorite: v });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// DELETE  DELETE /api/v1/resources/:id
// ══════════════════════════════════════════════════════════════
router.delete('/:id', (req, res) => {
  try {
    if (!db.prepare('SELECT id FROM resources WHERE id=?').get(req.params.id)) return notFound(res, 'Resource');
    clearTags(req.params.id, 'resource');  // replaces raw taggables DELETE
    db.prepare('DELETE FROM resources WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// BULK IMPORT  POST /api/v1/resources/import
// ══════════════════════════════════════════════════════════════
router.post('/import', (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) return badRequest(res, 'rows array required');
    const insert = db.prepare(`
      INSERT INTO resources (name, description, url, link_type, category, access_note, is_favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const importMany = db.transaction(items => {
      let count = 0;
      for (const item of items) {
        if (!item.name?.trim()) continue;
        const r = insert.run(item.name.trim(), item.description?.trim()||null,
          item.url?.trim()||null, item.link_type||'website',
          item.category?.trim()||null, item.access_note?.trim()||null, item.is_favorite?1:0);
        saveTagsByName(r.lastInsertRowid, 'resource', item.tags || []);
        count++;
      }
      return count;
    });
    res.status(201).json({ imported: importMany(rows) });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
