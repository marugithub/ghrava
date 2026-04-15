// @ts-check
'use strict';
/**
 * shared/webhooks.js
 * Trigger webhooks on system events.
 */
const db     = require('../db/db');
const crypto = require('crypto');

const EVENTS = {
  BACKUP_CREATED:      'backup.created',
  BACKUP_FAILED:       'backup.failed',
  HSA_POOL_THRESHOLD:  'hsa.pool_threshold',
  DOCUMENT_EXPIRING:   'document.expiring',
  TODO_OVERDUE:        'todo.overdue',
  IMPORT_COMPLETED:    'import.completed',
  MAINTENANCE_DUE:     'maintenance.due'
};

async function sendWebhook(webhook, payload, timeout = 10000) {
  const start = Date.now();
  let responseCode = 0, responseBody = null, success = false;
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeout);
    const headers = { 'Content-Type': 'application/json' };
    if (webhook.secret) {
      headers['X-Ghrava-Signature'] = crypto.createHmac('sha256', webhook.secret).update(payload).digest('hex');
    }
    const response = await fetch(webhook.url, { method: 'POST', headers, body: payload, signal: controller.signal });
    clearTimeout(tid);
    responseCode = response.status;
    responseBody = await response.text().catch(() => null);
    success = responseCode >= 200 && responseCode < 300;
  } catch(e) {
    responseBody = e.message;
  }
  const duration = Date.now() - start;
  db.prepare(`INSERT INTO webhook_logs (webhook_id,event_type,payload,response_code,response_body,duration_ms) VALUES (?,?,?,?,?,?)`)
    .run(webhook.id, webhook.event_type, payload, responseCode, responseBody, duration);
  if (success) {
    db.prepare(`UPDATE webhooks SET last_triggered=CURRENT_TIMESTAMP, last_status=?, failure_count=0 WHERE id=?`).run(responseCode, webhook.id);
  } else {
    db.prepare(`UPDATE webhooks SET failure_count=failure_count+1, last_status=? WHERE id=?`).run(responseCode, webhook.id);
    const maxFail = parseInt(db.prepare(`SELECT value FROM app_config WHERE key='webhook_retry_count'`).get()?.value || '3');
    const wh = db.prepare('SELECT failure_count FROM webhooks WHERE id=?').get(webhook.id);
    if (wh && wh.failure_count >= maxFail) {
      db.prepare('UPDATE webhooks SET enabled=0 WHERE id=?').run(webhook.id);
    }
  }
}

async function triggerWebhooks(eventType, payload) {
  if (db.prepare(`SELECT value FROM app_config WHERE key='webhooks_enabled'`).get()?.value !== '1') return;
  const webhooks = db.prepare(`SELECT * FROM webhooks WHERE event_type=? AND enabled=1`).all(eventType);
  if (!webhooks.length) return;
  const timeout = parseInt(db.prepare(`SELECT value FROM app_config WHERE key='webhook_timeout_seconds'`).get()?.value || '10') * 1000;
  const payloadStr = JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), data: payload });
  for (const wh of webhooks) { await sendWebhook(wh, payloadStr, timeout); }
}

// Non-blocking fire-and-forget — call from any route
function triggerIfEnabled(eventType, payload) {
  setImmediate(() => {
    triggerWebhooks(eventType, payload).catch(e => console.error(`[Webhook] ${eventType}: ${e.message}`));
  });
}

function getWebhooks() {
  return db.prepare(`
    SELECT w.*, (SELECT COUNT(*) FROM webhook_logs WHERE webhook_id=w.id) as total_calls
    FROM webhooks w ORDER BY w.event_type, w.name
  `).all();
}

function getWebhookLogs(webhookId = null, limit = 50) {
  const params = webhookId ? [webhookId, limit] : [limit];
  const where  = webhookId ? 'WHERE webhook_id=?' : '';
  return db.prepare(`SELECT * FROM webhook_logs ${where} ORDER BY created_at DESC LIMIT ?`).all(...params);
}

async function testWebhook(id) {
  const webhook = db.prepare('SELECT * FROM webhooks WHERE id=?').get(id);
  if (!webhook) return { success: false, error: 'Not found' };
  const tp = JSON.stringify({ event: 'test.ping', timestamp: new Date().toISOString(), data: { message: 'Test from Ghrava' } });
  await sendWebhook(webhook, tp, 10000);
  const last = db.prepare(`SELECT * FROM webhook_logs WHERE webhook_id=? ORDER BY created_at DESC LIMIT 1`).get(id);
  return { success: last?.response_code >= 200 && last?.response_code < 300, response_code: last?.response_code, duration_ms: last?.duration_ms };
}

module.exports = { EVENTS, triggerWebhooks, triggerIfEnabled, getWebhooks, getWebhookLogs, testWebhook };
