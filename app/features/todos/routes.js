// @ts-check
/**
 * features/todos/routes.js
 * Todos — user-created tasks + auto-generated data-integrity items.
 *
 * Auto-generation rules (syncAutoTodos, runs on every GET /):
 *
 *  hsa_missing_receipt   — hsa_payments: hsa_eligible=1, receipt_saved=0, no attachment
 *  hsa_unreimbursed      — unreimbursed HSA pool > $500 for current year
 *  inv_expiring          — item with expiration_date within 60 days
 *  inv_warranty_expiring — item warranty_expires within 90 days, no lifetime warranty
 *  inv_missing_doc       — item purchase_price >= $200 with zero attachments
 *  follow_up_overdue     — daily_log entry with overdue follow_up_date
 *  med_discontinued      — medication status=Discontinued with no end_date note
 */
'use strict';

const express = require('express');
const { requireAuth } = require('../auth/middleware');
const router  = express.Router();
const db      = require('../../db/db');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');
const { saveFamilyMembers, getFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');


const { badRequest, notFound, serverError } = require('../../shared/errors');
const { clearReview, checkAndCompleteTodo } = require('../../shared/needs-review');

const { syncAutoTodos, syncMedRefillTodos } = require('../../shared/autoTodos');

// ── GET /api/v1/todos ──────────────────────────────────────────
// ?status=open  ?category=HSA  ?priority=urgent  ?auto=1|0
// ── List todos (triggers auto-sync first) ──────────────────────
router.get('/', (req, res) => {
  try {
    syncAutoTodos();
    checkAndCompleteTodo(); // auto-complete "Data Needs Review" todo if all flags cleared

    const { status, category, priority, auto, limit = 300, offset = 0 } = req.query;
    let sql = `SELECT * FROM todos WHERE 1=1`;
    const p = [];

    if (status === 'done') {
      sql += ` AND status IN ('done','dismissed')`;
    } else if (status === 'all') {
      // no filter
    } else {
      sql += ` AND status IN ('open','in_progress')`;
    }

    if (category) { sql += ` AND category=?`;  p.push(category); }
    if (priority) { sql += ` AND priority=?`;  p.push(priority); }
    if (auto === '1') { sql += ` AND is_auto=1`; }
    if (auto === '0') { sql += ` AND is_auto=0`; }

    sql += ` ORDER BY
      CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
      due_date ASC, created_at DESC
    LIMIT ? OFFSET ?`;
    p.push(parseInt(String(limit ?? 300)), parseInt(String(offset ?? 0)));

    const todos = db.prepare(sql).all(...p);

    const stats = db.prepare(`
      SELECT
        COUNT(CASE WHEN status IN ('open','in_progress') THEN 1 END)                            AS open_count,
        COUNT(CASE WHEN status IN ('open','in_progress') AND is_auto=1 THEN 1 END)              AS auto_count,
        COUNT(CASE WHEN status IN ('open','in_progress') AND priority='urgent' THEN 1 END)      AS urgent_count,
        COUNT(CASE WHEN status IN ('open','in_progress') AND due_date < date('now') THEN 1 END) AS overdue_count,
        COUNT(CASE WHEN status='done' AND completed_at >= date('now','-7 days') THEN 1 END)     AS done_week
      FROM todos
    `).get();

    res.json({ todos: todos.map(t => withFamilyMembers(withTagNames(t, 'todo'), 'todo')), stats });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/todos/count — lightweight for nav badge
// ── Count of open todos (used by nav badge) ────────────────────
router.get('/count', (req, res) => {
  try {
    syncAutoTodos();
    try { syncMedRefillTodos(db); } catch(e) { /* non-fatal */ }
    const { n } = /** @type {{n:number}} */ (db.prepare(
      `SELECT COUNT(*) AS n FROM todos WHERE status IN ('open','in_progress')`
    ).get());
    res.json({ count: n });
  } catch (e) { res.json({ count: 0 }); }
});

// GET /api/v1/todos/:id
// ── Single todo by id ──────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const todo = /** @type {import('../../shared/types').Todo|null} */ (db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id));
    if (!todo) return notFound(res, 'Todo');
    res.json(todo);
  } catch (e) { serverError(res, e); }
});

// ── All routes below require authentication ──────────────
router.use(requireAuth);

// POST /api/v1/todos
// ── Create a todo ──────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { title, notes, due_date, priority, category, reminder_date, recurrence, recurrence_days, tags } = req.body;
    if (!title?.trim()) return badRequest(res, 'title required');
    const info = db.prepare(`
      INSERT INTO todos
        (title, notes, due_date, priority, category, is_auto, reminder_date, recurrence, status)
      VALUES (?,?,?,?,?,0,?,?,'open')
    `).run(
      title.trim(), notes || null, due_date || null,
      priority || 'medium', category || 'General',
      reminder_date || null, recurrence || null
    );
    const newId = Number(info.lastInsertRowid);
    if (tags && tags.length) saveTagsByName(newId, 'todo', tags);
    if (req.body.family_member_ids !== undefined) saveFamilyMembers(newId, 'todo', req.body.family_member_ids);
    res.status(201).json(withFamilyMembers(withTagNames(db.prepare('SELECT * FROM todos WHERE id=?').get(newId), 'todo'), 'todo'));
  } catch (e) { serverError(res, e); }
});

