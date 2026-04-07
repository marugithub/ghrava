// @ts-check
/**
 * shared/tags.js — Central tag utilities for all feature modules
 *
 * Architecture:
 *   - Tags live in the `tags` table (id, name, color_hex)
 *   - Association to any entity uses `taggables` (tag_id, entity_type, entity_id)
 *   - entity_type is a canonical string per module — see WIRING.md for the full registry
 *
 * Usage pattern in a route file:
 *   const { saveTagsByName, getTagNames, withTagNames } = require('../../shared/tags');
 *
 *   // On GET: attach tag names to each record
 *   res.json(records.map(r => withTagNames(r, 'todo')));
 *
 *   // On POST/PUT: save tags from the request body
 *   if (body.tags) saveTagsByName(newId, 'todo', body.tags);
 *
 *   // On DELETE: clean up taggables before soft-deleting
 *   clearTags(id, 'todo');
 *
 * Rules:
 *   - Never write raw taggables SQL in feature route files — use these helpers
 *   - Tag names are stored lowercase and trimmed
 *   - Duplicate tag names are silently ignored (INSERT OR IGNORE)
 *   - Missing entity references are handled gracefully — no crash on empty input
 */

'use strict';
const db = require('../db/db');

// ── Tag colour defaults by module ─────────────────────────────
// Used when creating a new tag that doesn't yet exist.
// Keeps tag chips visually consistent with their source module.
const MODULE_COLORS = {
  item:                 'f59e0b',  // amber  — inventory
  daily_log:            '0ea5e9',  // sky    — daily log
  resource:             '64748b',  // slate  — resources
  document:             '6366f1',  // indigo — documents
  todo:                 'a78bfa',  // purple — todos
  book:                 '8b5cf6',  // violet — books
  career_cert:          'f97316',  // orange — career
  career_job:           'f97316',
  career_skill:         'f97316',
  kid_activity:         'ec4899',  // pink   — kids
  kid_note:             'ec4899',
  property:             'ef4444',  // red    — property
  vehicle:              'ef4444',
  medical_visit:        '14b8a6',  // teal   — medical
  medical_medication:   '14b8a6',
  finance_transaction:  '22c55e',  // green  — finance
  gift_card:            '22c55e',
};

// ── Prepared statements (created once, reused) ────────────────
// better-sqlite3 prepared statements are cached per connection.
// Defining them here avoids re-preparing on every request.
const stmt = {
  findTag:    db.prepare('SELECT id FROM tags WHERE name = ?'),
  createTag:  db.prepare("INSERT INTO tags (name, color_hex) VALUES (?, ?)"),
  attach:     db.prepare('INSERT OR IGNORE INTO taggables (tag_id, entity_type, entity_id) VALUES (?, ?, ?)'),
  detachAll:  db.prepare('DELETE FROM taggables WHERE entity_type = ? AND entity_id = ?'),
  getNames:   db.prepare(`
    SELECT t.name FROM tags t
    JOIN taggables tb ON t.id = tb.tag_id
    WHERE tb.entity_type = ? AND tb.entity_id = ?
    ORDER BY t.name
  `),
  getEntities: db.prepare(`
    SELECT tb.entity_type, tb.entity_id FROM taggables tb
    JOIN tags t ON t.id = tb.tag_id
    WHERE t.name = ? COLLATE NOCASE
  `),
};

/**
 * getOrCreate — find a tag by name or insert it if new.
 * Returns the tag's numeric id. Returns null for blank names.
 *
 * @param {string} name     — raw tag name (will be trimmed + lowercased)
 * @param {string} entityType — used to pick a default colour if creating
 * @returns {number|null}
 */
function getOrCreate(name, entityType) {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const existing = /** @type {any} */ (stmt.findTag.get(n));
  if (existing) return existing.id;
  const color = MODULE_COLORS[entityType] || '64748b';
  return /** @type {number} */ (Number(stmt.createTag.run(n, color).lastInsertRowid));
}

/**
 * saveTagsByName — replace all tags for an entity with a new set of names.
 * Deletes existing associations first, then re-creates from the name list.
 * Safe to call with an empty array (clears all tags).
 *
 * @param {number}   entityId
 * @param {string}   entityType  — canonical type string from WIRING.md
 * @param {string[]} names       — array of tag name strings
 */
function saveTagsByName(entityId, entityType, names) {
  const list = Array.isArray(names) ? names : [];
  stmt.detachAll.run(entityType, entityId);
  for (const name of list) {
    const tagId = getOrCreate(name, entityType);
    if (tagId) stmt.attach.run(tagId, entityType, entityId);
  }
}

/**
 * getTagNames — return an array of tag name strings for an entity.
 * Returns [] if the entity has no tags (never throws).
 *
 * @param {number} entityId
 * @param {string} entityType
 * @returns {string[]}
 */
function getTagNames(entityId, entityType) {
  return /** @type {any[]} */ (stmt.getNames.all(entityType, entityId)).map(/** @param {any} r */ r => r.name);
}

/**
 * withTagNames — attach a `tags` array to a plain DB record object.
 * Used to enrich GET responses without altering the original record.
 * Returns the record unchanged if entityId is falsy.
 *
 * @param {object} record      — DB row object (must have .id)
 * @param {string} entityType
 * @returns {object}           — record with tags: string[] added
 */
function withTagNames(record, entityType) {
  if (!record) return null;
  return { ...record, tags: getTagNames(record.id, entityType) };
}

/**
 * clearTags — remove all tag associations for an entity.
 * Call this before deleting or archiving a record.
 *
 * @param {number} entityId
 * @param {string} entityType
 */
function clearTags(entityId, entityType) {
  stmt.detachAll.run(entityType, entityId);
}

/**
 * getEntitiesByTag — find all entities tagged with a given name.
 * Used by the global tag search feature.
 * Returns array of { entity_type, entity_id }.
 *
 * @param {string} tagName
 * @returns {{ entity_type: string, entity_id: number }[]}
 */
function getEntitiesByTag(tagName) {
  return /** @type {{ entity_type: string, entity_id: number }[]} */ (/** @type {any} */ (stmt.getEntities.all(tagName)));
}

// ── Legacy exports (kept for any code using the old API) ──────
// These wrap the new functions so nothing breaks during migration.
function getTagsForEntity(entityType, entityId) {
  // Old API returned full tag objects; new code uses getTagNames for strings.
  // This shim returns objects with at least { name } for compatibility.
  return stmt.getNames.all(entityType, entityId);
}

function setTagsForEntity(tagIds, entityType, entityId) {
  // Old API took tag IDs not names. Still usable but prefer saveTagsByName.
  stmt.detachAll.run(entityType, entityId);
  for (const id of tagIds) {
    stmt.attach.run(id, entityType, entityId);
  }
}

module.exports = {
  // Primary API — use these in all new code
  saveTagsByName,
  getTagNames,
  withTagNames,
  clearTags,
  getEntitiesByTag,

  // Legacy API — kept for backward compatibility
  getTagsForEntity,
  setTagsForEntity,
};
