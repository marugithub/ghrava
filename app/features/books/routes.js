'use strict';
/**
 * features/books/routes.js
 *
 * Reading list tracker. Supports three shelf states (Want to Read,
 * Currently Reading, Read), star ratings, genre, and format.
 * Tags use the central tags+taggables system (entity_type = 'book').
 *
 * Public routes (no auth):   GET /  GET /stats
 * Auth-required routes:      POST  PUT  DELETE
 */
const express = require('express');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');

// Public GETs, auth writes
// ── List all books ─────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, genre, format } = req.query;
    let sql = 'SELECT * FROM books WHERE is_active=1';
    const params = [];
    if (status) { sql += ' AND status=?'; params.push(status); }
    if (genre)  { sql += ' AND genre=?';  params.push(genre); }
    if (format) { sql += ' AND format=?'; params.push(format); }
    sql += " ORDER BY CASE status WHEN 'Currently Reading' THEN 0 WHEN 'Want to Read' THEN 1 ELSE 2 END, updated_at DESC";
    res.json(db.prepare(sql).all(...params).map(b => withTagNames(b, 'book')));
  } catch (e) { serverError(res, e); }
});

// ── Reading stats (counts by status) ──────────────────────────
router.get('/stats', (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='Read' THEN 1 ELSE 0 END) as read_count,
        SUM(CASE WHEN status='Currently Reading' THEN 1 ELSE 0 END) as reading_count,
        SUM(CASE WHEN status='Want to Read' THEN 1 ELSE 0 END) as want_count,
        ROUND(AVG(CASE WHEN rating IS NOT NULL THEN rating END), 1) as avg_rating
      FROM books WHERE is_active=1
    `).get();
    res.json(stats);
  } catch (e) { serverError(res, e); }
});

// requireAuth applied per-route on writes only

// ── Add a book ─────────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  try {
    const d = req.body;
    if (!d.title) return badRequest(res, 'title required');
    const r = db.prepare(`
      INSERT INTO books (title, author, genre, status, rating, format, date_started, date_finished, notes, isbn, cover_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(d.title, d.author||null, d.genre||null, d.status||'Want to Read',
           d.rating||null, d.format||'Physical',
           d.date_started||null, d.date_finished||null, d.notes||null,
           d.isbn||null, d.cover_url||null);
    if (d.tags) saveTagsByName(r.lastInsertRowid, 'book', d.tags);
    res.status(201).json(withTagNames(db.prepare('SELECT * FROM books WHERE id=?').get(r.lastInsertRowid), 'book'));
  } catch (e) { serverError(res, e); }
});

// ── Update a book (also updates tags) ──────────────────────────
router.put('/:id', requireAuth, (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM books WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Book');
    db.prepare(`
      UPDATE books SET title=?, author=?, genre=?, status=?, rating=?, format=?,
        date_started=?, date_finished=?, notes=?, isbn=?, cover_url=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.title||existing.title, d.author||null, d.genre||null,
      d.status||existing.status, d.rating||null, d.format||existing.format,
      d.date_started||null, d.date_finished||null, d.notes||null,
      d.isbn||null, d.cover_url||null, req.params.id
    );
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'book', d.tags);
    clearReview('books', req.params.id);
    res.json(withTagNames(db.prepare('SELECT * FROM books WHERE id=?').get(req.params.id), 'book'));
  } catch (e) { serverError(res, e); }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    clearTags(req.params.id, 'book');
    db.prepare('UPDATE books SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
