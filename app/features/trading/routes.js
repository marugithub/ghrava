/**
 * Trading Terminal — persistent data store
 * Data:    /app/data/trading.json
 * Reports: /app/data/trading-reports/YYYY-MM-DD_HHmm_type.json
 *
 * Auth model (follows Ghrava convention):
 *   All routes public — personal NAS tool, no sensitive data
 */

const express      = require('express');
const router       = express.Router();
const fs           = require('fs');
const path         = require('path');
const { serverError, badRequest } = require('../../shared/errors');

// Ghrava DB — read-only for portfolio integration
// NEVER write to finance tables. NEVER DELETE. Read only.
const db = require('../../db/db');

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

// ── ALL ROUTES PUBLIC (personal NAS tool) ────────────────────────

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

// GET live quote via Yahoo Finance (proxy — avoids browser CORS)
router.get('/market/quote/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.^-]/g, '');
  if (!symbol) return res.status(400).json({ error: 'Invalid symbol' });
  try {
    const https = require('https');
    const url   = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const data  = await new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        }
      };
      https.get(url, options, r => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('JSON parse failed')); }
        });
      }).on('error', reject);
    });

    const result = data?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'Symbol not found' });

    const meta  = result.meta;
    const price = meta.regularMarketPrice;
    const prev  = meta.previousClose || meta.chartPreviousClose || price;
    const chg   = price - prev;
    const pct   = prev > 0 ? (chg / prev) * 100 : 0;

    res.json({
      symbol,
      price:  parseFloat(price.toFixed(4)),
      chg:    parseFloat(chg.toFixed(4)),
      pct:    parseFloat(pct.toFixed(4)),
      h:      parseFloat((meta.regularMarketDayHigh || price).toFixed(4)),
      l:      parseFloat((meta.regularMarketDayLow  || price).toFixed(4)),
      vol:    meta.regularMarketVolume ? String(meta.regularMarketVolume) : '—',
      prev:   parseFloat(prev.toFixed(4)),
      currency: meta.currency || 'USD',
      exchange: meta.exchangeName || '',
      _source: 'yahoo',
      _ts: new Date().toISOString(),
    });
  } catch (e) {
    res.status(502).json({ error: 'Yahoo Finance fetch failed', detail: e.message });
  }
});

// GET StockTwits public stream (proxy — avoids CORS)
router.get('/social/stocktwits/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  try {
    const https = require('https');
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('Parse failed')); }
        });
      }).on('error', reject);
    });
    if (data.response?.status !== 200) {
      return res.status(502).json({ error: data.errors?.[0]?.message || 'StockTwits error' });
    }
    res.json({ messages: data.messages || [], symbol });
  } catch (e) {
    res.status(502).json({ error: 'StockTwits proxy failed: ' + e.message });
  }
});

// GET Yahoo Finance historical prices (for charting)
router.get('/market/history/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.^-]/g, '');
  const range    = ['1d','5d','1mo','3mo','6mo','1y','2y','5y'].includes(req.query.range) ? req.query.range : '3mo';
  const interval = { '1d':'5m','5d':'15m','1mo':'1d','3mo':'1d','6mo':'1wk','1y':'1wk','2y':'1mo','5y':'1mo' }[range] || '1d';
  try {
    const https = require('https');
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, r => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Parse failed')); } });
      }).on('error', reject);
    });
    const result = data?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'No data' });
    const timestamps = result.timestamp || [];
    const ohlcv = result.indicators?.quote?.[0] || {};
    const candles = timestamps.map((t, i) => ({
      t: t * 1000,
      o: ohlcv.open?.[i]  != null ? parseFloat(ohlcv.open[i].toFixed(4))  : null,
      h: ohlcv.high?.[i]  != null ? parseFloat(ohlcv.high[i].toFixed(4))  : null,
      l: ohlcv.low?.[i]   != null ? parseFloat(ohlcv.low[i].toFixed(4))   : null,
      c: ohlcv.close?.[i] != null ? parseFloat(ohlcv.close[i].toFixed(4)) : null,
      v: ohlcv.volume?.[i]|| 0,
    })).filter(c => c.c != null);
    res.json({ symbol, range, interval, candles, meta: result.meta });
  } catch (e) {
    res.status(502).json({ error: 'History fetch failed: ' + e.message });
  }
});

