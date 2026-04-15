// @ts-check
'use strict';
/**
 * features/family-snapshot/routes.js
 * Per-family-member summary report.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError, notFound } = require('../../shared/errors');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function getSnapshotData(memberId) {
  const member = db.prepare('SELECT * FROM family_members WHERE id=?').get(memberId);
  if (!member) return null;

  const medications = db.prepare(
    "SELECT id,name,dosage,frequency,status FROM med_medications WHERE family_member_id=? OR patient=? ORDER BY status,name"
  ).all(memberId, member.display_name);

  const conditions = db.prepare(
    "SELECT id,condition_name,status FROM med_conditions WHERE family_member_id=? OR patient=? ORDER BY condition_name"
  ).all(memberId, member.display_name);

  const visits = db.prepare(
    "SELECT v.id,v.visit_date,v.questions,c.name as physician FROM med_visit_notes v LEFT JOIN contacts c ON c.id=v.contact_id WHERE v.family_member_id=? ORDER BY v.visit_date DESC LIMIT 10"
  ).all(memberId);

  const todos = db.prepare(
    "SELECT id,title,status,due_date,priority FROM todos WHERE family_member_id=? AND status NOT IN ('done','dismissed') ORDER BY priority,due_date LIMIT 10"
  ).all(memberId);

  const hsa = db.prepare(
    "SELECT id,date,category,provider,you_paid FROM hsa_payments WHERE family_member_id=? ORDER BY date DESC LIMIT 10"
  ).all(memberId);

  const kids = db.prepare(
    "SELECT k.id,k.display_name,k.grade,k.allergies FROM kids k JOIN record_family_members rfm ON rfm.entity_type='kid' AND rfm.entity_id=k.id AND rfm.family_member_id=? WHERE k.is_active=1"
  ).all(memberId);

  return { member, medications, conditions, visits, todos, hsa, kids };
}

// GET /api/v1/family-snapshot/:id — JSON
router.get('/:id', (req, res) => {
  try {
    const data = getSnapshotData(req.params.id);
    if (!data) return notFound(res, 'Family member');
    res.json(data);
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/family-snapshot/:id/html — printable
router.get('/:id/html', (req, res) => {
  try {
    const data = getSnapshotData(req.params.id);
    if (!data) return notFound(res, 'Family member');
    const m = data.member;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(m.display_name)} — Snapshot</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#0f172a}
h1{font-size:22px;border-bottom:2px solid #3b82f6;padding-bottom:10px;margin-bottom:20px}
h2{font-size:15px;font-weight:700;color:#475569;margin:20px 0 8px;text-transform:uppercase;letter-spacing:.04em}
.row{padding:6px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;font-size:13px}
.lbl{color:#64748b;min-width:100px}.val{color:#0f172a;font-weight:500}
.badge{padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:#dbeafe;color:#1e40af}
@media print{body{padding:0}}</style>
</head><body>
<h1>👤 ${esc(m.display_name)}</h1>
<div class="row"><span class="lbl">Relationship</span><span class="val">${esc(m.relationship||'—')}</span></div>
<div class="row"><span class="lbl">Date of Birth</span><span class="val">${esc(m.date_of_birth||'—')}</span></div>
${m.emergency_notes ? `<div class="row"><span class="lbl">Notes</span><span class="val">${esc(m.emergency_notes)}</span></div>` : ''}

${data.medications.length ? `<h2>💊 Medications</h2>${data.medications.map(x=>`<div class="row"><span class="val">${esc(x.name)}</span><span class="lbl">${esc(x.dosage||'')} ${esc(x.frequency||'')}</span><span class="badge">${esc(x.status)}</span></div>`).join('')}` : ''}
${data.conditions.length ? `<h2>🩺 Conditions</h2>${data.conditions.map(x=>`<div class="row"><span class="val">${esc(x.condition_name)}</span><span class="badge">${esc(x.status)}</span></div>`).join('')}` : ''}
${data.todos.length ? `<h2>✓ Open Todos</h2>${data.todos.map(x=>`<div class="row"><span class="val">${esc(x.title)}</span>${x.due_date?`<span class="lbl">${x.due_date}</span>`:''}</div>`).join('')}` : ''}
${data.hsa.length ? `<h2>❤️ Recent HSA</h2>${data.hsa.slice(0,5).map(x=>`<div class="row"><span class="val">${esc(x.provider||x.category)}</span><span class="lbl">${x.date}</span><span style="font-weight:600">$${Number(x.you_paid||0).toFixed(2)}</span></div>`).join('')}` : ''}

<div style="margin-top:24px;text-align:center;font-size:11px;color:#94a3b8">Ghrava · Generated ${new Date().toLocaleString()}</div>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { serverError(res, e); }
});

module.exports = router;
