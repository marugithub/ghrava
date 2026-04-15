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
