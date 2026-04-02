'use strict';
/**
 * features/google/oauth.js
 * Helpers for Google OAuth 2.0 token management.
 * Credentials stored in app_config table.
 */
const db = require('../../db/db');

const GOOGLE_TOKEN_URL   = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL    = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/contacts.readonly',
].join(' ');

function getCfg(key) {
  return db.prepare("SELECT value FROM app_config WHERE key=?").get(key)?.value || '';
}
function setCfg(key, value) {
  db.prepare("INSERT OR REPLACE INTO app_config (key,value) VALUES (?,?)").run(key, value);
}

function getCredentials() {
  return {
    client_id:     getCfg('google_client_id'),
    client_secret: getCfg('google_client_secret'),
    access_token:  getCfg('google_access_token'),
    refresh_token: getCfg('google_refresh_token'),
    token_expiry:  getCfg('google_token_expiry'),
  };
}

function isConfigured() {
  const c = getCredentials();
  return !!(c.client_id && c.client_secret);
}

function isConnected() {
  const c = getCredentials();
  return !!(c.client_id && c.client_secret && c.refresh_token);
}

function buildAuthUrl(redirectUri) {
  const creds = getCredentials();
  const params = new URLSearchParams({
    client_id:     creds.client_id,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'consent',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code, redirectUri) {
  const creds = getCredentials();
  const body = new URLSearchParams({
    code,
    client_id:     creds.client_id,
    client_secret: creds.client_secret,
    redirect_uri:  redirectUri,
    grant_type:    'authorization_code',
  });
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  const data = await resp.json();
  setCfg('google_access_token',  data.access_token);
  setCfg('google_token_expiry',  String(Date.now() + (data.expires_in||3600) * 1000));
  if (data.refresh_token) setCfg('google_refresh_token', data.refresh_token);
  return data;
}

async function refreshAccessToken() {
  const creds = getCredentials();
  if (!creds.refresh_token) throw new Error('No refresh token stored');
  const body = new URLSearchParams({
    refresh_token: creds.refresh_token,
    client_id:     creds.client_id,
    client_secret: creds.client_secret,
    grant_type:    'refresh_token',
  });
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  const data = await resp.json();
  setCfg('google_access_token', data.access_token);
  setCfg('google_token_expiry', String(Date.now() + (data.expires_in||3600) * 1000));
  return data.access_token;
}

async function getValidToken() {
  const creds = getCredentials();
  const expiry = parseInt(creds.token_expiry || '0', 10);
  // Refresh if expiring within 5 minutes
  if (creds.access_token && expiry > Date.now() + 300_000) {
    return creds.access_token;
  }
  return await refreshAccessToken();
}

function disconnect() {
  ['google_access_token','google_refresh_token','google_token_expiry'].forEach(k => setCfg(k,''));
  // calendar_events and google_calendars left intact (historical data)
}

module.exports = { getCredentials, isConfigured, isConnected, buildAuthUrl, exchangeCode, getValidToken, getCfg, setCfg, disconnect };
