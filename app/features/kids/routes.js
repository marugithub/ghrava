// @ts-check
'use strict';
/**
 * features/kids/routes.js — Mounted at /api/v1/kids
 *
 * Tracks per-child profiles, weekly activities, and notes.
 * Data is structured as: Kid → Activities (weekly schedule)
 *                         Kid → Notes (dated log entries)
 *
 * Family members are stored in the settings/family table.
 * Tags on activities use entity_type = 'kid_activity'.
 * Tags on notes      use entity_type = 'kid_note'.
 * Kid profiles themselves are not tagged (no useful cross-module tag use case).
 *
 * Dropdowns backed by dropdown_options:
 *   kids_activity_category, kids_note_category
 *
 * Public routes:   GET /  GET /:id  GET /:id/activities  GET /:id/notes
 * Auth-required:   All POST / PUT / DELETE
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { requireAuth }                      = require('../auth/middleware');
const { serverError, notFound }            = require('../../shared/errors');
const { clearReview } = require('../../shared/needs-review');
const { saveTagsByName, getTagNames,
        withTagNames, clearTags }          = require('../../shared/tags');
const { saveFamilyMembers, getFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');

// ── Helpers ───────────────────────────────────────────────────
// Age is computed on every read so it stays current without DB updates.
function ageFromDob(dob) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function enrichKid(kid) {
  kid.age = ageFromDob(kid.date_of_birth);
  return kid;
}

// ── Kids CRUD ─────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const kids = db.prepare(`
      SELECT k.*, c.name AS school_name,
        (SELECT COUNT(*) FROM kid_activities WHERE kid_id=k.id AND is_active=1) AS activity_count,
        (SELECT COUNT(*) FROM kid_notes WHERE kid_id=k.id) AS note_count
      FROM kids k
      LEFT JOIN contacts c ON c.id = k.school_id
      WHERE k.is_active = 1
      ORDER BY k.display_name
    `).all().map(enrichKid);
    res.json(kids);
  } catch(e) { serverError(res, e); }
});

router.get('/:id', (req, res) => {
  try {
    const kid = /** @type {any} */ (db.prepare(`
      SELECT k.*, c.name AS school_name
      FROM kids k LEFT JOIN contacts c ON c.id = k.school_id
      WHERE k.id = ?
    `).get(req.params.id));
    if (!kid) return notFound(res, 'Kid');
    enrichKid(kid);
    // Attach related records inline so the UI needs only one request
    kid.activities = db.prepare(
      'SELECT * FROM kid_activities WHERE kid_id=? ORDER BY is_active DESC, day_of_week, start_time'
    ).all(kid.id).map(a => withFamilyMembers(withTagNames(a, 'kid_activity'), 'kid_activity'));
    kid.notes = db.prepare(
      'SELECT * FROM kid_notes WHERE kid_id=? ORDER BY note_date DESC, id DESC LIMIT 20'
    ).all(kid.id).map(n => withFamilyMembers(withTagNames(n, 'kid_note'), 'kid_note'));
    try {
      // Cross-module read: recent medical visits for this child (read-only context, no writes)
      kid.medical_visits = db.prepare(
        'SELECT * FROM med_visit_notes WHERE patient = ? ORDER BY visit_date DESC LIMIT 5'
      ).all(kid.display_name);
    } catch { kid.medical_visits = []; }
    res.json(kid);
  } catch(e) { serverError(res, e); }
});

