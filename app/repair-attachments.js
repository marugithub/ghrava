/**
 * repair-attachments.js
 *
 * Scans /app/attachments/inventory/ for image files that have no matching
 * row in the attachments table, matches each file back to its item by
 * comparing the slug in the filename to item names, and re-creates the
 * missing DB records.
 *
 * Run once via:
 *   docker exec ghrava node /app/repair-attachments.js
 *
 * Safe to re-run — skips files that already have a DB record.
 * Only touches inventory images. Never deletes anything.
 */

'use strict';

require('dotenv').config({ path: '/app/.env' });

const db   = require('./db/db');
const fs   = require('fs');
const path = require('path');

const INV_DIR   = '/app/attachments/inventory';
const THUMB_DIR = '/app/attachments/inventory/thumbs';
const UNC_BASE  = '\\\\soninas\\Backups\\MyAppAttachments\\inventory';

// ── Same slugify used when files were originally named ────────
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// ── Extract the item-name slug from a stored filename ─────────
// Format: inventory_{slug}_{YYYYMMDD}_{original}
// e.g.   inventory_apc-back-ups-650va_20260318_product.jpg
function extractSlug(filename) {
  const m = filename.match(/^inventory_([a-z0-9-]+)_\d{8}_/);
  return m ? m[1] : null;
}

if (!fs.existsSync(INV_DIR)) {
  console.log('Attachments folder not found:', INV_DIR);
  process.exit(0);
}

// Load all items
const items = db.prepare('SELECT id, name FROM items WHERE is_active=1').all();
console.log(`Loaded ${items.length} items from DB`);

// Build slug → item map (multiple items may share a slug prefix — we'll handle ambiguity)
const slugMap = {};
for (const item of items) {
  const s = slugify(item.name);
  if (!slugMap[s]) slugMap[s] = [];
  slugMap[s].push(item);
}

// Get all existing stored_paths so we can skip already-linked files
const existing = new Set(
  db.prepare('SELECT stored_path FROM attachments').all().map(r => r.stored_path)
);
console.log(`Found ${existing.size} existing attachment records`);

// Scan inventory folder for non-thumb image files
const files = fs.readdirSync(INV_DIR).filter(f => {
  if (f.startsWith('thumb_')) return false;
  if (fs.statSync(path.join(INV_DIR, f)).isDirectory()) return false;
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(f);
});
console.log(`Found ${files.length} image files in inventory folder\n`);

let inserted = 0;
let skipped  = 0;
let unmatched = 0;

for (const filename of files) {
  const storedPath = path.join(INV_DIR, filename);

  // Already has a DB record — skip
  if (existing.has(storedPath)) {
    console.log(`  SKIP (already linked): ${filename}`);
    skipped++;
    continue;
  }

  const fileSlug = extractSlug(filename);
  if (!fileSlug) {
    console.log(`  SKIP (can't parse slug): ${filename}`);
    unmatched++;
    continue;
  }

  // Try exact slug match first, then prefix match
  let candidates = slugMap[fileSlug] || [];
  if (candidates.length === 0) {
    // Try prefix — slug in filename may be truncated at 40 chars
    candidates = items.filter(i => slugify(i.name).startsWith(fileSlug));
  }

  if (candidates.length === 0) {
    console.log(`  NO MATCH for slug "${fileSlug}": ${filename}`);
    unmatched++;
    continue;
  }

  // If multiple candidates, pick the one whose full slug best matches
  const item = candidates.sort((a, b) => {
    const da = Math.abs(slugify(a.name).length - fileSlug.length);
    const db2 = Math.abs(slugify(b.name).length - fileSlug.length);
    return da - db2;
  })[0];

  // Check if a thumb exists
  const thumbName = `thumb_${filename}`;
  const thumbPath = path.join(THUMB_DIR, thumbName);
  const hasThumb  = fs.existsSync(thumbPath);

  // Is this item missing a primary photo?
  const hasPrimary = db.prepare(
    'SELECT 1 FROM attachments WHERE entity_type=? AND entity_id=? AND is_primary_photo=1'
  ).get('item', item.id);

  const isPrimary = hasPrimary ? 0 : 1;
  const fileSize  = fs.statSync(storedPath).size;
  const uncPath   = `${UNC_BASE}\\${filename}`;

  db.prepare(`
    INSERT INTO attachments
      (entity_type, entity_id, module, label, original_filename, stored_filename,
       stored_path, unc_path, file_size, mime_type, is_image, is_primary_photo,
       thumb_path, notes)
    VALUES ('item', ?, 'inventory', 'Product Photo', ?, ?, ?, ?, ?, 'image/jpeg', 1, ?, ?, ?)
  `).run(
    item.id,
    filename,
    filename,
    storedPath,
    uncPath,
    fileSize,
    isPrimary,
    hasThumb ? thumbPath : null,
    `Restored by repair-attachments.js — matched slug "${fileSlug}"`
  );

  console.log(`  LINKED: ${filename}`);
  console.log(`       → item #${item.id}: ${item.name} (primary=${isPrimary})`);
  inserted++;
}

console.log(`
──────────────────────────────────
  Inserted : ${inserted}
  Skipped  : ${skipped} (already linked)
  Unmatched: ${unmatched}
──────────────────────────────────`);

if (unmatched > 0) {
  console.log(`
  Unmatched files could not be linked automatically.
  Check the filenames above and manually assign them in the app
  by opening the item and uploading the photo again.`);
}

process.exit(0);
