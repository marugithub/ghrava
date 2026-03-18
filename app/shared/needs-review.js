'use strict';
/**
 * shared/needs-review.js — Data review flagging system
 *
 * Used when a migration changes field meaning, a CSV import has mismatches,
 * or a required field is restructured. Flags affected records so the user
 * can review them at their own pace via Settings → Data Review.
 *
 * Usage in a migration cleanup or import handler:
 *   const { flagRecords, createReviewTodo, checkAndCompleteTodo } = require('../../shared/needs-review');
 *
 *   // Flag specific records
 *   const count = flagRecords('items', [1, 2, 3], 'CSV import: category not matched');
 *
 *   // Flag all records in a table matching a condition
 *   const count = flagRecordsWhere('items', 'category IS NULL', 'System redesign: category became required');
 *
 *   // Create the review todo (call once after flagging)
 *   createReviewTodo(count, 'items');
 *
 *   // Call on todos page load to auto-complete when all clear
 *   checkAndCompleteTodo();
 */

const db = require('../db/db');

// ── Tables that support needs_review ─────────────────────────
const REVIEW_TABLES = [
  { table: 'items',                nameCol: 'name',         label: 'Inventory items' },
  { table: 'documents',            nameCol: 'title',        label: 'Documents' },
  { table: 'books',                nameCol: 'title',        label: 'Books' },
  { table: 'kids',                 nameCol: 'display_name', label: 'Kids' },
  { table: 'kid_activities',       nameCol: 'name',         label: 'Kid activities' },
  { table: 'kid_notes',            nameCol: 'body',         label: 'Kid notes' },
  { table: 'career_certifications',nameCol: 'name',         label: 'Certifications' },
  { table: 'career_jobs',          nameCol: 'title',        label: 'Jobs' },
  { table: 'career_skills',        nameCol: 'name',         label: 'Skills' },
  { table: 'career_education',     nameCol: 'institution',  label: 'Education' },
  { table: 'career_goals',         nameCol: 'title',        label: 'Goals' },
  { table: 'properties',           nameCol: 'nickname',     label: 'Properties' },
  { table: 'vehicles',             nameCol: 'nickname',     label: 'Vehicles' },
  { table: 'med_visit_notes',      nameCol: 'patient',      label: 'Medical visits' },
  { table: 'med_conditions',       nameCol: 'patient',      label: 'Medical conditions' },
  { table: 'med_medications',      nameCol: 'name',         label: 'Medications' },
  { table: 'daily_log',            nameCol: 'entry_text',   label: 'Daily log entries' },
  { table: 'todos',                nameCol: 'title',        label: 'Todos' },
  { table: 'resources',            nameCol: 'name',         label: 'Resources' },
  { table: 'contacts',             nameCol: 'name',         label: 'Contacts' },
  { table: 'family_members',       nameCol: 'display_name', label: 'Family members' },
  { table: 'hsa_payments',         nameCol: 'date',         label: 'HSA expenses' },
];

const REVIEW_TODO_TITLE = 'Data Needs Review';

/**
 * flagRecords — flag specific records by ID array
 * @param {string} table
 * @param {number[]} ids
 * @param {string} reason  — shown in review dashboard
 * @returns {number} count flagged
 */
function flagRecords(table, ids, reason) {
  if (!ids || !ids.length) return 0;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`
    UPDATE ${table}
    SET needs_review=1, review_flagged_at=CURRENT_TIMESTAMP, review_reason=?
    WHERE id IN (${placeholders})
  `).run(reason, ...ids);
  return ids.length;
}

/**
 * flagRecordsWhere — flag records matching a WHERE condition
 * @param {string} table
 * @param {string} whereClause  — SQL WHERE clause (no "WHERE" keyword)
 * @param {string} reason
 * @returns {number} count flagged
 */
function flagRecordsWhere(table, whereClause, reason) {
  const result = db.prepare(`
    UPDATE ${table}
    SET needs_review=1, review_flagged_at=CURRENT_TIMESTAMP, review_reason=?
    WHERE ${whereClause}
  `).run(reason);
  return result.changes;
}

/**
 * createReviewTodo — create or update the "Data Needs Review" todo
 * Called after flagging records. Creates one todo if none exists,
 * or updates the existing one's body with the new total.
 * @param {string} context  — short description e.g. "inventory items after CSV import"
 */
function createReviewTodo(context) {
  try {
    const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos'").get();
    if (!tbl) return;

    const total = getTotalFlaggedCount();
    if (total === 0) return;

    const existing = db.prepare(
      "SELECT id FROM todos WHERE title=? AND status!='done' LIMIT 1"
    ).get(REVIEW_TODO_TITLE);

    const body = `${total} record(s) flagged for review. Go to Settings → Data Review to see what needs attention.\n\nLatest: ${context}`;

    if (existing) {
      db.prepare("UPDATE todos SET notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .run(body, existing.id);
    } else {
      db.prepare(`
        INSERT INTO todos (title, notes, category, priority, status, is_auto, due_date)
        VALUES (?, ?, 'System', 'high', 'open', 1, date('now', '+7 days'))
      `).run(REVIEW_TODO_TITLE, body);
    }
  } catch(e) {
    console.warn('needs-review: could not create todo', e.message);
  }
}

/**
 * checkAndCompleteTodo — auto-complete the review todo if no flagged records remain
 * Call this on todos page load.
 */
function checkAndCompleteTodo() {
  try {
    const total = getTotalFlaggedCount();
    if (total > 0) return;

    const existing = db.prepare(
      "SELECT id FROM todos WHERE title=? AND status!='done' LIMIT 1"
    ).get(REVIEW_TODO_TITLE);

    if (existing) {
      db.prepare("UPDATE todos SET status='done', updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .run(existing.id);
    }
  } catch(e) {
    console.warn('needs-review: could not complete todo', e.message);
  }
}

/**
 * getTotalFlaggedCount — count all needs_review=1 across all tables
 * @returns {number}
 */
function getTotalFlaggedCount() {
  let total = 0;
  for (const { table } of REVIEW_TABLES) {
    try {
      const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE needs_review=1`).get();
      total += row?.n || 0;
    } catch { /* table may not have column yet */ }
  }
  return total;
}

/**
 * getReviewSummary — get per-module flagged counts + sample records
 * Used by the Settings Data Review dashboard
 * @returns {Array<{table, label, count, samples}>}
 */
function getReviewSummary() {
  const summary = [];
  for (const { table, nameCol, label } of REVIEW_TABLES) {
    try {
      const count = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE needs_review=1`).get()?.n || 0;
      if (count === 0) continue;
      const samples = db.prepare(`
        SELECT id, ${nameCol} AS name, review_reason, review_flagged_at
        FROM ${table} WHERE needs_review=1 ORDER BY review_flagged_at DESC LIMIT 5
      `).all();
      summary.push({ table, label, count, samples });
    } catch { /* skip if column missing */ }
  }
  return summary;
}

/**
 * clearReview — clear needs_review flag on a specific record (called on save/PUT)
 * @param {string} table
 * @param {number} id
 */
function clearReview(table, id) {
  try {
    db.prepare(`UPDATE ${table} SET needs_review=0, review_flagged_at=NULL, review_reason=NULL WHERE id=?`).run(id);
  } catch { /* column may not exist yet */ }
}

module.exports = {
  flagRecords,
  flagRecordsWhere,
  createReviewTodo,
  checkAndCompleteTodo,
  getTotalFlaggedCount,
  getReviewSummary,
  clearReview,
  REVIEW_TABLES,
};