router.post('/', requireAuth, (req, res) => {
  try {
    const { display_name, date_of_birth, grade, school_id, teacher_name, homeroom,
            allergies, medications_note, emergency_note, notes, family_member_id,
            teacher_contact_id } = req.body;
    if (!display_name?.trim()) return res.status(400).json({ error: 'display_name required' });
    const r = db.prepare(`
      INSERT INTO kids (display_name, date_of_birth, grade, school_id, teacher_name, homeroom,
        allergies, medications_note, emergency_note, notes, family_member_id, teacher_contact_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(display_name.trim(), date_of_birth||null, grade||null, school_id||null,
           teacher_name||null, homeroom||null, allergies||null, medications_note||null,
           emergency_note||null, notes||null, family_member_id||null, teacher_contact_id||null);
    res.status(201).json(enrichKid(db.prepare('SELECT * FROM kids WHERE id=?').get(r.lastInsertRowid)));
  } catch(e) { serverError(res, e); }
});

router.put('/:id', requireAuth, (req, res) => {
  try {
    const kid = /** @type {any} */ (db.prepare('SELECT * FROM kids WHERE id=?').get(req.params.id));
    if (!kid) return notFound(res, 'Kid');
    const { display_name, date_of_birth, grade, school_id, teacher_name, homeroom,
            allergies, medications_note, emergency_note, notes, family_member_id,
            teacher_contact_id } = req.body;
    db.prepare(`
      UPDATE kids SET display_name=?, date_of_birth=?, grade=?, school_id=?, teacher_name=?,
        homeroom=?, allergies=?, medications_note=?, emergency_note=?, notes=?,
        family_member_id=?, teacher_contact_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
    `).run(display_name??kid.display_name, date_of_birth??kid.date_of_birth, grade??kid.grade,
           school_id??kid.school_id, teacher_name??kid.teacher_name, homeroom??kid.homeroom,
           allergies??kid.allergies, medications_note??kid.medications_note,
           emergency_note??kid.emergency_note, notes??kid.notes,
           family_member_id??kid.family_member_id,
           teacher_contact_id??kid.teacher_contact_id??null, kid.id);
    clearReview('kids', kid.id);
    res.json(enrichKid(db.prepare('SELECT * FROM kids WHERE id=?').get(kid.id)));
  } catch(e) { serverError(res, e); }
});

router.delete('/:id', requireAuth, (req, res) => {
  try {
    db.prepare('UPDATE kids SET is_active=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Activities (weekly schedule) ──────────────────────────────
router.get('/:id/activities', (req, res) => {
  try {
    res.json(db.prepare(
      'SELECT * FROM kid_activities WHERE kid_id=? ORDER BY is_active DESC, day_of_week, start_time'
    ).all(req.params.id).map(a => withTagNames(a, 'kid_activity')));
  } catch(e) { serverError(res, e); }
});

router.post('/:id/activities', requireAuth, (req, res) => {
  try {
    const { name, category, day_of_week, start_time, end_time, location,
            contact_id, cost_per_month, season, start_date, end_date, notes, tags } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name required' });
    const r = db.prepare(`
      INSERT INTO kid_activities (kid_id, name, category, day_of_week, start_time, end_time,
        location, contact_id, cost_per_month, season, start_date, end_date, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(req.params.id, name.trim(), category||'Other', day_of_week||null,
           start_time||null, end_time||null, location||null, contact_id||null,
           cost_per_month||null, season||null, start_date||null, end_date||null, notes||null);
    if (tags) saveTagsByName(Number(r.lastInsertRowid), 'kid_activity', tags);
    if (req.body.family_member_ids !== undefined) saveFamilyMembers(Number(r.lastInsertRowid), 'kid_activity', req.body.family_member_ids);
    res.status(201).json(withFamilyMembers(withTagNames(
      db.prepare('SELECT * FROM kid_activities WHERE id=?').get(r.lastInsertRowid),
      'kid_activity'
    ), 'kid_activity'));
  } catch(e) { serverError(res, e); }
});

router.put('/:id/activities/:aid', requireAuth, (req, res) => {
  try {
    const act = /** @type {any} */ (db.prepare('SELECT * FROM kid_activities WHERE id=? AND kid_id=?').get(req.params.aid, req.params.id));
    if (!act) return notFound(res, 'Activity');
    const { name, category, day_of_week, start_time, end_time, location,
            contact_id, cost_per_month, season, start_date, end_date, notes, is_active, tags } = req.body;
    db.prepare(`
      UPDATE kid_activities SET name=?, category=?, day_of_week=?, start_time=?, end_time=?,
        location=?, contact_id=?, cost_per_month=?, season=?, start_date=?, end_date=?,
        notes=?, is_active=? WHERE id=?
    `).run(name??act.name, category??act.category, day_of_week??act.day_of_week,
           start_time??act.start_time, end_time??act.end_time, location??act.location,
           contact_id??act.contact_id, cost_per_month??act.cost_per_month, season??act.season,
           start_date??act.start_date, end_date??act.end_date, notes??act.notes,
           is_active!=null?+is_active:act.is_active, act.id);
    if (tags !== undefined) saveTagsByName(act.id, 'kid_activity', tags);
    if (req.body.family_member_ids !== undefined) saveFamilyMembers(act.id, 'kid_activity', req.body.family_member_ids);
    clearReview('kid_activities', act.id);
    res.json(withFamilyMembers(withTagNames(db.prepare('SELECT * FROM kid_activities WHERE id=?').get(act.id), 'kid_activity'), 'kid_activity'));
  } catch(e) { serverError(res, e); }
});

router.delete('/:id/activities/:aid', requireAuth, (req, res) => {
  try {
    clearFamilyMembers(Number(req.params.aid), 'kid_activity');
    clearTags(Number(req.params.aid), 'kid_activity');
    db.prepare('DELETE FROM kid_activities WHERE id=? AND kid_id=?').run(req.params.aid, req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Notes (dated log entries) ─────────────────────────────────
router.get('/:id/notes', (req, res) => {
  try {
    res.json(db.prepare(
      'SELECT * FROM kid_notes WHERE kid_id=? ORDER BY note_date DESC, id DESC'
    ).all(req.params.id).map(n => withFamilyMembers(withTagNames(n, 'kid_note'), 'kid_note')));
  } catch(e) { serverError(res, e); }
});

router.post('/:id/notes', requireAuth, (req, res) => {
  try {
    const { note_date, category, title, body, tags } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'body required' });
    const r = db.prepare(`
      INSERT INTO kid_notes (kid_id, note_date, category, title, body)
      VALUES (?,?,?,?,?)
    `).run(req.params.id, note_date||new Date().toISOString().slice(0,10),
           category||'General', title||null, body.trim());
    if (tags) saveTagsByName(Number(r.lastInsertRowid), 'kid_note', tags);
    if (req.body.family_member_ids !== undefined) saveFamilyMembers(Number(r.lastInsertRowid), 'kid_note', req.body.family_member_ids);
    res.status(201).json(withFamilyMembers(withTagNames(
      db.prepare('SELECT * FROM kid_notes WHERE id=?').get(r.lastInsertRowid),
      'kid_note'
    ), 'kid_note'));
  } catch(e) { serverError(res, e); }
});

router.put('/:id/notes/:nid', requireAuth, (req, res) => {
  try {
    const note = /** @type {any} */ (db.prepare('SELECT * FROM kid_notes WHERE id=? AND kid_id=?').get(req.params.nid, req.params.id));
    if (!note) return notFound(res, 'Note');
    const { note_date, category, title, body, tags } = req.body;
    db.prepare('UPDATE kid_notes SET note_date=?, category=?, title=?, body=? WHERE id=?')
      .run(note_date??note.note_date, category??note.category, title??note.title, body??note.body, note.id);
    if (tags !== undefined) saveTagsByName(note.id, 'kid_note', tags);
    clearReview('kid_notes', note.id);
    res.json(withTagNames(db.prepare('SELECT * FROM kid_notes WHERE id=?').get(note.id), 'kid_note'));
  } catch(e) { serverError(res, e); }
});

router.delete('/:id/notes/:nid', requireAuth, (req, res) => {
  try {
    clearTags(Number(req.params.nid), 'kid_note');
    db.prepare('DELETE FROM kid_notes WHERE id=? AND kid_id=?').run(req.params.nid, req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

// ── Summary for dashboard ─────────────────────────────────────
// Returns lightweight data for the dashboard panel — not full profiles.
router.get('/summary/dashboard', (req, res) => {
  try {
    const kids = /** @type {any[]} */ (db.prepare('SELECT id, display_name, date_of_birth, grade FROM kids WHERE 1=1').all()).map(enrichKid);
    const actCount = /** @type {any} */ (db.prepare('SELECT COUNT(*) AS n FROM kid_activities WHERE is_active=1').get()).n;
    res.json({ kids, active_activities: actCount });
  } catch(e) { serverError(res, e); }
});



module.exports = router;
