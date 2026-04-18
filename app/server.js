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
app.use('/api/v1/finance',         require('./features/finance/routes'));
app.use('/api/v1/wardrobe',        require('./features/wardrobe/routes'));
app.use('/api/v1/perfume',         require('./features/perfume/routes'));
app.use('/api/v1/subscriptions',   require('./features/subscriptions/routes'));
app.use('/api/v1/insurance',       require('./features/insurance/routes'));
app.use('/api/v1/finance/reports', require('./features/finance/reports'));
app.use('/api/v1/career',        require('./features/career/routes'));
app.use('/api/v1/books',         require('./features/books/routes'));
app.use('/api/v1/property',      require('./features/property/routes'));
app.use('/api/v1/import',        require('./features/import/routes'));
app.use('/api/v1/documents',     require('./features/documents/routes'));
app.use('/api/v1/google',        require('./features/google/routes'));
app.use('/api/v1/kids',          require('./features/kids/routes'));
app.use('/api/v1/data',          require('./features/data/routes'));
app.use('/api/v1/trading',       require('./features/trading/routes'));
app.use('/api/v1/reports/emergency', require('./features/reports/emergency'));
app.use('/api/v1/reports/expiry',    require('./features/reports/expiry'));
app.use('/api/v1/receipts',          require('./features/receipts/routes'));
app.use('/api/v1/search',            require('./features/search/routes'));
app.use('/api/v1/maintenance',       require('./features/maintenance/routes'));
app.use('/api/v1/templates',         require('./features/templates/routes'));
app.use('/api/v1/family-snapshot',   require('./features/family-snapshot/routes'));
app.use('/api/v1/watcher',           require('./features/watcher/routes'));
app.use('/api/v1/system',            require('./features/system/routes'));

// ── App info (public — no auth) ────────────────────────────────

