/**
 * features/inventory/routes.js  — v3
 * PUBLIC module (no login required).
 * Locations · Containers · Items · Attachments · Maintenance · Audit · Export · Import
 */
const express  = require('express');
const router   = express.Router();
const db       = require('../../db/db');
const { notFound, badRequest, serverError } = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');
const { runDataCleanup } = require('../../shared/data-cleanup');
const { requireAuth } = require('../auth/middleware');
const { logEvent, getEvents } = require('../../shared/auditLog');
const QRCode   = require('qrcode');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const https    = require('https');
const http     = require('http');
const { saveTagsByName, withTagNames, clearTags } = require('../../shared/tags');

// ── Optional sharp for thumbnails ────────────────────────────
let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

// ── Optional xlsx for export/import ─────────────────────────
let XLSX;
try { XLSX = require('xlsx'); } catch { XLSX = null; }

const QR_DIR      = '/app/data/uploads/qr';
const UPLOADS_DIR = '/app/data/uploads/items';
const DOCS_DIR    = '/app/data/uploads/docs';

[QR_DIR, UPLOADS_DIR, DOCS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Multer config ─────────────────────────────────────────────
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, String(req.params.id || 'tmp'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  }
});

const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(DOCS_DIR, String(req.params.id || 'tmp'));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  }
});

const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 20 * 1024 * 1024 } });
const uploadDoc   = multer({ storage: docStorage,   limits: { fileSize: 50 * 1024 * 1024 } });
const uploadImport = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function nextRef(prefix, table, col) {
  const row = db.prepare(`SELECT ${col} FROM ${table} WHERE ${col} LIKE ? ORDER BY ${col} DESC LIMIT 1`)
    .get(`${prefix}-%`);
  if (!row) return `${prefix}-0001`;
  const n = parseInt(row[col].split('-')[1]) + 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

async function generateQR(type, ref, reqBaseUrl) {
  const filePath = path.join(QR_DIR, `${type}-${ref}.png`);
  const base = getBaseUrl(reqBaseUrl);
  const url = `${base}/inventory.html?open=${ref}`;
  await QRCode.toFile(filePath, url,
    { width: 300, margin: 2, color: { dark: '#000', light: '#fff' } });
  return filePath;
}

/** Get base URL — from app_config first, fall back to provided default */
function getBaseUrl(fallback) {
  try {
    const row = db.prepare("SELECT value FROM app_config WHERE key='app_base_url'").get();
    if (row?.value) return row.value.replace(/\/$/, '');
  } catch {}
  return fallback || 'http://localhost:3001';
}

function getPath(parentType, parentId, depth = 0) {
  if (depth > 8 || !parentId) return '';
  const parts = [];
  let type = parentType, id = parentId;
  let d = 0;
  while (id && d < 8) {
    if (type === 'location') {
      const r = db.prepare('SELECT name, parent_location_id FROM locations WHERE id=?').get(id);
      if (!r) break;
      parts.unshift(r.name);
      id = r.parent_location_id; type = 'location';
    } else if (type === 'container') {
      const r = db.prepare('SELECT name, parent_type, parent_id FROM containers WHERE id=?').get(id);
      if (!r) break;
      parts.unshift(r.name);
      type = r.parent_type; id = r.parent_id;
    } else break;
    d++;
  }
  return parts.join(' › ');
}

// Download a URL to a local file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto.get(url, { headers: { 'User-Agent': 'Ghrava/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(destPath); });
    }).on('error', err => { fs.unlink(destPath, () => {}); reject(err); });
  });
}

