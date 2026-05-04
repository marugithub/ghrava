/**
 * features/attachments/routes.js
 * Shared attachment system — works for ALL modules.
 * Files are written through Docker volume mount to NAS:
 *   /app/attachments/<module>/  →  \\soninas\Backups\MyAppAttachments\<module>\
 *
 * Routes:
 *   POST   /api/v1/attachments/:entityType/:entityId   upload file(s)
 *   GET    /api/v1/attachments/:entityType/:entityId   list attachments
 *   GET    /api/v1/attachments/file/:id                serve file
 *   GET    /api/v1/attachments/thumb/:id               serve thumbnail
 *   PUT    /api/v1/attachments/:id/label               update label/notes
 *   PUT    /api/v1/attachments/:id/primary             set as primary photo
 *   DELETE /api/v1/attachments/:id                     delete record + file
 */
'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');
const { requireAuth }  = require('../auth/middleware');
const { notFound, badRequest, serverError } = require('../../shared/errors');

// ── Optional sharp for thumbnail generation ───────────────────
let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

// ── Base paths (inside container — mapped to NAS via volume) ──
const ATT_BASE  = '/app/attachments';
const THUMB_DIR = 'thumbs';

// ── NAS UNC base for generating Windows-clickable paths ───────
const UNC_BASE  = '\\\\soninas\\Backups\\MyAppAttachments';

// ── Allowed modules ───────────────────────────────────────────
const MODULES = ['inventory','hsa','medical','finance','estate','daily-log','career','books','property','todos','resources','contacts','kids','wardrobe','family'];

// ── Image MIME types ──────────────────────────────────────────
const IMAGE_MIMES = new Set(['image/jpeg','image/jpg','image/png','image/gif','image/webp']);

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/** Derive module from entity_type */
function moduleFor(entityType) {
  if (entityType.startsWith('hsa'))                                          return 'hsa';
  if (entityType.startsWith('med'))                                          return 'medical';
  if (entityType === 'item' || entityType === 'container' || entityType === 'location')
                                                                             return 'inventory';
  if (entityType.startsWith('fin'))                                          return 'finance';
  if (entityType.startsWith('estate'))                                       return 'estate';
  if (entityType === 'daily_log')                                            return 'daily-log';
  if (entityType.startsWith('career'))                                       return 'career';
  if (entityType === 'book')                                                 return 'books';
  if (entityType === 'property' || entityType === 'vehicle' ||
      entityType === 'property_maintenance' || entityType === 'vehicle_service')
                                                                             return 'property';
  if (entityType === 'todo')                                                 return 'todos';
  if (entityType === 'resource')                                             return 'resources';
  if (entityType === 'contact')                                              return 'contacts';
  if (entityType === 'kid' || entityType === 'kid_activity' || entityType === 'kid_note')
                                                                             return 'kids';
  if (entityType === 'outfit' || entityType === 'wardrobe_item')              return 'wardrobe';
  if (entityType === 'family_member')                                         return 'family';
  return entityType;
}

/** Ensure module dir and thumbs subdir exist */
function ensureModuleDir(module) {
  const dir   = path.join(ATT_BASE, module);
  const tdir  = path.join(dir, THUMB_DIR);
  if (!fs.existsSync(dir))  fs.mkdirSync(dir,  { recursive: true });
  if (!fs.existsSync(tdir)) fs.mkdirSync(tdir, { recursive: true });
  return dir;
}

/** Ensure ALL module dirs exist (called at startup) */
function ensureAllDirs() {
  MODULES.forEach(m => {
    try { ensureModuleDir(m); } catch { /* volume not mounted yet — ok */ }
  });
}

/**
 * Build a human-readable stored filename:
 * [module]_[record-title-slug]_[YYYYMMDD]_[originalname]
 * e.g.  hsa_cvs-pharmacy_20260226_receipt.pdf
 */
function buildStoredFilename(module, recordTitle, originalName) {
  const slug = String(recordTitle || 'record')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${module}_${slug}_${date}_${safe}`;
}

/** Resolve naming collision — append _2, _3 etc if file exists */
function resolveCollision(dir, filename) {
  const ext  = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = filename;
  let n = 2;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}_${n}${ext}`;
    n++;
  }
  return candidate;
}

