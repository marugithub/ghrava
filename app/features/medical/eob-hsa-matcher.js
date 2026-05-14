// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// features/medical/eob-hsa-matcher.js — v202604.167  (linker #27.3)
//
// When an EOB claim/service is parsed, attempt to match it to an
// existing hsa_payment so the reimbursement loop closes automatically.
//
// HIGH-confidence (auto-link silently):
//   same patient (family_member_id required on both sides)
//   AND ABS(claim.your_share - hsa_payment.you_paid) <= 0.50
//   AND date difference <= 14 days
//   (provider match is a BONUS — boosts confidence but isn't required)
//
// MEDIUM-confidence (auto-link with needs_review=1):
//   same patient AND amount equals (±$0.50) AND date 14d < Δ <= 30d
//   OR patient + amount match within +/- $2 AND date <= 14d
//
// Otherwise: no link, no row.
// ─────────────────────────────────────────────────────────────────────

const db = require('../../db/db');
const { createLink } = require('../../shared/auto-link');

function daysBetween(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(new Date(a) - new Date(b)) / 86400000;
}

// Find candidate hsa_payments for a given EOB claim.
// hsa_payments columns: date, patient, provider, you_paid, family_member_id (mig 083)
// We search ±30 days from claim.service_date (or statement_date as fallback).
const findCandidatesStmt = db.prepare(`
  SELECT id, date AS payment_date, provider AS vendor, you_paid, family_member_id
  FROM hsa_payments
  WHERE family_member_id IS ?
    AND ABS(julianday(date) - julianday(?)) <= 30
    AND ABS(you_paid - ?) <= 2.00
  ORDER BY ABS(julianday(date) - julianday(?)) ASC
  LIMIT 10
`);

/**
 * Process one EOB claim row. Returns array of links created.
 */
function processEobClaim(claim) {
  if (!claim) return { skipped: true, reason: 'no claim' };
  const fmId = claim.family_member_id || null;
  const claimAmt = Number(claim.your_share || claim.your_share_total || 0);
  const claimDate = claim.service_date || claim.statement_date;
  if (!claimDate || claimAmt < 0.01) return { skipped: true, reason: 'no date or zero amount' };
  if (!fmId) return { skipped: true, reason: 'patient unknown — cannot match without family_member_id' };

  const candidates = findCandidatesStmt.all(fmId, claimDate, claimAmt, claimDate);
  if (candidates.length === 0) return { skipped: true, reason: 'no candidates' };

  const links = [];
  for (const c of candidates) {
    const amtDiff = Math.abs(c.you_paid - claimAmt);
    const dayDiff = daysBetween(c.payment_date, claimDate);

    let confidence = null;
    if (amtDiff <= 0.50 && dayDiff <= 14) {
      confidence = 'high';
    } else if ((amtDiff <= 0.50 && dayDiff <= 30) || (amtDiff <= 2.00 && dayDiff <= 14)) {
      confidence = 'medium';
    } else {
      continue;
    }

    createLink({
      leftType:  'eob',
      leftId:    claim.id,
      rightType: 'hsa_payment',
      rightId:   c.id,
      kind:      'auto_eob_hsa',
      confidence,
      source:    'eob-hsa-matcher',
      notes:     `EOB claim your_share=$${claimAmt} on ${claimDate} ↔ HSA payment $${c.you_paid} on ${c.payment_date} (Δ ${Math.round(dayDiff)}d, $${amtDiff.toFixed(2)})`,
    });

    links.push({ hsa_payment_id: c.id, confidence, day_diff: Math.round(dayDiff), amount_diff: Number(amtDiff.toFixed(2)) });

    // Only auto-link the BEST candidate per claim. Stop after first link.
    break;
  }

  return { linked: links.length > 0, links };
}

const allClaimsStmt = db.prepare(`SELECT * FROM med_eob_claims`);
const allHsaPaymentsStmt = db.prepare(`SELECT * FROM hsa_payments`);

/**
 * Backfill: run matcher across all existing claims + payments.
 * Used by /api/v1/medical/eob/run-matcher endpoint.
 */
function runFullBackfill() {
  const claims = allClaimsStmt.all();
  let claimsLinked = 0, claimsSkipped = 0;
  for (const c of claims) {
    const r = processEobClaim(c);
    if (r.linked) claimsLinked++; else claimsSkipped++;
  }
  return { claims_checked: claims.length, claims_linked: claimsLinked, claims_skipped: claimsSkipped };
}

module.exports = { processEobClaim, runFullBackfill };
