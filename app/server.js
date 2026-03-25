require('dotenv').config({ path: '/app/.env' });

const path     = require('path');
const fs       = require('fs');
const express  = require('express');
const cors     = require('cors');
const VERSION  = fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim();

// ── Auto-backup DB before every startup ───────────────────────
// Runs BEFORE migrations so there's always a pre-deploy snapshot.
// Saved to /app/backups/auto_YYYYMMDD_HHmm.db
// Windows path: Z:\backups\ghrava\
// Keeps the last 30 auto-backups; older ones are pruned automatically.
(function autoBackupOnStartup() {
  try {
    const dbPath     = process.env.DB_PATH || '/app/data/lifetracker.db';
    const backupDir  = '/app/backups';
    if (!fs.existsSync(dbPath))    return; // first ever run — no DB yet
    if (!fs.existsSync(backupDir)) { try { fs.mkdirSync(backupDir, { recursive: true }); } catch {} }

    const now    = new Date();
    const stamp  = now.toISOString().slice(0,16).replace(/[-T:]/g, '').replace(/(\d{8})(\d{4})/, '$1_$2');
    const dest   = path.join(backupDir, `auto_${stamp}.db`);
    fs.copyFileSync(dbPath, dest);
    console.log(`[startup] auto-backup → ${dest}`);

    // Prune: keep newest 30 auto-backups
    const autoFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('auto_') && f.endsWith('.db'))
      .sort();                                // oldest first
    const toDelete = autoFiles.slice(0, Math.max(0, autoFiles.length - 30));
    toDelete.forEach(f => {
      try { fs.unlinkSync(path.join(backupDir, f)); } catch {}
    });
    if (toDelete.length) console.log(`[startup] pruned ${toDelete.length} old auto-backup(s)`);
  } catch (e) {
    // Never crash startup over a backup failure — just log it
    console.warn('[startup] auto-backup failed:', e.message);
  }
})();

require('./db/migrate');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── App-level log file ─────────────────────────────────────────
const LOG_DIR  = process.env.LOG_DIR || '/app/logs';
const LOG_FILE = path.join(LOG_DIR, 'ghrava.log');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

function writeLog(level, ...args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ')}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
}

const _origLog   = console.log.bind(console);
const _origWarn  = console.warn.bind(console);
const _origError = console.error.bind(console);
console.log   = (...a) => writeLog('INFO',  ...a);
console.warn  = (...a) => writeLog('WARN',  ...a);
console.error = (...a) => writeLog('ERROR', ...a);

// Request logger (skip static assets)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    writeLog(level, `${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

// ── Routes — each module manages its own auth split internally ──
// Auth design: reads are public (home NAS — no login to view).
//              writes require session token (requireAuth inside each router).
//              exceptions: /hsa, /medical, /attachments, /backup — all auth.
app.use('/api/v1/auth',          require('./features/auth/routes'));
app.use('/api/v1/daily-log',     require('./features/dailylog/routes'));
app.use('/api/v1/inventory',     require('./features/inventory/routes'));
app.use('/api/v1/resources',     require('./features/resources/routes'));
app.use('/api/v1/todos',         require('./features/todos/routes'));
app.use('/api/v1/notifications', require('./features/notifications/routes'));
app.use('/api/v1/dashboard',     require('./features/dashboard/routes'));
app.use('/api/v1/settings',      require('./features/settings/routes'));
app.use('/api/v1/hsa',           require('./features/hsa/routes'));
app.use('/api/v1/medical',       require('./features/medical/routes'));
app.use('/api/v1/attachments',   require('./features/attachments/routes'));
app.use('/api/v1/backup',        require('./features/backup/routes'));
app.use('/api/v1/finance',       require('./features/finance/routes'));
app.use('/api/v1/career',        require('./features/career/routes'));
app.use('/api/v1/books',         require('./features/books/routes'));
app.use('/api/v1/property',      require('./features/property/routes'));
app.use('/api/v1/import',        require('./features/import/routes'));
app.use('/api/v1/documents',     require('./features/documents/routes'));
app.use('/api/v1/google',        require('./features/google/routes'));
app.use('/api/v1/kids',          require('./features/kids/routes'));
app.use('/api/v1/trading',       require('./features/trading/routes'));

