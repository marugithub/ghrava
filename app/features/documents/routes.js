'use strict';
/**
 * features/documents/routes.js
 *
 * Household document vault. Stores metadata about physical and digital
 * documents: tax returns, insurance policies, warranties, legal docs, etc.
 *
 * Category and subcategory values are backed by dropdown_options table
 * (list_keys: document_category, document_subcategory) so the user can
 * customise them from Settings without a code change.
 *
 * Tags use the central tags+taggables system (entity_type = 'document').
 * The old `tags TEXT` column still exists as a backup; migration 037
 * moves those freetext tags into taggables on first run.
 *
 * Search (GET /?q=) checks: title, description, issuer, subcategory, and tags.
 *
 * Public routes:   GET /  GET /expiring  GET /:id
 * Auth-required:   POST  PUT  DELETE
 */
const express      = require('express');
const router       = express.Router();
const db           = require('../../db/db');
const { requireAuth }                      = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');
const { saveFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');


// ── GET / ─────────────────────────────────────────────────────
// ── List / search documents ─────────────────────────────────────
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM documents WHERE is_active=1';
    const p = [];
    if (req.query.category) { sql += ' AND category=?'; p.push(req.query.category); }
    if (req.query.member)   { sql += ' AND (family_member=? OR family_member IS NULL)'; p.push(req.query.member); }
    if (req.query.q) {
      const like = `%${req.query.q}%`;
      // Also search tags
      sql += ` AND (title LIKE ? OR description LIKE ? OR issuer LIKE ? OR subcategory LIKE ?
               OR id IN (SELECT entity_id FROM taggables tb2
                         JOIN tags t2 ON t2.id=tb2.tag_id
                         WHERE tb2.entity_type='document' AND t2.name LIKE ?))`;
      p.push(like, like, like, like, like);
    }
    sql += ' ORDER BY category, expiry_date ASC NULLS LAST, title COLLATE NOCASE';
    const docs = db.prepare(sql).all(...p).map(r => withFamilyMembers(withTagNames(r, 'document'), 'document'));
    res.json(docs);
  } catch (e) { serverError(res, e); }
});

// ── GET /expiring ─────────────────────────────────────────────
// ── Expiring within 90 days (used by dashboard) ────────────────
router.get('/expiring', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM documents
      WHERE is_active=1 AND expiry_date IS NOT NULL
        AND expiry_date >= date('now')
        AND expiry_date <= date('now','+90 days')
      ORDER BY expiry_date ASC
    `).all().map(r => withFamilyMembers(withTagNames(r, 'document'), 'document'));
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

// ── GET /:id ──────────────────────────────────────────────────
// ── Get single document ────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM documents WHERE id=? AND is_active=1').get(req.params.id);
    if (!doc) return notFound(res, 'Document');
    res.json(withTags(doc));
  } catch (e) { serverError(res, e); }
});

// ── POST / ────────────────────────────────────────────────────
// ── Create a document record ───────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.title) return badRequest(res, 'title required');
    const r = db.prepare(`
      INSERT INTO documents
        (title, category, subcategory, description, file_name, attachment_id,
         issuer, issue_date, expiry_date, family_member)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(d.title, d.category||'Other', d.subcategory||null, d.description||null,
           d.file_name||null, d.attachment_id||null,
           d.issuer||null, d.issue_date||null, d.expiry_date||null,
           d.family_member||null);
    const newId = r.lastInsertRowid;
    if (d.tags && d.tags.length) saveTagsByName(newId, 'document', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(newId, 'document', d.family_member_ids);
    res.status(201).json(withTagNames(db.prepare('SELECT * FROM documents WHERE id=?', 'document').get(newId)));
  } catch (e) { serverError(res, e); }
});

// ── PUT /:id ──────────────────────────────────────────────────
// ── Update a document record ───────────────────────────────────
router.put('/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Document');
    db.prepare(`
      UPDATE documents SET
        title=?, category=?, subcategory=?, description=?, file_name=?, attachment_id=?,
        issuer=?, issue_date=?, expiry_date=?, family_member=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(d.title||existing.title, d.category||existing.category,
           d.subcategory||null, d.description||null, d.file_name||null,
           d.attachment_id||null, d.issuer||null, d.issue_date||null,
           d.expiry_date||null, d.family_member||null,
           req.params.id);
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'document', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'document', d.family_member_ids);
    clearReview('documents', req.params.id);
    res.json(withTagNames(db.prepare('SELECT * FROM documents WHERE id=?', 'document').get(req.params.id)));
  } catch (e) { serverError(res, e); }
});

// ── DELETE /:id ───────────────────────────────────────────────
// ── Soft-delete (sets is_active=0, clears tags) ────────────────
router.delete('/:id', requireAuth, (req, res) => {
  try {
    clearFamilyMembers(req.params.id, 'document');
    clearTags(req.params.id, 'document');
    db.prepare('UPDATE documents SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
