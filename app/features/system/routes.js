// @ts-check
'use strict';
/**
 * features/system/routes.js
 * Undo delete, database maintenance, webhooks.
 * All routes are open (no global requireAuth) — consistent with app auth policy.
 * Write operations are protected individually.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, serverError } = require('../../shared/errors');
const { getDeletedItems, restoreItem } = require('../../shared/undo-delete');
const { runIntegrityCheck, runVacuum, runAnalyze, getDatabaseStats, getMaintenanceHistory } = require('../../shared/db-maintenance');
const { getWebhooks, getWebhookLogs, testWebhook, EVENTS } = require('../../shared/webhooks');

// ── Undo Delete ───────────────────────────────────────────────
router.get('/deleted', (req, res) => {
  try {
    const items = getDeletedItems(req.query.type || null, 100);
    res.json(items);
  } catch(e) { serverError(res, e); }
});

router.post('/restore', requireAuth, (req, res) => {
  try {
    const { deletion_id } = req.body;
    if (!deletion_id) return badRequest(res, 'deletion_id required');
    const result = restoreItem(deletion_id);
    result.success ? res.json({ ok: true }) : badRequest(res, result.error);
  } catch(e) { serverError(res, e); }
});

// ── Database Maintenance ──────────────────────────────────────
router.get('/db/stats', (req, res) => {
  try { res.json(getDatabaseStats()); } catch(e) { serverError(res, e); }
});

router.get('/db/history', (req, res) => {
  try { res.json(getMaintenanceHistory(20)); } catch(e) { serverError(res, e); }
});

router.post('/db/integrity-check', requireAuth, (req, res) => {
  try { res.json(runIntegrityCheck()); } catch(e) { serverError(res, e); }
});

router.post('/db/vacuum', requireAuth, (req, res) => {
  try { res.json(runVacuum()); } catch(e) { serverError(res, e); }
});

router.post('/db/analyze', requireAuth, (req, res) => {
  try { res.json(runAnalyze()); } catch(e) { serverError(res, e); }
});

// POST /api/v1/system/diag/cleanup
// Sweeps every table that the Settings → Diagnostics CRUD tests insert into,
// deleting any record whose primary text field starts with "_diag_".
// Safe to run anytime — only matches records the diagnostic suite created.
// Returns counts deleted per table for visibility.
router.post('/diag/cleanup', requireAuth, (req, res) => {
  try {
    const db = require('../../db/db');
    // [table, columnToMatch] pairs. Ordered safely (children before parents).
    const sweep = [
      ['kids_activities',     'name'],
      ['kids_notes',          'body'],
      ['kids',                'display_name'],
      ['career_goals',        'title'],
      ['career_certifications','name'],
      ['property_maintenance','description'],
      ['property_vehicles',   'nickname'],
      ['todos',               'title'],
      ['daily_log',           'entry_text'],
      ['hsa_payments',        'provider'],
      ['medical_notes',       'patient'],
      ['medical_medications', 'name'],
      ['medical_conditions',  'condition_name'],
      ['items',               'name'],
      ['contacts',            'name'],
      ['tags',                'name'],
      ['documents',           'title'],
      ['books',               'title'],
      // v.156: was 'financial_accounts'/'nickname' (compat view, not
      // deletable). Diagnostic test rows seeded with _diag_ prefix go
      // into accounts.name. The v.151 "no DELETE on accounts" rule has
      // a pragmatic exception for test cleanup confined to the
      // _diag_ namespace.
      ['accounts',            'name'],
    ];
    const results = {};
    let total = 0;
    for (const [table, col] of sweep) {
      try {
        // Underscore is a single-char wildcard in LIKE, so we must escape
        // each literal underscore. '\_diag\_%' ESCAPE '\' matches strings
        // that literally start with _diag_.
        const info = db.prepare(
          `DELETE FROM ${table} WHERE ${col} LIKE '\\_diag\\_%' ESCAPE '\\'`
        ).run();
        if (info.changes > 0) {
          results[table] = info.changes;
          total += info.changes;
        }
      } catch (e) {
        results[table] = `error: ${e.message}`;
      }
    }
    res.json({ ok: true, total_deleted: total, by_table: results });
  } catch (e) { serverError(res, e); }
});

// ── Webhooks ─────────────────────────────────────────────────
router.get('/webhooks', (req, res) => {
  try { res.json(getWebhooks()); } catch(e) { serverError(res, e); }
});

router.get('/webhooks/events', (req, res) => {
  res.json(Object.values(EVENTS));
});

router.post('/webhooks', requireAuth, (req, res) => {
  try {
    const { name, url, event_type, secret } = req.body;
    if (!name || !url || !event_type) return badRequest(res, 'name, url, and event_type required');
    const r = db.prepare(`INSERT INTO webhooks (name,url,event_type,secret) VALUES (?,?,?,?)`).run(name, url, event_type, secret||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch(e) { serverError(res, e); }
});

router.put('/webhooks/:id', requireAuth, (req, res) => {
  try {
    const { name, url, event_type, secret, enabled } = req.body;
    db.prepare(`UPDATE webhooks SET name=COALESCE(?,name), url=COALESCE(?,url), event_type=COALESCE(?,event_type), secret=?, enabled=COALESCE(?,enabled) WHERE id=?`)
      .run(name, url, event_type, secret, enabled, req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.delete('/webhooks/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM webhooks WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

router.post('/webhooks/:id/test', requireAuth, async (req, res) => {
  try { res.json(await testWebhook(req.params.id)); } catch(e) { serverError(res, e); }
});

router.get('/webhooks/:id/logs', (req, res) => {
  try { res.json(getWebhookLogs(req.params.id, 50)); } catch(e) { serverError(res, e); }
});

module.exports = router;
