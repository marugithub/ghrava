// @ts-nocheck
'use strict';
/**
 * shared/namematch.js — Family member name resolver for imports  (S3)
 *
 * Used by any import that has a person/patient field.
 * Resolves a raw name string from an imported document to a family_member_id.
 *
 * Resolution rules:
 *   1. Exact match (case-insensitive)           → return id, confidence = 'exact'
 *   2. Single member shares same first letter   → return id, confidence = 'initial'
 *   3. Multiple first-letter matches            → return null, confidence = 'ambiguous'
 *   4. No match at all                          → return null, confidence = 'none'
 *
 * Returns: { id, display_name, confidence, candidates }
 *   id           — family_member_id or null
 *   display_name — matched name or null
 *   confidence   — 'exact' | 'initial' | 'ambiguous' | 'none'
 *   candidates   — array of { id, display_name } for 'ambiguous' case
 *
 * Usage:
 *   const { resolvePatient } = require('../../shared/namematch');
 *   const match = resolvePatient('Z. Smith');
 *   if (match.id) { ... } else { // flag for review }
 */

const db = require('../db/db');

/**
 * Get all active family members (cached per-request via module scope)
 * Safe to call repeatedly — SQLite is fast for this small table.
 */
function getMembers() {
  return db.prepare(
    'SELECT id, display_name FROM family_members ORDER BY is_primary_user DESC, display_name'
  ).all();
}

/**
 * resolvePatient(rawName) — main entry point
 * rawName: string from imported document (may be shortened, redacted, partial)
 */
function resolvePatient(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    return { id: null, display_name: null, confidence: 'none', candidates: [] };
  }

  const raw    = rawName.trim();
  const rawLow = raw.toLowerCase();
  const members = getMembers();

  // 1. Exact match (case-insensitive)
  const exact = members.find(m => m.display_name.toLowerCase() === rawLow);
  if (exact) {
    return { id: exact.id, display_name: exact.display_name, confidence: 'exact', candidates: [] };
  }

  // 2. Starts-with match — raw starts with same chars as a member name
  //    e.g. "Z" or "Z." or "Zar" matches "Zarna"
  const startsWith = members.filter(m =>
    m.display_name.toLowerCase().startsWith(rawLow.replace(/\.$/, ''))
  );
  if (startsWith.length === 1) {
    return { id: startsWith[0].id, display_name: startsWith[0].display_name, confidence: 'initial', candidates: [] };
  }
  if (startsWith.length > 1) {
    return { id: null, display_name: null, confidence: 'ambiguous', candidates: startsWith };
  }

  // 3. First-letter match — single member whose name starts with same letter
  const firstChar = raw[0].toLowerCase();
  const byInitial = members.filter(m => m.display_name.toLowerCase().startsWith(firstChar));
  if (byInitial.length === 1) {
    return { id: byInitial[0].id, display_name: byInitial[0].display_name, confidence: 'initial', candidates: [] };
  }
  if (byInitial.length > 1) {
    return { id: null, display_name: null, confidence: 'ambiguous', candidates: byInitial };
  }

  // 4. No match
  return { id: null, display_name: null, confidence: 'none', candidates: [] };
}

/**
 * resolveAndFlag(rawName, table, recordId)
 * Resolves name AND flags the record if not an exact match.
 * Returns the match result.
 */
function resolveAndFlag(rawName, table, recordId) {
  const match = resolvePatient(rawName);
  if (match.confidence !== 'exact' && recordId && table) {
    const { flagRecord } = require('./needs-review');
    let reason, category;
    if (match.confidence === 'initial') {
      reason   = `Patient name auto-matched by initial: "${rawName}" → "${match.display_name}"`;
      category = 'data_quality';
    } else if (match.confidence === 'ambiguous') {
      const names = match.candidates.map(c => c.display_name).join(', ');
      reason   = `Patient name ambiguous: "${rawName}" could be: ${names}`;
      category = 'name_unmatched';
    } else {
      reason   = `Patient name not matched: "${rawName}" — no family member found`;
      category = 'name_unmatched';
    }
    try { flagRecord(table, recordId, reason, category); } catch {}
  }
  return match;
}

/**
 * buildPromptSummary(matches)
 * After a batch import, returns a human-readable summary of unmatched/auto-matched names
 * to display in the post-import prompt.
 */
function buildPromptSummary(matches) {
  const issues = matches.filter(m => m.confidence !== 'exact');
  if (!issues.length) return null;

  const autoMatched = issues.filter(m => m.confidence === 'initial');
  const ambiguous   = issues.filter(m => m.confidence === 'ambiguous');
  const unmatched   = issues.filter(m => m.confidence === 'none');

  const lines = [];
  if (autoMatched.length) {
    lines.push(`${autoMatched.length} name(s) auto-matched by initial — verify in Data Quality review`);
  }
  if (ambiguous.length) {
    lines.push(`${ambiguous.length} name(s) ambiguous — flagged for manual review`);
  }
  if (unmatched.length) {
    lines.push(`${unmatched.length} name(s) not matched to any family member — flagged for review`);
  }
  return lines.join('\n');
}

module.exports = { resolvePatient, resolveAndFlag, buildPromptSummary };
