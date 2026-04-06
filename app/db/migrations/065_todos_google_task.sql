-- Migration 065: Add google_task_id to todos for two-way Google Tasks sync
ALTER TABLE todos ADD COLUMN google_task_id TEXT;
ALTER TABLE todos ADD COLUMN google_tasklist_id TEXT;
CREATE INDEX IF NOT EXISTS idx_todos_google_task ON todos(google_task_id) WHERE google_task_id IS NOT NULL;