// ── Module Inventory — live record counts per module ──────────
// GET /api/v1/app/module-inventory
// Returns per-module counts directly from DB. Zero maintenance — all live SQL.
app.get('/api/v1/app/module-inventory', (req, res) => {
  const db = require('./db/db');
  const ago30 = new Date(Date.now() - 30*24*3600*1000).toISOString().slice(0,10);

  function q(sql) {
    try { const r = db.prepare(sql).get(); return r ? (r.n ?? r.total ?? 0) : 0; }
    catch { return null; }
  }
  function qa(sql) {
    try { return db.prepare(sql).all(); }
    catch { return []; }
  }

  const modules = [
    {
      id: 'inventory', label: 'Inventory',
      tables: ['items','containers','locations','item_maintenance_log','item_events'],
      stats: [
        { label:'Active items',     val: q("SELECT COUNT(*) n FROM items WHERE is_active=1 AND is_archived=0") },
        { label:'Archived items',   val: q("SELECT COUNT(*) n FROM items WHERE is_archived=1") },
        { label:'Containers',       val: q("SELECT COUNT(*) n FROM containers") },
        { label:'Locations/Rooms',  val: q("SELECT COUNT(*) n FROM locations") },
        { label:'Maintenance logs', val: q("SELECT COUNT(*) n FROM item_maintenance_log") },
        { label:'Added last 30d',   val: q(`SELECT COUNT(*) n FROM items WHERE created_at >= '${ago30}'`) },
        { label:'Total est. value', val: q("SELECT COALESCE(ROUND(SUM(replacement_value),2),0) n FROM items WHERE is_active=1 AND is_archived=0") },
        { label:'Unique categories',val: q("SELECT COUNT(DISTINCT category) n FROM items WHERE is_active=1") },
        { label:'Tagged items',     val: q("SELECT COUNT(DISTINCT entity_id) n FROM taggables WHERE entity_type='item'") },
      ]
    },
    {
      id: 'medical', label: 'Medical',
      tables: ['med_medications','med_conditions','med_visit_notes'],
      stats: [
        { label:'Medications (active)',val: q("SELECT COUNT(*) n FROM med_medications WHERE status='Active'") },
        { label:'Medications (total)', val: q("SELECT COUNT(*) n FROM med_medications") },
        { label:'Conditions',          val: q("SELECT COUNT(*) n FROM med_conditions WHERE is_active=1") },
        { label:'Visit notes',         val: q("SELECT COUNT(*) n FROM med_visit_notes") },
        { label:'Unique patients',     val: q("SELECT COUNT(DISTINCT patient) n FROM med_medications") },
        { label:'Visits last 30d',     val: q(`SELECT COUNT(*) n FROM med_visit_notes WHERE visit_date >= '${ago30}'`) },
      ]
    },
    {
      id: 'finance', label: 'Finance',
      tables: ['finance_accounts','finance_transactions','budgets','gift_cards','holdings','hsa_payments','hsa_otc','net_worth_snapshots'],
      stats: [
        { label:'Accounts',           val: q("SELECT COUNT(*) n FROM finance_accounts WHERE is_active=1") },
        { label:'Transactions',       val: q("SELECT COUNT(*) n FROM finance_transactions") },
        { label:'Imported batches',   val: q("SELECT COUNT(*) n FROM import_batches") },
        { label:'Transactions last 30d', val: q(`SELECT COUNT(*) n FROM finance_transactions WHERE date >= '${ago30}'`) },
        { label:'Budget categories',  val: q("SELECT COUNT(*) n FROM budgets WHERE is_active=1") },
        { label:'Gift cards (active)',val: q("SELECT COUNT(*) n FROM gift_cards WHERE is_active=1") },
        { label:'Holdings/positions', val: q("SELECT COUNT(*) n FROM holdings") },
        { label:'HSA expenses',       val: q("SELECT COUNT(*) n FROM hsa_payments") },
        { label:'HSA OTC',            val: q("SELECT COUNT(*) n FROM hsa_otc") },
        { label:'Net worth snapshots',val: q("SELECT COUNT(*) n FROM net_worth_snapshots") },
        { label:'Category rules',     val: q("SELECT COUNT(*) n FROM import_category_rules WHERE is_active=1") },
      ]
    },
    {
      id: 'todos', label: 'To Do',
      tables: ['todos'],
      stats: [
        { label:'Open todos',     val: q("SELECT COUNT(*) n FROM todos WHERE is_active=1 AND status NOT IN ('done','dismissed')") },
        { label:'Done (active)',  val: q("SELECT COUNT(*) n FROM todos WHERE status='done'") },
        { label:'Auto-generated', val: q("SELECT COUNT(*) n FROM todos WHERE is_auto=1 AND is_active=1") },
        { label:'Recurring',      val: q("SELECT COUNT(*) n FROM todos WHERE recurrence IS NOT NULL AND is_active=1") },
        { label:'Total ever',     val: q("SELECT COUNT(*) n FROM todos") },
        { label:'Overdue',        val: q(`SELECT COUNT(*) n FROM todos WHERE due_date < date('now') AND status NOT IN ('done','dismissed') AND is_active=1`) },
        { label:'Tagged',         val: q("SELECT COUNT(DISTINCT entity_id) n FROM taggables WHERE entity_type='todo'") },
      ]
    },
    {
      id: 'daily_log', label: 'Daily Log',
      tables: ['daily_log'],
      stats: [
        { label:'Total entries',     val: q("SELECT COUNT(*) n FROM daily_log") },
        { label:'Entries last 30d',  val: q(`SELECT COUNT(*) n FROM daily_log WHERE log_date >= '${ago30}'`) },
        { label:'With follow-up',    val: q("SELECT COUNT(*) n FROM daily_log WHERE follow_up_needed=1") },
        { label:'Unique categories', val: q("SELECT COUNT(DISTINCT category) n FROM daily_log") },
        { label:'Earliest entry',    val: (() => { try { return db.prepare("SELECT MIN(log_date) n FROM daily_log").get()?.n || null; } catch { return null; } })() },
      ]
    },
    {
      id: 'books', label: 'Books',
      tables: ['books'],
      stats: [
        { label:'Total books',       val: q("SELECT COUNT(*) n FROM books WHERE is_active=1") },
        { label:'Currently reading', val: q("SELECT COUNT(*) n FROM books WHERE status='Currently Reading' AND is_active=1") },
        { label:'Read',              val: q("SELECT COUNT(*) n FROM books WHERE status='Read' AND is_active=1") },
        { label:'Want to read',      val: q("SELECT COUNT(*) n FROM books WHERE status='Want to Read' AND is_active=1") },
        { label:'With progress',     val: q("SELECT COUNT(*) n FROM books WHERE pages_total > 0 AND is_active=1") },
        { label:'Added last 30d',    val: q(`SELECT COUNT(*) n FROM books WHERE created_at >= '${ago30}'`) },
        { label:'Tagged',            val: q("SELECT COUNT(DISTINCT entity_id) n FROM taggables WHERE entity_type='book'") },
      ]
    },
    {
      id: 'career', label: 'Career',
      tables: ['career_certifications','career_jobs','career_skills','career_education','career_goals'],
      stats: [
        { label:'Certifications',  val: q("SELECT COUNT(*) n FROM career_certifications WHERE is_active=1") },
        { label:'Active jobs',     val: q("SELECT COUNT(*) n FROM career_jobs WHERE is_active=1 AND status='Active'") },
        { label:'Jobs (total)',    val: q("SELECT COUNT(*) n FROM career_jobs WHERE is_active=1") },
        { label:'Skills',          val: q("SELECT COUNT(*) n FROM career_skills WHERE is_active=1") },
        { label:'Education',       val: q("SELECT COUNT(*) n FROM career_education WHERE is_active=1") },
        { label:'Goals',           val: q("SELECT COUNT(*) n FROM career_goals WHERE is_active=1") },
        { label:'Expired certs',   val: q(`SELECT COUNT(*) n FROM career_certifications WHERE expiry_date < date('now') AND is_active=1`) },
      ]
    },
    {
      id: 'property', label: 'Property',
      tables: ['properties','vehicles','property_maintenance','vehicle_service'],
      stats: [
        { label:'Properties',        val: q("SELECT COUNT(*) n FROM properties WHERE is_active=1") },
        { label:'Vehicles',          val: q("SELECT COUNT(*) n FROM vehicles WHERE is_active=1") },
        { label:'Maintenance records',val: q("SELECT COUNT(*) n FROM property_maintenance") },
        { label:'Maintenance completed',val: q("SELECT COUNT(*) n FROM property_maintenance WHERE is_completed=1") },
        { label:'Service logs',      val: q("SELECT COUNT(*) n FROM vehicle_service") },
        { label:'Overdue maintenance',val: q(`SELECT COUNT(*) n FROM property_maintenance WHERE next_due_date < date('now') AND (is_completed IS NULL OR is_completed=0)`) },
      ]
    },
    {
      id: 'documents', label: 'Documents',
      tables: ['documents'],
      stats: [
        { label:'Total documents',   val: q("SELECT COUNT(*) n FROM documents WHERE is_active=1") },
        { label:'With expiry date',  val: q("SELECT COUNT(*) n FROM documents WHERE expiry_date IS NOT NULL AND is_active=1") },
        { label:'Expiring 90 days',  val: q(`SELECT COUNT(*) n FROM documents WHERE expiry_date BETWEEN date('now') AND date('now','+90 days') AND is_active=1`) },
        { label:'Expired',           val: q(`SELECT COUNT(*) n FROM documents WHERE expiry_date < date('now') AND is_active=1`) },
        { label:'With attachment',   val: q("SELECT COUNT(*) n FROM documents WHERE attachment_id IS NOT NULL AND is_active=1") },
        { label:'Added last 30d',    val: q(`SELECT COUNT(*) n FROM documents WHERE created_at >= '${ago30}'`) },
        { label:'Unique categories', val: q("SELECT COUNT(DISTINCT category) n FROM documents WHERE is_active=1") },
      ]
    },
    {
      id: 'resources', label: 'Resources',
      tables: ['resources'],
      stats: [
        { label:'Total resources',   val: q("SELECT COUNT(*) n FROM resources WHERE is_active=1") },
        { label:'Favorites',         val: q("SELECT COUNT(*) n FROM resources WHERE is_favorite=1 AND is_active=1") },
        { label:'Unique categories', val: q("SELECT COUNT(DISTINCT category) n FROM resources WHERE is_active=1") },
        { label:'With URL',          val: q("SELECT COUNT(*) n FROM resources WHERE url IS NOT NULL AND url != '' AND is_active=1") },
        { label:'Added last 30d',    val: q(`SELECT COUNT(*) n FROM resources WHERE created_at >= '${ago30}'`) },
      ]
    },
    {
      id: 'kids', label: 'Kids',
      tables: ['kids','kid_activities','kid_notes'],
      stats: [
        { label:'Kids',              val: q("SELECT COUNT(*) n FROM kids WHERE is_active=1") },
        { label:'Activities (active)',val: q("SELECT COUNT(*) n FROM kid_activities WHERE is_active=1") },
        { label:'Notes',             val: q("SELECT COUNT(*) n FROM kid_notes") },
        { label:'Activity categories',val: q("SELECT COUNT(DISTINCT category) n FROM kid_activities WHERE is_active=1") },
      ]
    },
    {
      id: 'contacts', label: 'Contacts & Family',
      tables: ['contacts','family_members'],
      stats: [
        { label:'Contacts',          val: q("SELECT COUNT(*) n FROM contacts WHERE is_active=1") },
        { label:'Family members',    val: q("SELECT COUNT(*) n FROM family_members WHERE is_active=1") },
        { label:'Records linked to family', val: q("SELECT COUNT(*) n FROM record_family_members") },
      ]
    },
    {
      id: 'system', label: 'System / Shared',
      tables: ['tags','taggables','attachments','notifications','dropdown_options','app_config'],
      stats: [
        { label:'Unique tags',       val: q("SELECT COUNT(*) n FROM tags") },
        { label:'Tag assignments',   val: q("SELECT COUNT(*) n FROM taggables") },
        { label:'Attachments',       val: q("SELECT COUNT(*) n FROM attachments") },
        { label:'Notifications',     val: q("SELECT COUNT(*) n FROM notifications") },
        { label:'Dropdown options',  val: q("SELECT COUNT(*) n FROM dropdown_options WHERE is_active=1") },
        { label:'Config entries',    val: q("SELECT COUNT(*) n FROM app_config") },
      ]
    },
  ];

  // Cross-module totals
  const totals = {
    total_records: modules.flatMap(m => m.stats.map(s => s.val)).filter(v => typeof v === 'number').reduce((a,b) => a+b, 0),
    total_tables:  modules.reduce((a,m) => a + m.tables.length, 0),
    modules_count: modules.length,
    generated_at:  new Date().toISOString(),
  };

  res.json({ modules, totals });
});

