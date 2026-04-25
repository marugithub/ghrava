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
const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');
const { saveFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');

// Public GETs, auth writes
// ── List all books ─────────────────────────────────────────────
const stmtBookPhoto = db.prepare(
  "SELECT id FROM attachments WHERE entity_type='book' AND entity_id=? AND is_primary_photo=1 LIMIT 1"
);
const stmtBookAttachCount = db.prepare(
  "SELECT COUNT(*) as cnt FROM attachments WHERE entity_type='book' AND entity_id=?"
);
function withBookPhoto(b) {
  const row = stmtBookPhoto.get(b.id);
  const att = stmtBookAttachCount.get(b.id);
  return { ...b, primary_photo_id: row ? row.id : null, attachment_count: att?.cnt || 0 };
}

router.get('/', (req, res) => {
  try {
    const { status, genre, format } = req.query;
    let sql = 'SELECT * FROM books WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status=?'; params.push(status); }
    if (genre)  { sql += ' AND genre=?';  params.push(genre); }
    if (format) { sql += ' AND format=?'; params.push(format); }
    sql += " ORDER BY CASE status WHEN 'Currently Reading' THEN 0 WHEN 'Want to Read' THEN 1 ELSE 2 END, updated_at DESC";
    res.json(db.prepare(sql).all(...params).map(b => withFamilyMembers(withTagNames(withBookPhoto(b), 'book'), 'book')));
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
      INSERT INTO books (title, author, genre, status, rating, format, date_started, date_finished, notes, isbn, cover_url, pages_total, pages_read)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(d.title, d.author||null, d.genre||null, d.status||'Want to Read',
           d.rating||null, d.format||'Physical',
           d.date_started||null, d.date_finished||null, d.notes||null,
           d.isbn||null, d.cover_url||null,
           d.pages_total||null, d.pages_read||null);
    if (d.tags) saveTagsByName(r.lastInsertRowid, 'book', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(r.lastInsertRowid, 'book', d.family_member_ids);
    res.status(201).json(withFamilyMembers(withTagNames(db.prepare('SELECT * FROM books WHERE id=?').get(r.lastInsertRowid), 'book'), 'book'));
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
        date_started=?, date_finished=?, notes=?, isbn=?, cover_url=?,
        pages_total=?, pages_read=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.title||existing.title, d.author||null, d.genre||null,
      d.status||existing.status, d.rating||null, d.format||existing.format,
      d.date_started||null, d.date_finished||null, d.notes||null,
      d.isbn||null, d.cover_url||null,
      d.pages_total !== undefined ? d.pages_total||null : existing.pages_total,
      d.pages_read  !== undefined ? d.pages_read||null  : existing.pages_read,
      req.params.id
    );
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'book', d.tags);
    clearReview('books', req.params.id);
    if (d.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'book', d.family_member_ids);
    res.json(withFamilyMembers(withTagNames(db.prepare('SELECT * FROM books WHERE id=?').get(req.params.id), 'book'), 'book'));
  } catch (e) { serverError(res, e); }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    clearFamilyMembers(req.params.id, 'book');
    clearTags(req.params.id, 'book');
    db.prepare('UPDATE books SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ── Cover image fetch ──────────────────────────────────────────
// POST /api/v1/books/:id/fetch-cover
// Downloads a cover image URL and stores it as the book's primary attachment.
// Body: { cover_url: 'https://...' }

const COVER_BASE  = '/app/attachments/books';
const COVER_THUMB = '/app/attachments/books/thumbs';

function ensureBookDirs() {
  [COVER_BASE, COVER_THUMB].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Ghrava/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

router.post('/:id/fetch-cover', requireAuth, async (req, res) => {
  try {
    const { cover_url } = req.body;
    if (!cover_url) return badRequest(res, 'cover_url required');

    const book = db.prepare('SELECT * FROM books WHERE id=?').get(req.params.id);
    if (!book) return notFound(res, 'Book');

    // Skip if primary photo already exists
    const existing = db.prepare(
      "SELECT id FROM attachments WHERE entity_type='book' AND entity_id=? AND is_primary_photo=1"
    ).get(req.params.id);
    if (existing) return res.json({ ok: true, skipped: true, reason: 'cover already exists' });

    ensureBookDirs();

    const buf = await downloadBuffer(cover_url);
    if (!buf || buf.length < 100) return res.json({ ok: false, reason: 'download too small' });

    const slug     = (book.title||'book').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40);
    const date     = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const base     = `book_${slug}_${date}_cover.jpg`;
    let stored = base; let n = 2;
    while (fs.existsSync(`${COVER_BASE}/${stored}`)) { stored = base.replace('.jpg',`_${n}.jpg`); n++; }
    const thumb    = `thumb_${stored}`;
    const fullPath = `${COVER_BASE}/${stored}`;
    const thumbPath= `${COVER_THUMB}/${thumb}`;

    // Try sharp for resizing, fall back to raw write
    let sharp;
    try { sharp = require('sharp'); } catch { sharp = null; }
    if (sharp) {
      await sharp(buf).resize(400, 600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(fullPath);
      await sharp(buf).resize(200, 200, { fit: 'cover', position: 'centre' }).jpeg({ quality: 80 }).toFile(thumbPath);
    } else {
      fs.writeFileSync(fullPath, buf);
      fs.writeFileSync(thumbPath, buf);
    }

    const fileSize = fs.statSync(fullPath).size;

    db.prepare("UPDATE attachments SET is_primary_photo=0 WHERE entity_type='book' AND entity_id=?").run(req.params.id);

    const info = db.prepare(`
      INSERT INTO attachments
        (entity_type, entity_id, module, label, original_filename, stored_filename,
         stored_path, file_size, mime_type, is_image, is_primary_photo, thumb_path, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      'book', req.params.id, 'books', 'Cover',
      `${slug}_cover.jpg`, stored, fullPath,
      fileSize, 'image/jpeg', 1, 1, thumbPath,
      `Cover fetched from ${cover_url}`
    );

    // Update book cover_url to point to our attachment thumb endpoint
    db.prepare('UPDATE books SET cover_url=? WHERE id=?')
      .run(`/api/v1/attachments/thumb/${info.lastInsertRowid}`, req.params.id);

    res.json({ ok: true, attachment_id: info.lastInsertRowid });
  } catch(e) { serverError(res, e); }
});

// ── Fetch and store cover image from URL ──────────────────────
// POST /api/v1/books/:id/fetch-cover  { url: '...' }
const BOOK_ATT_DIR   = '/app/attachments/books';
const BOOK_THUMB_DIR = '/app/attachments/books/thumbs';

function ensureBookDirs() {
  [BOOK_ATT_DIR, BOOK_THUMB_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Ghrava/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

router.post('/:id/fetch-cover', requireAuth, async (req, res) => {
  try {
    const bookId = parseInt(req.params.id);
    const { url }  = req.body;
    if (!url) return badRequest(res, 'url required');

    const book = db.prepare('SELECT * FROM books WHERE id=?').get(bookId);
    if (!book) return notFound(res, 'Book');

    // Skip if primary photo already exists
    const existing = db.prepare(
      "SELECT id FROM attachments WHERE entity_type='book' AND entity_id=? AND is_primary_photo=1"
    ).get(bookId);
    if (existing) return res.json({ ok: true, skipped: true, reason: 'cover already exists' });

    ensureBookDirs();
    const buf = await downloadBuffer(url);
    if (!buf || buf.length < 100) return badRequest(res, 'image download failed or too small');

    const slug      = String(book.title || 'book').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const date      = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const baseName  = `book_${slug}_${date}_cover.jpg`;
    let   stored    = baseName;
    let   n = 2;
    while (fs.existsSync(`${BOOK_ATT_DIR}/${stored}`)) {
      stored = baseName.replace('.jpg', `_${n++}.jpg`);
    }
    const thumbName  = `thumb_${stored}`;
    const storedPath = `${BOOK_ATT_DIR}/${stored}`;
    const thumbPath  = `${BOOK_THUMB_DIR}/${thumbName}`;

    // Try sharp for resize, fall back to raw save
    let sharp;
    try { sharp = require('sharp'); } catch {}
    if (sharp) {
      await sharp(buf).resize(600, 800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(storedPath);
      await sharp(buf).resize(300, 400, { fit: 'cover', position: 'centre' }).jpeg({ quality: 80 }).toFile(thumbPath);
    } else {
      fs.writeFileSync(storedPath, buf);
      fs.writeFileSync(thumbPath, buf);
    }

    const fileSize = fs.statSync(storedPath).size;
    const info = db.prepare(`
      INSERT INTO attachments
        (entity_type, entity_id, module, label, original_filename, stored_filename,
         stored_path, file_size, mime_type, is_image, is_primary_photo, thumb_path, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      'book', bookId, 'books', 'Cover',
      `${slug}_cover.jpg`, stored,
      storedPath, fileSize, 'image/jpeg', 1, 1,
      thumbPath, `Cover fetched from ${url}`
    );

    res.json({ ok: true, attachment: db.prepare('SELECT * FROM attachments WHERE id=?').get(info.lastInsertRowid) });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
