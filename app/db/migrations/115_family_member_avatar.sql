-- Migration 115: family_members avatar support
-- Adds optional reference to an attachment row that stores the member's avatar photo.
-- When set, GH_AVATAR.render() displays the photo; otherwise falls back to colored initials.
-- No FK constraint (per project rule: ON DELETE CASCADE never used) — UI handles missing.

ALTER TABLE family_members ADD COLUMN avatar_attachment_id INTEGER;
