-- Migration 050: maintenance completion tracking
-- Adds ability to mark a maintenance record as completed and log the actual completion date.
-- A record with next_due_date but no completed_date = scheduled/overdue.
-- A record with completed_date = done, triggers no more overdue alerts.

ALTER TABLE property_maintenance ADD COLUMN is_completed  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE property_maintenance ADD COLUMN completed_date DATE;

CREATE INDEX IF NOT EXISTS idx_prop_maint_completed ON property_maintenance(is_completed, next_due_date);
