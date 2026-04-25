/**
 * features/backup/routes.js
 * Manual backup & restore for the SQLite database.
 *
 * Backup destination (via Docker volume mount):
 *   /app/backups/  →  \\soninas\Backups\XPS - My Documents\AllDocuments\_SaveForever\MyAppBackups\
 *
 * Routes:
 *   POST   /api/v1/backup/now          trigger immediate backup
 *   GET    /api/v1/backup/list         list backup files (all on disk, UI shows last 30)
 *   GET    /api/v1/backup/download/:filename   download a backup file to browser
 *   POST   /api/v1/backup/restore      restore from a backup file
 */
'use strict';

const express  = require('express');
const router   = express.Router();
const fs       = require('fs');
const path     = require('path');
const { requireAuth }  = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');
const db       = require('../../db/db');   // needed for SQLite Online Backup API

const DB_PATH      = process.env.DB_PATH || '/app/data/lifetracker.db';
const BACKUP_DIR   = '/app/backups';
const MAX_UI_LIST  = 30;

// Ensure backup dir exists on startup
try {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
} catch (e) {
  console.warn('Backup dir not available (volume not mounted?):', e.message);
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_` +
         `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function listBackupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const fp   = path.join(BACKUP_DIR, f);
      const stat = fs.statSync(fp);
      return { filename: f, size: stat.size, created_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at)); // newest first
}

async function doBackup(label = 'backup') {
  if (!fs.existsSync(DB_PATH)) throw new Error('Database file not found at ' + DB_PATH);
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const filename = `lifetracker_${label}_${timestamp()}.db`;
  const dest     = path.join(BACKUP_DIR, filename);
  // Use SQLite's own Online Backup API (via better-sqlite3) instead of a raw
  // file copy. This goes through SQLite itself and guarantees a fully consistent,
  // fully committed snapshot — no risk of copying a file mid-write or missing
  // pages that are in SQLite's internal page cache but not yet flushed to disk.
  await db.backup(dest);
  const stat = fs.statSync(dest);
  return { filename, size: stat.size, created_at: stat.mtime.toISOString() };
}

// ══════════════════════════════════════════════════════════════
// BACKUP NOW
// POST /api/v1/backup/now
// ══════════════════════════════════════════════════════════════

// ── All routes require authentication ────────────────────────
router.use(requireAuth);

