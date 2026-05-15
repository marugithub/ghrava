// 138_todos_google_columns_ensure.js
// v.170.1 — defensive: ensure todos has google_task_id and google_tasklist_id.
//
// Background: the Google Tasks sync code path in features/google/routes.js
// references todos.google_task_id and todos.google_tasklist_id, but those
// columns were never created by any migration on prod. The code path is
// currently dead (OAuth blocked on Tailscale HTTPS cert), so it doesn't
// crash today — but the moment OAuth comes back online and a sync runs,
// the INSERT/UPDATE will throw.
//
// This migration adds the columns idempotently. ALTER inside try/catch:
// no-op if columns already exist.
//
// schema: todos.{google_task_id TEXT, google_tasklist_id TEXT} — defensive

module.exports = function(db) {
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN google_task_id TEXT`);
  } catch (e) {
    // Column already exists, or table doesn't exist on this install
  }
  try {
    db.exec(`ALTER TABLE todos ADD COLUMN google_tasklist_id TEXT`);
  } catch (e) {
    // Column already exists, or table doesn't exist on this install
  }
};
