// @ts-nocheck
'use strict';
/**
 * features/google/routes.js
 * Google OAuth + Google Tasks ↔ Todos two-way sync
 *
 * Replaces calendar sync (dropped). Contacts sync retained.
 *
 * Scopes: tasks + contacts.readonly
 * Tasks sync: GET /sync/tasks  — pull Google Tasks → todos (upsert by google_task_id)
 *             POST /sync/tasks/push/:id — mark a todo complete in Google Tasks
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const oauth   = require('./oauth');
const { requireAuth } = require('../auth/middleware');
const { serverError, badRequest, notFound } = require('../../shared/errors');

const GTASKS_BASE  = 'https://tasks.googleapis.com/tasks/v1';
const GPEOPLE_BASE = 'https://people.googleapis.com/v1';

// ── Status ────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  try {
    const connected   = oauth.isConnected();
    const configured  = oauth.isConfigured();
    const lastTaskSync = oauth.getCfg('google_last_task_sync');
    const lastConSync  = oauth.getCfg('google_last_con_sync');
    const taskCount    = connected
      ? (db.prepare('SELECT COUNT(*) AS n FROM todos WHERE google_task_id IS NOT NULL').get()?.n || 0)
      : 0;
    const conCount     = connected
      ? (db.prepare('SELECT COUNT(*) AS n FROM contacts WHERE google_id IS NOT NULL').get()?.n || 0)
      : 0;

    res.json({
      configured,
      connected,
      services: {
        tasks: {
          enabled:    oauth.getCfg('google_sync_tasks') === '1',
          last_sync:  lastTaskSync || null,
          task_count: taskCount,
        },
        contacts: {
          enabled:       oauth.getCfg('google_sync_contacts') === '1',
          last_sync:     lastConSync || null,
          contact_count: conCount,
        },
      },
    });
  } catch(e) { serverError(res, e); }
});

// ── Credentials ───────────────────────────────────────────────
router.put('/credentials', requireAuth, (req, res) => {
  const { client_id, client_secret } = req.body;
  if (!client_id || !client_secret) return badRequest(res, 'client_id and client_secret required');
  oauth.setCfg('google_client_id',     client_id.trim());
  oauth.setCfg('google_client_secret', client_secret.trim());
  res.json({ ok: true });
});

router.put('/prefs', requireAuth, (req, res) => {
  const { sync_tasks, sync_contacts } = req.body;
  if (sync_tasks    !== undefined) oauth.setCfg('google_sync_tasks',    sync_tasks    ? '1' : '0');
  if (sync_contacts !== undefined) oauth.setCfg('google_sync_contacts', sync_contacts ? '1' : '0');
  res.json({ ok: true });
});

router.delete('/disconnect', requireAuth, (req, res) => {
  try { oauth.disconnect(); res.json({ ok: true }); }
  catch(e) { serverError(res, e); }
});

// ── OAuth flow ────────────────────────────────────────────────
router.get('/oauth/start', requireAuth, (req, res) => {
  if (!oauth.isConfigured()) return badRequest(res, 'Google credentials not configured');
  const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/google/oauth/callback`;
  res.json({ url: oauth.buildAuthUrl(redirectUri) });
});

router.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(`<h3>Auth error: ${error}</h3>`);
  if (!code)  return res.send('<h3>No code returned</h3>');
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/google/oauth/callback`;
    await oauth.exchangeCode(code, redirectUri);
    res.send('<h3>✓ Google connected. You can close this tab.</h3><script>window.close();</script>');
  } catch(e) {
    res.send(`<h3>Token exchange failed: ${e.message}</h3>`);
  }
});

// ── Sync Tasks ────────────────────────────────────────────────
// Pull all incomplete tasks from all Google Task lists → upsert into todos
// Two-way: completed todos get pushed back to Google
router.post('/sync/tasks', requireAuth, async (req, res) => {
  if (!oauth.isConnected()) return res.status(400).json({ error: 'Not connected to Google' });
  try {
    const token = await oauth.getValidToken();

    // Fetch all task lists
    const listResp = await fetch(`${GTASKS_BASE}/users/@me/lists?maxResults=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listResp.ok) throw new Error(`Task lists error: ${await listResp.text()}`);
    const listData = await listResp.json();
    const taskLists = listData.items || [];

    let synced = 0, created = 0, updated = 0;

    for (const list of taskLists) {
      // Fetch all tasks from this list (including completed for two-way sync)
      const taskResp = await fetch(
        `${GTASKS_BASE}/lists/${list.id}/tasks?maxResults=100&showCompleted=true&showHidden=false`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!taskResp.ok) continue;
      const taskData = await taskResp.json();
      const tasks = taskData.items || [];

      for (const t of tasks) {
        if (!t.title) continue;

        const existing = db.prepare(
          'SELECT id, status FROM todos WHERE google_task_id=?'
        ).get(t.id);

        const gStatus  = t.status === 'completed' ? 'done' : 'open';
        const dueDate  = t.due ? t.due.slice(0, 10) : null;
        const notes    = t.notes || null;

        if (existing) {
          // Only update if Google side changed — don't overwrite local edits
          db.prepare(`
            UPDATE todos SET
              title=?, notes=COALESCE(?,notes), due_date=COALESCE(?,due_date),
              status=?, google_tasklist_id=?, updated_at=CURRENT_TIMESTAMP
            WHERE google_task_id=?
          `).run(t.title, notes, dueDate, gStatus, list.id, t.id);
          updated++;
        } else {
          db.prepare(`
            INSERT INTO todos
              (title, notes, due_date, status, category, google_task_id, google_tasklist_id)
            VALUES (?,?,?,?,?,?,?)
          `).run(t.title, notes, dueDate, gStatus, 'Google Tasks', t.id, list.id);
          created++;
        }
        synced++;
      }
    }

    oauth.setCfg('google_last_task_sync', new Date().toISOString());
    res.json({ ok: true, synced, created, updated, lists: taskLists.length });
  } catch(e) { serverError(res, e); }
});

// POST /sync/tasks/push/:todoId — mark a todo as complete in Google Tasks
router.post('/sync/tasks/push/:id', requireAuth, async (req, res) => {
  if (!oauth.isConnected()) return res.status(400).json({ error: 'Not connected to Google' });
  try {
    const todo = db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id);
    if (!todo) return notFound(res, 'Todo');
    if (!todo.google_task_id) return res.json({ ok: true, skipped: 'no google_task_id' });

    const token    = await oauth.getValidToken();
    const listId   = todo.google_tasklist_id || '@default';
    const gStatus  = todo.status === 'done' ? 'completed' : 'needsAction';

    const resp = await fetch(
      `${GTASKS_BASE}/lists/${listId}/tasks/${todo.google_task_id}`,
      {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: gStatus }),
      }
    );
    if (!resp.ok) throw new Error(`Google Tasks PATCH failed: ${await resp.text()}`);
    res.json({ ok: true, google_status: gStatus });
  } catch(e) { serverError(res, e); }
});

// ── Sync Contacts ─────────────────────────────────────────────
router.post('/sync/contacts', requireAuth, async (req, res) => {
  if (!oauth.isConnected()) return res.status(400).json({ error: 'Not connected to Google' });
  try {
    const token = await oauth.getValidToken();
    const params = new URLSearchParams({
      personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,biographies',
      pageSize:     '1000',
    });
    const resp = await fetch(`${GPEOPLE_BASE}/people/me/connections?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`Contacts error: ${await resp.text()}`);
    const data = await resp.json();

    try { db.prepare('ALTER TABLE contacts ADD COLUMN google_id TEXT').run(); } catch {}

    const upsert = db.prepare(`
      INSERT OR IGNORE INTO contacts
        (name, contact_type, email, phone_primary, phone_secondary, google_id, company,
         address_street, address_city, address_state, address_zip, website, notes)
      VALUES (?, 'General', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Imported from Google Contacts')
    `);
    const update = db.prepare(`
      UPDATE contacts SET
        email=COALESCE(?,email),
        phone_primary=COALESCE(?,phone_primary),
        phone_secondary=COALESCE(?,phone_secondary),
        company=COALESCE(?,company),
        address_street=COALESCE(?,address_street),
        address_city=COALESCE(?,address_city),
        address_state=COALESCE(?,address_state),
        address_zip=COALESCE(?,address_zip),
        website=COALESCE(?,website)
      WHERE google_id=?
    `);

    let imported = 0;
    for (const person of (data.connections || [])) {
      const name = person.names?.[0]?.displayName;
      if (!name) continue;
      const email   = person.emailAddresses?.[0]?.value  || null;
      const phone1  = person.phoneNumbers?.[0]?.value    || null;
      const phone2  = person.phoneNumbers?.[1]?.value    || null;
      const org     = person.organizations?.[0]?.name    || null;
      const website = person.urls?.[0]?.value            || null;
      const addr    = person.addresses?.[0]              || null;
      const street  = addr?.streetAddress                || null;
      const city    = addr?.city                         || null;
      const state   = addr?.region                       || null;
      const zip     = addr?.postalCode                   || null;

      const existing = db.prepare('SELECT id FROM contacts WHERE google_id=?').get(person.resourceName);
      if (!existing) {
        upsert.run(name, email, phone1, phone2, person.resourceName, org,
                   street, city, state, zip, website);
        imported++;
      } else {
        update.run(email, phone1, phone2, org, street, city, state, zip, website,
                   person.resourceName);
      }
    }

    oauth.setCfg('google_last_con_sync', new Date().toISOString());
    res.json({ ok: true, imported, total: data.connections?.length || 0 });
  } catch(e) { serverError(res, e); }
});


// GET /api/v1/google/debug/connection — permanent diagnostic endpoint
router.get('/debug/connection', async (req, res) => {
  const results = {
    timestamp: new Date().toISOString(),
    config: {
      has_client_id:     !!oauth.getCfg('google_client_id'),
      has_client_secret: !!oauth.getCfg('google_client_secret'),
      has_refresh_token: !!oauth.getCfg('google_refresh_token'),
      token_expiry:      oauth.getCfg('google_token_expiry'),
      token_expiry_date: oauth.getCfg('google_token_expiry')
        ? new Date(parseInt(oauth.getCfg('google_token_expiry'))).toISOString()
        : null,
    },
    tests: {}
  };

  // DNS resolution
  try {
    const dns = require('dns');
    await new Promise((resolve, reject) => {
      dns.lookup('oauth2.googleapis.com', (err, addr) => err ? reject(err) : resolve(addr));
    });
    results.tests.dns = 'ok';
  } catch(e) { results.tests.dns = `failed: ${e.message}`; }

  // HTTPS reachability
  try {
    const https = require('https');
    await new Promise((resolve, reject) => {
      const req2 = https.get('https://oauth2.googleapis.com/token', { timeout: 5000 }, (r) => {
        r.resume(); resolve(r.statusCode);
      });
      req2.on('error', reject);
    });
    results.tests.token_endpoint = 'ok';
  } catch(e) { results.tests.token_endpoint = `failed: ${e.message}`; }

  // Token validity
  if (oauth.isConnected()) {
    try {
      const token = await oauth.getValidToken();
      results.tests.token = token ? `valid (prefix: ${token.slice(0,8)}...)` : 'null';

      // Tasks API test
      try {
        const resp = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1', {
          headers: { Authorization: `Bearer ${token}` }
        });
        results.tests.tasks_api = `${resp.status} ${resp.statusText}`;
        if (!resp.ok) {
          const err = await resp.text().catch(() => '');
          results.tests.tasks_api += ` — ${err.slice(0,200)}`;
        }
      } catch(e) { results.tests.tasks_api = `failed: ${e.message}`; }
    } catch(e) { results.tests.token = `failed: ${e.message}`; }
  } else {
    results.tests.token = 'not connected';
    results.tests.tasks_api = 'not connected';
  }

  res.json(results);
});

module.exports = router;
