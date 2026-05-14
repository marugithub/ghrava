// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// features/links/routes.js — v202604.167
//
// Generic record_links endpoints used by the review surface (auto-
// linker pattern #27). Keeps cross-module link management in one place.
// ─────────────────────────────────────────────────────────────────────

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');

// GET /api/v1/links/needs-review — all auto-links flagged for Al
router.get('/needs-review', (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit || '200', 10));
    const rows = db.prepare(`
      SELECT id, left_type, left_id, right_type, right_id, link_kind,
             confidence, needs_review, source, notes, created_at, reviewed_at
      FROM record_links
      WHERE needs_review = 1
      ORDER BY created_at DESC
      LIMIT ${limit}
    `).all();
    res.json({ count: rows.length, links: rows });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/links — manually create a link
router.post('/', requireAuth, (req, res) => {
  try {
    const { left_type, left_id, right_type, right_id, link_kind = 'manual', notes = null } = req.body || {};
    if (!left_type || !left_id || !right_type || !right_id) {
      return badRequest(res, 'left_type, left_id, right_type, right_id required');
    }
    const r = db.prepare(`
      INSERT INTO record_links (left_type, left_id, right_type, right_id, link_kind, confidence, needs_review, source, notes)
      VALUES (?, ?, ?, ?, ?, 'high', 0, 'manual', ?)
      ON CONFLICT (left_type, left_id, right_type, right_id, link_kind) DO NOTHING
    `).run(left_type, left_id, right_type, right_id, link_kind, notes);
    res.json({ ok: true, created: r.changes > 0, id: r.lastInsertRowid || null });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/links/:id/confirm — clear needs_review flag (Al confirmed the auto-link)
router.post('/:id/confirm', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = db.prepare(`
      UPDATE record_links
      SET needs_review = 0, reviewed_at = datetime('now')
      WHERE id = ?
    `).run(id);
    if (r.changes === 0) return notFound(res, 'link not found');
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// DELETE /api/v1/links/:id — remove a link (manual unlink or rejection of auto-link)
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const r = db.prepare(`DELETE FROM record_links WHERE id = ?`).run(id);
    if (r.changes === 0) return notFound(res, 'link not found');
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/links/for/:type/:id — all links touching this entity (from either side)
router.get('/for/:type/:id', (req, res) => {
  try {
    const { type, id } = req.params;
    const eid = parseInt(id, 10);
    const rows = db.prepare(`
      SELECT id, left_type, left_id, right_type, right_id, link_kind, confidence, needs_review, source, notes, created_at, reviewed_at
      FROM record_links
      WHERE (left_type = ? AND left_id = ?) OR (right_type = ? AND right_id = ?)
      ORDER BY created_at DESC
    `).all(type, eid, type, eid);
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/links/run/eob-hsa-matcher — full backfill of EOB ↔ HSA matches
router.post('/run/eob-hsa-matcher', requireAuth, (req, res) => {
  try {
    const matcher = require('../medical/eob-hsa-matcher');
    const result = matcher.runFullBackfill();
    res.json({ ok: true, ...result });
  } catch (e) { serverError(res, e); }
});

// POST /api/v1/links/run/subscription-categories?days=90 — retroactive subscription category copy
router.post('/run/subscription-categories', requireAuth, (req, res) => {
  try {
    const days = Math.max(1, Math.min(3650, parseInt(req.query.days || req.body.days || '90', 10)));
    const r = require('../../shared/auto-link-subscription-category').runRetroactive(days);
    res.json({ ok: true, ...r });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
