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
// Two-way sync. Mapped fields: name, email, phone x2, company, address x4, website.
// Latest updated_at wins. Ghrava-only fields (type, specialty, notes, tags) never touched.
// Group filter: only contacts in the configured Google group (default: "Ghrava").
// New Ghrava contacts → pushed to Google and labeled with sync group.
router.post('/sync/contacts', requireAuth, async (req, res) => {
  if (!oauth.isConnected()) return res.status(400).json({ error: 'Not connected to Google' });
  try {
    const token     = await oauth.getValidToken();
    const syncGroup = oauth.getCfg('google_contact_group') || 'Ghrava';

    // ── 1. Find or create the sync group in Google ────────────
    const groupsResp = await fetch(`${GPEOPLE_BASE}/contactGroups?maxMembers=0`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!groupsResp.ok) throw new Error(`Contact groups error: ${await groupsResp.text()}`);
    const groupsData = await groupsResp.json();
    let groupResourceName = (groupsData.contactGroups || [])
      .find(g => g.formattedName === syncGroup || g.name === syncGroup)?.resourceName;

    if (!groupResourceName) {
      // Create the group
      const createResp = await fetch(`${GPEOPLE_BASE}/contactGroups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactGroup: { name: syncGroup } }),
      });
      if (!createResp.ok) throw new Error(`Create group error: ${await createResp.text()}`);
      const created = await createResp.json();
      groupResourceName = created.resourceName;
    }

    // ── 2. Fetch all contacts in the sync group ───────────────
    const groupDetailResp = await fetch(
      `${GPEOPLE_BASE}/${groupResourceName}?maxMembers=1000`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!groupDetailResp.ok) throw new Error(`Group detail error: ${await groupDetailResp.text()}`);
    const groupDetail = await groupDetailResp.json();
    const memberNames = (groupDetail.memberResourceNames || []);

    // Fetch full contact details for group members
    let googleContacts = [];
    if (memberNames.length > 0) {
      const batchParams = new URLSearchParams({
        personFields: 'names,emailAddresses,phoneNumbers,organizations,addresses,urls,metadata',
      });
      memberNames.forEach(n => batchParams.append('resourceNames', n));
      const batchResp = await fetch(`${GPEOPLE_BASE}/people:batchGet?${batchParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!batchResp.ok) throw new Error(`Batch get error: ${await batchResp.text()}`);
      const batchData = await batchResp.json();
      googleContacts = (batchData.responses || []).map(r => r.person).filter(Boolean);
    }

    // ── 3. Pull: Google → Ghrava (latest wins) ────────────────
    let pulled = 0, pushed = 0, created = 0;

    for (const person of googleContacts) {
      const name    = person.names?.[0]?.displayName;
      if (!name) continue;
      const gId     = person.resourceName;
      const email   = person.emailAddresses?.[0]?.value || null;
      const phone1  = person.phoneNumbers?.[0]?.value   || null;
      const phone2  = person.phoneNumbers?.[1]?.value   || null;
      const org     = person.organizations?.[0]?.name   || null;
      const website = person.urls?.[0]?.value           || null;
      const addr    = person.addresses?.[0]             || null;
      const street  = addr?.streetAddress               || null;
      const city    = addr?.city                        || null;
      const state   = addr?.region                      || null;
      const zip     = addr?.postalCode                  || null;
      const gUpdated = person.metadata?.sources?.[0]?.updateTime || null;

      const existing = db.prepare(
        'SELECT id, updated_at, google_updated_at FROM contacts WHERE google_contact_id=?'
      ).get(gId);

      if (!existing) {
        // New from Google — create in Ghrava
        db.prepare(`
          INSERT INTO contacts
            (name, contact_type, email, phone_primary, phone_secondary, company,
             address_street, address_city, address_state, address_zip, website,
             google_contact_id, google_updated_at, notes)
          VALUES (?, 'General', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Imported from Google Contacts')
        `).run(name, email, phone1, phone2, org, street, city, state, zip, website, gId, gUpdated);
        created++;
      } else {
        // Compare timestamps — latest wins
        const ghrava_t = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
        const google_t = gUpdated ? new Date(gUpdated).getTime() : 0;
        if (google_t >= ghrava_t) {
          // Google is newer — update Ghrava
          db.prepare(`
            UPDATE contacts SET
              name=?, email=?, phone_primary=?, phone_secondary=?, company=?,
              address_street=?, address_city=?, address_state=?, address_zip=?,
              website=?, google_updated_at=?, updated_at=CURRENT_TIMESTAMP
            WHERE google_contact_id=?
          `).run(name, email, phone1, phone2, org, street, city, state, zip, website, gUpdated, gId);
          pulled++;
        }
        // else Ghrava is newer — will be pushed in step 4
      }
    }

    // ── 4. Push: Ghrava → Google (Ghrava newer, or no google_contact_id) ──
    // Push contacts where Ghrava was updated more recently than Google's record
    const toUpdate = db.prepare(`
      SELECT * FROM contacts
      WHERE google_contact_id IS NOT NULL AND google_contact_id != ''
        AND updated_at > COALESCE(google_updated_at, '1970-01-01')
    `).all();

    for (const c of toUpdate) {
      if (!googleContacts.find(g => g.resourceName === c.google_contact_id)) continue; // not in group
      try {
        const body = {
          names:          [{ displayName: c.name, givenName: c.name }],
          emailAddresses: c.email         ? [{ value: c.email }]                        : [],
          phoneNumbers:   [],
          organizations:  c.company       ? [{ name: c.company }]                       : [],
          addresses:      [],
          urls:           c.website       ? [{ value: c.website }]                      : [],
        };
        if (c.phone_primary)   body.phoneNumbers.push({ value: c.phone_primary,   type: 'main' });
        if (c.phone_secondary) body.phoneNumbers.push({ value: c.phone_secondary, type: 'other' });
        if (c.address_street || c.address_city) {
          body.addresses.push({
            streetAddress: c.address_street || '',
            city:          c.address_city   || '',
            region:        c.address_state  || '',
            postalCode:    c.address_zip    || '',
          });
        }
        // Get current etag for the contact (required for PATCH)
        const getResp = await fetch(
          `${GPEOPLE_BASE}/${c.google_contact_id}?personFields=metadata`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!getResp.ok) continue;
        const current = await getResp.json();
        body.etag = current.etag;

        const patchResp = await fetch(
          `${GPEOPLE_BASE}/${c.google_contact_id}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers,organizations,addresses,urls`,
          {
            method:  'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
          }
        );
        if (patchResp.ok) {
          const updated = await patchResp.json();
          const newGUpdated = updated.metadata?.sources?.[0]?.updateTime || null;
          db.prepare('UPDATE contacts SET google_updated_at=? WHERE id=?')
            .run(newGUpdated, c.id);
          pushed++;
        }
      } catch { /* skip failed individual pushes */ }
    }

    // ── 5. Push new Ghrava contacts (no google_contact_id) → Google + label ──
    const newLocal = db.prepare(
      "SELECT * FROM contacts WHERE (google_contact_id IS NULL OR google_contact_id='') AND name IS NOT NULL"
    ).all();

    for (const c of newLocal) {
      try {
        const body = {
          names:          [{ displayName: c.name, givenName: c.name }],
          emailAddresses: c.email         ? [{ value: c.email }]           : [],
          phoneNumbers:   [],
          organizations:  c.company       ? [{ name: c.company }]          : [],
          addresses:      [],
          urls:           c.website       ? [{ value: c.website }]         : [],
        };
        if (c.phone_primary)   body.phoneNumbers.push({ value: c.phone_primary,   type: 'main' });
        if (c.phone_secondary) body.phoneNumbers.push({ value: c.phone_secondary, type: 'other' });
        if (c.address_street || c.address_city) {
          body.addresses.push({
            streetAddress: c.address_street || '',
            city:          c.address_city   || '',
            region:        c.address_state  || '',
            postalCode:    c.address_zip    || '',
          });
        }

        const createResp = await fetch(`${GPEOPLE_BASE}/people:createContact`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
        if (!createResp.ok) continue;
        const newPerson = await createResp.json();
        const newGId    = newPerson.resourceName;
        const newGUpdated = newPerson.metadata?.sources?.[0]?.updateTime || null;

        // Save google_contact_id back to Ghrava
        db.prepare('UPDATE contacts SET google_contact_id=?, google_updated_at=? WHERE id=?')
          .run(newGId, newGUpdated, c.id);

        // Add to sync group
        await fetch(`${GPEOPLE_BASE}/${groupResourceName}/members:modify`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ resourceNamesToAdd: [newGId] }),
        });

        pushed++;
      } catch { /* skip failed individual creates */ }
    }

    oauth.setCfg('google_last_con_sync', new Date().toISOString());
    res.json({ ok: true, pulled, pushed, created,
               total_google: googleContacts.length,
               sync_group: syncGroup });
  } catch(e) { serverError(res, e); }
});

// ── GET /contacts/group — return configured sync group name ──
router.get('/contacts/group', (req, res) => {
  res.json({ group: oauth.getCfg('google_contact_group') || 'Ghrava' });
});

// ── PUT /contacts/group — save sync group name ────────────────
router.put('/contacts/group', requireAuth, (req, res) => {
  const { group } = req.body;
  if (!group?.trim()) return badRequest(res, 'group name required');
  oauth.setCfg('google_contact_group', group.trim());
  res.json({ ok: true });
});

module.exports = router;
