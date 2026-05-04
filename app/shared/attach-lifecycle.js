// @ts-check
'use strict';
/**
 * shared/attach-lifecycle.js
 *
 * v202604.140 — Companion to shared/attachments.js. Adds the file-move
 * lifecycle introduced with the receipt inbox:
 *
 *   _inbox/receipts/   → drop zone for receipts
 *   _inbox/eob/        → drop zone for EOBs
 *   _inbox/_failed/    → parse-failure copies (file kept)
 *   _orphans/          → record was deleted, file preserved
 *   _rejected/         → user rejected ("not medical")
 *
 * Plus the hash-prefixed filename convention for new files:
 *   <8-char-hash>_<original-name>.<ext>
 *
 * Existing files (those already in module folders before v140) are left
 * untouched. New convention applies only going forward.
 *
 * No DB writes here — pure file operations + path helpers. Modules that
 * call these are responsible for keeping their DB rows in sync.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ATTACHMENTS_ROOT = process.env.ATTACHMENTS_ROOT || '/app/attachments';

const INBOX_DIR    = path.join(ATTACHMENTS_ROOT, '_inbox');
const RECEIPTS_DIR = path.join(INBOX_DIR, 'receipts');
const EOB_DIR      = path.join(INBOX_DIR, 'eob');
const FAILED_DIR   = path.join(INBOX_DIR, '_failed');
const ORPHANS_DIR  = path.join(ATTACHMENTS_ROOT, '_orphans');
const REJECTED_DIR = path.join(ATTACHMENTS_ROOT, '_rejected');

/**
 * Ensure the lifecycle folders exist on disk. Idempotent — safe to call
 * on every server startup. Existing module folders are NOT created here
 * (that's done elsewhere by the legacy attachments init).
 */
function ensureLifecycleDirs() {
  for (const d of [RECEIPTS_DIR, EOB_DIR, FAILED_DIR, ORPHANS_DIR, REJECTED_DIR]) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }
}

/**
 * Compute SHA-256 hash of a file. Returns full 64-char hex digest.
 * Synchronous — fine for the small files we deal with (<20MB).
 */
function hashFileSync(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/**
 * Build the hash-prefixed filename: <8char>_<original>.<ext>
 *
 * Original-name preserved for human readability. 8 hex chars
 * (32 bits) is collision-safe at home-NAS scale — would need
 * billions of files for realistic collision risk.
 */
function hashedName(fullHash, originalName) {
  const safe = (originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${fullHash.slice(0, 8)}_${safe}`;
}

/**
 * Move a file into a target module folder using the new hash-prefix
 * convention. Returns the new absolute path.
 *
 * Caller has already hashed (avoid double-read on big files). If the
 * target file already exists (collision), we fall back to a longer
 * hash prefix until unique.
 */
function moveToModule(srcPath, targetModule, fullHash, originalName) {
  const moduleDir = path.join(ATTACHMENTS_ROOT, targetModule);
  if (!fs.existsSync(moduleDir)) fs.mkdirSync(moduleDir, { recursive: true });

  let prefixLen = 8;
  let destPath;
  while (true) {
    const name = `${fullHash.slice(0, prefixLen)}_${(originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    destPath = path.join(moduleDir, name);
    if (!fs.existsSync(destPath)) break;
    prefixLen += 4;
    if (prefixLen > 64) {
      // 64 chars = full hash. If this collides, the file is byte-identical.
      throw new Error(`Hash collision for ${originalName} — duplicate content?`);
    }
  }
  fs.renameSync(srcPath, destPath);
  return destPath;
}

/**
 * Move a file out of the inbox to _failed/ when its parser fails.
 * Original file remains accessible — manual review can still recover it.
 */
function moveToFailed(srcPath, originalName, errorMessage) {
  if (!fs.existsSync(FAILED_DIR)) fs.mkdirSync(FAILED_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = (originalName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const destPath = path.join(FAILED_DIR, `${ts}_${safe}`);
  fs.renameSync(srcPath, destPath);
  // Drop a sibling .error.txt so the cause is discoverable later
  if (errorMessage) {
    fs.writeFileSync(destPath + '.error.txt', String(errorMessage));
  }
  return destPath;
}

/**
 * Move a file to _orphans/ when its DB record was deleted. Preserves
 * the audit trail. Files here are never auto-purged.
 */
function moveToOrphans(srcPath) {
  if (!fs.existsSync(srcPath)) return null;  // already gone, nothing to do
  if (!fs.existsSync(ORPHANS_DIR)) fs.mkdirSync(ORPHANS_DIR, { recursive: true });
  const base = path.basename(srcPath);
  let destPath = path.join(ORPHANS_DIR, base);
  // If a same-named orphan already exists, append timestamp
  if (fs.existsSync(destPath)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    destPath = path.join(ORPHANS_DIR, `${ts}_${base}`);
  }
  fs.renameSync(srcPath, destPath);
  return destPath;
}

/**
 * Move a file to _rejected/ when the user explicitly rejected it
 * during inbox review (e.g. "not medical").
 */
function moveToRejected(srcPath) {
  if (!fs.existsSync(srcPath)) return null;
  if (!fs.existsSync(REJECTED_DIR)) fs.mkdirSync(REJECTED_DIR, { recursive: true });
  const base = path.basename(srcPath);
  let destPath = path.join(REJECTED_DIR, base);
  if (fs.existsSync(destPath)) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    destPath = path.join(REJECTED_DIR, `${ts}_${base}`);
  }
  fs.renameSync(srcPath, destPath);
  return destPath;
}

/**
 * Path-allowlist check — used by the file-serving routes to refuse
 * paths that escape ATTACHMENTS_ROOT (defense-in-depth against the
 * security audit finding #3).
 */
function isUnderAttachmentsRoot(filePath) {
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  const root = path.resolve(ATTACHMENTS_ROOT);
  return resolved === root || resolved.startsWith(root + path.sep);
}

module.exports = {
  ATTACHMENTS_ROOT,
  INBOX_DIR, RECEIPTS_DIR, EOB_DIR, FAILED_DIR, ORPHANS_DIR, REJECTED_DIR,
  ensureLifecycleDirs,
  hashFileSync,
  hashedName,
  moveToModule,
  moveToFailed,
  moveToOrphans,
  moveToRejected,
  isUnderAttachmentsRoot,
};
