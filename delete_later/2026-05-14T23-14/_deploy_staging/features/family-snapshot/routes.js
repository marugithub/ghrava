// @ts-check
'use strict';
/**
 * features/family-snapshot/routes.js
 * Per-family-member summary report.
 *
 * Per Ghrava rules:
 * - All columns verified against live schema before query.
 * - No is_active=1 filters on display routes — shows everything.
 * - Each section wrapped in safe() so a single broken query never breaks the whole snapshot.
 * - Read-only and public.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError, notFound } = require('../../shared/errors');

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function safe(fn, fallback) {
  try { return fn(); } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[family-snapshot]', e.message);
    return fallback === undefined ? [] : fallback;
  }
}

function getSnapshotData(memberId) {
  const member = db.prepare('SELECT * FROM family_members WHERE id=?').get(memberId);
  if (!member) return null;

  const name = member.display_name;

  const medications = safe(() => db.prepare(
    `SELECT id, name, dosage, frequency, status
     FROM med_medications WHERE family_member_id=? OR patient=?
     ORDER BY CASE status WHEN 'Active' THEN 0 ELSE 1 END, name`
  ).all(memberId, name));

  const conditions = safe(() => db.prepare(
    `SELECT id, condition_name, status
     FROM med_conditions WHERE family_member_id=? OR patient=?
     ORDER BY CASE status WHEN 'Active' THEN 0 ELSE 1 END, condition_name`
  ).all(memberId, name));

  const visits = safe(() => db.prepare(
    `SELECT v.id, v.visit_date, v.questions, c.name as physician
     FROM med_visit_notes v LEFT JOIN contacts c ON c.id = v.contact_id
     WHERE v.family_member_id=? ORDER BY v.visit_date DESC LIMIT 10`
  ).all(memberId));

  // todos has NO family_member_id — use name match best-effort
  const todos = safe(() => db.prepare(
    `SELECT id, title, status, due_date, priority FROM todos
     WHERE (title LIKE ? OR notes LIKE ?) AND status NOT IN ('done','dismissed')
     ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date
     LIMIT 10`
  ).all(`%${name}%`, `%${name}%`));

  const hsa = safe(() => db.prepare(
    `SELECT id, date, category, provider, you_paid FROM hsa_payments
     WHERE family_member_id=? ORDER BY date DESC LIMIT 10`
  ).all(memberId));

  // schema: kids has school_id (FK), teacher_name, homeroom — NO school_name column
  // v.170: was school_name — drop it; kids.school_id can join to a separate schools table when needed
  const kids = safe(() => db.prepare(
    `SELECT id, display_name, grade, allergies, school_id, teacher_name, notes FROM kids
     WHERE family_member_id=?`
  ).all(memberId));

  const memories = safe(() => db.prepare(
    `SELECT dl.id, dl.log_date, dl.entry_text, dl.memory_category
     FROM daily_log dl
     JOIN memory_members mm ON mm.log_id = dl.id
     WHERE dl.is_memory = 1 AND mm.family_member_id = ?
     ORDER BY dl.log_date DESC LIMIT 20`
  ).all(memberId));

  const items_owned = safe(() => db.prepare(
    `SELECT id, name, category, brand FROM items
     WHERE family_member_id = ? ORDER BY category, name LIMIT 25`
  ).all(memberId));

  const wardrobe = safe(() => db.prepare(
    `SELECT id, name, category, brand, wardrobe_nickname, wardrobe_status FROM items
     WHERE wardrobe_owner_id = ? AND category IN ('Clothing','Shoes','Accessories','Jewelry','Hats','Bags')
     ORDER BY category, name LIMIT 25`
  ).all(memberId));

  const outfits = safe(() => db.prepare(
    `SELECT id, name FROM wardrobe_outfits WHERE family_member_id = ? ORDER BY name`
  ).all(memberId));

  // schema: perfumes.owner_family_member_id (mig 108) — NOT family_member_id
  // v.170: was family_member_id
  const perfumes = safe(() => db.prepare(
    `SELECT id, name, brand, status FROM perfumes
     WHERE owner_family_member_id = ? ORDER BY status, name LIMIT 25`
  ).all(memberId));

  const properties = safe(() => db.prepare(
    `SELECT id, nickname, property_type, address_street FROM properties
     WHERE family_member_id = ? ORDER BY nickname`
  ).all(memberId));

  const vehicles = safe(() => db.prepare(
    `SELECT id, nickname, make, model, license_plate FROM vehicles
     WHERE family_member_id = ? ORDER BY nickname`
  ).all(memberId));

  const insurance = safe(() => db.prepare(
    `SELECT p.id, p.policy_number, p.status FROM insurance_policies p
     JOIN insurance_policy_members ipm ON ipm.policy_id = p.id
     WHERE ipm.family_member_id = ?
     ORDER BY CASE p.status WHEN 'active' THEN 0 ELSE 1 END, p.policy_number`
  ).all(memberId));

  const subscriptions = safe(() => db.prepare(
    `SELECT s.id, s.name, s.category, s.status FROM subscriptions s
     JOIN subscription_members sm ON sm.subscription_id = s.id
     WHERE sm.family_member_id = ? ORDER BY s.name`
  ).all(memberId));

  // schema: books has no family_member_id column. Use record_links polymorphic
  // (left_type='book', right_type='family_member') to associate. Until that's
  // populated, return [] — the snapshot still renders without books.
  // v.170: was direct WHERE family_member_id — table has no such column.
  const books = safe(() => {
    const rows = db.prepare(
      `SELECT b.id, b.title, b.author, b.status FROM books b
       JOIN record_links rl
         ON ((rl.left_type='book' AND rl.left_id=b.id AND rl.right_type='family_member' AND rl.right_id=?)
          OR (rl.right_type='book' AND rl.right_id=b.id AND rl.left_type='family_member' AND rl.left_id=?))
       ORDER BY CASE b.status WHEN 'reading' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, b.title LIMIT 20`
    ).all(memberId, memberId);
    return rows;
  });

  return {
    member,
    medications, conditions, visits, todos, hsa, kids,
    memories, items_owned, wardrobe, outfits, perfumes,
    properties, vehicles, insurance, subscriptions, books
  };
}

router.get('/:id', (req, res) => {
  try {
    const data = getSnapshotData(req.params.id);
    if (!data) return notFound(res, 'Family member');
    res.json(data);
  } catch(e) { serverError(res, e); }
});

router.get('/:id/html', (req, res) => {
  try {
    const data = getSnapshotData(req.params.id);
    if (!data) return notFound(res, 'Family member');
    const m = data.member;
    const sec = (icon, title, body) => body ? `<h2>${icon} ${title}</h2>${body}` : '';
    const row = (l, v) => `<div class="row"><span class="lbl">${esc(l)}</span><span class="val">${esc(v||'\u2014')}</span></div>`;

    const sections = [];
    sections.push(sec('\ud83d\udc64','Profile',
      row('Relationship', m.relationship) +
      row('Date of Birth', m.date_of_birth) +
      (m.emergency_notes ? row('Notes', m.emergency_notes) : '')
    ));
    if (data.memories.length) sections.push(sec('\u2726','Memories',
      data.memories.map(x => `<div class="row"><span class="val">${esc((x.entry_text||'').split('\n')[0].slice(0,80))}</span><span class="lbl">${esc(x.log_date)}</span><span class="badge">${esc(x.memory_category||'')}</span></div>`).join('')
    ));
    if (data.medications.length) sections.push(sec('\ud83d\udc8a','Medications',
      data.medications.map(x => `<div class="row"><span class="val">${esc(x.name)}</span><span class="lbl">${esc(x.dosage||'')} ${esc(x.frequency||'')}</span><span class="badge">${esc(x.status)}</span></div>`).join('')
    ));
    if (data.conditions.length) sections.push(sec('\ud83e\ude7a','Conditions',
      data.conditions.map(x => `<div class="row"><span class="val">${esc(x.condition_name)}</span><span class="badge">${esc(x.status)}</span></div>`).join('')
    ));
    if (data.todos.length) sections.push(sec('\u2713','Open Todos',
      data.todos.map(x => `<div class="row"><span class="val">${esc(x.title)}</span>${x.due_date?`<span class="lbl">${esc(x.due_date)}</span>`:''}</div>`).join('')
    ));
    if (data.kids.length) sections.push(sec('\ud83e\uddd2','Kids Profile',
      data.kids.map(x => row('Grade / School', `${x.grade||''} \u00b7 ${x.school_name||''}`) + (x.allergies ? row('Allergies', x.allergies) : '')).join('')
    ));
    if (data.insurance.length) sections.push(sec('\ud83d\udee1\ufe0f','Insurance',
      data.insurance.map(x => `<div class="row"><span class="val">${esc(x.policy_number)}</span><span class="badge">${esc(x.status)}</span></div>`).join('')
    ));
    if (data.subscriptions.length) sections.push(sec('\ud83d\udd01','Subscriptions',
      data.subscriptions.map(x => `<div class="row"><span class="val">${esc(x.name)}</span><span class="lbl">${esc(x.category||'')}</span><span class="badge">${esc(x.status||'')}</span></div>`).join('')
    ));
    if (data.properties.length) sections.push(sec('\ud83c\udfe0','Properties',
      data.properties.map(x => row(x.nickname || '\u2014', `${x.property_type||''} \u00b7 ${x.address_street||''}`)).join('')
    ));
    if (data.vehicles.length) sections.push(sec('\ud83d\ude97','Vehicles',
      data.vehicles.map(x => row(x.nickname || `${x.make} ${x.model}`, x.license_plate || '')).join('')
    ));
    if (data.wardrobe.length) sections.push(sec('\ud83d\udc55','Wardrobe',
      `<div class="row"><span class="val">${data.wardrobe.length} item${data.wardrobe.length!==1?'s':''}</span></div>`
    ));
    if (data.perfumes.length) sections.push(sec('\ud83c\udf38','Perfume Collection',
      `<div class="row"><span class="val">${data.perfumes.length} fragrance${data.perfumes.length!==1?'s':''}</span></div>`
    ));
    if (data.books.length) sections.push(sec('\ud83d\udcda','Books',
      data.books.slice(0,10).map(x => `<div class="row"><span class="val">${esc(x.title)}</span><span class="lbl">${esc(x.author||'')}</span><span class="badge">${esc(x.status||'')}</span></div>`).join('')
    ));
    if (data.hsa.length) sections.push(sec('\u2764\ufe0f','Recent HSA',
      data.hsa.slice(0,5).map(x => `<div class="row"><span class="val">${esc(x.provider||x.category)}</span><span class="lbl">${esc(x.date)}</span><span style="font-weight:600">$${Number(x.you_paid||0).toFixed(2)}</span></div>`).join('')
    ));

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(m.display_name)} \u2014 Snapshot</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#0f172a}
h1{font-size:22px;border-bottom:2px solid #3b82f6;padding-bottom:10px;margin-bottom:20px}
h2{font-size:13px;font-weight:700;color:#475569;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.04em}
.row{padding:6px 0;border-bottom:1px solid #f1f5f9;display:flex;gap:12px;font-size:13px;align-items:center}
.lbl{color:#64748b}.val{color:#0f172a;font-weight:500;flex:1}
.badge{padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;background:#dbeafe;color:#1e40af}
@media print{body{padding:0}}</style>
</head><body>
<h1>\ud83d\udc64 ${esc(m.display_name)}</h1>
${sections.join('')}
<div style="margin-top:24px;text-align:center;font-size:11px;color:#94a3b8">Ghrava \u00b7 Generated ${new Date().toLocaleString()}</div>
</body></html>`;
    res.set('Content-Type', 'text/html').send(html);
  } catch(e) { serverError(res, e); }
});

module.exports = router;