// Google CSE manual finder
async function findManualPDF(brand, model) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cseId  = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cseId) return null;
  const q = encodeURIComponent(`${brand || ''} ${model || ''} manual filetype:pdf`);
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${q}&num=3`;
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Ghrava/1.0' } }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pdfItem = (json.items || []).find(i =>
            i.link && (i.link.toLowerCase().endsWith('.pdf') || i.mime === 'application/pdf')
          );
          resolve(pdfItem?.link || null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// UPC lookup
function upcLookup(upc) {
  return new Promise(resolve => {
    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`;
    https.get(url, { headers: { 'User-Agent': 'Ghrava/1.0' } }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const item = json.items?.[0];
          if (!item) return resolve(null);
          const rawModel = item.model || null;
          // Don't use model if it looks like a barcode (8-14 digits) or matches the UPC itself
          const isBarcode = rawModel && /^\d{8,14}$/.test(rawModel.trim());
          resolve({
            name: item.title || null, brand: item.brand || null,
            model_number: (rawModel && !isBarcode) ? rawModel : null,
            manufacturer: item.brand || null,
            description: item.description || null, upc_barcode: upc,
            category: item.category || null,
            images: item.images || [],   // array of image URLs from upcitemdb
          });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// Open Food Facts fallback — free, local, covers grocery/food items UPCitemdb misses
function openFoodFactsLookup(upc) {
  return new Promise(resolve => {
    const url = `https://world.openfoodfacts.org/api/v0/product/${upc}.json`;
    https.get(url, { headers: { 'User-Agent': 'Ghrava/1.0' } }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status !== 1 || !json.product) return resolve(null);
          const p = json.product;
          const name = p.product_name || p.product_name_en || null;
          if (!name) return resolve(null);
          const images = [];
          if (p.image_url) images.push(p.image_url);
          if (p.image_front_url && p.image_front_url !== p.image_url)
            images.push(p.image_front_url);
          resolve({
            name,
            brand:        p.brands?.split(',')[0]?.trim() || null,
            model_number: null,
            manufacturer: p.brands?.split(',')[0]?.trim() || null,
            description:  p.generic_name || p.categories?.split(',')[0]?.trim() || null,
            upc_barcode:  upc,
            category:     'Food & Beverage',
            images:       [...new Set(images)],
            source:       'open_food_facts',
          });
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

// ══════════════════════════════════════════════════════════════
// STATS
// ══════════════════════════════════════════════════════════════

// ── Item/Container reads — public (no auth required) ─────────
router.get('/by-ref/:ref', (req, res) => {
  try {
    const ref = req.params.ref;
    if (ref.startsWith('ITM')) {
      const item = db.prepare(ITEM_WITH_THUMB + ' WHERE i.item_ref = ?').get(ref);
      if (item) return res.json({ type: 'item', ...item });
    }
    if (ref.startsWith('CNT')) {
      const ctn = db.prepare('SELECT * FROM containers WHERE container_ref = ?').get(ref);
      if (ctn) return res.json({ type: 'container', ...ctn });
    }
    res.status(404).json({ error: 'Not found', ref });
  } catch (e) { serverError(res, e); }
});


router.get('/items', (req, res) => {
  try {
    const { parent_type, parent_id, category, search, tag, archived, is_business } = req.query;
    const showArchived = archived === '1';
    let sql = ITEM_WITH_THUMB + ' WHERE i.is_active=1';
    const params = [];
    sql += showArchived ? ' AND i.is_archived=1' : ' AND i.is_archived=0';
    if (parent_type)   { sql += ' AND i.parent_type=?'; params.push(parent_type); }
    if (parent_id)     { sql += ' AND i.parent_id=?';   params.push(parent_id); }
    if (category)      { sql += ' AND i.category=?';    params.push(category); }
    if (is_business === '0') { sql += ' AND i.is_business=0'; }
    if (is_business === '1') { sql += ' AND i.is_business=1'; }
    if (search) {
      sql += ' AND (i.name LIKE ? OR i.description LIKE ? OR i.brand LIKE ? OR i.model_number LIKE ? OR i.serial_number LIKE ? OR i.store_name LIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q, q, q);
    }
    if (tag) {
      sql += ` AND i.id IN (SELECT entity_id FROM taggables WHERE entity_type='item' AND tag_id=(SELECT id FROM tags WHERE name=? COLLATE NOCASE))`;
      params.push(tag);
    }
    sql += ' ORDER BY i.name';
    const items = db.prepare(sql).all(...params);
    res.json(items.map(i => ({ ...withTagNames(i, 'item'), location_path: getPath(i.parent_type, i.parent_id) })));
  } catch (err) { serverError(res, err); }
});


router.get('/items/:id', (req, res) => {
  try {
    const item = db.prepare(ITEM_WITH_THUMB + ' WHERE i.id=?').get(req.params.id);
    if (!item) return notFound(res, 'Item');
    const tags         = db.prepare(`SELECT t.* FROM tags t JOIN taggables tb ON t.id=tb.tag_id WHERE tb.entity_type='item' AND tb.entity_id=?`).all(req.params.id);
    const attachments  = db.prepare(`SELECT * FROM attachments WHERE entity_type='item' AND entity_id=? ORDER BY is_primary_photo DESC, sort_order, created_at`).all(req.params.id);
    const photos       = attachments.filter(a => a.is_image);
    const documents    = attachments.filter(a => !a.is_image);
    const maintenance  = db.prepare(`SELECT * FROM item_maintenance_log WHERE item_id=? ORDER BY log_date DESC`).all(req.params.id);
    const events       = getEvents(req.params.id, 30);
    res.json({ ...item, location_path: getPath(item.parent_type, item.parent_id), tags, attachments, photos, documents, maintenance, events });
  } catch (err) { serverError(res, err); }
});


router.get('/photos/:itemId/thumb_primary', (req, res) => {
  try {
    const a = db.prepare(
      `SELECT * FROM attachments WHERE entity_type='item' AND entity_id=? AND is_image=1 AND is_primary_photo=1`
    ).get(req.params.itemId);
    if (!a) return notFound(res, 'Photo');
    const src = (a.thumb_path && fs.existsSync(a.thumb_path)) ? a.thumb_path
              : (fs.existsSync(a.stored_path) ? a.stored_path : null);
    if (!src) return notFound(res, 'Photo file');
    res.sendFile(src, { root: '/' });
  } catch (err) { serverError(res, err); }
});


router.get('/photos/:photoId/file', (req, res) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.photoId);
    if (!a || !fs.existsSync(a.stored_path)) return notFound(res, 'Photo file');
    res.sendFile(a.stored_path, { root: '/' });
  } catch (err) { serverError(res, err); }
});


router.get('/documents/:docId/file', (req, res) => {
  try {
    const a = db.prepare('SELECT * FROM attachments WHERE id=?').get(req.params.docId);
    if (!a || !fs.existsSync(a.stored_path)) return notFound(res, 'Document file');
    res.setHeader('Content-Disposition', `inline; filename="${a.original_filename}"`);
    res.sendFile(a.stored_path, { root: '/' });
  } catch (err) { serverError(res, err); }
});


router.get('/items/:id/maintenance', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM item_maintenance_log WHERE item_id=? ORDER BY log_date DESC').all(req.params.id));
  } catch (err) { serverError(res, err); }
});


router.get('/search', (req, res) => {
  try {
    const { q, type } = req.query;
    if (!q || q.length < 2) return badRequest(res, 'q must be at least 2 characters');
    const like = `%${q}%`;
    const results = [];
    if (!type || type === 'item') {
      db.prepare(
        `SELECT i.id, 'item' AS type, i.name, i.category, i.brand, i.model_number, NULL AS thumb_path
         FROM items i
         WHERE i.is_active=1 AND i.is_archived=0
           AND (i.name LIKE ? OR i.description LIKE ? OR i.brand LIKE ?
                OR i.model_number LIKE ? OR i.serial_number LIKE ?)
         LIMIT 30`
      ).all(like,like,like,like,like).forEach(r => results.push(r));
    }
    if (!type || type === 'container') {
      db.prepare(
        `SELECT id, 'container' AS type, name, subtype AS category, NULL AS brand, NULL AS model_number, NULL AS thumb_path
         FROM containers WHERE name LIKE ? LIMIT 15`
      ).all(like).forEach(r => results.push(r));
    }
    if (!type || type === 'location') {
      db.prepare(
        `SELECT id, 'location' AS type, name, location_type AS category, NULL AS brand, NULL AS model_number, NULL AS thumb_path
         FROM locations WHERE name LIKE ? LIMIT 10`
      ).all(like).forEach(r => results.push(r));
    }
    res.json(results);
  } catch (err) { serverError(res, err); }
});


router.get('/qr/:type/:ref', (req, res) => {
  try {
    const p = path.join(QR_DIR, `${req.params.type}-${req.params.ref}.png`);
    if (!fs.existsSync(p)) return notFound(res, 'QR code');
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(p, { root: '/' });
  } catch (err) { serverError(res, err); }
});


router.get('/items/:id/hw-details', (req, res) => {
  try {
    const hw = db.prepare(`
      SELECT hw.*, 
        fm.display_name AS family_member_name,
        ph.name AS pharmacy_name, ph.phone_primary AS pharmacy_phone,
        dr.name AS doctor_name
      FROM item_hw_details hw
      LEFT JOIN family_members fm ON fm.id = hw.family_member_id
      LEFT JOIN contacts ph ON ph.id = hw.pharmacy_contact_id
      LEFT JOIN contacts dr ON dr.id = hw.prescribing_doctor_id
      WHERE hw.item_id = ?
    `).get(req.params.id);
    res.json(hw || {});
  } catch (err) { serverError(res, err); }
});


router.get('/hw', (req, res) => {
  try {
    const { family_member_id, subcategory, expiring_days } = req.query;
    let sql = `
      SELECT i.*, hw.*,
        fm.display_name AS family_member_name,
        ph.name AS pharmacy_name,
        dr.name AS doctor_name
      FROM items i
      JOIN item_hw_details hw ON hw.item_id = i.id
      LEFT JOIN family_members fm ON fm.id = hw.family_member_id
      LEFT JOIN contacts ph ON ph.id = hw.pharmacy_contact_id
      LEFT JOIN contacts dr ON dr.id = hw.prescribing_doctor_id
      WHERE i.is_archived = 0
    `;
    const params = [];
    if (family_member_id) { sql += ' AND hw.family_member_id=?'; params.push(family_member_id); }
    if (subcategory)      { sql += ' AND hw.hw_subcategory=?';   params.push(subcategory); }
    if (expiring_days) {
      sql += ` AND hw.expiration_date IS NOT NULL AND hw.expiration_date <= date('now', '+${parseInt(expiring_days)} days')`;
    }
    sql += ' ORDER BY hw.hw_subcategory, i.name';
    res.json(db.prepare(sql).all(...params));
  } catch (err) { serverError(res, err); }
});

