-- Migration 086: Originally added FK columns. Superseded by migration 102.
-- 102_repair_schema.js does idempotent ALTER TABLE for all of these columns,
-- so this file is now a no-op so the runner can mark it applied.
SELECT 1;