// GET Reddit posts (proxy — avoids CORS, uses public JSON API)
router.get('/social/reddit/:subreddit', async (req, res) => {
  const sub   = req.params.subreddit.replace(/[^a-zA-Z0-9_]/g, '');
  const query = (req.query.q || '').trim();
  const https = require('https');
  try {
    const url = query
      ? `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=25`
      : `https://www.reddit.com/r/${sub}/hot.json?limit=25`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: { 'User-Agent': 'GhravaTradeTerminal/1.0' }
      }, r => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Parse failed')); } });
      }).on('error', reject);
    });
    const posts = (data?.data?.children || []).map(c => {
      const p = c.data;
      return {
        id:           p.id,
        title:        p.title,
        selftext:     p.selftext ? p.selftext.slice(0, 400) : '',
        author:       p.author,
        score:        p.score,
        num_comments: p.num_comments,
        url:          `https://reddit.com${p.permalink}`,
        flair:        p.link_flair_text || null,
        time:         new Date(p.created_utc * 1000).toISOString(),
        upvote_ratio: p.upvote_ratio,
      };
    });
    res.json({ posts, subreddit: sub, query });
  } catch (e) {
    res.status(502).json({ error: 'Reddit fetch failed: ' + e.message });
  }
});

// GET Fear & Greed Index (proxy — CNN endpoint)
router.get('/social/feargreed', async (req, res) => {
  const https = require('https');

  // Helper: fetch a URL and return parsed JSON
  const fetchJson = (url, headers) => new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json', 'Referer': 'https://edition.cnn.com/markets/fear-and-greed', ...headers } }, r => {
      let body = '';
      r.on('data', c => body += c);
      r.on('end', () => { try { resolve({ status: r.statusCode, data: JSON.parse(body) }); } catch(e) { reject(new Error('Parse failed: ' + body.slice(0, 100))); } });
    }).on('error', reject);
  });

  // CNN endpoint requires a start date — use 30 days ago to get recent data
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    const { status, data } = await fetchJson(
      `https://production.dataviz.cnn.io/index/fearandgreed/graphdata/${startDate}`
    );

    if (status !== 200 || !data) {
      return res.status(502).json({ error: `CNN returned HTTP ${status}` });
    }

    // Current value is in fear_and_greed, history in fear_and_greed_historical
    const current = data.fear_and_greed;
    if (!current || current.score == null) {
      return res.status(502).json({ error: 'No Fear & Greed score in response', raw: JSON.stringify(data).slice(0, 200) });
    }

    res.json({
      value:         Math.round(current.score),
      previousClose: current.previous_close != null ? Math.round(current.previous_close) : null,
      oneWeekAgo:    current.previous_1_week  != null ? Math.round(current.previous_1_week) : null,
      oneMonthAgo:   current.previous_1_month != null ? Math.round(current.previous_1_month) : null,
      lastUpdated:   current.timestamp ? new Date(current.timestamp).toLocaleDateString() : new Date().toLocaleDateString(),
      _source:       'CNN Fear & Greed Index',
    });
  } catch (e) {
    res.status(502).json({ error: 'Fear & Greed proxy failed: ' + e.message });
  }
});


