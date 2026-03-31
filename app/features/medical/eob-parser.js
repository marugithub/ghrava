'use strict';
/**
 * MHBP EOB Parser — local only, no API calls.
 * Parses text extracted from pdf-parse and returns structured data.
 *
 * Handles all three variants:
 *   1. Single patient, single visit
 *   2. Single patient, multiple visits
 *   3. Multiple patients (multiple "Claim for X" blocks)
 *
 * Also handles combined PDFs (multiple statements merged into one file).
 * Split boundary: MHBP header ("MHBP\nPO BOX") appears at start of each statement.
 */

// ── Helpers ──────────────────────────────────────────────────
function $num(s) {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[$,]/g, '').trim());
  return isNaN(n) ? null : n;
}

function $date(s) {
  if (!s) return null;
  s = s.trim();
  // "August 10, 2025" → "2025-08-10"
  const long = s.match(/^(\w+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (long) {
    const months = { January:1,February:2,March:3,April:4,May:5,June:6,
                     July:7,August:8,September:9,October:10,November:11,December:12 };
    const m = months[long[1]];
    if (m) return `${long[3]}-${String(m).padStart(2,'0')}-${String(+long[2]).padStart(2,'0')}`;
  }
  // "8/15/25" or "8/15/2025" or "1/1/25"
  const short = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (short) {
    let yr = +short[3]; if (yr < 100) yr += 2000;
    return `${yr}-${String(+short[1]).padStart(2,'0')}-${String(+short[2]).padStart(2,'0')}`;
  }
  return null;
}

function first(text, ...patterns) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1]?.trim() || null;
  }
  return null;
}

// ── Split combined PDF into individual statement blocks ───────
function splitStatements(fullText) {
  // Each statement starts with the MHBP letterhead
  // Marker: "MHBP\n" followed shortly by "PO BOX"
  // Use this as a reliable boundary across all MHBP EOBs
  const parts = fullText.split(/(?=MHBP\s*\n\s*PO BOX)/i);
  return parts.map(p => p.trim()).filter(p => p.length > 200);
}