// PUT /api/v1/todos/:id
// ── Update a todo (status, fields, tags) ───────────────────────
router.put('/:id', (req, res) => {
  try {
    const todo = /** @type {import('../../shared/types').Todo|null} */ (db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id));
    if (!todo) return notFound(res, 'Todo');
    if (todo.is_auto) return badRequest(res, 'Auto-generated todos cannot be edited — dismiss or complete them.');
    const { title, notes, due_date, priority, category, status, reminder_date, recurrence, recurrence_days } = req.body;
    db.prepare(`
      UPDATE todos SET
        title=?, notes=?, due_date=?, priority=?, category=?,
        status=?, reminder_date=?, recurrence=?,
        completed_at=CASE WHEN ? IN ('done','dismissed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      title ?? todo.title, notes ?? todo.notes, due_date ?? todo.due_date,
      priority ?? todo.priority, category ?? todo.category,
      status ?? todo.status, reminder_date ?? todo.reminder_date,
      recurrence ?? todo.recurrence,
      status ?? todo.status,
      req.params.id
    );
    if (req.body.tags !== undefined) saveTagsByName(Number(req.params.id), 'todo', req.body.tags);
    clearReview('todos', Number(req.params.id));
    if (req.body.family_member_ids !== undefined) saveFamilyMembers(Number(req.params.id), 'todo', req.body.family_member_ids);
    res.json(withFamilyMembers(withTagNames(db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id), 'todo'), 'todo'));
  } catch (e) { serverError(res, e); }
});

// PATCH /api/v1/todos/:id/status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!['open','in_progress','done','dismissed'].includes(status)) {
      return badRequest(res, 'Invalid status. Use: open, in_progress, done, dismissed');
    }
    const todo = /** @type {import('../../shared/types').Todo|null} */ (db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id));
    if (!todo) return notFound(res, 'Todo');
    db.prepare(`
      UPDATE todos SET
        status=?,
        completed_at=CASE WHEN ? IN ('done','dismissed') THEN CURRENT_TIMESTAMP ELSE NULL END,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(status, status, req.params.id);

    // Spawn next occurrence if recurring and just completed
    let nextId = null;
    if (status === 'done' && todo.recurrence && todo.recurrence !== 'none') {
      nextId = spawnNextRecurring(todo);
    }
    res.json({ ok: true, status, next_id: nextId });
  } catch (e) { serverError(res, e); }
});

function spawnNextRecurring(todo) {
  try {
    const base = todo.due_date ? new Date(todo.due_date) : new Date();
    const next = new Date(base);
    switch (todo.recurrence) {
      case 'daily':        next.setDate(next.getDate() + 1); break;
      case 'weekly':       next.setDate(next.getDate() + 7); break;
      case 'monthly':      next.setMonth(next.getMonth() + 1); break;
      case 'yearly':       next.setFullYear(next.getFullYear() + 1); break;
      case 'every_n_days': {
        const days = parseInt(todo.recurrence_days) || 1;
        next.setDate(next.getDate() + days);
        break;
      }
      default: return null;
    }
    const r = db.prepare(`
      INSERT INTO todos (title, notes, due_date, priority, category, recurrence, recurrence_days, status)
      VALUES (?,?,?,?,?,?,?,'open')
    `).run(todo.title, todo.notes, next.toISOString().slice(0,10),
           todo.priority, todo.category, todo.recurrence,
           todo.recurrence_days || null);
    return r.lastInsertRowid;
  } catch (e) { return null; }
}

// PATCH /api/v1/todos/:id/snooze
router.patch('/:id/snooze', (req, res) => {
  try {
    const { days = 1 } = req.body;
    const todo = /** @type {import('../../shared/types').Todo|null} */ (db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id));
    if (!todo) return notFound(res, 'Todo');
    const today = new Date().toISOString().slice(0,10);
    const base  = (todo.due_date && todo.due_date >= today) ? new Date(todo.due_date) : new Date();
    base.setDate(base.getDate() + parseInt(days));
    const newDue = base.toISOString().slice(0,10);
    db.prepare('UPDATE todos SET due_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(newDue, req.params.id);
    res.json({ ok: true, due_date: newDue });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/todos/bulk-complete
// ── Mark multiple todos done in one call ───────────────────────
router.post('/bulk-complete', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return badRequest(res, 'ids array required');
    const ph = ids.map(() => '?').join(',');
    db.prepare(`UPDATE todos SET status='done', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id IN (${ph})`).run(...ids);
    res.json({ ok: true, completed: ids.length });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/todos/:id — user-created only
router.delete('/:id', (req, res) => {
  try {
    const todo = /** @type {import('../../shared/types').Todo|null} */ (db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id));
    if (!todo) return notFound(res, 'Todo');
    if (todo.is_auto) return badRequest(res, 'Use PATCH /status = dismissed for auto todos.');
    clearFamilyMembers(Number(req.params.id), 'todo');
    clearTags(Number(req.params.id), 'todo');
    db.prepare('DELETE FROM todos WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