/** Build UNC path from stored path */
function toUncPath(storedPath) {
  // storedPath: /app/attachments/hsa/hsa_cvs_20260226_receipt.pdf
  const rel = storedPath.replace('/app/attachments/', '').replace(/\//g, '\\');
  return `${UNC_BASE}\\${rel}`;
}

/** Look up a record title from the DB given entity_type and entity_id */
function getRecordTitle(entityType, entityId) {
  try {
    if (entityType === 'item')              return db.prepare('SELECT name FROM items WHERE id=?').get(entityId)?.name;
    if (entityType === 'hsa_payment')       return db.prepare('SELECT provider FROM hsa_payments WHERE id=?').get(entityId)?.provider;
    if (entityType === 'hsa_otc')           return db.prepare('SELECT item_name FROM hsa_otc WHERE id=?').get(entityId)?.item_name;
    if (entityType === 'med_visit')         return db.prepare('SELECT visit_date FROM med_visit_notes WHERE id=?').get(entityId)?.visit_date;
    if (entityType === 'med_condition')     return db.prepare('SELECT condition_name FROM med_conditions WHERE id=?').get(entityId)?.condition_name;
    if (entityType === 'med_medication')    return db.prepare('SELECT name FROM med_medications WHERE id=?').get(entityId)?.name;
    if (entityType === 'career_cert')       return db.prepare('SELECT name FROM career_certifications WHERE id=?').get(entityId)?.name;
    if (entityType === 'career_job')        return db.prepare('SELECT title FROM career_jobs WHERE id=?').get(entityId)?.title;
    if (entityType === 'career_learning')   return db.prepare('SELECT title FROM career_learning WHERE id=?').get(entityId)?.title;
    if (entityType === 'book')              return db.prepare('SELECT title FROM books WHERE id=?').get(entityId)?.title;
    if (entityType === 'property')          return db.prepare('SELECT nickname FROM properties WHERE id=?').get(entityId)?.nickname;
    if (entityType === 'vehicle')           return db.prepare('SELECT nickname FROM vehicles WHERE id=?').get(entityId)?.nickname;
    if (entityType === 'property_maintenance') return db.prepare('SELECT description FROM property_maintenance WHERE id=?').get(entityId)?.description;
    if (entityType === 'vehicle_service')   return db.prepare('SELECT service_type FROM vehicle_service WHERE id=?').get(entityId)?.service_type;
    if (entityType === 'todo')              return db.prepare('SELECT title FROM todos WHERE id=?').get(entityId)?.title;
    if (entityType === 'resource')          return db.prepare('SELECT name FROM resources WHERE id=?').get(entityId)?.name;
    if (entityType === 'contact')           return db.prepare('SELECT name FROM contacts WHERE id=?').get(entityId)?.name;
    if (entityType === 'kid')               return db.prepare('SELECT display_name FROM kids WHERE id=?').get(entityId)?.display_name;
    if (entityType === 'outfit')             return db.prepare('SELECT name FROM wardrobe_outfits WHERE id=?').get(entityId)?.name;
    if (entityType === 'family_member')      return db.prepare('SELECT display_name FROM family_members WHERE id=?').get(entityId)?.display_name;
  } catch { /* ignore */ }
  return null;
}

// ── Multer — memory storage, we write manually after slugging ─
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
});

// ── Ensure dirs on startup ────────────────────────────────────
ensureAllDirs();

// v202604.140 — Inbox/orphan/reject lifecycle dirs.
// Wrapped in try so that volume-not-mounted at boot doesn't crash startup.
try {
  const { ensureLifecycleDirs } = require('../../shared/attach-lifecycle');
  ensureLifecycleDirs();
} catch (e) {
  console.warn('[attachments] Could not create lifecycle dirs:', e.message);
}

// ══════════════════════════════════════════════════════════════
// SERVE THUMBNAIL — public (browser <img> tags have no auth header)
// GET /api/v1/attachments/thumb/:id
// ══════════════════════════════════════════════════════════════
router.get('/thumb/:id', (req, res) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.id);
    if (!a) return notFound(res, 'Attachment');
    const src = (a.thumb_path && fs.existsSync(a.thumb_path))
      ? a.thumb_path
      : (fs.existsSync(a.stored_path) ? a.stored_path : null);
    if (!src) return res.status(410).json({ error: 'File not found' });
    res.setHeader('Content-Type', a.mime_type || 'image/jpeg');
    res.sendFile(src, { root: '/' });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// SERVE FILE — public (browser <img> tags have no auth header)
// GET /api/v1/attachments/file/:id
// ══════════════════════════════════════════════════════════════
router.get('/file/:id', (req, res) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.id);
    if (!a) return notFound(res, 'Attachment');
    if (!fs.existsSync(a.stored_path)) {
      return res.status(410).json({ error: 'File no longer exists on NAS', unc_path: a.unc_path });
    }
    res.setHeader('Content-Disposition', `inline; filename="${a.original_filename}"`);
    res.setHeader('Content-Type', a.mime_type || 'application/octet-stream');
    res.sendFile(a.stored_path, { root: '/' });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// COUNT — public (badge counts render outside the auth drawer)
