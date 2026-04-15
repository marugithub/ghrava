// @ts-check
'use strict';
/**
 * shared/db-maintenance.js
 * Database health checks and maintenance operations.
 */
const db  = require('../db/db');
const fs  = require('fs');

function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function getDatabaseSize() {
  const dbPath = process.env.DB_PATH || '/app/data/lifetracker.db';
  try { return fs.statSync(dbPath).size; } catch { return 0; }
}

function logOp(operation, result, details, durationMs) {
  db.prepare(`INSERT INTO db_maintenance_log (operation, completed_at, duration_ms, result, details) VALUES (?,CURRENT_TIMESTAMP,?,?,?)`)
    .run(operation, durationMs, result, details);
}

function runIntegrityCheck() {
  const start = Date.now();
  try {
    const result = db.pragma('integrity_check');
    const ok = result.every(r => r.integrity_check === 'ok');
    logOp('integrity_check', ok ? 'ok' : 'failed', JSON.stringify(result), Date.now() - start);
    return { ok, result };
  } catch(e) {
    logOp('integrity_check', 'error', e.message, Date.now() - start);
    return { ok: false, error: e.message };
  }
}

function runVacuum() {
  const start = Date.now();
  try {
    const before = getDatabaseSize();
    db.exec('VACUUM');
    const after  = getDatabaseSize();
    const saved  = before - after;
    logOp('vacuum', 'ok', `Saved ${formatBytes(saved)}`, Date.now() - start);
    return { ok: true, beforeSize: before, afterSize: after, saved, savedFormatted: formatBytes(saved) };
  } catch(e) {
    logOp('vacuum', 'error', e.message, Date.now() - start);
    return { ok: false, error: e.message };
  }
}

function runAnalyze() {
  const start = Date.now();
  try {
    db.exec('ANALYZE');
    logOp('analyze', 'ok', null, Date.now() - start);
    return { ok: true };
  } catch(e) {
    logOp('analyze', 'error', e.message, Date.now() - start);
    return { ok: false, error: e.message };
  }
}

function getDatabaseStats() {
  const size   = getDatabaseSize();
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();
  let totalRows = 0;
  const counts  = {};
  tables.forEach(t => {
    try {
      const n = db.prepare(`SELECT COUNT(*) as n FROM "${t.name}"`).get().n;
      counts[t.name] = n;
      totalRows += n;
    } catch { counts[t.name] = 0; }
  });
  const history = db.prepare(`SELECT operation, completed_at, result, duration_ms FROM db_maintenance_log WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 5`).all();
  return { size, size_formatted: formatBytes(size), table_count: tables.length, total_rows: totalRows, row_counts: counts, last_maintenance: history };
}

function getMaintenanceHistory(limit = 20) {
  return db.prepare(`SELECT * FROM db_maintenance_log ORDER BY started_at DESC LIMIT ?`).all(limit);
}

module.exports = { runIntegrityCheck, runVacuum, runAnalyze, getDatabaseStats, getMaintenanceHistory };
