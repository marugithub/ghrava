'use strict';
/**
 * features/google/routes.js
 * Mounted at /api/v1/google
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { serverError  } = require('../../shared/errors');
const oauth = require('./oauth');

const GCAL_BASE    = 'https://www.googleapis.com/calendar/v3';
const GPEOPLE_BASE = 'https://people.googleapis.com/v1';

// ── Status (public) ───────────────────────────────────────────
router.get('/status', (req, res) => {
  try {
    const creds = oauth.getCredentials();
    const connected = oauth.isConnected();
    const evtCount  = connected ? db.prepare("SELECT COUNT(*) AS n FROM calendar_events WHERE source='google'").get().n : 0;
    const conCount  = connected ? (db.prepare("SELECT COUNT(*) AS n FROM contacts WHERE google_id IS NOT NULL").get()?.n || 0) : 0;
    res.json({
      configured:      oauth.isConfigured(),
      connected,
      services: {
        calendar: {
          enabled:    oauth.getCfg('google_sync_calendars') === '1',
          last_sync:  oauth.getCfg('google_last_cal_sync') || null,
          event_count: evtCount,
        },
        contacts: {
          enabled:   oauth.getCfg('google_sync_contacts') === '1',
          last_sync: oauth.getCfg('google_last_con_sync') || null,
          contact_count: conCount,
        },
      },
    });
  } catch(e) { serverError(res, e); }
});

// ── Save credentials (auth required) ─────────────────────────
router.put('/credentials', requireAuth, (req, res) => {
  try {
    const { client_id, client_secret } = req.body;
    if (!client_id?.trim() || !client_secret?.trim()) {
      return res.status(400).json({ error: 'client_id and client_secret are required' });
    }
    oauth.setCfg('google_client_id',     client_id.trim());
    oauth.setCfg('google_client_secret', client_secret.trim());
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Save sync prefs (auth required) ──────────────────────────
router.put('/prefs', requireAuth, (req, res) => {
  try {
    const { sync_calendars, sync_contacts } = req.body;
    if (sync_calendars !== undefined) oauth.setCfg('google_sync_calendars', sync_calendars ? '1' : '0');
    if (sync_contacts  !== undefined) oauth.setCfg('google_sync_contacts',  sync_contacts  ? '1' : '0');
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── OAuth start — redirect user to Google ────────────────────
router.get('/oauth/start', requireAuth, (req, res) => {
  try {
    if (!oauth.isConfigured()) return res.status(400).json({ error: 'Credentials not configured' });
    const base       = oauth.getCfg('base_url') || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${base}/api/v1/google/oauth/callback`;
    const url = oauth.buildAuthUrl(redirectUri);
    res.json({ auth_url: url, redirect_uri: redirectUri });
  } catch(e) { serverError(res, e); }
});

// ── OAuth callback ────────────────────────────────────────────
router.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`/settings.html?google_error=${encodeURIComponent(error)}`);
  if (!code)  return res.redirect('/settings.html?google_error=no_code');
  try {
    const base       = oauth.getCfg('base_url') || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${base}/api/v1/google/oauth/callback`;
    await oauth.exchangeCode(code, redirectUri);
    res.redirect('/settings.html?google_connected=1');
  } catch(e) {
    res.redirect(`/settings.html?google_error=${encodeURIComponent(e.message)}`);
  }
});

// ── Disconnect ────────────────────────────────────────────────
router.delete('/disconnect', requireAuth, (req, res) => {
  try {
    oauth.disconnect();
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Sync Calendar ─────────────────────────────────────────────
router.post('/sync/calendar', requireAuth, async (req, res) => {
  if (!oauth.isConnected()) return res.status(400).json({ error: 'Not connected to Google' });
  try {
    const token = await oauth.getValidToken();
    // Fetch list of user's calendars
    const calListResp = await fetch(`${GCAL_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!calListResp.ok) throw new Error(`Calendar list error: ${await calListResp.text()}`);
    const calList = await calListResp.json();

    // Upsert calendars
    const insertCal = db.prepare(`
      INSERT OR REPLACE INTO google_calendars (id, summary, description, color_hex, is_primary)
      VALUES (?, ?, ?, ?, ?)
    `);
    const enabledCalIds = [];
    for (const cal of (calList.items || [])) {
      insertCal.run(cal.id, cal.summary, cal.description||null, cal.backgroundColor||null, cal.primary?1:0);
      // Check if user has disabled this calendar
      const existing = db.prepare('SELECT is_enabled FROM google_calendars WHERE id=?').get(cal.id);
      if (existing?.is_enabled !== 0) enabledCalIds.push(cal.id);
    }

    // Fetch events from enabled calendars — next 90 days
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 90 * 86400_000).toISOString();
    const insertEvt = db.prepare(`
      INSERT OR REPLACE INTO calendar_events
        (id, calendar_id, title, description, location, start_datetime, end_datetime,
         all_day, status, recurring, source, color_id, html_link, organizer_email, synced_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,  'google',?,?,?, CURRENT_TIMESTAMP)
    `);

    let totalSynced = 0;
    for (const calId of enabledCalIds) {
      const params = new URLSearchParams({
        timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '500',
      });
      const evtResp = await fetch(`${GCAL_BASE}/calendars/${encodeURIComponent(calId)}/events?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!evtResp.ok) continue;
      const evtData = await evtResp.json();
      for (const evt of (evtData.items || [])) {
        if (evt.status === 'cancelled') continue;
        const allDay    = !!(evt.start?.date && !evt.start?.dateTime);
        const startDt   = evt.start?.dateTime || evt.start?.date || '';
        const endDt     = evt.end?.dateTime   || evt.end?.date   || '';
        insertEvt.run(
          evt.id, calId, evt.summary||'(No title)', evt.description||null,
          evt.location||null, startDt, endDt, allDay?1:0,
          evt.status||'confirmed', evt.recurringEventId?1:0,
          evt.colorId||null, evt.htmlLink||null, evt.organizer?.email||null
        );
        totalSynced++;
      }
    }

    oauth.setCfg('google_last_cal_sync', new Date().toISOString());
    res.json({ ok: true, synced: totalSynced, calendars: enabledCalIds.length });
  } catch(e) { serverError(res, e); }
});

// ── Sync Contacts ─────────────────────────────────────────────
router.post('/sync/contacts', requireAuth, async (req, res) => {
  if (!oauth.isConnected()) return res.status(400).json({ error: 'Not connected to Google' });
  try {
    const token = await oauth.getValidToken();
    const params = new URLSearchParams({
      personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
      pageSize:     '1000',
    });
    const resp = await fetch(`${GPEOPLE_BASE}/people/me/connections?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`Contacts error: ${await resp.text()}`);
    const data = await resp.json();

    // Check if google_id column exists, add if not
    try { db.prepare('ALTER TABLE contacts ADD COLUMN google_id TEXT').run(); } catch {}

    const upsert = db.prepare(`
      INSERT OR IGNORE INTO contacts (name, contact_type, email, phone, google_id, notes)
      VALUES (?, 'other', ?, ?, ?, 'Imported from Google Contacts')
    `);
    let imported = 0;
    for (const person of (data.connections || [])) {
      const name = person.names?.[0]?.displayName;
      if (!name) continue;
      const existing = db.prepare('SELECT id FROM contacts WHERE google_id=?').get(person.resourceName);
      if (!existing) {
        upsert.run(
          name,
          person.emailAddresses?.[0]?.value || null,
          person.phoneNumbers?.[0]?.value   || null,
          person.resourceName
        );
        imported++;
      }
    }

    oauth.setCfg('google_last_con_sync', new Date().toISOString());
    res.json({ ok: true, imported, total: data.connections?.length || 0 });
  } catch(e) { serverError(res, e); }
});

// ── Toggle calendar on/off ────────────────────────────────────
router.patch('/calendars/:id/toggle', requireAuth, (req, res) => {
  try {
    const cal = db.prepare('SELECT * FROM google_calendars WHERE id=?').get(req.params.id);
    if (!cal) return res.status(404).json({ error: 'Calendar not found' });
    db.prepare('UPDATE google_calendars SET is_enabled=? WHERE id=?').run(cal.is_enabled?0:1, cal.id);
    res.json({ ok: true, is_enabled: !cal.is_enabled });
  } catch(e) { serverError(res, e); }
});

// ── Get calendar list ─────────────────────────────────────────
router.get('/calendars', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM google_calendars ORDER BY is_primary DESC, summary').all());
  } catch(e) { serverError(res, e); }
});

// ── Get events ───────────────────────────────────────────────
router.get('/events', (req, res) => {
  try {
    const { from, to, limit = '200' } = req.query;
    let sql = `SELECT * FROM calendar_events WHERE status != 'cancelled'`;
    const params = [];
    if (from) { sql += ' AND start_datetime >= ?'; params.push(from); }
    if (to)   { sql += ' AND start_datetime <= ?'; params.push(to); }
    sql += ' ORDER BY start_datetime ASC LIMIT ?';
    params.push(parseInt(limit));
    res.json(db.prepare(sql).all(...params));
  } catch(e) { serverError(res, e); }
});

// ── Get upcoming events (next N days, for dashboard/widgets) ──
router.get('/events/upcoming', (req, res) => {
  try {
    const days = parseInt(req.query.days || '14');
    const from = new Date().toISOString().slice(0,10);
    const to   = new Date(Date.now() + days * 86400_000).toISOString().slice(0,10);
    const rows = db.prepare(`
      SELECT * FROM calendar_events
      WHERE status != 'cancelled'
        AND DATE(start_datetime) BETWEEN ? AND ?
      ORDER BY start_datetime ASC LIMIT 20
    `).all(from, to);
    res.json(rows);
  } catch(e) { serverError(res, e); }
});

// ── Local event CRUD ──────────────────────────────────────────
router.post('/events', requireAuth, (req, res) => {
  try {
    const { title, start_datetime, end_datetime, all_day, description, location, family_member } = req.body;
    if (!title?.trim() || !start_datetime) return res.status(400).json({ error: 'title and start_datetime required' });
    const id = `local_${Date.now()}`;
    db.prepare(`
      INSERT INTO calendar_events (id, title, start_datetime, end_datetime, all_day, description, location, family_member, source)
      VALUES (?,?,?,?,?,?,?,?,'local')
    `).run(id, title.trim(), start_datetime, end_datetime||null, all_day?1:0, description||null, location||null, family_member||null);
    res.status(201).json(db.prepare('SELECT * FROM calendar_events WHERE id=?').get(id));
  } catch(e) { serverError(res, e); }
});

router.put('/events/:id', requireAuth, (req, res) => {
  try {
    const evt = db.prepare('SELECT * FROM calendar_events WHERE id=?').get(req.params.id);
    if (!evt) return res.status(404).json({ error: 'Not found' });
    const { title, start_datetime, end_datetime, all_day, description, location, family_member } = req.body;
    db.prepare(`
      UPDATE calendar_events SET title=?, start_datetime=?, end_datetime=?, all_day=?,
        description=?, location=?, family_member=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(title??evt.title, start_datetime??evt.start_datetime, end_datetime??evt.end_datetime,
           all_day!=null?+all_day:evt.all_day, description??evt.description,
           location??evt.location, family_member??evt.family_member, evt.id);
    res.json(db.prepare('SELECT * FROM calendar_events WHERE id=?').get(evt.id));
  } catch(e) { serverError(res, e); }
});

router.delete('/events/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM calendar_events WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
