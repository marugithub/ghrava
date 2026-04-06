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

// ── Helpers ────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function currentYear() { return String(new Date().getFullYear()); }

// ── Auto-generation engine ─────────────────────────────────────
// Idempotent: will not create duplicate open auto-todos for the same source.
// Auto-resolves todos whose triggering condition has cleared.
function syncAutoTodos() {
  const now  = todayStr();
  const in60 = daysFromNow(60);
  const in90 = daysFromNow(90);
  const year = currentYear();

  // Insert only if no open/in_progress todo exists for this source
  const upsert = db.prepare(`
    INSERT INTO todos
      (title, notes, due_date, priority, category, is_auto,
       auto_type, auto_source_type, auto_source_id, status)
    SELECT ?,?,?,?,?,1,?,?,?,'open'
    WHERE NOT EXISTS (
      SELECT 1 FROM todos
      WHERE is_auto=1 AND auto_type=? AND auto_source_type=? AND auto_source_id=?
        AND status IN ('open','in_progress')
    )
  `);

  // Mark resolved — only updates open/in_progress
  const resolve = db.prepare(`
    UPDATE todos SET status='done', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
    WHERE is_auto=1 AND auto_type=? AND auto_source_type=? AND auto_source_id=?
      AND status IN ('open','in_progress')
  `);

  // ── 1. HSA payments missing receipt ────────────────────────
  try {
    const payments = db.prepare(
      `SELECT id, date, patient, provider, you_paid
       FROM hsa_payments WHERE hsa_eligible=1`
    ).all();

    for (const p of payments) {
      const hasAtt = db.prepare(
        `SELECT 1 FROM attachments WHERE entity_type='hsa_payment' AND entity_id=? LIMIT 1`
      ).get(p.id);
      const saved = db.prepare(
        `SELECT receipt_saved FROM hsa_payments WHERE id=?`
      ).get(p.id)?.receipt_saved;

      if (!hasAtt && !saved) {
        const provider = p.provider || 'HSA expense';
        const amt = p.you_paid ? ` ($${Number(p.you_paid).toFixed(2)})` : '';
        upsert.run(
          `Add receipt: ${provider}${amt}`,
          `HSA payment on ${p.date} — attach a receipt or EOB to qualify for reimbursement.`,
          null, 'high', 'HSA',
          'hsa_missing_receipt', 'hsa_payment', p.id,
          'hsa_missing_receipt', 'hsa_payment', p.id
        );
      } else {
        resolve.run('hsa_missing_receipt', 'hsa_payment', p.id);
      }
    }
  } catch (e) { console.error('[todos] hsa_missing_receipt:', e.message); }

  // ── 2. HSA unreimbursed pool > $500 ────────────────────────
  try {
    const payPool = db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN you_paid ELSE 0 END),0) AS p
       FROM hsa_payments WHERE strftime('%Y',date)=?`
    ).get(year).p || 0;
    const otcPool = db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN amount ELSE 0 END),0) AS p
       FROM hsa_otc WHERE strftime('%Y',date)=?`
    ).get(year).p || 0;
    const total = payPool + otcPool;

    const existing = db.prepare(
      `SELECT id FROM todos WHERE is_auto=1 AND auto_type='hsa_unreimbursed'
       AND status IN ('open','in_progress') LIMIT 1`
    ).get();

    if (total > 500 && !existing) {
      db.prepare(
        `INSERT INTO todos (title, notes, due_date, priority, category, is_auto, auto_type, status)
         VALUES (?,?,?,?,?,1,'hsa_unreimbursed','open')`
      ).run(
        `Submit HSA reimbursement — $${Math.round(total).toLocaleString()} available`,
        `You have $${Number(total).toFixed(2)} in unreimbursed HSA-eligible expenses for ${year}. Log into Fidelity / HSA provider to request reimbursement.`,
        daysFromNow(30), 'high', 'HSA'
      );
    } else if (total <= 500 && existing) {
      db.prepare(
        `UPDATE todos SET status='done', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
         WHERE is_auto=1 AND auto_type='hsa_unreimbursed' AND status IN ('open','in_progress')`
      ).run();
    }
  } catch (e) { console.error('[todos] hsa_unreimbursed:', e.message); }

  // ── 3. Inventory items expiring within 60 days ─────────────
  try {
    const expiring = db.prepare(
      `SELECT i.id, i.name, hw.expiration_date
       FROM items i
       JOIN item_hw_details hw ON hw.item_id = i.id
       WHERE i.is_active=1 AND i.is_archived=0
         AND hw.expiration_date IS NOT NULL
         AND hw.expiration_date >= ? AND hw.expiration_date <= ?`
    ).all(now, in60);

    const expiringIds = new Set(expiring.map(i => i.id));

    // Resolve todos for items no longer in expiry window
    const openExp = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='inv_expiring' AND auto_source_type='item'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openExp) {
      if (!expiringIds.has(sid)) resolve.run('inv_expiring', 'item', sid);
    }

    for (const item of expiring) {
      const days = Math.ceil((new Date(item.expiration_date) - new Date(now)) / 86400000);
      const prio = days <= 7 ? 'urgent' : days <= 21 ? 'high' : 'medium';
      upsert.run(
        `Expiring soon: ${item.name}`,
        `"${item.name}" expires ${item.expiration_date} (${days} day${days !== 1 ? 's' : ''}). Use, replace, or dispose.`,
        item.expiration_date, prio, 'Inventory',
        'inv_expiring', 'item', item.id,
        'inv_expiring', 'item', item.id
      );
    }
  } catch (e) { console.error('[todos] inv_expiring:', e.message); }

  // ── 4. Inventory warranty expiring within 90 days ──────────
  try {
    const warr = db.prepare(
      `SELECT id, name, warranty_expires FROM items
       WHERE is_active=1 AND is_archived=0 AND lifetime_warranty=0
         AND warranty_expires IS NOT NULL
         AND warranty_expires >= ? AND warranty_expires <= ?`
    ).all(now, in90);

    const warrIds = new Set(warr.map(i => i.id));
    const openWarr = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='inv_warranty_expiring' AND auto_source_type='item'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openWarr) {
      if (!warrIds.has(sid)) resolve.run('inv_warranty_expiring', 'item', sid);
    }

    for (const item of warr) {
      const days = Math.ceil((new Date(item.warranty_expires) - new Date(now)) / 86400000);
      upsert.run(
        `Warranty expiring: ${item.name}`,
        `Warranty expires ${item.warranty_expires} (${days} days). Consider extended coverage, note serial number, or file a claim if needed.`,
        item.warranty_expires, days <= 30 ? 'high' : 'medium', 'Inventory',
        'inv_warranty_expiring', 'item', item.id,
        'inv_warranty_expiring', 'item', item.id
      );
    }
  } catch (e) { console.error('[todos] inv_warranty_expiring:', e.message); }

  // ── 5. High-value items (>=$200) missing any attachment ─────
  try {
    const highValue = db.prepare(
      `SELECT id, name, purchase_price FROM items
       WHERE is_active=1 AND is_archived=0 AND purchase_price >= 200
         AND id NOT IN (
           SELECT DISTINCT entity_id FROM attachments WHERE entity_type='item'
         )`
    ).all();

    const hvIds = new Set(highValue.map(i => i.id));
    const openHv = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='inv_missing_doc' AND auto_source_type='item'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openHv) {
      if (!hvIds.has(sid)) resolve.run('inv_missing_doc', 'item', sid);
    }

    for (const item of highValue) {
      upsert.run(
        `Add photo/receipt: ${item.name}`,
        `"${item.name}" ($${Number(item.purchase_price).toFixed(2)}) has no attached photos or documents. Attach a receipt, warranty card, or photo for insurance purposes.`,
        null, 'low', 'Inventory',
        'inv_missing_doc', 'item', item.id,
        'inv_missing_doc', 'item', item.id
      );
    }
  } catch (e) { console.error('[todos] inv_missing_doc:', e.message); }

  // ── 6. Daily log overdue follow-ups ────────────────────────
  try {
    const overdue = db.prepare(
      `SELECT id, log_date, entry_text, follow_up_date
       FROM daily_log WHERE follow_up_needed=1 AND follow_up_date < ?`
    ).all(now);

    const odIds = new Set(overdue.map(e => e.id));
    const openOd = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='follow_up_overdue' AND auto_source_type='daily_log'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openOd) {
      if (!odIds.has(sid)) resolve.run('follow_up_overdue', 'daily_log', sid);
    }

    for (const entry of overdue) {
      const preview = (entry.entry_text || '').slice(0, 100).trim();
      upsert.run(
        `Overdue follow-up: ${entry.log_date}`,
        `Log entry from ${entry.log_date}: "${preview}${preview.length >= 100 ? '…' : ''}" — follow-up was due ${entry.follow_up_date}.`,
        entry.follow_up_date, 'urgent', 'General',
        'follow_up_overdue', 'daily_log', entry.id,
        'follow_up_overdue', 'daily_log', entry.id
      );
    }
  } catch (e) { console.error('[todos] follow_up_overdue:', e.message); }

  // ── 7. Discontinued medications with no end_date ───────────
  try {
    const disc = db.prepare(
      `SELECT id, name, patient FROM med_medications
       WHERE status='Discontinued' AND (end_date IS NULL OR end_date='')`
    ).all();

    const discIds = new Set(disc.map(m => m.id));
    const openDisc = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='med_discontinued' AND auto_source_type='med_medication'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openDisc) {
      if (!discIds.has(sid)) resolve.run('med_discontinued', 'med_medication', sid);
    }

    for (const med of disc) {
      upsert.run(
        `Update med record: ${med.name}`,
        `"${med.name}" (${med.patient}) is marked Discontinued but has no end date. Add the discontinuation date for accurate medical history.`,
        null, 'low', 'Medical',
        'med_discontinued', 'med_medication', med.id,
        'med_discontinued', 'med_medication', med.id
      );
    }
  } catch (e) { console.error('[todos] med_discontinued:', e.message); }

  // ── 8. Vehicle service next_due_date within 30 days ─────────
  try {
    const in30 = daysFromNow(30);
    const dueService = db.prepare(`
      SELECT vs.id, vs.service_type, vs.next_due_date, v.nickname, v.make, v.model
      FROM vehicle_service vs
      JOIN vehicles v ON v.id = vs.vehicle_id
      WHERE vs.next_due_date IS NOT NULL AND vs.next_due_date <= ?
        AND v.is_active = 1
    `).all(in30);

    const openSvcIds = new Set(
      db.prepare(`SELECT auto_source_id FROM todos
        WHERE is_auto=1 AND auto_type='vehicle_service_due' AND auto_source_type='vehicle_service'
          AND status IN ('open','in_progress')`).all().map(r => r.auto_source_id)
    );
    const dueSvcIds = new Set(dueService.map(s => s.id));
    // Resolve todos for service records no longer due
    for (const sid of openSvcIds) {
      if (!dueSvcIds.has(sid)) resolve.run('vehicle_service_due', 'vehicle_service', sid);
    }
    for (const svc of dueService) {
      const vname = svc.nickname || `${svc.make||''} ${svc.model||''}`.trim() || 'Vehicle';
      const overdue = svc.next_due_date < now;
      upsert.run(
        `${svc.service_type} due — ${vname}`,
        `${overdue ? 'Overdue' : 'Due'}: ${svc.service_type} for ${vname} (next due ${svc.next_due_date}).`,
        svc.next_due_date, overdue ? 'high' : 'medium', 'Property',
        'vehicle_service_due', 'vehicle_service', svc.id,
        'vehicle_service_due', 'vehicle_service', svc.id
      );
    }
  } catch (e) { console.error('[todos] vehicle_service_due:', e.message); }

  // ── 9. Property maintenance next_due_date within 30 days ────
  try {
    const in30 = daysFromNow(30);
    const dueMaint = db.prepare(`
      SELECT pm.id, pm.category, pm.description, pm.next_due_date, p.nickname
      FROM property_maintenance pm
      JOIN properties p ON p.id = pm.property_id
      WHERE pm.next_due_date IS NOT NULL AND pm.next_due_date <= ?
        AND p.is_active = 1
    `).all(in30);

    const openMaintIds = new Set(
      db.prepare(`SELECT auto_source_id FROM todos
        WHERE is_auto=1 AND auto_type='property_maint_due' AND auto_source_type='property_maintenance'
          AND status IN ('open','in_progress')`).all().map(r => r.auto_source_id)
    );
    const dueMaintIds = new Set(dueMaint.map(m => m.id));
    for (const sid of openMaintIds) {
      if (!dueMaintIds.has(sid)) resolve.run('property_maint_due', 'property_maintenance', sid);
    }
    for (const maint of dueMaint) {
      const pname = maint.nickname || 'Property';
      const overdue = maint.next_due_date < now;
      upsert.run(
        `${maint.category} maintenance due — ${pname}`,
        `${overdue ? 'Overdue' : 'Due'}: ${maint.description} at ${pname} (next due ${maint.next_due_date}).`,
        maint.next_due_date, overdue ? 'high' : 'medium', 'Property',
        'property_maint_due', 'property_maintenance', maint.id,
        'property_maint_due', 'property_maintenance', maint.id
      );
    }
  } catch (e) { console.error('[todos] property_maint_due:', e.message); }
}

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
    p.push(parseInt(limit), parseInt(offset));

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
    const { n } = db.prepare(
      `SELECT COUNT(*) AS n FROM todos WHERE status IN ('open','in_progress')`
    ).get();
    res.json({ count: n });
  } catch (e) { res.json({ count: 0 }); }
});

