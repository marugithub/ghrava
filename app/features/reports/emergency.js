// @ts-check
'use strict';
/**
 * features/reports/emergency.js
 * Emergency information report — printable card with critical household info.
 * GET /api/v1/reports/emergency        → JSON
 * GET /api/v1/reports/emergency/html   → printable HTML
 * GET /api/v1/reports/emergency/text   → plain text (copy/share)
 */

const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError } = require('../../shared/errors');

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getEmergencyData() {
  // Config
  const configRows = db.prepare(`SELECT key, value FROM app_config WHERE key LIKE 'emergency_%'`).all();
  const config = {};
  configRows.forEach(r => { config[r.key] = r.value; });

  // Emergency contacts — sorted: Medical first, then Emergency, then others
  const contacts = db.prepare(`
    SELECT id, name, contact_type, phone_primary, phone_secondary,
           email, address_street, address_city, address_state, specialty, notes
    FROM contacts
    WHERE is_emergency_contact = 1
    ORDER BY
      CASE contact_type WHEN 'Medical' THEN 1 WHEN 'Emergency' THEN 2 ELSE 3 END,
      name
  `).all();

  // Family members
  const family = db.prepare(`
    SELECT id, display_name, relationship, date_of_birth,
           full_legal_name, ssn_last4, emergency_notes
    FROM family_members
    ORDER BY is_primary_user DESC, display_name
  `).all();

  // Active medications with pharmacy info
  const medications = db.prepare(`
    SELECT m.id, m.name, m.dosage, m.frequency, m.patient,
           m.purpose, m.rx_number, m.pharmacy_contact_id,
           c.name AS pharmacy_name, c.phone_primary AS pharmacy_phone
    FROM med_medications m
    LEFT JOIN contacts c ON c.id = m.pharmacy_contact_id
    WHERE m.status = 'Active'
    ORDER BY m.patient, m.name
  `).all();

  // Active/chronic conditions
  const conditions = db.prepare(`
    SELECT id, condition_name, patient, status, treatment_notes
    FROM med_conditions
    WHERE status IN ('Active', 'Chronic')
    ORDER BY patient, condition_name
  `).all();

  // Allergies from kids profiles
  const kidAllergies = db.prepare(`
    SELECT k.display_name AS patient, k.allergies
    FROM kids k
    WHERE k.allergies IS NOT NULL AND k.allergies != '' AND k.is_active = 1
  `).all();

  // Allergies from family emergency notes
  const familyAllergies = db.prepare(`
    SELECT display_name AS patient, emergency_notes AS allergies
    FROM family_members
    WHERE emergency_notes IS NOT NULL AND LOWER(emergency_notes) LIKE '%allerg%'
  `).all();

  const allergies = [...kidAllergies, ...familyAllergies];

  // Insurance (current year)
  const insurance = db.prepare(`
    SELECT plan_year, plan_name, insurance_carrier,
           plan_effective_date, individual_deductible, family_deductible,
           individual_oop_max, family_oop_max
    FROM hsa_plan_info
    WHERE plan_year = CAST(strftime('%Y', 'now') AS INTEGER)
    ORDER BY plan_year DESC LIMIT 1
  `).get();

  // Primary physician (emergency-flagged Medical contact, or first Medical)
  const primaryPhysician = db.prepare(`
    SELECT id, name, phone_primary, address_street, address_city, address_state, specialty
    FROM contacts
    WHERE contact_type = 'Medical'
    ORDER BY is_emergency_contact DESC, name
    LIMIT 1
  `).get();

  return {
    generated_at: new Date().toISOString(),
    config,
    emergency_contacts: contacts,
    family_members: family,
    medications,
    conditions,
    allergies,
    insurance: insurance || null,
    primary_physician: primaryPhysician || null,
  };
}

// ── JSON endpoint ─────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    res.json(getEmergencyData());
  } catch(e) { serverError(res, e); }
});

