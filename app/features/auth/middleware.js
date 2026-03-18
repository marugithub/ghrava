/**
 * features/auth/middleware.js
 * Single-password auth. Sessions stored in DB — survive container restarts.
 *
 * requireAuth  — blocks request with 401 if not authenticated (use on writes)
 * optionalAuth — never blocks, sets req.isAuthenticated (use on reads)
 *
 * Design intent: reading data never requires a password.
 * The password only prevents unauthorized modifications.
 */
const db     = require('../../db/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SESSION_TIMEOUT_MS = 365 * 24 * 60 * 60 * 1000; // 365 days — stay logged in on home network

// Ensure sessions table exists (runs at startup before migrations)
db.exec(`
  CREATE TABLE IF NOT EXISTS _sessions (
    token       TEXT PRIMARY KEY,
    created_at  INTEGER NOT NULL,
    last_active INTEGER NOT NULL
  )
`);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function purgeExpiredSessions() {
  const cutoff = Date.now() - SESSION_TIMEOUT_MS;
  db.prepare('DELETE FROM _sessions WHERE last_active < ?').run(cutoff);
}

function isValidToken(token) {
  if (!token) return false;
  purgeExpiredSessions();
  const row = db.prepare('SELECT token FROM _sessions WHERE token = ?').get(token);
  if (!row) return false;
  db.prepare('UPDATE _sessions SET last_active = ? WHERE token = ?').run(Date.now(), token);
  return true;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!isValidToken(token)) {
    return res.status(401).json({ error: 'Not authenticated', login_required: true });
  }
  req.sessionToken = token;
  next();
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  req.isAuthenticated = isValidToken(token);
  if (req.isAuthenticated) req.sessionToken = token;
  next();
}

async function login(password) {
  const config = db.prepare("SELECT value FROM app_config WHERE key = 'app_password_hash'").get();
  // If no password has been set yet, allow login with any password (first-run)
  if (!config) return null;
  const valid = await bcrypt.compare(password, config.value);
  if (!valid) return null;
  const token = generateToken();
  db.prepare('INSERT OR REPLACE INTO _sessions (token, created_at, last_active) VALUES (?, ?, ?)')
    .run(token, Date.now(), Date.now());
  return token;
}

async function setPassword(password) {
  const hash = await bcrypt.hash(password, 10);
  const existing = db.prepare("SELECT 1 FROM app_config WHERE key = 'app_password_hash'").get();
  if (existing) {
    db.prepare("UPDATE app_config SET value = ? WHERE key = 'app_password_hash'").run(hash);
  } else {
    db.prepare("INSERT INTO app_config (key, value) VALUES ('app_password_hash', ?)").run(hash);
  }
}

function logout(token) {
  db.prepare('DELETE FROM _sessions WHERE token = ?').run(token);
}

function sessionInfo(token) {
  purgeExpiredSessions();
  const row = db.prepare('SELECT last_active FROM _sessions WHERE token = ?').get(token);
  if (!row) return null;
  const remainingMs = SESSION_TIMEOUT_MS - (Date.now() - row.last_active);
  return {
    valid: remainingMs > 0,
    remaining_seconds: Math.max(0, Math.floor(remainingMs / 1000)),
    expires_at: new Date(row.last_active + SESSION_TIMEOUT_MS).toISOString()
  };
}

module.exports = { requireAuth, optionalAuth, login, setPassword, logout, sessionInfo };