// ── Locations — read (public) ─────────────────────────────────
router.get('/locations', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM locations ORDER BY name').all());
  } catch (err) { serverError(res, err); }
});

router.get('/locations/flat', (req, res) => {
  try {
    res.json(db.prepare('SELECT id, name, location_type, parent_location_id FROM locations ORDER BY name').all());
  } catch (err) { serverError(res, err); }
});

// ── Containers — read (public) ────────────────────────────────
router.get('/containers', (req, res) => {
  try {
    const { parent_type, parent_id } = req.query;
    let sql = 'SELECT * FROM containers WHERE 1=1';
    const params = [];
    if (parent_type) { sql += ' AND parent_type=?'; params.push(parent_type); }
    if (parent_id)   { sql += ' AND parent_id=?';   params.push(parent_id); }
    sql += ' ORDER BY name';
    res.json(db.prepare(sql).all(...params));
  } catch (err) { serverError(res, err); }
});

router.get('/containers/:id', (req, res) => {
  try {
    const ctn = db.prepare('SELECT * FROM containers WHERE id=?').get(req.params.id);
    if (!ctn) return notFound(res, 'Container');
    // Include contents so the UI can render items with thumbnails
    const containers = db.prepare('SELECT * FROM containers WHERE parent_type=? AND parent_id=? ORDER BY name').all('container', ctn.id);
    const items = db.prepare(ITEM_WITH_THUMB + ' WHERE i.parent_type=? AND i.parent_id=? AND i.is_active=1 AND i.is_archived=0 ORDER BY i.name').all('container', ctn.id);
    res.json({ ...ctn, contents: { containers, items } });
  } catch (err) { serverError(res, err); }
});

// ── Stats (public) ────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const items     = db.prepare("SELECT COUNT(*) AS n FROM items WHERE is_active=1 AND is_archived=0").get().n;
    const archived  = db.prepare("SELECT COUNT(*) AS n FROM items WHERE is_active=1 AND is_archived=1").get().n;
    const containers = db.prepare("SELECT COUNT(*) AS n FROM containers").get().n;
    const val       = db.prepare("SELECT COALESCE(SUM(purchase_price),0) AS v FROM items WHERE is_active=1 AND is_archived=0").get().v;
    res.json({ items, archived, containers, total_value: val });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// PRODUCT IMAGE FETCH — shared utility
// Downloads a product image from a URL, resizes it, saves to
// the attachments volume, inserts into the attachments table.
//
// Naming follows the established attachment convention:
//   inventory_{item-name-slug}_{YYYYMMDD}_product.jpg
//   thumb: same filename prefixed with thumb_
//
// Full image: max 800px on longest side, JPEG quality 85
// Thumbnail:  400×400 cover crop,        JPEG quality 80
//
// Returns the new attachment row on success, null on failure.
// ══════════════════════════════════════════════════════════════

const ATT_BASE     = '/app/attachments/inventory';
const ATT_THUMB    = '/app/attachments/inventory/thumbs';
const UNC_BASE_INV = '\\\\soninas\\Backups\\MyAppAttachments\\inventory';

function ensureAttachDirs() {
  [ATT_BASE, ATT_THUMB].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
}

