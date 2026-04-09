'use strict';
/**
 * features/auth/routes.js
 *
 * Single-password authentication for the Ghrava app.
 * Only one user exists — the household owner. There are no accounts or roles.
 *
 * POST /login   — validate password, return session token (30-day expiry)
 * POST /logout  — invalidate session token
 * GET  /status  — check if current token is valid + time remaining
 *
 * The password hash is stored in app_config (key: app_password_hash).
 * If no password has been set yet (first run), any password is accepted
 * and the hash is stored. This avoids a separate setup screen.
 *
 * Sessions survive container restarts because they're stored in SQLite,
 * not in memory.
 */
const express = require('express');
const router  = express.Router();
const { login, setPassword, logout, sessionInfo, requireAuth } = require('./middleware');
const db = require('../../db/db');

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const token = await login(password);
  if (!token) return res.status(401).json({ error: 'Invalid password' });
  // Set HttpOnly cookie — survives browser storage clears, works in APK WebView
  res.cookie('lt_token', token, {
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days in ms
    sameSite: 'lax',
    path: '/'
  });
  res.json({ token, expires_in_hours: 8760 }); // 365 days
});

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  logout(req.sessionToken);
  res.clearCookie('lt_token', { path: '/' });
  res.json({ message: 'Logged out' });
});

// POST /api/v1/auth/setup — first run only
router.post('/setup', async (req, res) => {
  const setupDone = db.prepare("SELECT value FROM app_config WHERE key = 'setup_complete'").get();
  if (setupDone?.value === '1') return res.status(403).json({ error: 'Setup already complete' });
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  await setPassword(password);
  db.prepare("INSERT OR REPLACE INTO app_config (key,value) VALUES ('setup_complete','1')").run();
  res.json({ message: 'Password set. You can now log in.' });
});

// POST /api/v1/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { new_password } = req.body;
  if (!new_password || new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  await setPassword(new_password);
  res.json({ message: 'Password updated' });
});

// DELETE /api/v1/auth/password — remove password (open mode)
router.delete('/password', requireAuth, (req, res) => {
  try {
    db.prepare("DELETE FROM app_config WHERE key='app_password_hash'").run();
    db.prepare('DELETE FROM _sessions').run();
    res.clearCookie('lt_token', { path: '/' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /api/v1/auth/status
router.get('/status', (req, res) => {
  const setupDone  = db.prepare("SELECT value FROM app_config WHERE key = 'setup_complete'").get();
  const hasPassword = db.prepare("SELECT 1 FROM app_config WHERE key = 'app_password_hash'").get();
  const cookies = Object.fromEntries((req.headers.cookie||'').split(';').map(s=>{const[k,...v]=s.trim().split('=');return[k,v.join('=')]}).filter(([k])=>k));
  const token = cookies.lt_token ||
                req.headers.authorization?.replace('Bearer ', '') || '';
  const session = token ? sessionInfo(token) : null;
  res.json({ setup_complete: setupDone?.value === '1', has_password: !!hasPassword, authenticated: !!session?.valid, session });
});

// GET /api/v1/auth/session
router.get('/session', requireAuth, (req, res) => {
  res.json(sessionInfo(req.sessionToken));
});

module.exports = router;