// ── Parse one statement block ─────────────────────────────────
function parseStatement(text, filename) {
  const stmt = {};

  // ── Header fields ─────────────────────────────────────────
  stmt.insurer      = 'MHBP';
  stmt.source_filename = filename || null;

  stmt.statement_date = $date(first(text,
    /Statement date:\s*([\w]+ \d{1,2},\s*\d{4})/i));

  stmt.member_name = first(text, /Member:\s*([A-Z][A-Z\s]+[A-Z])\b/);
  stmt.member_id   = first(text, /Member ID:\s*(\S+)/i);
  stmt.group_name  = first(text, /Group name:\s*(.+)/i)?.replace(/\s+/g,' ').trim();
  stmt.group_number = first(text, /Group #:\s*([^\n]+)/i)?.trim();

  // Plan name — appears near "Aetna HealthFund" at bottom of p1
  const planM = text.match(/Aetna HealthFund[®\s]*Aetna\s+(.+)/i);
  stmt.plan_name = planM ? ('Aetna HealthFund® Aetna ' + planM[1].trim()) : 'MHBP';

  // Period: "for 1/1/25 to 12/31/25"
  const perM = text.match(/for\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  stmt.period_start = perM ? $date(perM[1]) : null;
  stmt.period_end   = perM ? $date(perM[2]) : null;

  // ── Statement-level amounts ────────────────────────────────
  // Amount saved: "$67.06\n Amount you saved"
  const savedM = text.match(/\$([\d,.]+)\s+Amount you saved/i);
  stmt.amount_saved = savedM ? $num(savedM[1]) : null;

  // Key terms table: "Amount billed: ...description... $NNN"
  stmt.amount_billed = $num(first(text,
    /Amount billed:\s+The amount[^$]*\$([\d,.]+)/is,
    /Amount billed:\s*\$([\d,.]+)/i));

  stmt.allowed_amount = $num(first(text,
    /Member rate\/\s*\n?\s*Allowed amount:[^$]*\$([\d,.]+)/is,
    /Allowed amount:\s*\$([\d,.]+)/i));

  stmt.pending_not_payable = $num(first(text,
    /Pending or not payable:[^$]*\$([\d,.]+)/is));

  stmt.deductible_applied = $num(first(text,
    /Deductible:\s+A cost share[^$]*\$([\d,.]+)/is));

  // Copay total from key terms
  const copayM = text.match(/Copay:\s+The fixed cost[^$]*\$([\d,.]+)/is);
  stmt.copay_total = copayM ? $num(copayM[1]) : null;

  // HealthFund amount applied
  const hfAppliedM = text.match(/HealthFund:\s+A fund[^$]*\$([\d,.]+)/is);
  stmt.healthfund_applied = hfAppliedM ? $num(hfAppliedM[1]) : null;

  // Plan paid total (from payment summary "Total: $NNN")
  const totalM = text.match(/Total:\s+\$([\d,.]+)\s+\$([\d,.]+)/);
  stmt.plan_paid_total = totalM ? $num(totalM[1]) : null;
  stmt.your_share_total = totalM ? $num(totalM[2]) : null;

  // ── Deductible tracking ────────────────────────────────────
  stmt.deductible_annual    = $num(first(text, /Annual deductible\s+\$([\d,.]+)/i));
  stmt.deductible_used      = $num(first(text, /Deductible used\s*[-–]?\s*\$([\d,.]+)/i));
  stmt.deductible_remaining = $num(first(text, /Deductible remaining\s+\$([\d,.]+)/i));

  // Family OOP max (from balances section)
  const fOopM = text.match(/Family Balances[\s\S]*?Medical In Network Out of Pocket Maximum\s+\$([\d,.]+)\s+\$([\d,.]+)\s+\$([\d,.]+)/i);
  stmt.oop_max_annual  = fOopM ? $num(fOopM[1]) : null;
  stmt.oop_used        = fOopM ? $num(fOopM[2]) : null;
  stmt.oop_remaining   = fOopM ? $num(fOopM[3]) : null;

  // HealthFund balance
  const hfM = text.match(/Fund Benefit\s+\$([\d,.]+)\s+\$([\d,.]+)\s+\$([\d,.]+)/i);
  stmt.healthfund_total     = hfM ? $num(hfM[1]) : null;
  stmt.healthfund_used      = hfM ? $num(hfM[2]) : null;
  stmt.healthfund_remaining = hfM ? $num(hfM[3]) : null;

  // ── Claims ────────────────────────────────────────────────
  stmt.claims = parseClaims(text);

  // ── Benefit balances (YTD per person) ─────────────────────
  stmt.balances = parseBalances(text);

  return stmt;
}

// ── Parse all "Claim for X" blocks ───────────────────────────
function parseClaims(text) {
  const claims = [];
  // Each claim block starts with "Claim for [name]"
  const claimBlocks = [];
  const claimStart = /Claim for ([^\n]+)\n/gi;
  let m;
  const positions = [];
  while ((m = claimStart.exec(text)) !== null) {
    // Skip page footer references (short matches or near "Page N of")
    const context = text.slice(Math.max(0, m.index - 20), m.index + 5);
    if (!context.includes('\n\n') && m.index > 0) {
      // Check if this is near a page boundary
      const nearby = text.slice(m.index, m.index + 200);
      if (/Statement date:/i.test(nearby.slice(0, 30))) continue;
    }
    positions.push({ index: m.index, patient: m[1].trim() });
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end   = i < positions.length - 1 ? positions[i+1].index : text.length;
    claimBlocks.push({ patient: positions[i].patient, block: text.slice(start, end) });
  }

  for (const { patient, block } of claimBlocks) {
    const claim = parseClaimBlock(patient, block);
    if (claim) claims.push(claim);
  }

  return claims;
}

function parseClaimBlock(patient, block) {
  const claim = { patient };

  // Provider and network status: "Provider: Name (In-Network)"
  const provM = block.match(/Provider:\s*([^()\n]+?)\s*\((In-Network|Out-of-Network|In Network|Out of Network)\)/i);
  claim.provider      = provM ? provM[1].trim() : null;
  claim.network_status = provM ? provM[2].trim() : null;

  claim.claim_id      = first(block, /Claim ID:\s*(\S+)/i);
  claim.received_date = $date(first(block, /Received on\s+(\S+)/i));

  // Send date from totals row: "Totals: NNN NNN ... $NNN"
  // Payment summary line for this patient: "[patient] [provider] $amount [provider] M/D/YY $your"
  const sendM = block.match(/\d{1,2}\/\d{1,2}\/\d{2,4}\s+\$[\d,.]+\s*$/m);
  if (sendM) {
    const parts = sendM[0].trim().split(/\s+/);
    claim.send_date = $date(parts[0]);
    claim.your_share = $num(parts[parts.length - 1]);
  }

  // Totals row: "Totals: billed memberRate pending deduc copay remaining planShare coinsu yourShare"
  const totM = block.match(/Totals:\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+\$([\d,.]+)/);
  if (totM) {
    claim.amount_billed         = $num(totM[1]);
    claim.member_rate           = $num(totM[2]);
    claim.pending_not_payable   = $num(totM[3]);
    claim.applied_to_deductible = $num(totM[4]);
    claim.copay                 = $num(totM[5]);
    claim.plan_paid             = $num(totM[7]);
    claim.coinsurance           = $num(totM[8]);
    claim.your_share            = $num(totM[9]);
  }

  // Fund paid (appears after Totals for some claims)
  const fundM = block.match(/Fund Paid\s+\$([\d,.]+)/i);
  claim.fund_paid = fundM ? $num(fundM[1]) : null;

  // Service lines
  claim.services = parseServiceLines(block);

  // Validate: skip if no useful data
  if (!claim.claim_id && !claim.provider) return null;
  return claim;
}

// ── Parse CPT service lines within a claim block ──────────────
function parseServiceLines(block) {
  const services = [];
  // Pattern: description text + CPT_CODE on M/D/YY, then a line of numbers
  // CPT codes: 5 chars (digits or letter+digits), e.g. 99394, G0444, 96127
  const svcPattern = /([A-Z][A-Z0-9,\s/-]*?)([A-Z]?\d{4,5})\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s*\n([\d.,\s()%]+)/gi;
  let m;
  while ((m = svcPattern.exec(block)) !== null) {
    const desc    = m[1].trim().replace(/\s+/g, ' ');
    const code    = m[2].trim();
    const svcDate = $date(m[3]);
    const nums    = m[4].trim().split(/\s+/);
    // nums: billed  memberRate  [pending]  [ded]  [copay]  remaining  planShare(%)  [coins]  [yourShare]
    const amts = nums
      .map(n => n.replace(/\(.*?\)/g, '').replace(/[()%]/g, '').trim())
      .filter(n => /^[\d.,]+$/.test(n))
      .map(n => $num(n));

    if (desc && code && svcDate && amts.length >= 2) {
      services.push({
        service_description: desc,
        service_code: code,
        service_date: svcDate,
        amount_billed: amts[0] || null,
        member_rate:   amts[1] || null,
        plan_share:    amts.length >= 3 ? amts[amts.length - 2] : null,
        your_share:    amts.length >= 3 ? amts[amts.length - 1] : null,
      });
    }
  }
  return services;
}

// ── Parse benefit balance rows ────────────────────────────────
function parseBalances(text) {
  const balances = [];
  const balanceSection = text.match(/Your benefit balances[\s\S]+$/i)?.[0] || '';
  if (!balanceSection) return balances;

  // HealthFund
  const hfM = balanceSection.match(/Fund Benefit\s+\$([\d,.]+)\s+\$([\d,.]+)\s+\$([\d,.]+)/i);
  if (hfM) {
    balances.push({
      person: 'HealthFund', balance_type: 'Fund Benefit',
      annual_limit: $num(hfM[1]), amount_used: $num(hfM[2]), amount_remaining: $num(hfM[3])
    });
  }

  // Individual balances — find person headers then their balance rows
  const personPattern = /^([A-Z][a-z]+(?:\s+\([^)]+\))?)\s*$/gm;
  const balTypes = [
    'Medical In Network Deductible',
    'Medical In Network Out of Pocket Maximum',
    'Medical Out of Network Deductible',
    'Medical Out of Network Out of Pocket Maximum',
  ];

  let currentPerson = null;
  const lines = balanceSection.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Person header line (e.g. "Arnav (son)" or "Family Balances")
    if (/^[A-Z][a-zA-Z]+ (\([^)]+\))?$/.test(line) || line === 'Family Balances') {
      currentPerson = line === 'Family Balances' ? 'Family' : line;
      continue;
    }
    // Balance row
    for (const bt of balTypes) {
      if (line.startsWith(bt)) {
        const nums = line.slice(bt.length).match(/\$([\d,.]+)\s+\$([\d,.]+)\s+\$([\d,.]+)/);
        if (nums && currentPerson) {
          balances.push({
            person: currentPerson, balance_type: bt,
            annual_limit:    $num(nums[1]),
            amount_used:     $num(nums[2]),
            amount_remaining: $num(nums[3]),
          });
        }
        break;
      }
    }
  }

  return balances;
}

// ── Main export ───────────────────────────────────────────────
/**
 * Parse EOB PDF buffer (from multer memoryStorage).
 * Returns array of statement objects (one per detected EOB in the file).
 */
async function parseEobPdf(buffer, filename) {
  let pdfParse;
  try { pdfParse = require('pdf-parse'); }
  catch (e) { throw new Error('pdf-parse not installed. Run: docker compose up --build -d'); }

  const data = await pdfParse(buffer);
  const fullText = data.text;

  const statementBlocks = splitStatements(fullText);
  if (!statementBlocks.length) {
    // Fallback: treat entire text as one statement
    statementBlocks.push(fullText);
  }

  const results = [];
  for (const block of statementBlocks) {
    const stmt = parseStatement(block, filename);
    if (stmt.statement_date && stmt.member_id) {
      results.push(stmt);
    }
  }

  return results;
}

module.exports = { parseEobPdf };
