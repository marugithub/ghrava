/**
 * shared/auditLog.js
 * Write audit events for any item mutation.
 * Called automatically by inventory routes — never call from frontend.
 *
 * Usage:
 *   const { logEvent } = require('../../shared/auditLog');
 *   logEvent(itemId, 'moved', { old_value: 'Garage', new_value: 'Living Room' });
 */
const db = require('../db/db');

function logEvent(itemId, eventType, options = {}) {
  const { field_changed, old_value, new_value, notes, created_by } = options;
  try {
    db.prepare(`
      INSERT INTO item_events
        (item_id, event_type, field_changed, old_value, new_value, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId,
      eventType,
      field_changed || null,
      old_value     !== undefined ? String(old_value) : null,
      new_value     !== undefined ? String(new_value) : null,
      notes         || null,
      created_by    || null
    );
  } catch (err) {
    // Audit log failures must never crash the main request
    console.error('audit log error:', err.message);
  }
}

function getEvents(itemId, limit = 50) {
  return db.prepare(`
    SELECT * FROM item_events
    WHERE item_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(itemId, limit);
}

module.exports = { logEvent, getEvents };
