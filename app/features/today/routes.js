'use strict';
/**
 * features/today/routes.js
 *
 * Powers the new index.html (the Today page). Aggregates time-sensitive
 * items across subscriptions, documents, insurance, and todos into a
 * single response with three buckets:
 *
 *   now          — due today or overdue
 *   soon         — due within 1..7 days
 *   pipeline_count — count of items due in 8..lookahead days (default 30)
 *
 * Items snoozed via /snooze are excluded from now/soon until the snooze
 * date passes. The pipeline_count ignores snoozes (it's a heads-up only).
 *
 * Routes
 *   GET  /?lookahead=30           list of items + pipeline count
 *   POST /snooze                  body: { record_kind, record_id, days }
 *                                 days defaults to 7. Allowed: 1, 7, 30.
 *   DELETE /snooze/:kind/:id      remove snooze (un-snooze)
 *
 * All routes public (no auth) — matches the rest of the app outside
 * settings.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError } = require('../../shared/errors');

// ── Helpers ──────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate + 'T00:00:00');
  const t = new Date(todayISO() + 'T00:00:00');
  return Math.round((d - t) / 86400000);
}

// Pull the snooze map once per request: { 'kind:id' => 'YYYY-MM-DD' }
function loadSnoozeMap() {
  try {
    const today = todayISO();
    const rows = db.prepare(`
      SELECT record_kind, record_id, snoozed_until
      FROM today_snoozes
      WHERE snoozed_until > ?
    `).all(today);
    const map = new Map();
    rows.forEach(r => map.set(`${r.record_kind}:${r.record_id}`, r.snoozed_until));
    return map;
  } catch(e) { return new Map(); }
}

function isSnoozed(snoozeMap, kind, id) {
  return snoozeMap.has(`${kind}:${id}`);
}

// ── GET / ────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const lookahead = Math.max(1, Math.min(parseInt(req.query.lookahead || '30', 10) || 30, 365));
    const today      = todayISO();
    const day7       = daysFromNow(7);
    const dayLookahead = daysFromNow(lookahead);
    const snoozeMap  = loadSnoozeMap();

    const items = [];
    let pipelineCount = 0;

    // Helper that classifies an item by its due date string and pushes
    // it into the right bucket (or counts it for the pipeline).
    function classify(item) {
      const days = daysBetween(item.due_date);
      if (days == null) return;
      if (isSnoozed(snoozeMap, item.module, item.record_id)) return;
      if (days <= 0) {
        item.severity = 'now';
        items.push(item);
      } else if (days <= 7) {
        item.severity = 'soon';
        items.push(item);
      } else if (days <= lookahead) {
        pipelineCount++;
      }
    }

    // ── Todos ────────────────────────────────────────────────────────
    try {
      const rows = db.prepare(`
        SELECT id, title, due_date, priority
        FROM todos
        WHERE status IN ('open','in_progress')
          AND due_date IS NOT NULL
          AND due_date <= ?
      `).all(dayLookahead);
      rows.forEach(r => classify({
        module:       'todo',
        record_id:    r.id,
        title:        r.title,
        subtitle:     'Todos · ' + (r.priority || 'medium'),
        due_date:     r.due_date,
        action_label: 'Open',
        href:         '/todos.html',
      }));
    } catch(e) { /* table may not exist yet — skip */ }

    // ── Subscriptions ────────────────────────────────────────────────
    try {
      const rows = db.prepare(`
        SELECT id, name, next_billing_date, cost
        FROM subscriptions
        WHERE COALESCE(status,'active') = 'active'
          AND next_billing_date IS NOT NULL
          AND next_billing_date <= ?
      `).all(dayLookahead);
      rows.forEach(r => classify({
        module:       'subscription',
        record_id:    r.id,
        title:        r.name + ' renews',
        subtitle:     'Subscriptions' + (r.cost ? ' · $' + Number(r.cost).toFixed(2) : ''),
        due_date:     r.next_billing_date,
        action_label: 'Open',
        href:         '/subscriptions.html',
      }));
    } catch(e) {}

    // ── Insurance policies ───────────────────────────────────────────
    try {
      const rows = db.prepare(`
        SELECT id, policy_type, coverage_end_date, policy_number
        FROM insurance_policies
        WHERE COALESCE(status,'active') = 'active'
          AND coverage_end_date IS NOT NULL
          AND coverage_end_date <= ?
      `).all(dayLookahead);
      rows.forEach(r => classify({
        module:       'insurance',
        record_id:    r.id,
        title:        (r.policy_type || 'Insurance') + ' renews',
        subtitle:     'Insurance' + (r.policy_number ? ' · ' + r.policy_number : ''),
        due_date:     r.coverage_end_date,
        action_label: 'Open',
        href:         '/insurance.html',
      }));
    } catch(e) {}

    // ── Documents ────────────────────────────────────────────────────
    try {
      const rows = db.prepare(`
        SELECT id, title, expiry_date, category, family_member
        FROM documents
        WHERE COALESCE(is_active,1) = 1
          AND expiry_date IS NOT NULL
          AND expiry_date <= ?
      `).all(dayLookahead);
      rows.forEach(r => classify({
        module:       'document',
        record_id:    r.id,
        title:        (r.title || 'Document') + ' expires',
        subtitle:     'Documents' + (r.family_member ? ' · ' + r.family_member : '') + (r.category ? ' · ' + r.category : ''),
        due_date:     r.expiry_date,
        action_label: 'Open',
        href:         '/documents.html',
      }));
    } catch(e) {}

    // ── Sort each bucket: most urgent first ──────────────────────────
    const now  = items.filter(i => i.severity === 'now').sort((a,b) => a.due_date.localeCompare(b.due_date));
    const soon = items.filter(i => i.severity === 'soon').sort((a,b) => a.due_date.localeCompare(b.due_date));

    res.json({
      now,
      soon,
      pipeline_count: pipelineCount,
      generated_at:   new Date().toISOString(),
      lookahead,
    });
  } catch(e) { serverError(res, e); }
});

// ── POST /snooze ─────────────────────────────────────────────────────
const ALLOWED_SNOOZE = new Set([1, 7, 30]);
router.post('/snooze', express.json(), (req, res) => {
  try {
    const { record_kind, record_id, days } = req.body || {};
    if (!record_kind || record_id == null) {
      return res.status(400).json({ error: 'record_kind and record_id required' });
    }
    const n = parseInt(days, 10);
    if (!ALLOWED_SNOOZE.has(n)) {
      return res.status(400).json({ error: 'days must be 1, 7, or 30' });
    }
    const until = daysFromNow(n);
    db.prepare(`
      INSERT INTO today_snoozes (record_kind, record_id, snoozed_until)
      VALUES (?, ?, ?)
      ON CONFLICT(record_kind, record_id)
      DO UPDATE SET snoozed_until = excluded.snoozed_until,
                    created_at    = CURRENT_TIMESTAMP
    `).run(record_kind, record_id, until);
    res.json({ ok: true, snoozed_until: until });
  } catch(e) { serverError(res, e); }
});

// ── DELETE /snooze/:kind/:id ─────────────────────────────────────────
router.delete('/snooze/:kind/:id', (req, res) => {
  try {
    const r = db.prepare(`
      DELETE FROM today_snoozes WHERE record_kind = ? AND record_id = ?
    `).run(req.params.kind, parseInt(req.params.id, 10));
    res.json({ ok: true, removed: r.changes });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
