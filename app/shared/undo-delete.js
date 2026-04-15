// @ts-check
'use strict';
/**
 * shared/undo-delete.js
 * Record soft deletions and support restoration.
 */
const db = require('../db/db');

function recordDeletion(entityType, entityId, entityName, rowData = null) {
  try {
    // Keep last 100 per type
    db.prepare(`
      DELETE FROM deleted_items WHERE entity_type = ? AND id NOT IN (
        SELECT id FROM deleted_items WHERE entity_type = ? ORDER BY deleted_at DESC LIMIT 100
      )
    `).run(entityType, entityType);
    db.prepare(`
      INSERT INTO deleted_items (entity_type, entity_id, entity_name, deleted_data)
      VALUES (?, ?, ?, ?)
    `).run(entityType, entityId, entityName, rowData ? JSON.stringify(rowData) : null);
  } catch(e) {
    console.error('[undo-delete] Failed to record:', e.message);
  }
}

function getDeletedItems(entityType = null, limit = 50) {
  let sql = `SELECT * FROM deleted_items WHERE deleted_at > datetime('now', '-30 days')`;
  const params = [];
  if (entityType) { sql += ' AND entity_type = ?'; params.push(entityType); }
  sql += ' ORDER BY deleted_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function restoreItem(deletionId) {
  const deleted = db.prepare('SELECT * FROM deleted_items WHERE id = ?').get(deletionId);
  if (!deleted) return { success: false, error: 'Item not found' };
  const data = deleted.deleted_data ? JSON.parse(deleted.deleted_data) : null;
  try {
    switch(deleted.entity_type) {
      case 'document':
        db.prepare('UPDATE documents SET is_active = 1 WHERE id = ?').run(deleted.entity_id);
        break;
      case 'todo':
        db.prepare("UPDATE todos SET status = 'open', completed_at = NULL WHERE id = ?").run(deleted.entity_id);
        break;
      case 'item':
        db.prepare('UPDATE items SET is_archived = 0, archived_at = NULL WHERE id = ?').run(deleted.entity_id);
        break;
      case 'book':
        db.prepare('UPDATE books SET is_active = 1 WHERE id = ?').run(deleted.entity_id);
        break;
      default:
        return { success: false, error: `Cannot restore ${deleted.entity_type}` };
    }
    db.prepare('DELETE FROM deleted_items WHERE id = ?').run(deletionId);
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

module.exports = { recordDeletion, getDeletedItems, restoreItem };
