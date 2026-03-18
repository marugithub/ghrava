/**
 * features/dailylog/routes.js
 * Reads are public. Writes require authentication.
 * Full CRUD: list, get, create, update, delete.
 * Supports: search, filter by category, follow-up flag.
 */

const express = require('express');
const { requireAuth } = require('../auth/middleware');
const router = express.Router();
const db = require('../../db/db');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');
const { notFound, badRequest, serverError } = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');


// ── GET /api/v1/daily-log ──────────────────────────────────────
// Query params: ?search=text  ?category=Finance  ?follow_up=1  ?limit=50  ?offset=0
// ── List entries (filterable by date range, category, follow-up) ─
router.get('/', (req, res) => {
  try {
    const { search, category, follow_up, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM daily_log WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND entry_text LIKE ?';
      params.push(`%${search}%`);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (follow_up === '1') {
      sql += ' AND follow_up_needed = 1';
    }

    // Count total for pagination
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countSql).get(...params);

    sql += ` ORDER BY
      CASE WHEN follow_up_needed=1 AND follow_up_date < date('now') THEN 0
           WHEN follow_up_needed=1 AND (follow_up_date IS NULL OR follow_up_date >= date('now')) THEN 1
           ELSE 2 END,
      log_date DESC, created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const entries = db.prepare(sql).all(...params);

    res.json({ entries, total, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (err) { serverError(res, err); }
});

// ── GET /api/v1/daily-log/categories ──────────────────────────
router.get('/categories', (req, res) => {
  res.json(VALID_CATEGORIES);
});

// ── GET /api/v1/daily-log/follow-ups ──────────────────────────
// Returns all entries with follow_up_needed = 1, ordered by follow_up_date
router.get('/follow-ups', (req, res) => {
  try {
    const entries = db.prepare(`
      SELECT * FROM daily_log
      WHERE follow_up_needed = 1
      ORDER BY follow_up_date ASC, log_date DESC
    `).all();
    res.json(entries);
  } catch (err) { serverError(res, err); }
});

// ── GET /api/v1/daily-log/:id ──────────────────────────────────
// ── Single entry by id ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM daily_log WHERE id = ?').get(req.params.id);
    if (!entry) return notFound(res, 'Log entry');
    res.json(withTagNames(entry, 'daily_log'));
  } catch (err) { serverError(res, err); }
});

// ── All routes below require authentication ──────────────────
// requireAuth applied per-route on writes only

// ── POST /api/v1/daily-log ─────────────────────────────────────
// ── Create an entry ────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  try {
    const { log_date, category, entry_text, follow_up_needed, follow_up_date, tags } = req.body;

    if (!entry_text || !entry_text.trim()) return badRequest(res, 'entry_text is required');
    if (!log_date) return badRequest(res, 'log_date is required');

    const result = db.prepare(`
      INSERT INTO daily_log (log_date, category, entry_text, follow_up_needed, follow_up_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      log_date,
      category || 'General',
      entry_text.trim(),
      follow_up_needed ? 1 : 0,
      follow_up_needed && follow_up_date ? follow_up_date : null
    );

    const newId = result.lastInsertRowid;
    if (tags && tags.length) saveTagsByName(newId, 'daily_log', tags);
    const entry = db.prepare('SELECT * FROM daily_log WHERE id = ?').get(newId);
    res.status(201).json({ ...entry, tags: getTagNames(newId, 'daily_log') });
  } catch (err) { serverError(res, err); }
});

// ── PUT /api/v1/daily-log/:id ──────────────────────────────────
// ── Update an entry (also replaces tags) ───────────────────────
router.put('/:id', requireAuth, (req, res) => {
  try {
    const { log_date, category, entry_text, follow_up_needed, follow_up_date, tags } = req.body;

    if (!entry_text || !entry_text.trim()) return badRequest(res, 'entry_text is required');
    if (!log_date) return badRequest(res, 'log_date is required');

    const existing = db.prepare('SELECT id FROM daily_log WHERE id = ?').get(req.params.id);
    if (!existing) return notFound(res, 'Log entry');

    db.prepare(`
      UPDATE daily_log SET
        log_date = ?, category = ?, entry_text = ?,
        follow_up_needed = ?, follow_up_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      log_date,
      category || 'General',
      entry_text.trim(),
      follow_up_needed ? 1 : 0,
      follow_up_needed && follow_up_date ? follow_up_date : null,
      req.params.id
    );

    if (tags !== undefined) saveTagsByName(req.params.id, 'daily_log', tags);
    clearReview('daily_log', req.params.id);
    const entry = db.prepare('SELECT * FROM daily_log WHERE id = ?').get(req.params.id);
    res.json(withTagNames(entry, 'daily_log'));
  } catch (err) { serverError(res, err); }
});


// ── PATCH /api/v1/daily-log/:id — partial update (e.g. clear follow-up) ──
router.patch('/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM daily_log WHERE id = ?').get(req.params.id);
    if (!existing) return notFound(res, 'Log entry');
    const updates = [];
    const params  = [];
    if ('follow_up_needed' in req.body) {
      updates.push('follow_up_needed = ?');
      params.push(req.body.follow_up_needed ? 1 : 0);
    }
    if ('follow_up_date' in req.body) {
      updates.push('follow_up_date = ?');
      params.push(req.body.follow_up_date || null);
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    db.prepare(`UPDATE daily_log SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const entry = db.prepare('SELECT * FROM daily_log WHERE id = ?').get(req.params.id);
    res.json(entry);
  } catch (err) { serverError(res, err); }
});

// ── DELETE /api/v1/daily-log/:id ───────────────────────────────
// ── Soft-delete ─────────────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM daily_log WHERE id = ?').get(req.params.id);
    if (!existing) return notFound(res, 'Log entry');
    clearTags(req.params.id, 'daily_log');  // replaces raw taggables DELETE
    db.prepare('DELETE FROM daily_log WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
