/**
 * Trading Terminal — persistent data store
 * Data:    /app/data/trading.json
 * Reports: /app/data/trading-reports/YYYY-MM-DD_HHmm_type.json
 *
 * Auth model (follows Ghrava convention):
 *   GETs  → public  (before requireAuth)
 *   Write → locked  (after requireAuth)
 */

const express      = require('express');
const router       = express.Router();
const fs           = require('fs');
const path         = require('path');
const { requireAuth }            = require('../auth/middleware');
const { serverError, badRequest } = require('../../shared/errors');

const DATA_DIR    = path.join(__dirname, '../../data');
const DATA_FILE   = path.join(DATA_DIR, 'trading.json');
const REPORTS_DIR = path.join(DATA_DIR, 'trading-reports');

// Ensure directories exist at module load
[DATA_DIR, REPORTS_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const DEFAULTS = {
  settings: {
    provider: 'gemini',
    apiKeys:  { gemini: '', deepseek: '', openai: '', claudeHaiku: '', claudeSonnet: '' },
    avKey:    '',
    demoMode: true
  },
  watchlist:       ['AAPL', 'SPY', 'NVDA', 'TSLA', 'QQQ', 'META', 'MSFT'],
  portfolio:       [],
  analysisHistory: []
};

function readData() {
  try {
    return fs.existsSync(DATA_FILE)
      ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
      : JSON.parse(JSON.stringify(DEFAULTS));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

// ── PUBLIC READS (before requireAuth) ───────────────────────────

// GET all trading data
router.get('/data', (req, res) => {
  try { res.json(readData()); }
  catch (e) { serverError(res, e); }
});

// GET list of saved reports (metadata only, not full content)
router.get('/reports', (req, res) => {
  try {
    const files = fs.existsSync(REPORTS_DIR)
      ? fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json')).sort().reverse()
      : [];
    const list = files.map(f => {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, f), 'utf8'));
        return { filename: f, date: r.date, type: r.type, title: r.title, ticker: r.ticker || null };
      } catch { return null; }
    }).filter(Boolean);
    res.json(list);
  } catch (e) { serverError(res, e); }
});

// GET single report by filename
router.get('/reports/:filename', (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const file = path.join(REPORTS_DIR, safe);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Report not found' });
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (e) { serverError(res, e); }
});

// ── WRITES (require auth) ────────────────────────────────────────

router.use(requireAuth);

// POST save all trading data (full replace of mutable fields)
router.post('/data', (req, res) => {
  try {
    const current = readData();
    // Merge top-level keys; never wipe settings if body omits them
    const updated = {
      settings:        req.body.settings        ?? current.settings,
      watchlist:       req.body.watchlist       ?? current.watchlist,
      portfolio:       req.body.portfolio       ?? current.portfolio,
      analysisHistory: req.body.analysisHistory ?? current.analysisHistory,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2));
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// POST save a new dated report
router.post('/reports', (req, res) => {
  try {
    const { type, title, ticker, data } = req.body;
    if (!type || !data) return badRequest(res, 'type and data required');

    const now      = new Date();
    const dateISO  = now.toISOString();
    // Filename: 2026-03-22T14-30_Portfolio-Snapshot.json
    const stamp    = dateISO.slice(0, 16).replace('T', '_').replace(':', '-');
    const slug     = type.replace(/[^a-zA-Z0-9]+/g, '-');
    const filename = `${stamp}_${slug}.json`;

    const report = {
      filename,
      date:        dateISO,
      dateDisplay: now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' }),
      type,
      title:  title || type,
      ticker: ticker || null,
      generatedAt: dateISO,
      data
    };

    fs.writeFileSync(path.join(REPORTS_DIR, filename), JSON.stringify(report, null, 2));
    res.json({ ok: true, filename });
  } catch (e) { serverError(res, e); }
});

// DELETE a report
router.delete('/reports/:filename', (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const file = path.join(REPORTS_DIR, safe);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