// GET /api/v1/todos/:id
// ── Single todo by id ──────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const todo = db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id);
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
    const newId = info.lastInsertRowid;
    if (tags && tags.length) saveTagsByName(newId, 'todo', tags);
    if (req.body.family_member_ids !== undefined) saveFamilyMembers(newId, 'todo', req.body.family_member_ids);
    res.status(201).json(withFamilyMembers(withTagNames(db.prepare('SELECT * FROM todos WHERE id=?').get(newId), 'todo'), 'todo'));
  } catch (e) { serverError(res, e); }
});

// PUT /api/v1/todos/:id
// ── Update a todo (status, fields, tags) ───────────────────────
router.put('/:id', (req, res) => {
  try {
    const todo = db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id);
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
    if (req.body.tags !== undefined) saveTagsByName(req.params.id, 'todo', req.body.tags);
    clearReview('todos', req.params.id);
    if (req.body.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'todo', req.body.family_member_ids);
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
    const todo = db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id);
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
    const todo = db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id);
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
    const todo = db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id);
    if (!todo) return notFound(res, 'Todo');
    if (todo.is_auto) return badRequest(res, 'Use PATCH /status = dismissed for auto todos.');
    clearFamilyMembers(req.params.id, 'todo');
    clearTags(req.params.id, 'todo');
    db.prepare('DELETE FROM todos WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
