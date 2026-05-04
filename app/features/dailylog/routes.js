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


// Check once at module load whether memory_members table exists
const _memTableExists = (() => {
  try {
    db.prepare("SELECT 1 FROM memory_members LIMIT 1").get();
    return true;
  } catch { return false; }
})();

// ── GET /api/v1/daily-log ──────────────────────────────────────
// Query params: ?search=text  ?category=Finance  ?follow_up=1  ?limit=50  ?offset=0
// ── List entries (filterable by date range, category, follow-up) ─
router.get('/', (req, res) => {
  try {
    const { search, category, follow_up, limit = 50, offset = 0 } = req.query;

    let sql = `SELECT dl.*,
      (SELECT COUNT(*) FROM attachments WHERE entity_type='daily_log' AND entity_id=dl.id) AS attachment_count${_memTableExists ? `,
      CASE WHEN dl.is_memory=1 THEN (
        SELECT GROUP_CONCAT(fm.display_name, ', ')
        FROM memory_members mm
        JOIN family_members fm ON fm.id=mm.family_member_id
        WHERE mm.log_id=dl.id
      ) END AS member_names` : ''}
      FROM daily_log dl WHERE 1=1`;
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

    // Count total for pagination — build matching WHERE using same params
    let countWhere = '1=1';
    const countParams = [];
    if (search)    { countWhere += ' AND entry_text LIKE ?'; countParams.push(`%${search}%`); }
    if (category)  { countWhere += ' AND category = ?';      countParams.push(category); }
    if (follow_up === '1') { countWhere += ' AND follow_up_needed = 1'; }
    const { total } = db.prepare(`SELECT COUNT(*) as total FROM daily_log WHERE ${countWhere}`).get(...countParams);

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

router.get('/memories', (req, res) => {
  if (!_memTableExists) return res.json([]);
  try {
    const { member_id, category, year } = req.query;
    let where = 'dl.is_memory = 1';
    const params = [];
    if (category) { where += ' AND dl.memory_category = ?'; params.push(category); }
    if (year)     { where += " AND strftime('%Y', dl.log_date) = ?"; params.push(year); }
    if (member_id) {
      where += ' AND EXISTS (SELECT 1 FROM memory_members mm WHERE mm.log_id=dl.id AND mm.family_member_id=?)';
      params.push(member_id);
    }
    const rows = db.prepare(`
      SELECT dl.*,
        (SELECT GROUP_CONCAT(fm.display_name, ', ')
         FROM memory_members mm
         JOIN family_members fm ON fm.id = mm.family_member_id
         WHERE mm.log_id = dl.id) AS member_names,
        (SELECT GROUP_CONCAT(mm.family_member_id, ',')
         FROM memory_members mm WHERE mm.log_id = dl.id) AS member_ids_csv
      FROM daily_log dl
      WHERE ${where}
      ORDER BY dl.log_date DESC
    `).all(...params);
    const result = rows.map(r => ({
      ...withTagNames(r, 'daily_log'),
      member_ids: r.member_ids_csv ? r.member_ids_csv.split(',').map(Number) : []
    }));
    res.json(result);
  } catch (err) { serverError(res, err); }
});

// ── GET /api/v1/daily-log/:id ──────────────────────────────────
// ── Single entry by id ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const entry = db.prepare('SELECT * FROM daily_log WHERE id = ?').get(req.params.id);
    if (!entry) return notFound(res, 'Log entry');
    const members = _memTableExists ? db.prepare(`
      SELECT mm.family_member_id, fm.display_name
      FROM memory_members mm
      JOIN family_members fm ON fm.id = mm.family_member_id
      WHERE mm.log_id = ?
    `).all(req.params.id) : [];
    res.json({ ...withTagNames(entry, 'daily_log'), memory_members: members });
  } catch (err) { serverError(res, err); }
});

// ── All routes below require authentication ──────────────────
// All routes are public — daily-log is not gated behind auth (per project rules,
// only settings/routes.js requires auth).

