-- Migration 063: Add review_category to all needs_review tables
-- Categories: data_quality | name_unmatched | partial_import | duplicate_risk | manual_review
-- Additive only. Existing review_reason values are preserved.

ALTER TABLE items              ADD COLUMN review_category TEXT;
ALTER TABLE documents          ADD COLUMN review_category TEXT;
ALTER TABLE books              ADD COLUMN review_category TEXT;
ALTER TABLE kids               ADD COLUMN review_category TEXT;
ALTER TABLE kid_activities     ADD COLUMN review_category TEXT;
ALTER TABLE kid_notes          ADD COLUMN review_category TEXT;
ALTER TABLE career_certifications ADD COLUMN review_category TEXT;
ALTER TABLE career_jobs        ADD COLUMN review_category TEXT;
ALTER TABLE career_skills      ADD COLUMN review_category TEXT;
ALTER TABLE career_education   ADD COLUMN review_category TEXT;
ALTER TABLE career_goals       ADD COLUMN review_category TEXT;
ALTER TABLE properties         ADD COLUMN review_category TEXT;
ALTER TABLE vehicles           ADD COLUMN review_category TEXT;
ALTER TABLE med_visit_notes    ADD COLUMN review_category TEXT;
ALTER TABLE med_conditions     ADD COLUMN review_category TEXT;
ALTER TABLE med_medications    ADD COLUMN review_category TEXT;
ALTER TABLE daily_log          ADD COLUMN review_category TEXT;
-- todos.review_category added by migration 043
ALTER TABLE resources          ADD COLUMN review_category TEXT;
ALTER TABLE contacts           ADD COLUMN review_category TEXT;
ALTER TABLE family_members     ADD COLUMN review_category TEXT;
ALTER TABLE hsa_payments       ADD COLUMN review_category TEXT;
