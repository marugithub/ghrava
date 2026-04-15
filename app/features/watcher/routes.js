// @ts-check
'use strict';
/**
 * features/watcher/routes.js
 * Folder watcher config, inbox, and audit log API.
 * All routes require auth — watcher modifies config and triggers file imports.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, serverError } = require('../../shared/errors');
const fw = require('../../shared/folder-watcher');

router.use(requireAuth);

// GET /api/v1/watcher/status
router.get('/status', (req, res) => {
  try {
    const enabled = db.prepare(`SELECT value FROM app_config WHERE key='folder_watcher_enabled'`).get()?.value === '1';
    const config  = fw.getConfig();
    const stats   = fw.getImportStats();
    res.json({ enabled, watch_paths: config.watch_paths||[], rules: config.rules||[], catch_all: config.catch_all, stats });
  } catch(e) { serverError(res, e); }
});

// PUT /api/v1/watcher/config
router.put('/config', (req, res) => {
  try {
    const { enabled, watch_paths, rules, catch_all } = req.body;
    if (enabled !== undefined) {
      db.prepare(`INSERT OR REPLACE INTO app_config (key,value) VALUES ('folder_watcher_enabled',?)`).run(enabled ? '1' : '0');
    }
    if (watch_paths !== undefined || rules !== undefined) {
      const current = fw.getConfig();
      const next = {
        watch_paths: watch_paths !== undefined ? watch_paths : current.watch_paths,
        rules:       rules       !== undefined ? rules       : current.rules,
        catch_all:   catch_all   !== undefined ? catch_all   : current.catch_all,
      };
      db.prepare(`INSERT OR REPLACE INTO app_config (key,value) VALUES ('folder_watcher_config',?)`).run(JSON.stringify(next));
    }
    fw.restartWatcher();
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/watcher/pending
router.get('/pending', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const files = fw.getPendingFiles(limit);
    res.json({ files, total: files.length });
  } catch(e) { serverError(res, e); }
});

// POST /api/v1/watcher/process — manually process a pending file
router.post('/process', async (req, res) => {
  try {
    const { file_id, action } = req.body;
    if (!file_id) return badRequest(res, 'file_id required');
    if (action === 'ignore') {
      db.prepare(`UPDATE watcher_file_registry SET import_status='ignored' WHERE id=?`).run(file_id);
      return res.json({ ok: true });
    }
    const file = db.prepare(`SELECT file_path FROM watcher_file_registry WHERE id=?`).get(file_id);
    if (!file) return badRequest(res, 'File not found');
    await fw.processFile(file.file_path);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// POST /api/v1/watcher/scan — trigger a scan of a path
router.post('/scan', async (req, res) => {
  try {
    const { path: scanPath, recursive = true } = req.body;
    if (!scanPath) return badRequest(res, 'path required');
    const result = await fw.scanDirectory(scanPath, recursive);
    res.json({ ok: true, ...result });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/watcher/history
router.get('/history', (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status;
    let sql    = `SELECT h.*, f.file_path FROM watcher_import_history h JOIN watcher_file_registry f ON f.id=h.file_registry_id WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND h.status=?'; params.push(status); }
    sql += ' ORDER BY h.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const history = db.prepare(sql).all(...params).map(h => ({
      ...h, file_name: h.file_path?.split('/').pop() || 'Unknown'
    }));
    res.json({ history, limit, offset });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
