// @ts-nocheck
'use strict';
/**
 * features/career/routes.js
 *
 * Four sub-domains:
 *   Certifications — professional certs with expiry tracking.
 *                    On POST, if expiry_date is set, a renewal Todo is
 *                    auto-created 60 days before expiry.
 *   Jobs           — employment history. Only one can be is_current=1;
 *                    setting a new current job clears the previous flag.
 *   Skills         — competency catalogue with proficiency level.
 *   Goals          — short/long-term career objectives with progress tracking.
 *
 * Dropdowns backed by dropdown_options:
 *   career_job_type, career_goal_category, career_skill_category
 *
 * Tags:
 *   career_cert → entity_type='career_cert'
 *   career_job  → entity_type='career_job'
 *   career_skill → entity_type='career_skill'
 *
 * Routes are split across two sub-routers:
 *   pub  — reads, mounted without auth
 *   auth — writes, mounted with requireAuth
 * Both are combined onto the main router at the bottom.
 *
 * Public routes:   All GETs
 * Auth-required:   All writes
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth } = require('../auth/middleware');
const { badRequest, notFound, serverError } = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');
const { saveTagsByName, getTagNames, withTagNames, clearTags } = require('../../shared/tags');
const { saveFamilyMembers, getFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');
const { router: learningRouter, certPreset, addCycleEnd } = require('./learning');



// Public GETs, auth writes
const pub = express.Router();
const auth = express.Router();
auth.use(requireAuth);

// ══════════════════════════════════════════════════════════════
// CERTIFICATIONS
// ══════════════════════════════════════════════════════════════

pub.get('/certifications', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.*,
        (SELECT COALESCE(SUM(lc.hours_applied), 0)
         FROM career_learning_certs lc
         JOIN career_learning l ON l.id = lc.learning_id
         WHERE lc.certification_id = c.id
           AND (c.current_cycle_start IS NULL OR l.start_date >= c.current_cycle_start)
           AND (c.current_cycle_end   IS NULL OR l.start_date <= c.current_cycle_end)
        ) AS pdu_applied_this_cycle,
        (SELECT COUNT(*)
         FROM career_learning_certs lc
         WHERE lc.certification_id = c.id) AS learning_count,
        (SELECT COUNT(*) FROM attachments WHERE entity_type='career_cert' AND entity_id=c.id) AS attachment_count
      FROM career_certifications c ORDER BY
        CASE status WHEN 'Active' THEN 0 WHEN 'In Progress' THEN 1 ELSE 2 END,
        expiry_date ASC NULLS LAST
    `).all();
    res.json(rows.map(r => withTagNames(r, 'career_cert')));
  } catch (e) { serverError(res, e); }
});

auth.post('/certifications', (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const r = db.prepare(`
      INSERT INTO career_certifications
        (name, issuing_body, credential_id, cert_number, issue_date, expiry_date, status,
         ce_hours_required, renewal_period_months, current_cycle_start, notes, renewal_fee)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.name,
      d.issuing_body || certPreset(d.name)?.issuing_body || null,
      d.credential_id || null,
      d.cert_number || null,
      d.issue_date || null,
      d.expiry_date || null,
      d.status || 'Active',
      d.ce_hours_required != null ? parseFloat(d.ce_hours_required) : (certPreset(d.name)?.ce_hours_required ?? null),
      d.renewal_period_months != null ? parseInt(d.renewal_period_months) : (certPreset(d.name)?.renewal_period_months ?? null),
      d.current_cycle_start || d.issue_date || null,
      d.notes || null,
      d.renewal_fee != null ? parseFloat(d.renewal_fee) : null
    );

    // Auto-create renewal Todo 60 days before expiry
    let todoId = null;
    if (d.expiry_date) {
      todoId = createRenewalTodo(r.lastInsertRowid, d.name, d.expiry_date);
      if (todoId) db.prepare('UPDATE career_certifications SET todo_id=? WHERE id=?').run(todoId, r.lastInsertRowid);
    }
    if (d.tags) saveTagsByName(r.lastInsertRowid, 'career_cert', d.tags);
    res.status(201).json({ id: r.lastInsertRowid, todo_id: todoId });
  } catch (e) { serverError(res, e); }
});

auth.put('/certifications/:id', (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM career_certifications WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Certification');
    db.prepare(`
      UPDATE career_certifications SET
        name=?, issuing_body=?, credential_id=?, cert_number=?,
        issue_date=?, expiry_date=?, status=?,
        ce_hours_required=?, renewal_period_months=?,
        current_cycle_start=?, notes=?, renewal_fee=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.name ?? existing.name,
      d.issuing_body ?? existing.issuing_body,
      d.credential_id ?? existing.credential_id,
      d.cert_number ?? existing.cert_number,
      d.issue_date ?? existing.issue_date,
      d.expiry_date ?? existing.expiry_date,
      d.status ?? existing.status,
      d.ce_hours_required != null ? parseFloat(d.ce_hours_required) : existing.ce_hours_required,
      d.renewal_period_months != null ? parseInt(d.renewal_period_months) : existing.renewal_period_months,
      d.current_cycle_start ?? existing.current_cycle_start,
      d.notes ?? existing.notes,
      d.renewal_fee != null ? parseFloat(d.renewal_fee) : existing.renewal_fee,
      req.params.id
    );
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'career_cert', d.tags);
    clearReview('career_certifications', req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

auth.delete('/certifications/:id', (req, res) => {
  try {
    // Nullify cert link on any training records — never delete training
    db.prepare('UPDATE career_learning_certs SET certification_id=NULL WHERE certification_id=?').run(req.params.id);
    clearTags(req.params.id, 'career_cert');
    db.prepare('DELETE FROM career_certifications WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

function createRenewalTodo(certId, name, expiryDate) {
  try {
    const tbl = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='todos'").get();
    if (!tbl) return null;
    const exp = new Date(expiryDate);
    const due = new Date(exp.getTime() - 60 * 24 * 60 * 60 * 1000);
    const r = db.prepare(`
      INSERT INTO todos (title, notes, due_date, priority, status)
      VALUES (?,?,?,'high','open')
    `).run(
      `Certification renewal: ${name}`,
      `${name} expires on ${expiryDate}. Cert ID: ${certId}`,
      due.toISOString().slice(0,10)
    );
    return r.lastInsertRowid;
  } catch (e) { return null; }
}

// ══════════════════════════════════════════════════════════════
// JOBS
// ══════════════════════════════════════════════════════════════

pub.get('/jobs', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT j.*,
        (SELECT COUNT(*) FROM attachments WHERE entity_type='career_job' AND entity_id=j.id) AS attachment_count
      FROM career_jobs j ORDER BY is_current DESC, start_date DESC
    `).all();
    res.json(rows.map(r => withFamilyMembers(withTagNames(r, 'career_job'), 'career_job')));
  } catch (e) { serverError(res, e); }
});

auth.post('/jobs', (req, res) => {
  try {
    const d = req.body;
    if (!d.company || !d.title) return badRequest(res, 'company and title required');
    if (d.is_current) db.prepare('UPDATE career_jobs SET is_current=0').run();
    const r = db.prepare(`
      INSERT INTO career_jobs (company, title, employment_type, start_date, end_date, location, description, is_current, company_contact_id)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(d.company, d.title, d.employment_type||'Full-time',
           d.start_date||null, d.end_date||null,
           d.location||null, d.description||null, d.is_current?1:0,
           d.company_contact_id||null);
    if (d.tags) saveTagsByName(r.lastInsertRowid, 'career_job', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(r.lastInsertRowid, 'career_job', d.family_member_ids);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

auth.put('/jobs/:id', (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM career_jobs WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Job');
    if (d.is_current) db.prepare('UPDATE career_jobs SET is_current=0 WHERE id!=?').run(req.params.id);
    db.prepare(`
      UPDATE career_jobs SET company=?, title=?, employment_type=?, start_date=?, end_date=?,
        location=?, description=?, is_current=?, company_contact_id=? WHERE id=?
    `).run(d.company||existing.company, d.title||existing.title,
           d.employment_type||existing.employment_type,
           d.start_date||null, d.end_date||null, d.location||null, d.description||null,
           d.is_current?1:0, d.company_contact_id||null, req.params.id);
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'career_job', d.tags);
    if (d.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'career_job', d.family_member_ids);
    clearReview('career_jobs', req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

auth.delete('/jobs/:id', (req, res) => {
  try {
    clearFamilyMembers(req.params.id, 'career_job');
    clearTags(req.params.id, 'career_job');
    db.prepare('DELETE FROM career_jobs WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// SKILLS
// ══════════════════════════════════════════════════════════════

pub.get('/skills', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM career_skills ORDER BY category, name').all();
    res.json(rows.map(r => withTagNames(r, 'career_skill')));
  } catch (e) { serverError(res, e); }
});

auth.post('/skills', (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name required');
    const r = db.prepare(`
      INSERT INTO career_skills (name, category, proficiency, years_experience, last_used_year, notes)
      VALUES (?,?,?,?,?,?)
    `).run(d.name, d.category||null, d.proficiency||'Intermediate',
           d.years_experience||null, d.last_used_year||null, d.notes||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

auth.put('/skills/:id', (req, res) => {
  try {
    const d = req.body;
    const existing = db.prepare('SELECT * FROM career_skills WHERE id=?').get(req.params.id);
    if (!existing) return notFound(res, 'Skill');
    db.prepare(`
      UPDATE career_skills SET name=?, category=?, proficiency=?, years_experience=?, last_used_year=?, notes=? WHERE id=?
    `).run(d.name||existing.name, d.category||null, d.proficiency||existing.proficiency,
           d.years_experience||null, d.last_used_year||null, d.notes||null, req.params.id);
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'career_skill', d.tags);
    clearReview('career_skills', req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

auth.delete('/skills/:id', (req, res) => {
  try {
    clearTags(req.params.id, 'career_skill');
    db.prepare('DELETE FROM career_skills WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// LEARNING & DEVELOPMENT  (replaces education — see learning.js)
// Mounted at /career/learning/* via learningRouter below
// ══════════════════════════════════════════════════════════════

// ── POST /certifications/:id/link-training ───────────────────
// Body: [{ learning_id, hours_applied, ce_category }]
// Adds links from the cert side — used by Option A multi-select modal.
// Existing links for the same learning_id are replaced (upsert).
auth.post('/certifications/:id/link-training', (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    if (!db.prepare('SELECT 1 FROM career_certifications WHERE id=?').get(certId))
      return notFound(res, 'Certification');
    const links = Array.isArray(req.body) ? req.body : [];
    const upsert = db.prepare(`
      INSERT INTO career_learning_certs (learning_id, certification_id, hours_applied, ce_category)
      VALUES (?,?,?,?)
      ON CONFLICT(learning_id, certification_id) DO UPDATE SET
        hours_applied=excluded.hours_applied,
        ce_category=excluded.ce_category
    `);
    const txn = db.transaction(() => {
      for (const lk of links) {
        if (!lk.learning_id) continue;
        upsert.run(
          parseInt(lk.learning_id), certId,
          lk.hours_applied != null ? parseFloat(lk.hours_applied) : null,
          lk.ce_category || null
        );
      }
    });
    txn();
    res.json({ ok: true, linked: links.length });
  } catch(e) { serverError(res, e); }
});

// ── POST /certifications/:id/renew — advance to next cycle ───
auth.post('/certifications/:id/renew', (req, res) => {
  try {
    const cert = db.prepare('SELECT * FROM career_certifications WHERE id=?').get(req.params.id);
    if (!cert) return notFound(res, 'Certification');
    if (!cert.renewal_period_months) return badRequest(res, 'Renewal period (months) not set on this cert');
    if (!cert.current_cycle_start)   return badRequest(res, 'Current cycle start not set on this cert');

    // Validate: hours applied this cycle must meet requirement
    if (cert.ce_hours_required > 0) {
      const cycleEnd = cert.current_cycle_end;
      const applied = db.prepare(`
        SELECT COALESCE(SUM(lc.hours_applied), 0) AS total
        FROM career_learning_certs lc
        JOIN career_learning l ON l.id = lc.learning_id
        WHERE lc.certification_id = ?
          AND l.start_date >= ?
          ${cycleEnd ? 'AND l.start_date <= ?' : ''}
      `).get(...[cert.id, cert.current_cycle_start, ...(cycleEnd ? [cycleEnd] : [])])?.total || 0;

      if (applied < cert.ce_hours_required) {
        return res.status(400).json({
          error: `Not enough CE hours: ${applied} applied, ${cert.ce_hours_required} required (${cert.ce_hours_required - applied} still needed)`
        });
      }
    }

    // Validate: renewal fee must be provided in request body
    const fee = req.body?.renewal_fee;
    if (fee == null || isNaN(parseFloat(fee))) {
      return badRequest(res, 'Renewal fee is required to complete the cycle renewal');
    }

    const newStart = cert.current_cycle_end
      ? (() => { const d = new Date(cert.current_cycle_end + 'T00:00:00'); d.setDate(d.getDate()+1); return d.toISOString().slice(0,10); })()
      : new Date().toISOString().slice(0,10);

    db.prepare('UPDATE career_certifications SET current_cycle_start=?, renewal_fee=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(newStart, parseFloat(fee), cert.id);
    const updated = db.prepare('SELECT * FROM career_certifications WHERE id=?').get(cert.id);
    res.json(addCycleEnd(updated));
  } catch(e) { serverError(res, e); }
});

// ── GET /certifications/preset?name=PMP ─────────────────────
pub.get('/certifications/preset', (req, res) => {
  res.json(certPreset(req.query.name || '') || {});
});

// ── CSV Exports ───────────────────────────────────────────────
function escCsv(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvResp(res, rows, headers, filename) {
  const lines = rows.map(r => headers.map(h => escCsv(r[h])).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send([headers.join(','), ...lines].join('\n'));
}

pub.get('/certifications/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT id,name,issuing_body,credential_id,issue_date,expiry_date,status,notes FROM career_certifications ORDER BY status,name').all();
    csvResp(res, rows, ['id','name','issuing_body','credential_id','issue_date','expiry_date','status','notes'], 'certifications.csv');
  } catch(e) { serverError(res, e); }
});

pub.get('/jobs/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT id,company,title,employment_type,start_date,end_date,location,is_current,description FROM career_jobs ORDER BY start_date DESC').all();
    csvResp(res, rows, ['id','company','title','employment_type','start_date','end_date','location','is_current','description'], 'jobs.csv');
  } catch(e) { serverError(res, e); }
});

pub.get('/skills/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT id,name,category,proficiency,notes FROM career_skills ORDER BY category,name').all();
    csvResp(res, rows, ['id','name','category','proficiency','notes'], 'skills.csv');
  } catch(e) { serverError(res, e); }
});

pub.get('/goals/export/csv', (req, res) => {
  try {
    const rows = db.prepare('SELECT id,title,category,status,target_date,notes FROM career_goals ORDER BY status,target_date').all();
    csvResp(res, rows, ['id','title','category','status','target_date','notes'], 'career_goals.csv');
  } catch(e) { serverError(res, e); }
});

router.use('/', pub);
router.use('/', auth);
// Mount learning sub-router
router.use('/learning', learningRouter);

module.exports = router;

// ── Career Goals ─────────────────────────────────────────────
pub.get('/goals', (req, res) => {
  try {
    const rows = db.prepare(
      "SELECT * FROM career_goals ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'achieved' THEN 1 ELSE 2 END, target_date ASC"
    ).all();
    res.json(rows);
  } catch(e) { serverError(res, e); }
});

auth.post('/goals', (req, res) => {
  try {
    const d = req.body;
    if (!d.title?.trim()) return badRequest(res, 'title required');
    const r = db.prepare(`
      INSERT INTO career_goals (title, category, target_date, status, notes)
      VALUES (?,?,?,?,?)
    `).run(d.title.trim(), d.category||'General', d.target_date||null,
           d.status||'active', d.notes||null);
    if (d.family_member_ids !== undefined) saveFamilyMembers(r.lastInsertRowid, 'career_goal', d.family_member_ids);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch(e) { serverError(res, e); }
});

auth.put('/goals/:id', (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE career_goals SET title=?, category=?, target_date=?, status=?, notes=?,
        updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(d.title, d.category||'General', d.target_date||null,
           d.status||'active', d.notes||null, req.params.id);
    if (d.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'career_goal', d.family_member_ids);
    clearReview('career_goals', req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

auth.delete('/goals/:id', (req, res) => {
  try {
    clearFamilyMembers(req.params.id, 'career_goal');
    db.prepare('DELETE FROM career_goals WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});
