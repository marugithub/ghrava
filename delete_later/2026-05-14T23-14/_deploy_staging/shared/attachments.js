/**
 * shared/attachments.js
 * File attachment logic used by all features.
 */
const db   = require('../db/db');
const fs   = require('fs');
const path = require('path');

const UPLOADS_BASE = process.env.UPLOADS_PATH || '/app/data/uploads';

function getAttachments(entityType, entityId) {
  return db.prepare(`
    SELECT * FROM attachments
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY is_primary_photo DESC, created_at DESC
  `).all(entityType, entityId);
}

function linkQnapFile(entityType, entityId, filePath, label, notes) {
  const fileName = path.basename(filePath);
  // schema: attachments.{entity_type, entity_id, module, original_filename, stored_path, stored_filename, label, notes}
  // v.170: was attachment_type/file_name/file_path — columns are module/original_filename/stored_path
  const result = db.prepare(`
    INSERT INTO attachments (entity_type, entity_id, module, original_filename, stored_filename, stored_path, label, notes)
    VALUES (?, ?, 'qnap_link', ?, ?, ?, ?, ?)
  `).run(entityType, entityId, fileName, fileName, filePath, label, notes);
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
}

function saveUploadedFile(entityType, entityId, file, label) {
  const destDir = path.join(UPLOADS_BASE, entityType, String(entityId));
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, file.originalname);
  fs.renameSync(file.path, destPath);
  // schema: attachments (see linkQnapFile)
  const result = db.prepare(`
    INSERT INTO attachments (entity_type, entity_id, module, original_filename, stored_filename, stored_path, file_size, mime_type, label)
    VALUES (?, ?, 'upload', ?, ?, ?, ?, ?, ?)
  `).run(entityType, entityId, file.originalname, file.originalname, destPath, file.size, file.mimetype, label);
  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
}

function deleteAttachment(attachmentId) {
  const a = db.prepare('SELECT * FROM attachments WHERE id = ?').get(attachmentId);
  if (!a) return false;
  // schema: attachments.module / .stored_path
  if (a.module === 'upload' && a.stored_path && fs.existsSync(a.stored_path)) fs.unlinkSync(a.stored_path);
  db.prepare('DELETE FROM attachments WHERE id = ?').run(attachmentId);
  return true;
}

function setPrimaryPhoto(attachmentId, entityType, entityId) {
  db.prepare('UPDATE attachments SET is_primary_photo = 0 WHERE entity_type = ? AND entity_id = ?').run(entityType, entityId);
  db.prepare('UPDATE attachments SET is_primary_photo = 1 WHERE id = ?').run(attachmentId);
}

module.exports = { getAttachments, linkQnapFile, saveUploadedFile, deleteAttachment, setPrimaryPhoto };
