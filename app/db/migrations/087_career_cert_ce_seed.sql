-- Migration 087: Seed CE hours and cycle data for existing certifications
-- Also remove CASCADE from career_learning_certs so training survives cert deletion

-- PMP: 60 PDUs / 36 months
UPDATE career_certifications SET
  ce_hours_required = 60, renewal_period_months = 36,
  current_cycle_start = '2025-04-23', issuing_body = 'PMI'
WHERE id = 14;

-- FAC-PPM Entry Level: 40 hrs / 24 months (VA = DAU)
UPDATE career_certifications SET
  ce_hours_required = 40, renewal_period_months = 24,
  current_cycle_start = '2026-05-01', issuing_body = 'DAU'
WHERE id = 15;

-- FAC-PPM Mid Level: 40 hrs / 24 months
UPDATE career_certifications SET
  ce_hours_required = 40, renewal_period_months = 24,
  current_cycle_start = '2026-05-01', issuing_body = 'DAU'
WHERE id = 16;

-- CSM: no CE hours required, 2yr renewal
UPDATE career_certifications SET
  ce_hours_required = 0, renewal_period_months = 24,
  current_cycle_start = '2025-06-01', issuing_body = 'Scrum Alliance'
WHERE id = 17;

-- ITIL Foundation: no renewal requirement
UPDATE career_certifications SET
  ce_hours_required = 0, renewal_period_months = NULL,
  issuing_body = 'PeopleCert'
WHERE id = 18;

-- Security+: 50 CE hrs / 36 months
UPDATE career_certifications SET
  ce_hours_required = 50, renewal_period_months = 36,
  current_cycle_start = '2024-07-15', issuing_body = 'CompTIA'
WHERE id = 19;