// ── Plain text endpoint ───────────────────────────────────────
router.get('/text', (req, res) => {
  try {
    const d = getEmergencyData();
    let text = `EMERGENCY INFORMATION — ${new Date(d.generated_at).toLocaleString()}\n`;
    text += `${'='.repeat(50)}\n\n`;

    text += `EMERGENCY CONTACTS:\n`;
    if (d.emergency_contacts.length) {
      d.emergency_contacts.forEach(c => {
        text += `  ${c.name} (${c.contact_type}${c.specialty ? ' · ' + c.specialty : ''})\n`;
        if (c.phone_primary)   text += `    Phone: ${c.phone_primary}\n`;
        if (c.phone_secondary) text += `    Alt: ${c.phone_secondary}\n`;
        if (c.email)           text += `    Email: ${c.email}\n`;
      });
    } else { text += `  None marked — go to Settings → Contacts\n`; }

    text += `\nFAMILY MEMBERS:\n`;
    d.family_members.forEach(m => {
      text += `  ${m.display_name}${m.relationship ? ' (' + m.relationship + ')' : ''}`;
      if (m.date_of_birth) text += ` · DOB: ${m.date_of_birth}`;
      text += `\n`;
      if (m.emergency_notes) text += `    ${m.emergency_notes}\n`;
    });

    if (d.medications.length) {
      text += `\nACTIVE MEDICATIONS:\n`;
      d.medications.forEach(m => {
        text += `  ${m.name} — ${m.patient}`;
        if (m.dosage) text += ` · ${m.dosage}`;
        if (m.frequency) text += ` · ${m.frequency}`;
        text += `\n`;
        if (m.pharmacy_name) text += `    Pharmacy: ${m.pharmacy_name}${m.pharmacy_phone ? ' ' + m.pharmacy_phone : ''}\n`;
      });
    }

    if (d.conditions.length) {
      text += `\nMEDICAL CONDITIONS:\n`;
      d.conditions.forEach(c => {
        text += `  ${c.condition_name} — ${c.patient} (${c.status})\n`;
      });
    }

    if (d.allergies.length) {
      text += `\nALLERGIES:\n`;
      d.allergies.forEach(a => { text += `  ${a.patient}: ${a.allergies}\n`; });
    }

    if (d.insurance) {
      text += `\nINSURANCE:\n`;
      text += `  ${d.insurance.insurance_carrier} — ${d.insurance.plan_name || ''}\n`;
    }
    if (d.primary_physician) {
      text += `\nPRIMARY PHYSICIAN: ${d.primary_physician.name} · ${d.primary_physician.phone_primary || ''}\n`;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch(e) { serverError(res, e); }
});

// ── Printable HTML endpoint ───────────────────────────────────
router.get('/html', (req, res) => {
  try {
    const d = getEmergencyData();
    const showDob = d.config.emergency_show_dob !== '0';
    const showSsn = d.config.emergency_show_ssn === '1';
    const showIns = d.config.emergency_include_insurance !== '0';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Emergency Info — Ghrava</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;background:#f8fafc;color:#0f172a;line-height:1.5;padding:20px}
.card{max-width:800px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,.08);padding:24px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:16px;border-bottom:2px solid #ef4444}
.header h1{font-size:22px;font-weight:700;color:#ef4444;display:flex;align-items:center;gap:8px}
.generated{font-size:11px;color:#64748b}
.section{margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0}
.section-title{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:10px}
.contact-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.contact-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px}
.contact-name{font-weight:700;color:#1e293b}
.contact-type{font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:.4px}
.contact-phone{font-size:15px;font-weight:600;color:#2563eb;margin:4px 0 2px}
.contact-detail{font-size:12px;color:#64748b}
.row{display:flex;align-items:baseline;padding:6px 0;border-bottom:1px solid #f1f5f9}
.row:last-child{border-bottom:none}
.row-label{font-weight:600;min-width:110px;font-size:13px}
.row-detail{font-size:13px;color:#475569}
.badge{display:inline-block;background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;margin:2px}
.badge-red{background:#fee2e2;color:#dc2626}
.print-hint{background:#dbeafe;border:1px solid #bfdbfe;border-radius:8px;padding:10px 14px;margin-bottom:16px;color:#1e40af;font-size:12px;display:flex;align-items:center;gap:8px}
.warn{background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:8px 12px;font-size:12px;color:#b45309}
.footer{margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8}
@media print{body{background:#fff;padding:0}.card{box-shadow:none;padding:0}.print-hint{display:none}}
</style>
</head>
<body>
<div class="card">
  <div class="print-hint">🖨️ Print this card and keep it on the fridge, in your wallet, or in your car.</div>
  <div class="header">
    <h1>🚨 Emergency Information</h1>
    <span style="font-size:11px;background:#ef4444;color:#fff;padding:3px 10px;border-radius:99px;font-weight:600">ICE</span>
  </div>
  <div class="generated">Generated: ${new Date(d.generated_at).toLocaleString('en-US',{dateStyle:'full',timeStyle:'short'})}</div>

  <div class="section">
    <div class="section-title">📞 Emergency Contacts</div>
    ${d.emergency_contacts.length ? `
    <div class="contact-grid">
      ${d.emergency_contacts.map(c => `
        <div class="contact-card">
          <div class="contact-name">${esc(c.name)}</div>
          <div class="contact-type">${esc(c.contact_type)}${c.specialty ? ' · ' + esc(c.specialty) : ''}</div>
          ${c.phone_primary   ? `<div class="contact-phone">${esc(c.phone_primary)}</div>` : ''}
          ${c.phone_secondary ? `<div class="contact-detail">Alt: ${esc(c.phone_secondary)}</div>` : ''}
          ${c.email           ? `<div class="contact-detail">✉ ${esc(c.email)}</div>` : ''}
        </div>`).join('')}
    </div>` : `<div class="warn">No emergency contacts marked. Add them in Settings → Contacts.</div>`}
  </div>

  <div class="section">
    <div class="section-title">👨‍👩‍👧‍👦 Family Members</div>
    ${d.family_members.map(m => `
      <div class="row">
        <span class="row-label">${esc(m.display_name)}</span>
        <span class="row-detail">
          ${m.relationship ? esc(m.relationship) : ''}
          ${showDob && m.date_of_birth ? ' · DOB: ' + esc(m.date_of_birth) : ''}
          ${showSsn && m.ssn_last4 ? ' · SSN: XXX-XX-' + esc(m.ssn_last4) : ''}
          ${m.emergency_notes ? '<div style="margin-top:3px;font-size:12px">' + esc(m.emergency_notes) + '</div>' : ''}
        </span>
      </div>`).join('')}
  </div>

  ${d.medications.length ? `
  <div class="section">
    <div class="section-title">💊 Active Medications</div>
    ${d.medications.map(m => `
      <div class="row">
        <span class="row-label">${esc(m.name)}</span>
        <span class="row-detail">
          <span style="color:#ef4444;font-size:11px;text-transform:uppercase">${esc(m.patient)}</span>
          ${m.dosage ? ' · ' + esc(m.dosage) : ''}
          ${m.frequency ? ' · ' + esc(m.frequency) : ''}
          ${m.rx_number ? '<div style="font-size:11px">Rx: ' + esc(m.rx_number) + '</div>' : ''}
          ${m.pharmacy_name ? '<div style="font-size:11px">💊 ' + esc(m.pharmacy_name) + (m.pharmacy_phone ? ' · ' + esc(m.pharmacy_phone) : '') + '</div>' : ''}
        </span>
      </div>`).join('')}
  </div>` : ''}

  ${d.conditions.length ? `
  <div class="section">
    <div class="section-title">🩺 Medical Conditions</div>
    ${d.conditions.map(c => `
      <div class="row">
        <span class="row-label">${esc(c.condition_name)}</span>
        <span class="row-detail">
          <span style="color:#ef4444;font-size:11px;text-transform:uppercase">${esc(c.patient)}</span>
          · ${esc(c.status)}
          ${c.treatment_notes ? '<div style="font-size:11px">' + esc(c.treatment_notes) + '</div>' : ''}
        </span>
      </div>`).join('')}
  </div>` : ''}

  ${d.allergies.length ? `
  <div class="section">
    <div class="section-title">⚠️ Allergies</div>
    <div>${d.allergies.map(a => `<span class="badge badge-red">${esc(a.patient)}: ${esc(a.allergies)}</span>`).join('')}</div>
  </div>` : ''}

  ${showIns && (d.insurance || d.primary_physician) ? `
  <div class="section">
    <div class="section-title">🏥 Insurance & Physician</div>
    ${d.insurance ? `
    <div class="row">
      <span class="row-label">Insurance</span>
      <span class="row-detail">${esc(d.insurance.insurance_carrier)} — ${esc(d.insurance.plan_name || '')}</span>
    </div>` : ''}
    ${d.primary_physician ? `
    <div class="row">
      <span class="row-label">Primary MD</span>
      <span class="row-detail">
        ${esc(d.primary_physician.name)}${d.primary_physician.phone_primary ? ' · ' + esc(d.primary_physician.phone_primary) : ''}
        ${d.primary_physician.specialty ? ' · ' + esc(d.primary_physician.specialty) : ''}
      </span>
    </div>` : ''}
  </div>` : ''}

  <div class="footer">Ghrava · Emergency Info Card · For emergency use only</div>
</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { serverError(res, e); }
});

module.exports = router;