// ── Weather ────────────────────────────────────────────────────
// GET /api/v1/app/weather — 7-day forecast from OpenWeatherMap
// Requires OPENWEATHERMAP_API_KEY in .env.secrets and lat/lon in app_config
const _weatherCache = { data: null, ts: 0 };
app.get('/api/v1/app/weather', async (req, res) => {
  try {
    // Serve from cache if fresh (30 min)
    if (_weatherCache.data && Date.now() - _weatherCache.ts < 30 * 60 * 1000) {
      return res.json(_weatherCache.data);
    }
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) return res.json({ error: 'OPENWEATHERMAP_API_KEY not configured' });

    const db = require('./db/db');
    const lat = db.prepare("SELECT value FROM app_config WHERE key='weather_latitude'").get()?.value;
    const lon = db.prepare("SELECT value FROM app_config WHERE key='weather_longitude'").get()?.value;
    const units = db.prepare("SELECT value FROM app_config WHERE key='weather_units'").get()?.value || 'imperial';

    if (!lat || !lon) return res.json({ error: 'Weather location not configured — set lat/lon in Settings' });

    const url = `https://api.openweathermap.org/data/2.5/forecast/daily?lat=${lat}&lon=${lon}&cnt=7&units=${units}&appid=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: `OpenWeatherMap error: ${err.slice(0,200)}` });
    }
    const data = await resp.json();
    _weatherCache.data = data;
    _weatherCache.ts   = Date.now();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

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

// ── Test Results — store and retrieve nightly E2E run data ──────
// POST /api/v1/app/test-results  — called by the external Playwright runner after a run
// GET  /api/v1/app/test-results  — list runs (newest first, last 30)
// GET  /api/v1/app/test-results/:id — single run details
const TEST_REPORT_DIR = '/app/data/test-reports';
(function() {
  if (!fs.existsSync(TEST_REPORT_DIR)) {
    try { fs.mkdirSync(TEST_REPORT_DIR, { recursive: true }); } catch {}
  }

  app.post('/api/v1/app/test-results', (req, res) => {
    try {
      const run = req.body;
      if (!run || !run.started_at) return res.status(400).json({ error: 'started_at required' });
      const stamp = run.started_at.replace(/[^0-9T]/g, '-').replace(/T/, '_').slice(0, 16);
      const filename = `run_${stamp}.json`;
      const filepath = path.join(TEST_REPORT_DIR, filename);
      fs.writeFileSync(filepath, JSON.stringify({ ...run, filename }, null, 2));
      console.log(`[test-results] saved ${filename} — ${run.passed}/${run.total} passed`);
      res.status(201).json({ ok: true, filename });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/v1/app/test-results', (req, res) => {
    try {
      if (!fs.existsSync(TEST_REPORT_DIR)) return res.json([]);
      const files = fs.readdirSync(TEST_REPORT_DIR)
        .filter(f => f.startsWith('run_') && f.endsWith('.json'))
        .sort().reverse().slice(0, 30);
      const runs = files.map(f => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(TEST_REPORT_DIR, f), 'utf8'));
          // Return summary only (not full suite details) for the list
          return { filename: f, started_at: d.started_at, duration_ms: d.duration_ms,
            passed: d.passed, failed: d.failed, total: d.total, suites: d.suites?.length ?? 0 };
        } catch { return null; }
      }).filter(Boolean);
      res.json(runs);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/api/v1/app/test-results/:filename', (req, res) => {
    try {
      const name = path.basename(req.params.filename);
      if (!name.startsWith('run_') || !name.endsWith('.json'))
        return res.status(400).json({ error: 'Invalid filename' });
      const fp = path.join(TEST_REPORT_DIR, name);
      if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Run not found' });
      res.json(JSON.parse(fs.readFileSync(fp, 'utf8')));
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
})();


app.get('/', (req, res) => res.redirect('/index.html'));

// Start recurring transaction scheduler
try { require('./shared/recurring-transactions').startScheduler(); } catch(e) { console.error('[server] Recurring scheduler failed:', e.message); }

// Start folder watcher (after 8s to let migrations settle)
setTimeout(() => {
  try { require('./shared/folder-watcher').startWatcher(); }
  catch(e) { console.error('[server] Folder watcher failed:', e.message); }
}, 8000);

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
