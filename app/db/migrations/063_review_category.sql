-- Migration 063: Add review_category to all needs_review tables
-- Categories: data_quality | name_unmatched | partial_import | duplicate_risk | manual_review
-- Additive only. Existing review_reason values are preserved.

ALTER TABLE career_education   ADD COLUMN review_category TEXT;
ALTER TABLE med_visit_notes    ADD COLUMN review_category TEXT;
-- todos.review_category added by migration 043