// GET SEC EDGAR recent filings for a ticker (free, no key)
router.get('/market/filings/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const https  = require('https');
  try {
    // Step 1: resolve CIK from ticker
    const cikData = await new Promise((resolve, reject) => {
      https.get(`https://efts.sec.gov/LATEST/search-index?q="${symbol}"&dateRange=custom&startdt=2020-01-01&forms=10-K,10-Q,8-K`, {
        headers:{'User-Agent':'GhravaTradeTerminal admin@example.com'}
      }, r => {
        let b=''; r.on('data',c=>b+=c);
        r.on('end',()=>{ try{resolve(JSON.parse(b))}catch{reject(new Error('parse'))} });
      }).on('error', reject);
    }).catch(()=>null);

    // Step 2: get recent filings via company search
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&forms=8-K,10-K,10-Q&dateRange=custom&startdt=${new Date(Date.now()-90*86400000).toISOString().slice(0,10)}`;
    const data = await new Promise((resolve, reject) => {
      https.get(url, { headers:{'User-Agent':'GhravaTradeTerminal admin@example.com'} }, r => {
        let b=''; r.on('data',c=>b+=c);
        r.on('end',()=>{ try{resolve(JSON.parse(b))}catch{reject(new Error('parse'))} });
      }).on('error', reject);
    });

    const filings = (data?.hits?.hits||[]).slice(0,10).map(h=>{
      const s = h._source;
      return {
        form:   s.form_type,
        filed:  s.file_date,
        title:  s.display_names?.[0] || symbol,
        url:    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${symbol}&type=${s.form_type}&dateb=&owner=include&count=10`,
      };
    });

    res.json({ symbol, filings });
  } catch(e) {
    res.status(502).json({ error: 'EDGAR proxy failed: '+e.message, filings:[] });
  }
});

// GET Congressional trading data (public S3 bucket — House STOCK Act disclosures)
router.get('/market/congress/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const https  = require('https');
  try {
    // Community-maintained clean JSON of all House trades — updated daily, no auth
    const data = await new Promise((resolve, reject) => {
      https.get('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json', {
        headers:{'User-Agent':'GhravaTradeTerminal/1.0'}
      }, r => {
        let b=''; r.on('data',c=>b+=c);
        r.on('end',()=>{ try{resolve(JSON.parse(b))}catch{reject(new Error('parse'))} });
      }).on('error', reject);
    });

    // Filter to this symbol, last 90 days, sort newest first
    const cutoff = Date.now() - 90*24*60*60*1000;
    const trades = (Array.isArray(data) ? data : [])
      .filter(t => {
        const ticker = (t.ticker||'').replace('$','').toUpperCase();
        const d = new Date(t.transaction_date||t.disclosure_date||0).getTime();
        return ticker === symbol && d >= cutoff;
      })
      .sort((a,b) => new Date(b.transaction_date||0) - new Date(a.transaction_date||0))
      .slice(0,20)
      .map(t => ({
        representative: t.representative,
        type:           t.type,
        amount:         t.amount,
        transaction_date: t.transaction_date,
        party:          t.party,
        district:       t.district,
        description:    t.asset_description,
      }));

    res.json({ symbol, trades, source:'House STOCK Act Disclosures' });
  } catch(e) {
    res.status(502).json({ error: 'Congress data failed: '+e.message, trades:[] });
  }
});


// ══════════════════════════════════════════════════════════════
// GHRAVA INTEGRATION — READ-ONLY FROM lifetracker.db
// All queries filter is_active=1. No DELETE. No writes to Ghrava tables.
// See TRADE_TERMINAL_INTEGRATION.md for rules and constraints.
// ══════════════════════════════════════════════════════════════