// ── POST /api/v1/daily-log ─────────────────────────────────────
// ── Create an entry ────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { log_date, category, entry_text, follow_up_needed, follow_up_date, tags,
            is_memory, memory_category, member_ids } = req.body;

    if (!entry_text || !entry_text.trim()) return badRequest(res, 'entry_text is required');
    if (!log_date) return badRequest(res, 'log_date is required');

    const result = db.prepare(`
      INSERT INTO daily_log (log_date, category, entry_text, follow_up_needed, follow_up_date,
                             is_memory, memory_category)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      log_date,
      category || 'General',
      entry_text.trim(),
      follow_up_needed ? 1 : 0,
      follow_up_needed && follow_up_date ? follow_up_date : null,
      is_memory ? 1 : 0,
      is_memory && memory_category ? memory_category : null
    );

    const newId = result.lastInsertRowid;
    if (tags && tags.length) saveTagsByName(newId, 'daily_log', tags);
    if (_memTableExists && is_memory && Array.isArray(member_ids) && member_ids.length) {
      const stmt = db.prepare('INSERT INTO memory_members (log_id, family_member_id) VALUES (?,?)');
      member_ids.forEach(mid => stmt.run(newId, mid));
    }
    const entry = db.prepare('SELECT * FROM daily_log WHERE id = ?').get(newId);
    res.status(201).json({ ...entry, tags: getTagNames(newId, 'daily_log') });
  } catch (err) { serverError(res, err); }
});

// ── PUT /api/v1/daily-log/:id ──────────────────────────────────
// ── Update an entry (also replaces tags) ───────────────────────
router.put('/:id', (req, res) => {
  try {
    const { log_date, category, entry_text, follow_up_needed, follow_up_date, tags,
            is_memory, memory_category, member_ids } = req.body;

    if (!entry_text || !entry_text.trim()) return badRequest(res, 'entry_text is required');
    if (!log_date) return badRequest(res, 'log_date is required');

    const existing = db.prepare('SELECT id FROM daily_log WHERE id = ?').get(req.params.id);
    if (!existing) return notFound(res, 'Log entry');

    db.prepare(`
      UPDATE daily_log SET
        log_date = ?, category = ?, entry_text = ?,
        follow_up_needed = ?, follow_up_date = ?,
        is_memory = ?, memory_category = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      log_date,
      category || 'General',
      entry_text.trim(),
      follow_up_needed ? 1 : 0,
      follow_up_needed && follow_up_date ? follow_up_date : null,
      is_memory ? 1 : 0,
      is_memory && memory_category ? memory_category : null,
      req.params.id
    );

    if (tags !== undefined) saveTagsByName(req.params.id, 'daily_log', tags);
    if (_memTableExists && is_memory !== undefined) {
      db.prepare('DELETE FROM memory_members WHERE log_id = ?').run(req.params.id);
      if (is_memory && Array.isArray(member_ids) && member_ids.length) {
        const stmt = db.prepare('INSERT INTO memory_members (log_id, family_member_id) VALUES (?,?)');
        member_ids.forEach(mid => stmt.run(req.params.id, mid));
      }
    }
    clearReview('daily_log', req.params.id);
    const entry = db.prepare('SELECT * FROM daily_log WHERE id = ?').get(req.params.id);
    res.json(withTagNames(entry, 'daily_log'));
  } catch (err) { serverError(res, err); }
});


// ── PATCH /api/v1/daily-log/:id — partial update (e.g. clear follow-up) ──
router.patch('/:id', (req, res) => {
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
    // v202604.139 — Promotion link. Set when an entry is promoted into
    // another module (kids note, medical visit, todo). Pass null/null
    // to un-promote.
    if ('promoted_to_type' in req.body) {
      updates.push('promoted_to_type = ?');
      params.push(req.body.promoted_to_type || null);
    }
    if ('promoted_to_id' in req.body) {
      updates.push('promoted_to_id = ?');
      params.push(req.body.promoted_to_id != null ? parseInt(req.body.promoted_to_id, 10) : null);
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
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM daily_log WHERE id = ?').get(req.params.id);
    if (!existing) return notFound(res, 'Log entry');
    clearTags(req.params.id, 'daily_log');  // replaces raw taggables DELETE
    db.prepare('DELETE FROM daily_log WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});



// GET /api/v1/daily-log/export/csv
router.get('/export/csv', (req, res) => {
  try {
    const { year } = req.query;
    let sql = 'SELECT id,log_date,category,entry_text,follow_up_needed,follow_up_date,created_at FROM daily_log';
    const params = [];
    if (year) { sql += " WHERE strftime('%Y',log_date)=?"; params.push(String(year)); }
    sql += ' ORDER BY log_date DESC';
    const rows = db.prepare(sql).all(...params);
    const h = ['id','log_date','category','entry_text','follow_up_needed','follow_up_date','created_at'];
    function esc(v) { if (v==null) return ''; const s=String(v); return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`  :s; }
    const lines = rows.map(r => h.map(k => esc(r[k])).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="daily_log${year?'_'+year:''}.csv"`);
    res.send([h.join(','), ...lines].join('\n'));
  } catch(e) { const {serverError}=require('../errors')||{serverError:(r,e)=>r.status(500).json({error:e.message})}; res.status(500).json({error:e.message}); }
});


// POST /api/v1/daily-log/quick — quick capture from global modal
router.post('/quick', (req, res) => {
  try {
    const { content, category, follow_up_needed, follow_up_date } = req.body;
    if (!content?.trim()) return badRequest(res, 'content required');
    const r = db.prepare(`
      INSERT INTO daily_log (entry_date, category, entry_text, follow_up_needed, follow_up_date)
      VALUES (date('now'), ?, ?, ?, ?)
    `).run(category || 'General', content.trim(), follow_up_needed ? 1 : 0, follow_up_date || null);
    res.status(201).json({ id: r.lastInsertRowid, ok: true });
  } catch(e) { serverError(res, e); }
});
module.exports = router;