// GET /api/v1/attachments/count/:entityType/:entityId
// NOTE: must be registered BEFORE /:entityType/:entityId to avoid
//       Express matching "count" as entityType
// ══════════════════════════════════════════════════════════════
router.get('/count/:entityType/:entityId', (req, res) => {
  try {
    const row = db.prepare(
      'SELECT COUNT(*) as total, SUM(is_image) as images FROM attachments WHERE entity_type=? AND entity_id=?'
    ).get(req.params.entityType, req.params.entityId);
    res.json(row);
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// LIST — public (attachment drawer must load even before unlock)
// GET /api/v1/attachments/:entityType/:entityId
// ══════════════════════════════════════════════════════════════
router.get('/:entityType/:entityId', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM attachments
      WHERE entity_type=? AND entity_id=?
      ORDER BY is_primary_photo DESC, sort_order, created_at
    `).all(req.params.entityType, req.params.entityId);

    // Annotate each with whether the file still exists on disk
    const annotated = rows.map(r => ({
      ...r,
      file_exists: fs.existsSync(r.stored_path),
    }));

    res.json(annotated);
  } catch (e) { serverError(res, e); }
});

// ── All routes below require authentication ───────────────────
router.use(requireAuth);

router.post('/:entityType/:entityId', upload.array('files', 10),
  async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const module    = moduleFor(entityType);
      const moduleDir = ensureModuleDir(module);
      const thumbDir  = path.join(moduleDir, THUMB_DIR);
      const title     = getRecordTitle(entityType, entityId) || entityType;
      const label     = req.body.label  || null;
      const notes     = req.body.notes  || null;

      if (!req.files || !req.files.length) return badRequest(res, 'No files provided');

      // Count existing to determine primary photo
      const existingPhotos = db.prepare(
        "SELECT COUNT(*) as n FROM attachments WHERE entity_type=? AND entity_id=? AND is_image=1"
      ).get(entityType, entityId).n;

      const results = [];

      for (let i = 0; i < req.files.length; i++) {
        const file    = req.files[i];
        const isImage = IMAGE_MIMES.has(file.mimetype);

        // Build filename + resolve collision
        const storedName = resolveCollision(
          moduleDir,
          buildStoredFilename(module, title, file.originalname)
        );
        const storedPath = path.join(moduleDir, storedName);

        // Write file to NAS via volume
        fs.writeFileSync(storedPath, file.buffer);

        // Generate thumbnail for images
        let thumbPath = null;
        if (isImage && sharp) {
          try {
            const thumbName = `thumb_${storedName}`;
            thumbPath = path.join(thumbDir, thumbName);
            await sharp(file.buffer)
              .rotate()
              .resize(300, 300, { fit: 'cover', position: 'centre' })
              .jpeg({ quality: 80 })
              .toFile(thumbPath);
          } catch (e) {
            console.warn('Thumbnail generation failed:', e.message);
            thumbPath = null;
          }
        }

        // Primary photo: first image ever attached to this record
        const isPrimary = (isImage && existingPhotos === 0 && i === 0) ? 1 : 0;
        if (isPrimary) {
          db.prepare(
            'UPDATE attachments SET is_primary_photo=0 WHERE entity_type=? AND entity_id=?'
          ).run(entityType, entityId);
        }

        const uncPath = toUncPath(storedPath);

        const info = db.prepare(`
          INSERT INTO attachments
            (entity_type, entity_id, module, label, original_filename, stored_filename,
             stored_path, unc_path, file_size, mime_type, is_image, is_primary_photo,
             thumb_path, sort_order, notes)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          entityType, entityId, module,
          label || (isImage ? 'Photo' : 'Document'),
          file.originalname, storedName, storedPath, uncPath,
          file.size, file.mimetype, isImage ? 1 : 0, isPrimary,
          thumbPath, i, notes
        );

        results.push(db.prepare('SELECT * FROM attachments WHERE id=?').get(info.lastInsertRowid));
      }

      res.status(201).json(results);
    } catch (e) { serverError(res, e); }
  }
);

// ══════════════════════════════════════════════════════════════
// UPDATE LABEL / NOTES
// PUT /api/v1/attachments/:id/label
// ══════════════════════════════════════════════════════════════
router.put('/:id/label', (req, res) => {
  try {
    db.prepare('UPDATE attachments SET label=?, notes=? WHERE id=?')
      .run(req.body.label || null, req.body.notes || null, req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// SET PRIMARY PHOTO
// PUT /api/v1/attachments/:id/primary
// ══════════════════════════════════════════════════════════════
router.put('/:id/primary', (req, res) => {
  try {
    const a = db.prepare('SELECT entity_type, entity_id FROM attachments WHERE id=?').get(req.params.id);
    if (!a) return notFound(res, 'Attachment');
    db.prepare('UPDATE attachments SET is_primary_photo=0 WHERE entity_type=? AND entity_id=?')
      .run(a.entity_type, a.entity_id);
    db.prepare('UPDATE attachments SET is_primary_photo=1 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// DELETE
// DELETE /api/v1/attachments/:id
// Removes DB record AND the physical file + thumbnail from NAS
// ══════════════════════════════════════════════════════════════
router.delete('/:id', (req, res) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.id);
    if (!a) return notFound(res, 'Attachment');

    // Delete physical files
    [a.stored_path, a.thumb_path].forEach(p => {
      if (p && fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) { console.warn('Could not delete file:', p, e.message); }
      }
    });

    db.prepare('DELETE FROM attachments WHERE id=?').run(req.params.id);

    // If deleted was primary photo, promote the next image
    if (a.is_primary_photo) {
      const next = db.prepare(
        "SELECT id FROM attachments WHERE entity_type=? AND entity_id=? AND is_image=1 ORDER BY sort_order, created_at LIMIT 1"
      ).get(a.entity_type, a.entity_id);
      if (next) db.prepare('UPDATE attachments SET is_primary_photo=1 WHERE id=?').run(next.id);
    }

    res.json({ deleted: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