// GET live portfolio from Ghrava holdings
// Reads: financial_accounts JOIN holdings (import system tables)
// Filters: is_active=1 on accounts only
router.get('/portfolio/live', (req, res) => {
  try {
    // Check if financial_accounts table exists (may not on fresh install)
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='financial_accounts'`
    ).get();
    if (!tableCheck) return res.json({ accounts: [], summary: { total_market_value:0, total_cost_basis:0, total_gain_loss:0, total_gain_loss_pct:0 }, _source:'ghrava_holdings', _note:'No investment accounts found' });

    const accounts = db.prepare(`
      SELECT id, nickname, institution, account_type,
             COALESCE(tax_treatment,'taxable') AS tax_treatment,
             owner, is_active
      FROM financial_accounts
      WHERE is_active = 1
      ORDER BY institution, nickname
    `).all();

    const holdingsStmt = db.prepare(`
      SELECT symbol, name, asset_type, shares, cost_basis,
             price, price_date, market_value,
             total_cost_basis, gain_loss_dollar, gain_loss_pct,
             day_change_dollar, day_change_pct,
             week52_low, week52_high,
             dividend_yield, annual_dividend
      FROM holdings
      WHERE account_id = ?
      ORDER BY market_value DESC
    `);

    let totalValue = 0, totalCost = 0, totalGain = 0;

    const result = accounts.map(acct => {
      const holdings = holdingsStmt.all(acct.id);
      const acctValue = holdings.reduce((s, h) => s + (h.market_value || 0), 0);
      const acctCost  = holdings.reduce((s, h) => s + (h.total_cost_basis || (h.cost_basis||0) * (h.shares||0)), 0);
      totalValue += acctValue;
      totalCost  += acctCost;
      totalGain  += (acctValue - acctCost);
      return {
        id:           acct.id,
        nickname:     acct.nickname,
        institution:  acct.institution,
        account_type: acct.account_type,
        tax_treatment: acct.tax_treatment,
        owner:        acct.owner,
        market_value: parseFloat(acctValue.toFixed(2)),
        cost_basis:   parseFloat(acctCost.toFixed(2)),
        gain_loss:    parseFloat((acctValue - acctCost).toFixed(2)),
        holdings:     holdings.map(h => ({
          ...h,
          market_value:       h.market_value       ? parseFloat(h.market_value.toFixed(2))       : null,
          total_cost_basis:   h.total_cost_basis   ? parseFloat(h.total_cost_basis.toFixed(2))   : null,
          gain_loss_dollar:   h.gain_loss_dollar   ? parseFloat(h.gain_loss_dollar.toFixed(2))   : null,
          gain_loss_pct:      h.gain_loss_pct      ? parseFloat(h.gain_loss_pct.toFixed(4))      : null,
        }))
      };
    });

    const gainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

    res.json({
      accounts: result,
      summary: {
        total_market_value:  parseFloat(totalValue.toFixed(2)),
        total_cost_basis:    parseFloat(totalCost.toFixed(2)),
        total_gain_loss:     parseFloat(totalGain.toFixed(2)),
        total_gain_loss_pct: parseFloat(gainPct.toFixed(4)),
      },
      _source:  'ghrava_holdings',
      _as_of:   new Date().toISOString().slice(0, 10),
    });
  } catch(e) { serverError(res, e); }
});

// GET portfolio performance history from portfolio_snapshots
// Reads: portfolio_snapshots (written by shared/portfolio-analytics.js scheduler)
router.get('/portfolio/performance', (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 12, 60);
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='portfolio_snapshots'`
    ).get();
    if (!tableCheck) return res.json({ snapshots: [], allocation: [], top_gainers: [], _note: 'No performance history yet' });

    const snapshots = db.prepare(`
      SELECT snapshot_date, total_value, total_cost, total_gain, total_gain_pct
      FROM portfolio_snapshots
      WHERE snapshot_date >= date('now', '-' || ? || ' months')
      ORDER BY snapshot_date ASC
    `).all(months);

    // Asset allocation from current holdings
    const allocation = db.prepare(`
      SELECT COALESCE(asset_type,'other') AS type,
             ROUND(SUM(market_value),2)   AS value,
             COUNT(*)                     AS count
      FROM holdings
      WHERE market_value > 0
      GROUP BY asset_type
      ORDER BY value DESC
    `).all();

    // Top performers from holdings
    const topGainers = db.prepare(`
      SELECT symbol, name, market_value, total_cost_basis,
             gain_loss_dollar, gain_loss_pct
      FROM holdings
      WHERE market_value > 0 AND gain_loss_pct IS NOT NULL
      ORDER BY gain_loss_pct DESC
      LIMIT 5
    `).all();

    const topLosers = db.prepare(`
      SELECT symbol, name, market_value, total_cost_basis,
             gain_loss_dollar, gain_loss_pct
      FROM holdings
      WHERE market_value > 0 AND gain_loss_pct IS NOT NULL
      ORDER BY gain_loss_pct ASC
      LIMIT 5
    `).all();

    res.json({ snapshots, allocation, top_gainers: topGainers, top_losers: topLosers });
  } catch(e) { serverError(res, e); }
});

