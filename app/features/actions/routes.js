// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// features/actions/routes.js
//
// Generic surface over the action ledger (effect dispatcher). Mirrors the
// links router pattern: read history for an entity, inspect one action,
// and reverse (undo) an action. Verbs are FIRED from their owning module
// (e.g. inventory POST /items/:id/donate) — this router is read + undo.
//
// Mounted at /api/v1/actions.
// ─────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { notFound, serverError } = require('../../shared/errors');
const { reverseAction } = require('../../shared/effects/dispatch');

// Attach the ordered effects to an action row.
function withEffects(action) {
  if (!action) return action;
  action.payload = action.payload ? safeParse(action.payload) : null;
  action.effects = db.prepare(`
    SELECT id, seq, op, target_type, target_id, before, after, confidence, needs_review, created_at
    FROM action_effects WHERE action_id=? ORDER BY seq
  `).all(action.id).map(e => ({
    ...e,
    before: e.before ? safeParse(e.before) : null,
    after:  e.after  ? safeParse(e.after)  : null,
    needs_review: !!e.needs_review,
  }));
  return action;
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }

// GET /for/:type/:id — action history for a subject (newest first)
router.get('/for/:type/:id', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM actions
      WHERE subject_type=? AND subject_id=?
      ORDER BY created_at DESC, id DESC
    `).all(req.params.type, parseInt(req.params.id, 10));
    res.json({ count: rows.length, actions: rows.map(withEffects) });
  } catch (e) { serverError(res, e); }
});

// GET /:id — one action with its effects
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare(`SELECT * FROM actions WHERE id=?`).get(parseInt(req.params.id, 10));
    if (!row) return notFound(res, 'Action');
    res.json(withEffects(row));
  } catch (e) { serverError(res, e); }
});

// POST /:id/reverse — undo an action (restores before-snapshots)
router.post('/:id/reverse', requireAuth, (req, res) => {
  try {
    const result = reverseAction(parseInt(req.params.id, 10));
    if (!result.reversed) {
      const code = result.reason === 'not found' ? 404 : 409;
      return res.status(code).json({ ok: false, ...result });
    }
    res.json({ ok: true, ...result });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