function slugify(str) {
  return String(str || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Ghrava/1.0' } }, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function fetchProductImage(itemId) {
  // Load item
  const item = db.prepare('SELECT id, name, brand, upc_barcode FROM items WHERE id=?').get(itemId);
  if (!item)             return { ok: false, reason: 'item not found' };
  if (!item.upc_barcode) return { ok: false, reason: 'no UPC barcode' };

  // Check if primary photo already exists
  const existing = db.prepare(
    'SELECT id FROM attachments WHERE entity_type=? AND entity_id=? AND is_primary_photo=1'
  ).get('item', itemId);
  if (existing) return { ok: false, reason: 'primary photo already exists', skipped: true };

  // Get image URLs from upcitemdb
  const product = await upcLookup(item.upc_barcode);
  if (!product || !product.images || !product.images.length)
    return { ok: false, reason: 'no images found for UPC' };

  // Try each image URL until one downloads
  let imgBuffer = null;
  let usedUrl   = null;
  for (const url of product.images) {
    try {
      const buf = await downloadBuffer(url);
      // Validate it's actually an image (check magic bytes)
      if (buf && buf.length > 100) {
        imgBuffer = buf; usedUrl = url; break;
      }
    } catch(e) {
      console.log(`[fetchProductImage] failed url ${url}: ${e.message}`);
      continue;
    }
  }
  if (!imgBuffer) return { ok: false, reason: 'could not download any image' };
  console.log(`[fetchProductImage] item ${itemId} downloaded ${imgBuffer.length} bytes from ${usedUrl}`);

  ensureAttachDirs();

  const titleSlug = slugify(item.name || item.brand || 'product');
  const date      = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const baseName  = `inventory_${titleSlug}_${date}_product.jpg`;

  let storedName = baseName;
  let n = 2;
  while (fs.existsSync(`${ATT_BASE}/${storedName}`)) {
    storedName = baseName.replace('.jpg', `_${n}.jpg`);
    n++;
  }
  const thumbStoredName = `thumb_${storedName}`;
  const storedPath = `${ATT_BASE}/${storedName}`;
  const thumbPath  = `${ATT_THUMB}/${thumbStoredName}`;
  const uncPath    = `${UNC_BASE_INV}\\${storedName}`;

  // Use sharp if available for resizing, otherwise save raw
  try {
    if (sharp) {
      await sharp(imgBuffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(storedPath);
      await sharp(imgBuffer)
        .resize(400, 400, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);
    } else {
      // No sharp — save raw buffer directly
      fs.writeFileSync(storedPath, imgBuffer);
      fs.writeFileSync(thumbPath, imgBuffer);
    }
  } catch (e) {
    return { ok: false, reason: `image processing failed: ${e.message}` };
  }

  const fileSize = fs.statSync(storedPath).size;

  db.prepare('UPDATE attachments SET is_primary_photo=0 WHERE entity_type=? AND entity_id=?')
    .run('item', itemId);

  const info = db.prepare(`
    INSERT INTO attachments
      (entity_type, entity_id, module, label, original_filename, stored_filename,
       stored_path, unc_path, file_size, mime_type, is_image, is_primary_photo,
       thumb_path, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    'item', itemId, 'inventory', 'Product Photo',
    `${item.upc_barcode}_product.jpg`, storedName,
    storedPath, uncPath, fileSize, 'image/jpeg', 1, 1,
    thumbPath, `Auto-fetched via UPC ${item.upc_barcode} from ${usedUrl}`
  );

  return { ok: true, attachment: db.prepare('SELECT * FROM attachments WHERE id=?').get(info.lastInsertRowid) };
}

// ── Fetch product image for a single item ──────────────────────
// GET /api/v1/inventory/items/:id/fetch-image
// Public — no auth needed (reads are public, this only writes an image)
router.get('/items/:id/fetch-image', async (req, res) => {
  try {
    const result = await fetchProductImage(parseInt(req.params.id));
    if (result.ok)      return res.status(201).json(result.attachment);
    if (result.skipped) return res.json({ skipped: true, reason: result.reason });
    return res.status(404).json({ error: result.reason });
  } catch (e) { serverError(res, e); }
});

// ── Backfill images for all items with UPC but no primary photo ─
// POST /api/v1/inventory/items/backfill-images
// Processes up to 50 items per call to avoid long-running requests.
// Returns { processed, succeeded, skipped, failed, remaining }
router.post('/items/backfill-images', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const candidates = db.prepare(`
      SELECT i.id FROM items i
      WHERE i.upc_barcode IS NOT NULL
        AND i.upc_barcode != ''
        AND i.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM attachments a
          WHERE a.entity_type = 'item'
            AND a.entity_id = i.id
            AND a.is_primary_photo = 1
        )
      ORDER BY i.id
      LIMIT ?
    `).all(limit);

    // Count total remaining (before processing)
    const totalRemaining = db.prepare(`
      SELECT COUNT(*) as n FROM items i
      WHERE i.upc_barcode IS NOT NULL AND i.upc_barcode != '' AND i.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM attachments a
          WHERE a.entity_type='item' AND a.entity_id=i.id AND a.is_primary_photo=1
        )
    `).get().n;

    let succeeded = 0, skipped = 0, failed = 0;
    const details = [];

    for (const row of candidates) {
      const result = await fetchProductImage(row.id);
      if (result.ok)      { succeeded++; details.push({ id: row.id, status: 'ok' }); }
      else if (result.skipped) { skipped++; details.push({ id: row.id, status: 'skipped', reason: result.reason }); }
      else                { failed++;    details.push({ id: row.id, status: 'failed',  reason: result.reason }); }
      // Small delay between requests to be a good API citizen
      await new Promise(r => setTimeout(r, 300));
    }

    res.json({
      processed:  candidates.length,
      succeeded,
      skipped,
      failed,
      remaining:  Math.max(0, totalRemaining - candidates.length),
      details,
    });
  } catch (e) { serverError(res, e); }
});

// ── UPC lookup (public — no auth needed to scan a barcode) ────
router.get('/upc/:barcode', async (req, res) => {
  try {
    let product = await upcLookup(req.params.barcode);

    // Open Food Facts fallback — good for grocery/food items UPCitemdb misses
    if (!product) {
      const offEnabled = db.prepare("SELECT value FROM app_config WHERE key='api_openfoodfacts_enabled'").get()?.value;
      if (offEnabled !== '0') {
        product = await openFoodFactsLookup(req.params.barcode);
      }
    }

    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Attempt manual PDF find if Google API keys are set
    let manual_url = null;
    let manual_search_url = null;
    if (product.brand || product.model_number) {
      const q = encodeURIComponent(`${product.brand||''} ${product.model_number||''} manual`);
      manual_search_url = `https://www.manualslib.com/search/?q=${q}`;
      try {
        manual_url = await findManualPDF(product.brand, product.model_number);
      } catch {}
    }

    res.json({ ...product, manual_url, manual_search_url });
  } catch (err) { serverError(res, err); }
});

