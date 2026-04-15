// @ts-check
'use strict';
const db = require('../db/db');

function getLinksForDocument(documentId) {
  return db.prepare(`
    SELECT dil.id, dil.item_id, i.name, i.brand, i.category
    FROM document_item_links dil
    JOIN items i ON i.id = dil.item_id
    WHERE dil.document_id = ?
    ORDER BY i.name
  `).all(documentId);
}

function getLinksForItem(itemId) {
  return db.prepare(`
    SELECT dil.id, dil.document_id, d.title, d.category, d.expiry_date
    FROM document_item_links dil
    JOIN documents d ON d.id = dil.document_id AND d.is_active = 1
    WHERE dil.item_id = ?
    ORDER BY d.title
  `).all(itemId);
}

function addLink(documentId, itemId) {
  return db.prepare(`
    INSERT OR IGNORE INTO document_item_links (document_id, item_id) VALUES (?,?)
  `).run(documentId, itemId);
}

function removeLink(documentId, itemId) {
  db.prepare('DELETE FROM document_item_links WHERE document_id=? AND item_id=?').run(documentId, itemId);
}

function removeAllForDocument(documentId) {
  db.prepare('DELETE FROM document_item_links WHERE document_id=?').run(documentId);
}

function removeAllForItem(itemId) {
  db.prepare('DELETE FROM document_item_links WHERE item_id=?').run(itemId);
}

module.exports = { getLinksForDocument, getLinksForItem, addLink, removeLink, removeAllForDocument, removeAllForItem };
