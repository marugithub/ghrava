// @ts-check
'use strict';
/**
 * shared/familyMembers.js — Family member association utilities
 *
 * Links any record to one or more family members via the
 * record_family_members junction table.
 *
 * Usage pattern in a route file:
 *   const { saveFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');
 *
 *   // On GET: attach family members to each record
 *   res.json(records.map(r => withFamilyMembers(r, 'book')));
 *
 *   // On POST/PUT: save family members from request body
 *   if (body.family_member_ids) saveFamilyMembers(newId, 'book', body.family_member_ids);
 *
 *   // On DELETE: clean up before deleting
 *   clearFamilyMembers(id, 'book');
 *
 * Rules:
 *   - Never write raw record_family_members SQL in route files — use these helpers
 *   - IDs are integers — invalid/missing IDs are silently skipped
 *   - Duplicate associations are silently ignored (UNIQUE index)
 */

const db = require('../db/db');

// ── Prepared statements ───────────────────────────────────────
const stmt = {
  detachAll: db.prepare('DELETE FROM record_family_members WHERE entity_type=? AND entity_id=?'),
  attach:    db.prepare('INSERT OR IGNORE INTO record_family_members (entity_type, entity_id, family_member_id) VALUES (?,?,?)'),
  getAll:    db.prepare(`
    SELECT fm.id, fm.display_name, fm.relationship
    FROM family_members fm
    JOIN record_family_members rfm ON fm.id = rfm.family_member_id
    WHERE rfm.entity_type = ? AND rfm.entity_id = ?
    ORDER BY fm.is_primary_user DESC, fm.display_name
  `),
  clearByMember: db.prepare('DELETE FROM record_family_members WHERE family_member_id=?'),
};

/**
 * saveFamilyMembers — replace all family member links for an entity.
 * Deletes existing associations first, then re-creates from the id list.
 * Safe to call with an empty array (clears all associations).
 *
 * @param {number}   entityId
 * @param {string}   entityType
 * @param {number[]} ids  — array of family_member IDs
 */
function saveFamilyMembers(entityId, entityType, ids) {
  const list = Array.isArray(ids) ? ids.map(Number).filter(Boolean) : [];
  stmt.detachAll.run(entityType, entityId);
  for (const id of list) {
    stmt.attach.run(entityType, entityId, id);
  }
}

/**
 * getFamilyMembers — return family member objects for an entity.
 * Returns [] if no associations exist.
 *
 * @param {number} entityId
 * @param {string} entityType
 * @returns {{ id, display_name, relationship }[]}
 */
function getFamilyMembers(entityId, entityType) {
  return /** @type {import('./types').FamilyMember[]} */ (/** @type {any} */ (stmt.getAll.all(entityType, entityId)));
}

/**
 * withFamilyMembers — attach a `family_members` array to a plain DB record.
 * Used to enrich GET responses without altering the original record.
 *
 * @param {object} record    — DB row (must have .id)
 * @param {string} entityType
 * @returns {object}         — record with family_members: [] added
 */
function withFamilyMembers(record, entityType) {
  if (!record) return null;
  return { ...record, family_members: getFamilyMembers(record.id, entityType) };
}

/**
 * clearFamilyMembers — remove all family member links for an entity.
 * Call before deleting or archiving a record.
 *
 * @param {number} entityId
 * @param {string} entityType
 */
function clearFamilyMembers(entityId, entityType) {
  stmt.detachAll.run(entityType, entityId);
}

module.exports = { saveFamilyMembers, getFamilyMembers, withFamilyMembers, clearFamilyMembers };
