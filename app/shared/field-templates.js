// @ts-check
'use strict';
/**
 * shared/field-templates.js
 * Save and retrieve frequently used field values.
 */
const db = require('../db/db');

function getTemplates(entityType, fieldName) {
  return db.prepare(`
    SELECT id, template_name, template_value, usage_count
    FROM field_templates WHERE entity_type = ? AND field_name = ?
    ORDER BY usage_count DESC, template_name
  `).all(entityType, fieldName);
}

function saveTemplate(entityType, fieldName, value, name = null) {
  const existing = db.prepare(`SELECT id FROM field_templates WHERE entity_type=? AND field_name=? AND template_value=?`).get(entityType, fieldName, value);
  if (existing) {
    db.prepare(`UPDATE field_templates SET usage_count = usage_count + 1 WHERE id = ?`).run(existing.id);
    return existing.id;
  }
  return db.prepare(`INSERT INTO field_templates (entity_type,field_name,template_name,template_value,usage_count) VALUES (?,?,?,?,1)`)
    .run(entityType, fieldName, name || value, value).lastInsertRowid;
}

function recordUsage(templateId) {
  db.prepare(`UPDATE field_templates SET usage_count = usage_count + 1 WHERE id = ?`).run(templateId);
}

module.exports = { getTemplates, saveTemplate, recordUsage };
