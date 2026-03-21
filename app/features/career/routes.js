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
      SELECT * FROM career_certifications ORDER BY
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
      INSERT INTO career_certifications (name, issuing_body, credential_id, issue_date, expiry_date, status, notes)
      VALUES (?,?,?,?,?,?,?)
    `).run(d.name, d.issuing_body||null, d.credential_id||null,
           d.issue_date||null, d.expiry_date||null,
           d.status||'Active', d.notes||null);

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
        name=?, issuing_body=?, credential_id=?, issue_date=?, expiry_date=?, status=?, notes=?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(
      d.name||existing.name, d.issuing_body||null, d.credential_id||null,
      d.issue_date||null, d.expiry_date||null,
      d.status||existing.status, d.notes||null, req.params.id
    );
    if (d.tags !== undefined) saveTagsByName(req.params.id, 'career_cert', d.tags);
    clearReview('career_certifications', req.params.id);
    clearReview('career_education', req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

auth.delete('/certifications/:id', (req, res) => {
  try {
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
    const rows = db.prepare('SELECT * FROM career_jobs ORDER BY is_current DESC, start_date DESC').all();
    res.json(rows.map(r => withFamilyMembers(withTagNames(r, 'career_job'), 'career_job')));
  } catch (e) { serverError(res, e); }
});

auth.post('/jobs', (req, res) => {
  try {
    const d = req.body;
    if (!d.company || !d.title) return badRequest(res, 'company and title required');
    if (d.is_current) db.prepare('UPDATE career_jobs SET is_current=0').run();
    const r = db.prepare(`
      INSERT INTO career_jobs (company, title, employment_type, start_date, end_date, location, description, is_current)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(d.company, d.title, d.employment_type||'Full-time',
           d.start_date||null, d.end_date||null,
           d.location||null, d.description||null, d.is_current?1:0);
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
        location=?, description=?, is_current=? WHERE id=?
    `).run(d.company||existing.company, d.title||existing.title,
           d.employment_type||existing.employment_type,
           d.start_date||null, d.end_date||null, d.location||null, d.description||null,
           d.is_current?1:0, req.params.id);
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
// EDUCATION
// ══════════════════════════════════════════════════════════════

pub.get('/education', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM career_education ORDER BY end_year DESC NULLS FIRST').all();
    res.json(rows);
  } catch (e) { serverError(res, e); }
});

auth.post('/education', (req, res) => {
  try {
    const d = req.body;
    if (!d.institution) return badRequest(res, 'institution required');
    const r = db.prepare(`
      INSERT INTO career_education (institution, degree, field_of_study, start_year, end_year, gpa, notes)
      VALUES (?,?,?,?,?,?,?)
    `).run(d.institution, d.degree||null, d.field_of_study||null,
           d.start_year||null, d.end_year||null, d.gpa||null, d.notes||null);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) { serverError(res, e); }
});

auth.put('/education/:id', (req, res) => {
  try {
    const d = req.body;
    db.prepare(`
      UPDATE career_education SET institution=?, degree=?, field_of_study=?, start_year=?, end_year=?, gpa=?, notes=? WHERE id=?
    `).run(d.institution, d.degree||null, d.field_of_study||null,
           d.start_year||null, d.end_year||null, d.gpa||null, d.notes||null, req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

auth.delete('/education/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM career_education WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { serverError(res, e); }
});

router.use('/', pub);
router.use('/', auth);
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
