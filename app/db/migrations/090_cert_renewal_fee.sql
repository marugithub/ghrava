-- 090_cert_renewal_fee.sql
-- Add renewal_fee field to career_certifications.
-- Stores the typical cost to renew this certification.
-- Required before the Renew Cycle action can proceed.

ALTER TABLE career_certifications ADD COLUMN renewal_fee REAL;
