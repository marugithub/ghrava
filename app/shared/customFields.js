/**
 * shared/customFields.js
 * Custom field read/write used by all features.
 */
const db = require('../db/db');

function getFieldDefs(scopeModule, scopeCategory) {
  let sql = 'SELECT * FROM custom_field_defs WHERE 1=1';
  const params = [];
  if (scopeModule)   { sql += ' AND (scope_module IS NULL OR scope_module = ?)';     params.push(scopeModule); }
  if (scopeCategory) { sql += ' AND (scope_category IS NULL OR scope_category = ?)'; params.push(scopeCategory); }
  sql += ' ORDER BY sort_order, name';
  return db.prepare(sql).all(...params);
}

function getCustomFieldValues(entityType, entityId) {
  return db.prepare(`
    SELECT cfd.id, cfd.name, cfd.field_type, cfd.options, cfv.value
    FROM custom_field_defs cfd
    LEFT JOIN custom_field_values cfv
      ON cfd.id = cfv.field_def_id
      AND cfv.entity_type = ? AND cfv.entity_id = ?
    ORDER BY cfd.sort_order, cfd.name
  `).all(entityType, entityId);
}

function setCustomFieldValue(fieldDefId, entityType, entityId, value) {
  db.prepare(`
    INSERT INTO custom_field_values (field_def_id, entity_type, entity_id, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(field_def_id, entity_type, entity_id) DO UPDATE SET value = excluded.value
  `).run(fieldDefId, entityType, entityId, value);
}

function setCustomFieldValues(fields, entityType, entityId) {
  db.transaction(() => {
    for (const f of fields) setCustomFieldValue(f.field_def_id, entityType, entityId, f.value);
  })();
}

module.exports = { getFieldDefs, getCustomFieldValues, setCustomFieldValue, setCustomFieldValues };