router.post('/now', async (req, res) => {
  try {
    const result = await doBackup('manual');
    res.status(201).json({ ok: true, ...result });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// SCHEDULED BACKUPS
// Config persisted in app_config:
//   backup_schedule_enabled  '1' | '0'
//   backup_schedule_hour     '0'..'23'  (default 3 — 3am)
//   backup_retention_days    '7' | '14' | '30' (default 14)
//   backup_last_auto_at      ISO date 'YYYY-MM-DD'
// ══════════════════════════════════════════════════════════════

function getCfg(key, fallback) {
  try {
    const r = db.prepare('SELECT value FROM app_config WHERE key=?').get(key);
    return r ? r.value : fallback;
  } catch { return fallback; }
}
function setCfg(key, value) {
  try {
    db.prepare(`INSERT INTO app_config (key,value) VALUES (?,?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, String(value));
  } catch (e) { console.warn('[backup] setCfg failed:', e.message); }
}

router.get('/schedule', (req, res) => {
  res.json({
    enabled:        getCfg('backup_schedule_enabled', '0') === '1',
    hour:           parseInt(getCfg('backup_schedule_hour', '3'), 10),
    retention_days: parseInt(getCfg('backup_retention_days', '14'), 10),
    last_auto_at:   getCfg('backup_last_auto_at', null),
  });
});

router.post('/schedule', (req, res) => {
  try {
    const { enabled, hour, retention_days } = req.body || {};
    if (enabled !== undefined) setCfg('backup_schedule_enabled', enabled ? '1' : '0');
    if (hour !== undefined) {
      const h = parseInt(hour, 10);
      if (!Number.isInteger(h) || h < 0 || h > 23) return badRequest(res, 'hour must be 0-23');
      setCfg('backup_schedule_hour', h);
    }
    if (retention_days !== undefined) {
      const d = parseInt(retention_days, 10);
      if (!Number.isInteger(d) || d < 1 || d > 365) return badRequest(res, 'retention_days must be 1-365');
      setCfg('backup_retention_days', d);
    }
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// Prune backups older than retention_days. Only auto-named files are pruned
// — manual backups (label 'manual') are kept forever.
function pruneOldBackups() {
  try {
    const days = parseInt(getCfg('backup_retention_days', '14'), 10);
    if (!fs.existsSync(BACKUP_DIR)) return;
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    fs.readdirSync(BACKUP_DIR).forEach(f => {
      if (!f.endsWith('.db')) return;
      if (!f.includes('_auto_')) return; // protect manual + ad-hoc backups
      const fp = path.join(BACKUP_DIR, f);
      try {
        if (fs.statSync(fp).mtime.getTime() < cutoff) fs.unlinkSync(fp);
      } catch (_) {}
    });
  } catch (e) { console.warn('[backup] prune error:', e.message); }
}

async function runAutoBackupIfDue() {
  try {
    if (getCfg('backup_schedule_enabled', '0') !== '1') return;
    const today = new Date().toISOString().slice(0, 10);
    const last  = getCfg('backup_last_auto_at', null);
    if (last === today) return; // already ran today

    const nowH = new Date().getHours();
    const wantH = parseInt(getCfg('backup_schedule_hour', '3'), 10);
    if (nowH < wantH) return; // not yet time today

    await doBackup('auto');
    setCfg('backup_last_auto_at', today);
    pruneOldBackups();
    console.log('[backup] auto-backup completed for', today);
  } catch (e) {
    console.warn('[backup] auto-backup failed:', e.message);
  }
}

// Check every 30 minutes whether a daily backup is due.
// Also fire once shortly after startup (so a backup runs even if the container
// restarts during the scheduled hour).
setTimeout(() => { runAutoBackupIfDue(); }, 60 * 1000);
setInterval(() => { runAutoBackupIfDue(); }, 30 * 60 * 1000);

// ══════════════════════════════════════════════════════════════
// LIST BACKUPS
// GET /api/v1/backup/list
// Returns ALL files on disk; client shows last 30.
// ══════════════════════════════════════════════════════════════
router.get('/list', (req, res) => {
  try {
    const all = listBackupFiles();
    res.json({
      total_on_disk: all.length,
      shown_in_ui:   Math.min(all.length, MAX_UI_LIST),
      backups:       all.slice(0, MAX_UI_LIST),  // UI sees last 30; all kept on disk
    });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// DOWNLOAD A BACKUP FILE
// GET /api/v1/backup/download/:filename
// Streams the .db file to the browser as a download
// ══════════════════════════════════════════════════════════════
router.get('/download/:filename', (req, res) => {
  try {
    // Sanitise — only allow .db files, no path traversal
    const filename = path.basename(req.params.filename);
    if (!filename.endsWith('.db')) return badRequest(res, 'Invalid filename');
    const fp = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(fp)) return notFound(res, 'Backup file');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(fp);
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// RESTORE
// POST /api/v1/backup/restore
// Body: { filename: 'lifetracker_manual_2026-02-26_143022.db' }
//
// Steps:
//   1. Validate the file exists
//   2. Create an automatic pre-restore snapshot
//   3. Copy the chosen backup over the live DB
//   4. Return { ok, pre_restore_snapshot }
//   5. User restarts container in QNAP Container Station
// ══════════════════════════════════════════════════════════════
router.post('/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return badRequest(res, 'filename required');

    // Sanitise
    const safe = path.basename(filename);
    if (!safe.endsWith('.db')) return badRequest(res, 'Invalid filename');

    const src = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(src)) return notFound(res, 'Backup file');

    // Step 1: pre-restore snapshot of current live DB
    let snapshot = null;
    try {
      snapshot = doBackup('pre-restore');
    } catch (e) {
      console.warn('Could not create pre-restore snapshot:', e.message);
    }

    // Step 2: overwrite live DB with chosen backup
    fs.copyFileSync(src, DB_PATH);

    res.json({
      ok: true,
      restored_from:        safe,
      pre_restore_snapshot: snapshot?.filename || null,
      restart_required:     true,
      message: 'Database restored. Go to QNAP Container Station and restart the lifetracker container to apply.',
    });
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/backup/export-json  — full human-readable JSON data export
router.get('/export-json', (req, res) => {
  try {
    const safeQuery = (sql) => { try { return db.prepare(sql).all(); } catch(e) { return []; } };

    const exportData = {
      _meta: {
        app: 'Ghrava',
        exported_at: new Date().toISOString(),
        version: 'v26',
      },
      todos:                safeQuery('SELECT * FROM todos ORDER BY created_at'),
      hsa_payments:         safeQuery('SELECT * FROM hsa_payments ORDER BY date'),
      hsa_otc:              safeQuery('SELECT * FROM hsa_otc ORDER BY purchase_date'),
      hsa_physicians:       safeQuery('SELECT * FROM hsa_physicians ORDER BY name'),
      inventory_locations:  safeQuery('SELECT * FROM locations ORDER BY name'),
      inventory_containers: safeQuery('SELECT * FROM containers ORDER BY name'),
      inventory_items:      safeQuery('SELECT * FROM items WHERE is_active=1 ORDER BY name'),
      medical_conditions:   safeQuery('SELECT * FROM med_conditions ORDER BY patient, condition_name'),
      medical_medications:  safeQuery('SELECT * FROM med_medications ORDER BY patient, name'),
      medical_visits:       safeQuery('SELECT * FROM med_visit_notes ORDER BY visit_date'),
      daily_log:            safeQuery('SELECT * FROM daily_log ORDER BY log_date'),
      resources:            safeQuery('SELECT * FROM resources ORDER BY category, title'),
      finance_accounts:     safeQuery('SELECT * FROM finance_accounts ORDER BY name'),
      finance_transactions: safeQuery('SELECT * FROM finance_transactions ORDER BY date'),
      finance_budgets:      safeQuery('SELECT * FROM budgets ORDER BY year, month, category'),
      gift_cards:           safeQuery('SELECT * FROM gift_cards ORDER BY store'),
      books:                safeQuery('SELECT * FROM books WHERE is_active=1 ORDER BY title'),
      career_certifications:safeQuery('SELECT * FROM career_certifications ORDER BY name'),
      career_jobs:          safeQuery('SELECT * FROM career_jobs ORDER BY start_date'),
      career_skills:        safeQuery('SELECT * FROM career_skills ORDER BY name'),
      career_education:     safeQuery('SELECT * FROM career_education ORDER BY start_date'),
      properties:           safeQuery('SELECT * FROM properties WHERE is_active=1 ORDER BY address'),
      vehicles:             safeQuery('SELECT * FROM vehicles WHERE is_active=1 ORDER BY year, make'),
      vehicle_service:      safeQuery('SELECT * FROM vehicle_service ORDER BY service_date'),
      documents:            safeQuery('SELECT * FROM documents WHERE is_active=1 ORDER BY category, title'),
      family_members:       safeQuery('SELECT * FROM family_members ORDER BY display_name'),
      dropdown_options:     safeQuery('SELECT * FROM dropdown_options ORDER BY list_key, sort_order'),
      contacts:             safeQuery('SELECT * FROM contacts ORDER BY name'),
    };

    const filename = `ghrava-export-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (e) { serverError(res, e); }
});

// GET /api/v1/backup/export-csv/:table  — single-table CSV export
router.get('/export-csv/:table', (req, res) => {
  const ALLOWED = ['todos','hsa_payments','hsa_otc','finance_transactions','inventory_items',
                   'med_medications','med_conditions','med_visit_notes','daily_log','books',
                   'career_certifications','documents','gift_cards','vehicle_service'];
  const table = req.params.table;
  if (!ALLOWED.includes(table)) return badRequest(res, `Table not allowed. Allowed: ${ALLOWED.join(', ')}`);

  try {
    const tableMap = {
      inventory_items: 'items', med_medications: 'med_medications',
      med_conditions: 'med_conditions', med_visit_notes: 'med_visit_notes',
    };
    const actualTable = tableMap[table] || table;
    const rows = db.prepare(`SELECT * FROM ${actualTable} ORDER BY id`).all();
    if (!rows.length) { res.setHeader('Content-Type','text/csv'); return res.send(''); }

    const headers = Object.keys(rows[0]);
    const escape = v => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');

    const filename = `ghrava-${table}-${new Date().toISOString().slice(0,10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (e) { serverError(res, e); }
});

module.exports = router;