// ── App info (public — no auth) ────────────────────────────────
app.get('/api/v1/app/info', (req, res) => {
  const db = require('./db/db');
  try {
    const tables = [
      { key: 'items',                sql: "SELECT COUNT(*) AS n FROM items WHERE is_active=1 AND is_archived=0" },
      { key: 'hsa_payments',         sql: "SELECT COUNT(*) AS n FROM hsa_payments" },
      { key: 'med_visit_notes',      sql: "SELECT COUNT(*) AS n FROM med_visit_notes" },
      { key: 'finance_transactions', sql: "SELECT COUNT(*) AS n FROM finance_transactions" },
      { key: 'todos',                sql: "SELECT COUNT(*) AS n FROM todos WHERE is_active=1" },
      { key: 'daily_log',            sql: "SELECT COUNT(*) AS n FROM daily_log" },
      { key: 'contacts',             sql: "SELECT COUNT(*) AS n FROM contacts" },
      { key: 'family_members',       sql: "SELECT COUNT(*) AS n FROM family_members WHERE is_active=1" },
      { key: 'books',                sql: "SELECT COUNT(*) AS n FROM books WHERE is_active=1" },
      { key: 'documents',            sql: "SELECT COUNT(*) AS n FROM documents WHERE is_active=1" },
    ];
    const counts = {};
    tables.forEach(t => {
      try { counts[t.key] = db.prepare(t.sql).get().n; }
      catch { counts[t.key] = null; }
    });
    const cfg = db.prepare("SELECT value FROM app_config WHERE key='base_url'").get();
    res.json({
      name:        'Ghrava',
      version:     VERSION,
      build_date:  (() => { try { return fs.statSync(path.join(__dirname, 'version.txt')).mtime.toISOString().slice(0,10); } catch { return 'unknown'; } })(),
      node_version: process.version,
      uptime_s:    Math.floor(process.uptime()),
      base_url:    cfg?.value || null,
      log_file:    LOG_FILE,
      record_counts: counts,
      db_size_bytes: (() => { try { return fs.statSync(process.env.DB_PATH || '/app/data/lifetracker.db').size; } catch { return null; } })(),
      sharp_available: (() => { try { require('sharp'); return true; } catch { return false; } })(),
    });
  } catch(e) {
    res.json({ name:'Ghrava', version:VERSION, error: e.message });
  }
});

// ── Log tail (auth required) ───────────────────────────────────
const { requireAuth: _reqAuth } = require('./features/auth/middleware');
app.get('/api/v1/app/logs', _reqAuth, (req, res) => {
  try {
    const lines = parseInt(req.query.lines || '100');
    if (!fs.existsSync(LOG_FILE)) return res.json({ lines: [], log_file: LOG_FILE });
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const all = content.trim().split('\n').filter(Boolean);
    res.json({ lines: all.slice(-lines), total: all.length, log_file: LOG_FILE });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Health ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: VERSION, timestamp: new Date().toISOString(), port: PORT });
});


app.get('/', (req, res) => res.redirect('/index.html'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const server = app.listen(PORT, () => {
  console.log(`Ghrava v${VERSION} running on port ${PORT}`);
  // Run data cleanup in background on every startup (5s delay — server fully up first)
  setTimeout(() => {
    try {
      const { runDataCleanup } = require('./shared/data-cleanup');
      runDataCleanup({ source: 'startup' });
    } catch(e) {
      console.warn('[startup] data-cleanup skipped:', e.message);
    }
  }, 5000);

  // ── Scheduled daily backup (2:00 AM) ────────────────────────
  // Uses node-cron (already in package.json). Keeps 7 rolling daily backups
  // in /app/backups/ with prefix 'scheduled_'. Startup backup (auto_*) is
  // separate and untouched by this pruning.
  try {
    const cron = require('node-cron');
    cron.schedule('0 2 * * *', async () => {
      try {
        const db         = require('./db/db');
        const backupDir  = '/app/backups';
        const dbPath     = process.env.DB_PATH || '/app/data/lifetracker.db';
        if (!fs.existsSync(dbPath)) return;
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        const stamp    = new Date().toISOString().slice(0,16).replace(/[-T:]/g,'').replace(/(\d{8})(\d{4})/,'$1_$2');
        const dest     = path.join(backupDir, `scheduled_${stamp}.db`);
        await db.backup(dest);
        console.log(`[cron] daily backup → ${dest} (${fs.statSync(dest).size} bytes)`);

        // Prune: keep newest 7 scheduled backups
        const files = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('scheduled_') && f.endsWith('.db'))
          .sort(); // oldest first
        const toDelete = files.slice(0, Math.max(0, files.length - 7));
        toDelete.forEach(f => { try { fs.unlinkSync(path.join(backupDir, f)); } catch {} });
        if (toDelete.length) console.log(`[cron] pruned ${toDelete.length} old scheduled backup(s)`);
      } catch(e) {
        console.error('[cron] scheduled backup failed:', e.message);
      }
    }, { timezone: 'America/Chicago' });
    console.log('[cron] daily backup scheduled at 02:00 America/Chicago');
  } catch(e) {
    console.warn('[cron] node-cron not available, scheduled backup disabled:', e.message);
  }
});

// ── Graceful shutdown — checkpoint WAL before exit ────────────
// Docker sends SIGTERM before stopping. We catch it, force a full
// WAL checkpoint so all pending writes are flushed to the main DB
// file, then exit cleanly. Without this, a hard kill can discard
// any writes sitting in the WAL that haven't been checkpointed yet.
function gracefulShutdown(signal) {
  console.log(`[shutdown] ${signal} received — checkpointing DB and exiting`);
  try {
    const db = require('./db/db');
    db.pragma('wal_checkpoint(TRUNCATE)');
    console.log('[shutdown] WAL checkpoint complete');
  } catch(e) {
    console.warn('[shutdown] checkpoint failed:', e.message);
  }
  server.close(() => {
    console.log('[shutdown] HTTP server closed');
    process.exit(0);
  });
  // Force exit after 8s if server doesn't close cleanly
  setTimeout(() => process.exit(0), 8000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
