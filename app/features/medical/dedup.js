// @ts-check
'use strict';
/**
 * features/medical/dedup.js — natural-key hashing + collision routing
 *
 * Single source of truth for "is this record a duplicate?" Used by:
 *   - manual entry (POST /medications, /conditions, /notes, /eob/import)
 *   - parser path (folder-watcher.js → importEob)
 *   - reactivate flow (POST /medications detecting a discontinued match)
 *
 * Hash strategy:
 *   - SHA-256 of a normalized natural-key string (lowercase, trimmed, joined by |)
 *   - Hex-truncated to 16 chars (collision probability ≈ 1 in 10^19, plenty for
 *     household scale)
 *   - Stored on the row as `dedup_hash`. Indexed.
 *
 * Outcomes (per the agreed contract):
 *   - identical    → hash match AND every key field byte-equal → silent skip
 *   - strong_match → hash match BUT non-key fields differ → pending_review
 *   - weak_match   → only some key fields match → insert with auto_imported=1
 *   - new          → no match → straight insert
 *
 * Reactivation outcome (medication-only):
 *   - reactivate_match → hash matches a Discontinued row → pending_review with
 *                        proposed_action='reactivate' (manual path may resolve
 *                        in the same request via prompt; parser path queues)
 */

const crypto = require('crypto');

function _norm(s) {
  return String(s == null ? '' : s).toLowerCase().trim();
}

function _hash(parts) {
  const joined = parts.map(_norm).join('|');
  return crypto.createHash('sha256').update(joined).digest('hex').slice(0, 16);
}

// ── Domain-specific key builders ────────────────────────────

function medicationHash(rec) {
  // Natural key: patient + drug name + dosage.
  // family_member_id is preferred over patient text when present (handles
  // "Sarah" vs "Sarah Reed" vs "self" inconsistencies).
  const who = rec.family_member_id != null
    ? `fm:${rec.family_member_id}`
    : `pt:${_norm(rec.patient || 'self')}`;
  return _hash([who, rec.name, rec.dosage]);
}

function conditionHash(rec) {
  // Natural key: patient + condition name. One condition per person.
  const who = rec.family_member_id != null
    ? `fm:${rec.family_member_id}`
    : `pt:${_norm(rec.patient || 'self')}`;
  return _hash([who, rec.condition_name]);
}

function visitHash(rec) {
  // Natural key: patient + provider + date + start_time + visit_type.
  // start_time included so two follow-ups same day same provider don't collide.
  const who = rec.family_member_id != null
    ? `fm:${rec.family_member_id}`
    : `pt:${_norm(rec.patient || 'self')}`;
  const provider = rec.physician_contact_id != null
    ? `dr:${rec.physician_contact_id}`
    : `dr:${_norm(rec.physician || '')}`;
  return _hash([who, provider, rec.visit_date, rec.start_time || '', rec.visit_type || '']);
}

function eobStatementHash(rec) {
  // Insurer + member_id + statement_date — same as the existing UNIQUE
  // constraint on med_eob_statements (kept compatible).
  return _hash([rec.insurer || 'MHBP', rec.member_id, rec.statement_date]);
}

function eobClaimHash(rec) {
  // Patient + claim_id + send_date. claim_id is the strongest key when present.
  return _hash([rec.patient, rec.claim_id || '', rec.send_date || '']);
}

function fileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ── Lookup helpers ───────────────────────────────────────────
//
// Each takes a (db, hash) and returns the matching row or null.
// Read-only — never modify state. Used by the dedup gate.

function findByHash(db, table, hash) {
  if (!hash) return null;
  return db.prepare(`SELECT * FROM ${table} WHERE dedup_hash = ?`).get(hash) || null;
}

// ── Pending review queue helpers ────────────────────────────

/**
 * Push a row into med_pending_review and (if non-manual) auto-create
 * a Todo so the user sees it in the alerts pipeline.
 *
 * @param {object} db          better-sqlite3 instance
 * @param {object} item        { source, entity_type, proposed_action, payload, existing_id, dedup_hash, file_hash, reason }
 * @returns {number}           inserted pending_review id
 */
function queueReview(db, item) {
  const payloadStr = typeof item.payload === 'string'
    ? item.payload
    : JSON.stringify(item.payload || {});
  const info = db.prepare(`
    INSERT INTO med_pending_review
      (source, entity_type, proposed_action, payload,
       existing_id, dedup_hash, file_hash, reason)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(
    item.source, item.entity_type, item.proposed_action, payloadStr,
    item.existing_id || null, item.dedup_hash || null,
    item.file_hash || null, item.reason || null
  );

  // For non-manual sources, create a Todo so the user is notified through
  // the standard alerts pipeline, not just a buried admin page. Todo
  // due_date defaults to creation date per agreement (immediate attention).
  if (item.source !== 'manual') {
    try {
      const hasTodos = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='todos'").get();
      if (hasTodos) {
        const today = new Date().toISOString().slice(0, 10);
        const reviewId = info.lastInsertRowid;
        const title = `Review: ${item.entity_type} import — ${item.reason || 'needs review'}`;
        // Use minimal columns that exist in every todos schema variant
        const todoCols = db.prepare("PRAGMA table_info(todos)").all().map(r => r.name);
        if (todoCols.includes('title') && todoCols.includes('due_date')) {
          const hasStatus = todoCols.includes('status');
          const hasCategory = todoCols.includes('category');
          let cols = ['title', 'due_date'];
          let placeholders = ['?', '?'];
          let params = [title, today];
          if (hasStatus) { cols.push('status'); placeholders.push('?'); params.push('open'); }
          if (hasCategory) { cols.push('category'); placeholders.push('?'); params.push('Medical'); }
          const todoInfo = db.prepare(
            `INSERT INTO todos (${cols.join(',')}) VALUES (${placeholders.join(',')})`
          ).run(...params);
          db.prepare(`UPDATE med_pending_review SET todo_id=? WHERE id=?`).run(
            todoInfo.lastInsertRowid, reviewId
          );
        }
      }
    } catch (e) {
      // Best-effort. Failure to create the todo doesn't block the queue write.
      console.warn('[dedup] auto-todo failed:', e.message);
    }
  }

  return info.lastInsertRowid;
}

/**
 * Fast pending-review counter for the medical landing-page banner.
 */
function openReviewCount(db) {
  try {
    return db.prepare(`SELECT COUNT(*) AS n FROM med_pending_review WHERE status='open'`).get().n;
  } catch (e) {
    return 0;
  }
}

module.exports = {
  medicationHash,
  conditionHash,
  visitHash,
  eobStatementHash,
  eobClaimHash,
  fileHash,
  findByHash,
  queueReview,
  openReviewCount,
};