// ── Parse product title into structured fields (public) ───────
// POST /api/v1/inventory/parse-title
// Body: { title: "Tylenol Extra Strength 500mg 100ct Caplets" }
// Returns: { name, brand, category, description, size, model_number, source }
router.post('/parse-title', (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return badRequest(res, 'title required');
    const raw = title.trim();

    // ── Size extraction ──────────────────────────────────────
    const sizePatterns = [
      /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|kg|oz|fl\s*oz|lb|lbs|ml|l|L)\b)/i,
      /\b(\d+\s*(?:ct|count|pack|pk|pc|pcs|piece|pieces|tablets?|caps?|capsules?|caplets?))\b/i,
      /\b(\d+[-\s](?:pack|pk|count|ct))\b/i,
    ];
    let size = '';
    for (const p of sizePatterns) {
      const m = raw.match(p);
      if (m) { size = m[1].replace(/\s+/g, ' ').trim(); break; }
    }

    // ── Category inference ───────────────────────────────────
    const categoryMap = [
      { cat: 'Health & Wellness', kw: /\b(vitamin|supplement|medicine|tablet|capsule|ibuprofen|acetaminophen|tylenol|advil|aspirin|antibiotic|probiotic|melatonin|allergy|antacid|bandage|first.?aid)\b/i },
      { cat: 'Food & Beverage',   kw: /\b(coffee|tea|juice|soda|water|snack|chips|cereal|sauce|oil|vinegar|sugar|flour|protein|bar|shake)\b/i },
      { cat: 'Electronics',       kw: /\b(cable|charger|battery|usb|hdmi|adapter|speaker|headphone|earphone|monitor|keyboard|mouse|router|hub)\b/i },
      { cat: 'Cleaning',          kw: /\b(detergent|cleaner|soap|shampoo|conditioner|bleach|disinfect|wipes|spray|laundry|dish)\b/i },
      { cat: 'Office',            kw: /\b(pen|pencil|notebook|paper|staple|binder|folder|tape|scissors|marker|highlighter)\b/i },
      { cat: 'Kitchen',           kw: /\b(utensil|spatula|pan|pot|bowl|plate|cup|mug|knife|fork|spoon|container|storage)\b/i },
      { cat: 'Baby & Kids',       kw: /\b(baby|infant|toddler|diaper|wipe|formula|toy|children)\b/i },
      { cat: 'Pet',               kw: /\b(dog|cat|pet|kibble|treat|collar|leash|litter|aquarium|bird|fish)\b/i },
      { cat: 'Personal Care',     kw: /\b(lotion|moisturizer|deodorant|razor|toothbrush|toothpaste|floss|sunscreen|makeup|face|skin)\b/i },
      { cat: 'Tools',             kw: /\b(drill|wrench|hammer|screwdriver|plier|tool|tape.?measure|level|bit|nail|screw|bolt)\b/i },
    ];
    let category = '';
    for (const { cat, kw } of categoryMap) {
      if (kw.test(raw)) { category = cat; break; }
    }

    // ── Model number extraction ──────────────────────────────
    const modelMatch = raw.match(/\b(?:model|part|item|sku|#|no\.?)\s*[:#]?\s*([A-Z0-9][-A-Z0-9]{3,})/i)
                    || raw.match(/\b([A-Z]{1,4}[-_][A-Z0-9]{3,}(?:[-_][A-Z0-9]+)*)\b/);
    const model_number = modelMatch ? modelMatch[1] : '';

    // ── Clean name (remove size token) ──────────────────────
    let name = raw;
    if (size) name = name.replace(new RegExp(size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
    name = name.replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').trim();
    if (name.length > 80) name = name.slice(0, 80).trim();

    res.json({ name, brand: '', category, description: raw, size, model_number, source: 'regex' });
  } catch (err) { serverError(res, err); }
});

// ── All routes below require authentication ──────────────────
router.use(requireAuth);

router.post('/locations', (req, res) => {
  try {
    const { name, description, location_type, notes } = req.body;
    if (!name) return badRequest(res, 'name is required');
    const r = db.prepare(`INSERT INTO locations (name, description, location_type, notes)
      VALUES (?, ?, ?, ?)`)
      .run(name, description||null, location_type||'room', notes||null);
    // Keep dropdown_options in sync so GH_SELECT shows the new name
    db.prepare(`INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
      VALUES ('location_name', ?, ?, 0, 1, (SELECT COALESCE(MAX(sort_order),0)+1 FROM dropdown_options WHERE list_key='location_name'))`)
      .run(name, name);
    res.status(201).json(db.prepare('SELECT * FROM locations WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { serverError(res, err); }
});

router.put('/locations/:id', (req, res) => {
  try {
    const { name, description, location_type, notes } = req.body;
    if (!name) return badRequest(res, 'name is required');
    const existing = db.prepare('SELECT name FROM locations WHERE id=?').get(req.params.id);
    db.prepare(`UPDATE locations SET name=?, description=?, location_type=?,
      notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name, description||null, location_type||'room', notes||null, req.params.id);
    // Sync dropdown_options — update label if name changed
    if (existing && existing.name !== name) {
      db.prepare(`UPDATE dropdown_options SET label=?, value=? WHERE list_key='location_name' AND value=?`)
        .run(name, name, existing.name);
    }
    db.prepare(`INSERT OR IGNORE INTO dropdown_options (list_key, label, value, is_system, is_active, sort_order)
      VALUES ('location_name', ?, ?, 0, 1, (SELECT COALESCE(MAX(sort_order),0)+1 FROM dropdown_options WHERE list_key='location_name'))`)
      .run(name, name);
    res.json(db.prepare('SELECT * FROM locations WHERE id=?').get(req.params.id));
  } catch (err) { serverError(res, err); }
});

router.delete('/locations/:id', (req, res) => {
  try {
    const hasContainers = db.prepare("SELECT 1 FROM containers WHERE parent_type='location' AND parent_id=?").get(req.params.id);
    const hasItems      = db.prepare("SELECT 1 FROM items WHERE parent_type='location' AND parent_id=?").get(req.params.id);
    const hasChildren   = db.prepare('SELECT 1 FROM locations WHERE parent_location_id=?').get(req.params.id);
    if (hasContainers || hasItems || hasChildren)
      return badRequest(res, 'Cannot delete — has containers, items, or sub-locations. Move or delete them first.');
    db.prepare('DELETE FROM locations WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// CONTAINERS
// ══════════════════════════════════════════════════════════════


router.post('/containers', async (req, res) => {
  try {
    const { name, description, subtype, parent_type, parent_id, notes } = req.body;
    if (!name || !parent_type || !parent_id) return badRequest(res, 'name, parent_type, parent_id required');
    const ref = nextRef('CTN', 'containers', 'container_ref');
    let qrPath = null;
    try { qrPath = await generateQR('container', ref, getBaseUrl(`${req.protocol}://${req.get('host')}`)); } catch {}
    const r = db.prepare(`INSERT INTO containers (container_ref,name,description,subtype,parent_type,parent_id,qr_code_path,notes)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(ref, name, description||null, subtype||'movable', parent_type, parent_id, qrPath, notes||null);
    res.status(201).json(db.prepare('SELECT * FROM containers WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { serverError(res, err); }
});

router.put('/containers/:id', (req, res) => {
  try {
    const { name, description, subtype, notes } = req.body;
    db.prepare(`UPDATE containers SET name=?,description=?,subtype=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(name, description||null, subtype||'movable', notes||null, req.params.id);
    res.json(db.prepare('SELECT * FROM containers WHERE id=?').get(req.params.id));
  } catch (err) { serverError(res, err); }
});


router.put('/containers/:id/move', (req, res) => {
  try {
    const { new_parent_type, new_parent_id, confirm } = req.body;
    if (!new_parent_type || !new_parent_id) return badRequest(res, 'new_parent_type and new_parent_id required');
    if (!confirm) return badRequest(res, 'confirm=true required');
    const old = db.prepare('SELECT parent_type, parent_id FROM containers WHERE id=?').get(req.params.id);
    db.prepare(`UPDATE containers SET parent_type=?,parent_id=?,last_moved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(new_parent_type, new_parent_id, req.params.id);
    // Log move event for all items inside
    const items = db.prepare("SELECT id FROM items WHERE parent_type='container' AND parent_id=?").all(req.params.id);
    const oldPath = old ? getPath(old.parent_type, old.parent_id) : '';
    const newPath = getPath(new_parent_type, new_parent_id);
    items.forEach(i => logEvent(i.id, 'moved', { old_value: oldPath, new_value: newPath, notes: 'Container moved' }));
    res.json({ moved: true });
  } catch (err) { serverError(res, err); }
});

router.delete('/containers/:id', (req, res) => {
  try {
    const hasC = db.prepare("SELECT 1 FROM containers WHERE parent_type='container' AND parent_id=?").get(req.params.id);
    const hasI = db.prepare("SELECT 1 FROM items WHERE parent_type='container' AND parent_id=? AND is_active=1").get(req.params.id);
    if (hasC || hasI) return badRequest(res, 'Container has contents. Move or delete them first.');
    db.prepare('DELETE FROM containers WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// ITEMS
// ══════════════════════════════════════════════════════════════
const ITEM_WITH_THUMB = `
  SELECT i.*,
    a.stored_path  as thumb_path,
    a.thumb_path   as thumb_small,
    a.id           as primary_photo_id,
    (SELECT COUNT(*) FROM attachments WHERE entity_type='item' AND entity_id=i.id) as attachment_count
  FROM items i
  LEFT JOIN attachments a
    ON a.entity_type='item' AND a.entity_id=i.id
    AND a.is_image=1 AND a.is_primary_photo=1
`;

// Direct ref lookup — used by QR code deep-link (?open=ITM-xxxx or CNT-xxxx)
// Separate from /items search because search uses LIKE on name/brand/etc, not item_ref
router.post('/items', async (req, res) => {
  try {
    const d = req.body;
    if (!d.name)        return badRequest(res, 'name is required');
    if (!d.parent_type) return badRequest(res, 'parent_type is required');
    if (!d.parent_id)   return badRequest(res, 'parent_id is required');

    const ref = nextRef('ITM', 'items', 'item_ref');
    let qrPath = null;
    try { qrPath = await generateQR('item', ref, getBaseUrl(`${req.protocol}://${req.get('host')}`)); } catch {}

    const r = db.prepare(`INSERT INTO items
      (item_ref,name,description,category,parent_type,parent_id,is_container,quantity,
       brand,model_number,serial_number,manufacturer,upc_barcode,size,manufacturer_country,
       manufacturer_support_phone,manufacturer_support_url,
       purchase_date,purchase_price,purchased_from,store_name,purchase_method,order_number,
       replacement_value,appraised_value,appraised_date,condition,
       insured,insurance_policy,insured_value,
       warranty_expires,lifetime_warranty,warranty_vendor,warranty_vendor_contact_id,warranty_phone,warranty_claim_url,warranty_notes,
       sold_date,sold_price,sold_to,
       qr_code_path,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .run(
        ref, d.name, d.description||null, d.category||null, d.parent_type, d.parent_id,
        d.is_container?1:0, d.quantity||1,
        d.brand||null, d.model_number||null, d.serial_number||null, d.manufacturer||null,
        d.upc_barcode||null, d.size||null, d.manufacturer_country||null,
        d.manufacturer_support_phone||null, d.manufacturer_support_url||null,
        d.purchase_date||null, d.purchase_price||null, d.purchased_from||null,
        d.store_name||null, d.purchase_method||null, d.order_number||null,
        d.replacement_value||null, d.appraised_value||null, d.appraised_date||null, d.condition||null,
        d.insured?1:0, d.insurance_policy||null, d.insured_value||null,
        d.warranty_expires||null, d.lifetime_warranty?1:0, d.warranty_vendor||null,
        d.warranty_vendor_contact_id||null,
        d.warranty_phone||null, d.warranty_claim_url||null, d.warranty_notes||null,
        d.sold_date||null, d.sold_price||null, d.sold_to||null,
        qrPath, d.notes||null
      );

    const newItem = db.prepare('SELECT * FROM items WHERE id=?').get(r.lastInsertRowid);
    logEvent(newItem.id, 'created', { new_value: newItem.name });
    if (d.tags && d.tags.length) saveTagsByName(newItem.id, 'item', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(newItem.id, 'item', d.family_member_ids);
    res.status(201).json(newItem);

    // Auto-fetch product image in background if UPC present (non-blocking)
    if (newItem.upc_barcode) {
      fetchProductImage(newItem.id).catch(() => {});
    }
  } catch (err) { serverError(res, err); }
});

router.put('/items/:id', (req, res) => {
  try {
    const d = req.body;
    const old = db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id);
    if (!old) return notFound(res, 'Item');

    db.prepare(`UPDATE items SET
      name=?,description=?,category=?,parent_type=?,parent_id=?,is_container=?,quantity=?,
      brand=?,model_number=?,serial_number=?,manufacturer=?,upc_barcode=?,manufacturer_country=?,
      manufacturer_support_phone=?,manufacturer_support_url=?,
      purchase_date=?,purchase_price=?,purchased_from=?,store_name=?,purchase_method=?,order_number=?,
      replacement_value=?,appraised_value=?,appraised_date=?,condition=?,
      insured=?,insurance_policy=?,insured_value=?,
      warranty_expires=?,lifetime_warranty=?,warranty_vendor=?,warranty_vendor_contact_id=?,warranty_phone=?,warranty_claim_url=?,warranty_notes=?,
      sold_date=?,sold_price=?,sold_to=?,
      notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(
        d.name, d.description||null, d.category||null, d.parent_type, d.parent_id,
        d.is_container?1:0, d.quantity||1,
        d.brand||null, d.model_number||null, d.serial_number||null, d.manufacturer||null,
        d.upc_barcode||null, d.size||null, d.manufacturer_country||null,
        d.manufacturer_support_phone||null, d.manufacturer_support_url||null,
        d.purchase_date||null, d.purchase_price||null, d.purchased_from||null,
        d.store_name||null, d.purchase_method||null, d.order_number||null,
        d.replacement_value||null, d.appraised_value||null, d.appraised_date||null, d.condition||null,
        d.insured?1:0, d.insurance_policy||null, d.insured_value||null,
        d.warranty_expires||null, d.lifetime_warranty?1:0, d.warranty_vendor||null,
        d.warranty_vendor_contact_id||null,
        d.warranty_phone||null, d.warranty_claim_url||null, d.warranty_notes||null,
        d.sold_date||null, d.sold_price||null, d.sold_to||null,
        d.notes||null, req.params.id
      );

    // Audit significant changes
    const trackFields = ['name','category','condition','quantity','parent_type','parent_id'];
    trackFields.forEach(f => {
      if (String(old[f]||'') !== String(d[f]||'')) {
        const eventType = f === 'parent_id' ? 'moved'
          : f === 'condition' ? 'condition_changed'
          : f === 'quantity'  ? 'quantity_changed'
          : 'field_updated';
        logEvent(req.params.id, eventType, {
          field_changed: f,
          old_value: old[f],
          new_value: d[f]
        });
      }
    });

    if (d.tags !== undefined)           saveTagsByName(req.params.id, 'item', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'item', d.family_member_ids);
    clearReview('items', req.params.id);
    res.json(db.prepare('SELECT * FROM items WHERE id=?').get(req.params.id));
  } catch (err) { serverError(res, err); }
});

// Archive / unarchive
router.put('/items/:id/archive', (req, res) => {
  try {
    const { reason } = req.body;
    db.prepare(`UPDATE items SET is_archived=1, archived_at=CURRENT_TIMESTAMP, archived_reason=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(reason||null, req.params.id);
    logEvent(req.params.id, 'archived', { notes: reason || 'Archived' });
    res.json({ archived: true });
  } catch (err) { serverError(res, err); }
});

router.put('/items/:id/unarchive', (req, res) => {
  try {
    db.prepare(`UPDATE items SET is_archived=0, archived_at=NULL, archived_reason=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(req.params.id);
    logEvent(req.params.id, 'unarchived', {});
    res.json({ unarchived: true });
  } catch (err) { serverError(res, err); }
});

// Mark sold
router.put('/items/:id/sell', (req, res) => {
  try {
    const { sold_date, sold_price, sold_to } = req.body;
    db.prepare(`UPDATE items SET sold_date=?,sold_price=?,sold_to=?,is_archived=1,archived_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(sold_date||null, sold_price||null, sold_to||null, req.params.id);
    logEvent(req.params.id, 'sold', { new_value: sold_price ? `$${sold_price}` : 'unknown', notes: sold_to ? `Sold to ${sold_to}` : null });
    res.json({ sold: true });
  } catch (err) { serverError(res, err); }
});

// Hard delete (only if already archived)
router.delete('/items/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT is_archived FROM items WHERE id=?').get(req.params.id);
    if (!item) return notFound(res, 'Item');
    if (!item.is_archived) return badRequest(res, 'Archive the item before deleting permanently.');
    clearTags(req.params.id, 'item');
    db.prepare('DELETE FROM items WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// ATTACHMENTS — handled by shared /api/v1/attachments router
// Legacy stubs kept so any cached calls don't 500.
// New UI uses /api/v1/attachments/item/:id directly.
// ══════════════════════════════════════════════════════════════

// Serve file by attachment id (used by item cards for primary thumb)
// ══════════════════════════════════════════════════════════════
// MAINTENANCE LOG
// ══════════════════════════════════════════════════════════════
// MAINTENANCE LOG
// ══════════════════════════════════════════════════════════════
router.post('/items/:id/maintenance', (req, res) => {
  try {
    const { log_date, maintenance_type, description, cost, provider, next_due_date, notes } = req.body;
    if (!description) return badRequest(res, 'description is required');
    const r = db.prepare(`INSERT INTO item_maintenance_log (item_id,log_date,maintenance_type,description,cost,provider,next_due_date,notes)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(req.params.id, log_date||new Date().toISOString().slice(0,10), maintenance_type||'other',
           description, cost||null, provider||null, next_due_date||null, notes||null);
    logEvent(req.params.id, 'maintenance_logged', { new_value: description, notes: cost ? `Cost: $${cost}` : null });
    res.status(201).json(db.prepare('SELECT * FROM item_maintenance_log WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { serverError(res, err); }
});

router.delete('/items/:id/maintenance/:mId', (req, res) => {
  try {
    db.prepare('DELETE FROM item_maintenance_log WHERE id=? AND item_id=?').run(req.params.mId, req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// UPC LOOKUP + MANUAL FINDER
// ══════════════════════════════════════════════════════════════
// ── Parse product title into structured fields ────────────────
// Attach a PDF from URL (called after UPC lookup finds a manual)

router.post('/items/:id/attach-url', async (req, res) => {
  try {
    const { url, label } = req.body;
    if (!url) return badRequest(res, 'url required');
    const fname  = `manual-${Date.now()}.pdf`;
    const dir    = path.join(DOCS_DIR, String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, fname);
    await downloadFile(url, dest);
    const stat = fs.statSync(dest);
    const r = db.prepare(`INSERT INTO attachments (entity_type,entity_id,attachment_type,file_name,file_path,file_size,mime_type,label)
      VALUES ('item',?,'document',?,?,?,'application/pdf',?)`)
      .run(req.params.id, fname, dest, stat.size, label||'Manual');
    logEvent(req.params.id, 'document_added', { new_value: label||'Manual (auto-downloaded)' });
    res.status(201).json(db.prepare('SELECT * FROM attachments WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// QR CODE
// ══════════════════════════════════════════════════════════════
// Regenerate all QR codes with correct URLs
// POST /api/v1/inventory/qr/regenerate-all
router.post('/qr/regenerate-all', async (req, res) => {
  try {
    const baseUrl = getBaseUrl(`${req.protocol}://${req.get('host')}`);
    const items      = db.prepare('SELECT id, item_ref FROM items WHERE item_ref IS NOT NULL').all();
    const containers = db.prepare('SELECT id, container_ref FROM containers WHERE container_ref IS NOT NULL').all();
    let done = 0, failed = 0;
    for (const item of items) {
      try {
        const qrPath = await generateQR('item', item.item_ref, baseUrl);
        db.prepare('UPDATE items SET qr_code_path=? WHERE id=?').run(qrPath, item.id);
        done++;
      } catch { failed++; }
    }
    for (const ctn of containers) {
      try {
        const qrPath = await generateQR('container', ctn.container_ref, baseUrl);
        db.prepare('UPDATE containers SET qr_code_path=? WHERE id=?').run(qrPath, ctn.id);
        done++;
      } catch { failed++; }
    }
    res.json({ ok: true, regenerated: done, failed, base_url: baseUrl });
  } catch (err) { serverError(res, err); }
});


// ══════════════════════════════════════════════════════════════
// HEALTH & WELLNESS EXTENDED DETAILS
// ══════════════════════════════════════════════════════════════

// GET /api/v1/inventory/items/:id/hw-details
// POST /api/v1/inventory/items/:id/hw-details  (upsert)
router.post('/items/:id/hw-details', (req, res) => {
  try {
    const id = req.params.id;
    const d  = req.body;
    const existing = db.prepare('SELECT id FROM item_hw_details WHERE item_id=?').get(id);
    if (existing) {
      db.prepare(`
        UPDATE item_hw_details SET
          hw_subcategory=?, family_member_id=?, dosage_strength=?,
          expiration_date=?, lot_number=?, active_ingredients=?,
          rx_number=?, pharmacy_contact_id=?, prescribing_doctor_id=?,
          date_filled=?, refills_remaining=?, next_refill_date=?,
          updated_at=CURRENT_TIMESTAMP
        WHERE item_id=?
      `).run(
        d.hw_subcategory||'OTC', d.family_member_id||null, d.dosage_strength||null,
        d.expiration_date||null, d.lot_number||null, d.active_ingredients||null,
        d.rx_number||null, d.pharmacy_contact_id||null, d.prescribing_doctor_id||null,
        d.date_filled||null, d.refills_remaining!=null?+d.refills_remaining:null,
        d.next_refill_date||null, id
      );
    } else {
      db.prepare(`
        INSERT INTO item_hw_details
          (item_id, hw_subcategory, family_member_id, dosage_strength,
           expiration_date, lot_number, active_ingredients,
           rx_number, pharmacy_contact_id, prescribing_doctor_id,
           date_filled, refills_remaining, next_refill_date)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        id, d.hw_subcategory||'OTC', d.family_member_id||null, d.dosage_strength||null,
        d.expiration_date||null, d.lot_number||null, d.active_ingredients||null,
        d.rx_number||null, d.pharmacy_contact_id||null, d.prescribing_doctor_id||null,
        d.date_filled||null, d.refills_remaining!=null?+d.refills_remaining:null,
        d.next_refill_date||null
      );
    }
    res.json(db.prepare(`
      SELECT hw.*,
        fm.display_name AS family_member_name,
        ph.name AS pharmacy_name,
        dr.name AS doctor_name
      FROM item_hw_details hw
      LEFT JOIN family_members fm ON fm.id = hw.family_member_id
      LEFT JOIN contacts ph ON ph.id = hw.pharmacy_contact_id
      LEFT JOIN contacts dr ON dr.id = hw.prescribing_doctor_id
      WHERE hw.item_id=?
    `).get(id));
  } catch (err) { serverError(res, err); }
});

// GET /api/v1/inventory/hw — list all H&W items (for Medical page cross-reference)
// ══════════════════════════════════════════════════════════════
router.get('/export', (req, res) => {
  try {
    if (!XLSX) return serverError(res, new Error('xlsx module not available'));

    const wb = XLSX.utils.book_new();

    // Items sheet — includes primary attachment path per item
    const items = db.prepare(`
      SELECT i.item_ref, i.name, i.description, i.category, i.brand, i.model_number, i.serial_number,
        i.quantity, i.condition,
        l_loc.name as location_name, l_ctn.name as container_name,
        i.purchase_date, i.purchase_price, i.store_name, i.purchase_method, i.purchased_from, i.order_number,
        i.replacement_value, i.warranty_expires, i.lifetime_warranty,
        i.insured, i.insurance_policy, i.insured_value,
        i.sold_date, i.sold_price, i.sold_to,
        i.manufacturer, i.upc_barcode, i.is_archived, i.notes,
        i.id as _item_id
      FROM items i
      LEFT JOIN locations l_loc ON i.parent_type='location' AND i.parent_id=l_loc.id
      LEFT JOIN containers l_ctn ON i.parent_type='container' AND i.parent_id=l_ctn.id
      WHERE i.is_active=1 ORDER BY i.name
    `).all();

    // Primary attachment per item (NAS/UNC path preferred)
    const primaryAtts = {};
    db.prepare(`
      SELECT entity_id, COALESCE(unc_path, stored_path) as path, original_filename
      FROM attachments WHERE entity_type='item' AND is_primary_photo=1
    `).all().forEach(a => { primaryAtts[a.entity_id] = a; });

    const itemsSheet = items.map(row => {
      const att = primaryAtts[row._item_id];
      const out = { ...row };
      delete out._item_id;
      out.attachment_path = att ? att.path : '';
      out.attachment_file = att ? att.original_filename : '';
      return out;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsSheet.length ? itemsSheet : [{}]), 'Items');

    // Attachments sheet — all attachments with NAS paths, all modules
    const allAtts = db.prepare(`
      SELECT a.entity_type, a.entity_id, a.module, a.label,
        a.original_filename, COALESCE(a.unc_path, a.stored_path) as file_path,
        a.file_size, a.mime_type, a.is_primary_photo, a.created_at
      FROM attachments a ORDER BY a.entity_type, a.entity_id, a.is_primary_photo DESC, a.created_at
    `).all();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allAtts.length ? allAtts : [{}]), 'Attachments');

    // Locations sheet
    const locs = db.prepare('SELECT id,name,location_type,address,description,notes FROM locations ORDER BY name').all();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(locs.length ? locs : [{}]), 'Locations');

    // Containers sheet
    const ctns = db.prepare(`
      SELECT c.container_ref, c.name, c.subtype, c.notes,
        CASE WHEN c.parent_type='location' THEN l.name ELSE p.name END as parent_name,
        c.parent_type
      FROM containers c
      LEFT JOIN locations l ON c.parent_type='location' AND c.parent_id=l.id
      LEFT JOIN containers p ON c.parent_type='container' AND c.parent_id=p.id
      ORDER BY c.name
    `).all();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ctns.length ? ctns : [{}]), 'Containers');

    // Daily Log sheet
    const logs = db.prepare('SELECT log_date,category,entry_text,follow_up_needed,follow_up_date FROM daily_log ORDER BY log_date DESC').all();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logs.length ? logs : [{}]), 'Daily Log');

    // Maintenance sheet
    const maint = db.prepare(`
      SELECT i.name as item_name, i.item_ref, m.log_date, m.maintenance_type,
        m.description, m.cost, m.provider, m.next_due_date, m.notes
      FROM item_maintenance_log m JOIN items i ON m.item_id=i.id
      ORDER BY m.log_date DESC
    `).all();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(maint.length ? maint : [{}]), 'Maintenance');

    // Audit log sheet
    const audit = db.prepare(`
      SELECT i.name as item_name, i.item_ref, e.event_type,
        e.field_changed, e.old_value, e.new_value, e.notes, e.created_at
      FROM item_events e JOIN items i ON e.item_id=i.id
      ORDER BY e.created_at DESC LIMIT 1000
    `).all();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(audit.length ? audit : [{}]), 'Audit Log');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const fname = `Ghrava-Export-${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(buf);
  } catch (err) { serverError(res, err); }
});
// ══════════════════════════════════════════════════════════════
// IMPORT — xlsx workbook (Items sheet only for now)
// ══════════════════════════════════════════════════════════════
router.post('/import', uploadImport.single('file'), async (req, res) => {
  try {
    if (!req.file) return badRequest(res, 'No file uploaded');
    if (!XLSX)     return serverError(res, new Error('xlsx module not available'));

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets['Items'];
    if (!ws) return badRequest(res, 'No "Items" sheet found in workbook');

    const rows = XLSX.utils.sheet_to_json(ws);
    let imported = 0, skipped = 0, errors = [], importedIds = [];

    for (const row of rows) {
      try {
        if (!row.name) { skipped++; continue; }
        // Find or create location
        let parent_type = 'location', parent_id = null;
        if (row.location_name) {
          let loc = db.prepare('SELECT id FROM locations WHERE name=? COLLATE NOCASE').get(row.location_name);
          if (!loc) {
            const r = db.prepare("INSERT INTO locations (name,location_type) VALUES (?,'room')").run(row.location_name);
            loc = { id: r.lastInsertRowid };
          }
          parent_id = loc.id;
        }
        if (row.container_name) {
          let ctn = db.prepare('SELECT id FROM containers WHERE name=? COLLATE NOCASE').get(row.container_name);
          if (ctn) { parent_type = 'container'; parent_id = ctn.id; }
        }
        if (!parent_id) { skipped++; errors.push(`Row "${row.name}": no location found`); continue; }
        // Skip if item_ref already exists
        if (row.item_ref && db.prepare('SELECT 1 FROM items WHERE item_ref=?').get(row.item_ref)) { skipped++; continue; }

        const ref = row.item_ref || nextRef('ITM', 'items', 'item_ref');
        let qrPath = null;
        try { qrPath = await generateQR('item', ref, getBaseUrl(`${req.protocol}://${req.get('host')}`)); } catch {}

        const r = db.prepare(`INSERT INTO items
          (item_ref,name,description,category,parent_type,parent_id,quantity,brand,model_number,
           serial_number,purchase_date,purchase_price,store_name,purchase_method,condition,
           warranty_expires,insured,notes,qr_code_path)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .run(ref, row.name, row.description||null, row.category||null, parent_type, parent_id,
               row.quantity||1, row.brand||null, row.model_number||null, row.serial_number||null,
               row.purchase_date||null, row.purchase_price||null, row.store_name||null,
               row.purchase_method||null, row.condition||null, row.warranty_expires||null,
               row.insured?1:0, row.notes||null, qrPath);
        logEvent(r.lastInsertRowid, 'created', { notes: 'Imported from xlsx' });
        importedIds.push(r.lastInsertRowid);
        imported++;
      } catch (e) { errors.push(`Row "${row.name}": ${e.message}`); skipped++; }
    }

    // Run data cleanup on imported items in background
    if (importedIds.length > 0) {
      setImmediate(() => {
        try { runDataCleanup({ source: 'import', itemIds: importedIds }); } catch {}
      });
    }
    res.json({ imported, skipped, errors: errors.slice(0, 20) });
  } catch (err) { serverError(res, err); }
});

module.exports = router;
