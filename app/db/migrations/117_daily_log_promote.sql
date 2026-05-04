-- Migration 117: daily_log promotion links (v202604.139)
--
-- A daily log entry can be "promoted" — its content is copied into a
-- target module (e.g., a kids note, medical visit, todo). The original
-- entry stays in the daily log unchanged; we just record where the
-- copy lives so the daily-log UI can show a link forward.
--
-- Edits to the target do NOT propagate back. Edits to the daily log
-- entry do NOT propagate forward. Two records, two sources of truth,
-- by design.
--
-- Columns are nullable. Existing rows get NULL.
ALTER TABLE daily_log ADD COLUMN promoted_to_type TEXT;
ALTER TABLE daily_log ADD COLUMN promoted_to_id   INTEGER;

CREATE INDEX IF NOT EXISTS idx_daily_log_promoted
  ON daily_log(promoted_to_type, promoted_to_id);
