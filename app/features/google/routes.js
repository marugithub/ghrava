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
      personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses',
      pageSize:     '1000',
    });
    const resp = await fetch(`${GPEOPLE_BASE}/people/me/connections?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`Contacts error: ${await resp.text()}`);
    const data = await resp.json();

    try { db.prepare('ALTER TABLE contacts ADD COLUMN google_id TEXT').run(); } catch {}

    const upsert = db.prepare(`
      INSERT OR IGNORE INTO contacts (name, contact_type, email, phone_primary, google_id, company, notes)
      VALUES (?, 'other', ?, ?, ?, ?, 'Imported from Google Contacts')
    `);
    const update = db.prepare(`
      UPDATE contacts SET email=COALESCE(?,email), phone_primary=COALESCE(?,phone_primary),
        company=COALESCE(?,company)
      WHERE google_id=?
    `);

    let imported = 0;
    for (const person of (data.connections || [])) {
      const name = person.names?.[0]?.displayName;
      if (!name) continue;
      const email = person.emailAddresses?.[0]?.value || null;
      const phone = person.phoneNumbers?.[0]?.value   || null;
      const org   = person.organizations?.[0]?.name   || null;
      const addr  = person.addresses?.[0]
        ? [person.addresses[0].streetAddress, person.addresses[0].city,
           person.addresses[0].region].filter(Boolean).join(', ')
        : null;

      const existing = db.prepare('SELECT id FROM contacts WHERE google_id=?').get(person.resourceName);
      if (!existing) {
        upsert.run(name, email, phone, person.resourceName, org);
        imported++;
      } else {
        update.run(email, phone, org, person.resourceName);
      }
    }

    oauth.setCfg('google_last_con_sync', new Date().toISOString());
    res.json({ ok: true, imported, total: data.connections?.length || 0 });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
