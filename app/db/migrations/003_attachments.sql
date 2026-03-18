-- Migration 003: Replace attachment scaffolding with NAS-path-based system
-- Drops old Docker-upload-centric attachments table, creates new one.
-- NOTE: inventory routes.js is updated in this patch to use new table/columns.

PRAGMA foreign_keys = OFF;

-- Drop old table (was never exposed in UI — safe to replace)
DROP TABLE IF EXISTS attachments;

PRAGMA foreign_keys = ON;

-- ══════════════════════════════════════════════════════════════
-- NEW ATTACHMENTS TABLE
-- Stores references to files on the NAS (uploaded via app,
-- written to mounted volume /app/attachments/<module>/).
-- Works for all modules via entity_type + entity_id.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS attachments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Which record this belongs to
  entity_type      TEXT NOT NULL,   -- 'item' | 'hsa_payment' | 'hsa_otc' | 'med_visit' | etc.
  entity_id        INTEGER NOT NULL,
  module           TEXT NOT NULL,   -- 'inventory' | 'hsa' | 'medical' | 'finance' | 'estate'

  -- File identity
  label            TEXT,            -- 'Receipt', 'Manual', 'Warranty', 'Photo', user-typed
  original_filename TEXT NOT NULL,  -- original name from upload
  stored_filename  TEXT NOT NULL,   -- slugged name saved on NAS
  stored_path      TEXT NOT NULL,   -- /app/attachments/hsa/hsa_cvs_20260226_receipt.pdf
  unc_path         TEXT,            -- \\soninas\Backups\MyAppAttachments\hsa\... (Windows clickable)

  -- File metadata
  file_size        INTEGER,         -- bytes
  mime_type        TEXT,
  is_image         INTEGER DEFAULT 0,  -- 1 if image mime type
  is_primary_photo INTEGER DEFAULT 0,  -- 1 = primary/thumbnail for the record
  thumb_path       TEXT,            -- /app/attachments/inventory/thumbs/filename.jpg

  sort_order       INTEGER DEFAULT 0,
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_att_entity   ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_att_module   ON attachments(module);
CREATE INDEX IF NOT EXISTS idx_att_primary  ON attachments(entity_type, entity_id, is_primary_photo);
