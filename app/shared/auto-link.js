// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// shared/auto-link.js — v202604.167
//
// One helper, all linkers. Writes to record_links with the auto-linker
// pattern from `_templates.html #27`. Idempotent via UNIQUE constraint
// on (left_type, left_id, right_type, right_id, link_kind).
//
// Returns { linkId, action: 'created'|'existing'|'review' }.
// ─────────────────────────────────────────────────────────────────────

const db = require('../db/db');

const insertStmt = db.prepare(`
  INSERT INTO record_links (left_type, left_id, right_type, right_id, link_kind, confidence, needs_review, source, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (left_type, left_id, right_type, right_id, link_kind) DO NOTHING
`);

const findStmt = db.prepare(`
  SELECT id, confidence, needs_review
  FROM record_links
  WHERE left_type = ? AND left_id = ? AND right_type = ? AND right_id = ? AND link_kind = ?
`);

/**
 * Create or upsert a link. If the link already exists, returns it without
 * modification. If a different confidence tier is detected, it stays as the
 * higher tier (we never downgrade silently).
 */
function createLink({ leftType, leftId, rightType, rightId, kind = 'auto', confidence = 'high', source = null, notes = null }) {
  const needsReview = confidence === 'medium' ? 1 : 0;
  insertStmt.run(leftType, leftId, rightType, rightId, kind, confidence, needsReview, source, notes);
  const row = findStmt.get(leftType, leftId, rightType, rightId, kind);
  if (!row) return null;
  return { linkId: row.id, action: 'created', confidence: row.confidence, needs_review: !!row.needs_review };
}

/**
 * Find existing link without creating.
 */
function findLink({ leftType, leftId, rightType, rightId, kind = 'auto' }) {
  return findStmt.get(leftType, leftId, rightType, rightId, kind);
}

module.exports = { createLink, findLink };
