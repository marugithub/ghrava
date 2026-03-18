-- 039_needs_review.sql
-- Adds needs_review tracking to all user-data tables.
-- Used when: migrations change field meaning, CSV imports have mismatches,
--            or required fields are restructured.
--
-- needs_review      = 1 means this record needs user attention
-- review_flagged_at = when it was flagged
-- review_reason     = why it was flagged (e.g. "CSV import: category not matched")
--
-- Clearing: set needs_review=0 on any PUT/save — handled in each route.

ALTER TABLE items               ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE items               ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE items               ADD COLUMN review_reason     TEXT;

ALTER TABLE documents           ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE documents           ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE documents           ADD COLUMN review_reason     TEXT;

ALTER TABLE books               ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE books               ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE books               ADD COLUMN review_reason     TEXT;

ALTER TABLE kids                ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE kids                ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE kids                ADD COLUMN review_reason     TEXT;

ALTER TABLE kid_activities      ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE kid_activities      ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE kid_activities      ADD COLUMN review_reason     TEXT;

ALTER TABLE kid_notes           ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE kid_notes           ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE kid_notes           ADD COLUMN review_reason     TEXT;

ALTER TABLE career_certifications ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE career_certifications ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE career_certifications ADD COLUMN review_reason     TEXT;

ALTER TABLE career_jobs         ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE career_jobs         ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE career_jobs         ADD COLUMN review_reason     TEXT;

ALTER TABLE career_skills       ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE career_skills       ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE career_skills       ADD COLUMN review_reason     TEXT;

ALTER TABLE career_education    ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE career_education    ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE career_education    ADD COLUMN review_reason     TEXT;

ALTER TABLE career_goals        ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE career_goals        ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE career_goals        ADD COLUMN review_reason     TEXT;

ALTER TABLE properties          ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE properties          ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE properties          ADD COLUMN review_reason     TEXT;

ALTER TABLE vehicles            ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE vehicles            ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE vehicles            ADD COLUMN review_reason     TEXT;

ALTER TABLE med_visit_notes     ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE med_visit_notes     ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE med_visit_notes     ADD COLUMN review_reason     TEXT;

ALTER TABLE med_conditions      ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE med_conditions      ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE med_conditions      ADD COLUMN review_reason     TEXT;

ALTER TABLE med_medications     ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE med_medications     ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE med_medications     ADD COLUMN review_reason     TEXT;

ALTER TABLE daily_log           ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE daily_log           ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE daily_log           ADD COLUMN review_reason     TEXT;

ALTER TABLE todos               ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE todos               ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE todos               ADD COLUMN review_reason     TEXT;

ALTER TABLE resources           ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE resources           ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE resources           ADD COLUMN review_reason     TEXT;

ALTER TABLE contacts            ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE contacts            ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE contacts            ADD COLUMN review_reason     TEXT;

ALTER TABLE family_members      ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE family_members      ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE family_members      ADD COLUMN review_reason     TEXT;

ALTER TABLE hsa_payments        ADD COLUMN needs_review      INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE hsa_payments        ADD COLUMN review_flagged_at DATETIME;
ALTER TABLE hsa_payments        ADD COLUMN review_reason     TEXT;