// GET watchlist summary — top movers for Dashboard widget
// Reads: trading.json watchlist + live Yahoo Finance quotes
router.get('/watchlist/summary', async (req, res) => {
  try {
    const data = readData();
    const watchlist = data.watchlist || [];
    if (!watchlist.length) return res.json({ movers: [], fearGreed: null });

    const https = require('https');
    const fetchYahoo = (sym) => new Promise((resolve) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`;
      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, r => {
        let b = ''; r.on('data', c => b += c);
        r.on('end', () => {
          try {
            const d = JSON.parse(b);
            const m = d?.chart?.result?.[0]?.meta;
            if (!m) return resolve(null);
            const prev = m.previousClose || m.chartPreviousClose || m.regularMarketPrice;
            const chg  = m.regularMarketPrice - prev;
            const pct  = prev > 0 ? (chg / prev) * 100 : 0;
            resolve({ symbol: sym, price: parseFloat(m.regularMarketPrice.toFixed(2)),
              chg: parseFloat(chg.toFixed(2)), pct: parseFloat(pct.toFixed(2)) });
          } catch(e) { resolve(null); }
        });
      }).on('error', () => resolve(null));
    });

    // Fetch top 8 watchlist symbols in parallel
    const quotes = (await Promise.all(watchlist.slice(0, 8).map(fetchYahoo)))
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    res.json({ movers: quotes, count: watchlist.length });
  } catch(e) { serverError(res, e); }
});

// POST save analysis report to Ghrava Documents
// Writes one new row to documents table — the ONLY write to lifetracker.db
router.post('/reports/save-to-ghrava', (req, res) => {
  try {
    const { symbol, title, summary, timeframe, provider, date } = req.body;
    if (!symbol || !title) return badRequest(res, 'symbol and title required');

    // Check documents table exists
    const tableCheck = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='documents'`
    ).get();
    if (!tableCheck) return res.status(503).json({ error: 'Documents module not available' });

    // Check for duplicate — same symbol + same date to avoid re-saves
    const existing = db.prepare(
      `SELECT id FROM documents WHERE title = ? AND issue_date = ?`
    ).get(title, date || new Date().toISOString().slice(0, 10));
    if (existing) return res.json({ ok: true, id: existing.id, duplicate: true });

    const r = db.prepare(`
      INSERT INTO documents
        (title, category, subcategory, description, issue_date, issuer)
      VALUES (?, 'Trade Research', ?, ?, ?, ?)
    `).run(
      title,
      symbol.toUpperCase(),
      summary ? summary.slice(0, 500) : null,
      date || new Date().toISOString().slice(0, 10),
      provider || 'Trade Terminal'
    );

    // Tag with ticker symbol
    try {
      const { saveTagsByName } = require('../../shared/tags');
      saveTagsByName(r.lastInsertRowid, 'document', [symbol.toUpperCase()]);
    } catch(e) { /* tags optional — don't fail the save */ }

    res.status(201).json({ ok: true, id: r.lastInsertRowid });
  } catch(e) { serverError(res, e); }
});

// ── WRITES ────────────────────────────────────────────────────────

// POST save all trading data
// Strategy: merge ALL keys from body over current — never drop any field.
// New fields added in future code versions are preserved automatically.
router.post('/data', (req, res) => {
  try {
    const current  = readData();
    const incoming = req.body || {};

    // Deep-merge settings so individual key additions never wipe others
    const mergedSettings = {
      ...(current.settings  || {}),
      ...(incoming.settings || {}),
      // Always deep-merge apiKeys specifically
      apiKeys: {
        ...((current.settings  || {}).apiKeys || {}),
        ...((incoming.settings || {}).apiKeys || {}),
      },
    };

    // For every other top-level key: prefer incoming if present, else keep current
    const updated = { ...current, ...incoming, settings: mergedSettings };

    fs.writeFileSync(DATA_FILE, JSON.stringify(updated, null, 2));
    res.json({ ok: true, savedAt: new Date().toISOString() });
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
