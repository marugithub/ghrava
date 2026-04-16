// @ts-check
'use strict';
/**
 * features/templates/routes.js
 * Task template CRUD + apply endpoint.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { serverError, badRequest, notFound } = require('../../shared/errors');

// GET /api/v1/templates — list all active templates with item count
router.get('/', (req, res) => {
  try {
    const templates = db.prepare(`
      SELECT t.*, COUNT(ti.id) as item_count
      FROM task_templates t
      LEFT JOIN task_template_items ti ON ti.template_id = t.id
      WHERE t.is_active = 1
      GROUP BY t.id ORDER BY t.name
    `).all();
    res.json(templates);
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/templates/:id — single template with items
router.get('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM task_templates WHERE id=?').get(req.params.id);
    if (!template) return notFound(res, 'Template');
    const items = db.prepare('SELECT * FROM task_template_items WHERE template_id=? ORDER BY sort_order,id').all(req.params.id);
    res.json({ ...template, items });
  } catch(e) { serverError(res, e); }
});

// POST /api/v1/templates — create template
router.post('/', (req, res) => {
  try {
    const { name, description, category, items = [] } = req.body;
    if (!name) return badRequest(res, 'name required');
    const r = db.prepare(`INSERT INTO task_templates (name, description, category) VALUES (?,?,?)`).run(name, description||null, category||null);
    const tid = r.lastInsertRowid;
    const insertItem = db.prepare(`INSERT INTO task_template_items (template_id,title,notes,priority,due_days_offset,sort_order) VALUES (?,?,?,?,?,?)`);
    items.forEach((item, i) => insertItem.run(tid, item.title, item.notes||null, item.priority||'medium', item.due_days_offset||0, i));
    res.status(201).json({ id: tid });
  } catch(e) { serverError(res, e); }
});

// PUT /api/v1/templates/:id — update template
router.put('/:id', (req, res) => {
  try {
    const { name, description, category } = req.body;
    db.prepare(`UPDATE task_templates SET name=COALESCE(?,name), description=?, category=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name, description||null, category||null, req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// DELETE /api/v1/templates/:id — soft delete
router.delete('/:id', (req, res) => {
  try {
    db.prepare('UPDATE task_templates SET is_active=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// POST /api/v1/templates/:id/apply — create todos from template
router.post('/:id/apply', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM task_templates WHERE id=? AND is_active=1').get(req.params.id);
    if (!template) return notFound(res, 'Template');
    const items = db.prepare('SELECT * FROM task_template_items WHERE template_id=? ORDER BY sort_order').all(req.params.id);
    if (!items.length) return badRequest(res, 'Template has no items');
    const today = new Date();
    const insert = db.prepare(`INSERT INTO todos (title,notes,priority,due_date,category,status) VALUES (?,?,?,?,?,'open')`);
    const ids = [];
    const txn = db.transaction(() => {
      items.forEach(item => {
        const due = item.due_days_offset ? new Date(today.getTime() + item.due_days_offset*86400000).toISOString().slice(0,10) : null;
        const r = insert.run(item.title, item.notes||null, item.priority||'medium', due, template.category||null);
        ids.push(r.lastInsertRowid);
      });
    });
    txn();
    res.json({ ok: true, created: ids.length, ids });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
