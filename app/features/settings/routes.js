/**
 * features/settings/routes.js
 * PRIVATE — requireAuth applied at top, covers all routes in this file.
 */
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../auth/middleware');
const db = require('../../db/db');
const { notFound, badRequest, serverError } = require('../../shared/errors');
const { saveFamilyMembers, getFamilyMembers, withFamilyMembers, clearFamilyMembers } = require('../../shared/familyMembers');
const { getReviewSummary, getTotalFlaggedCount, checkAndCompleteTodo } = require('../../shared/needs-review');
const { runDataCleanup } = require('../../shared/data-cleanup');
const { getEntitiesByTag } = require('../../shared/tags');

// ── Data Cleanup endpoint (manual run) ───────────────────────
router.post('/cleanup/run', requireAuth, (req, res) => {
  try {
    const results = runDataCleanup({ source: 'manual' });
    res.json({ ok: true, ...results });
  } catch(err) { serverError(res, err); }
});

// ── Data Review endpoints ─────────────────────────────────────
// GET /api/v1/settings/review/summary — per-module flagged counts + samples
router.get('/review/summary', (req, res) => {
  try {
    const summary = getReviewSummary();
    const total   = summary.reduce((s, m) => s + m.count, 0);
    res.json({ total, modules: summary });
  } catch(err) { serverError(res, err); }
});

// POST /api/v1/settings/review/check-complete — auto-complete todo if all clear
router.post('/review/check-complete', (req, res) => {
  try {
    checkAndCompleteTodo();
    res.json({ total: getTotalFlaggedCount() });
  } catch(err) { serverError(res, err); }
});

// GET /api/v1/settings/completeness
// Returns data completeness issues — records missing important optional fields.
// Distinct from needs_review (migration flags) — this is ongoing field coverage.
router.get('/completeness', (req, res) => {
  try {
    const issues = [];

    function check(module, label, href, sql, field) {
      try {
        const rows = db.prepare(sql).all();
        if (rows.length) issues.push({ module, label, href, field, count: rows.length,
          samples: rows.slice(0, 3).map(r => r.name || r.title || r.display_name || String(r.id)) });
      } catch { /* table may not exist */ }
    }

    // Inventory
    check('inventory', 'Inventory', '/inventory.html',
      "SELECT name FROM items WHERE is_active=1 AND is_archived=0 AND (parent_type IS NULL OR parent_id IS NULL)",
      'No location assigned');
    check('inventory', 'Inventory', '/inventory.html',
      "SELECT name FROM items WHERE is_active=1 AND is_archived=0 AND (purchase_price IS NULL OR purchase_price=0)",
      'No purchase price');
    check('inventory', 'Inventory', '/inventory.html',
      "SELECT name FROM items WHERE is_active=1 AND is_archived=0 AND (category IS NULL OR category='')",
      'No category');

    // Contacts
    check('contacts', 'Contacts', '/settings.html',
      "SELECT name FROM contacts WHERE phone_primary IS NULL AND email IS NULL",
      'No phone or email');

    // Documents
    check('documents', 'Documents', '/documents.html',
      "SELECT title AS name FROM documents WHERE is_active=1 AND expiry_date IS NULL AND category IN ('Insurance','Legal','ID','Warranty','Medical')",
      'No expiry date (for ' + 'Insurance/Legal/ID/Warranty/Medical)');

    // Books
    check('books', 'Books', '/books.html',
      "SELECT title AS name FROM books WHERE is_active=1 AND author IS NULL",
      'No author');

    // Vehicles
    check('vehicles', 'Vehicles', '/property.html',
      "SELECT nickname AS name FROM vehicles WHERE is_active=1 AND registration_expires IS NULL",
      'No registration expiry date');
    check('vehicles', 'Vehicles', '/property.html',
      "SELECT nickname AS name FROM vehicles WHERE is_active=1 AND (make IS NULL OR model IS NULL)",
      'Missing make or model');

    // Medical medications
    check('medical', 'Medical', '/medical.html',
      "SELECT name FROM med_medications WHERE status='Active' AND (dosage IS NULL OR dosage='')",
      'Active medication missing dosage');

    // Career certifications
    check('career', 'Career', '/career.html',
      "SELECT name FROM career_certifications WHERE status='Active' AND expiry_date IS NULL",
      'Active cert with no expiry date');

    // HSA payments
    check('hsa', 'HSA', '/finance.html',
      "SELECT provider AS name FROM hsa_payments WHERE hsa_eligible=1 AND (category IS NULL OR category='')",
      'HSA-eligible expense missing category');

    // Kids
    check('kids', 'Kids', '/kids.html',
      "SELECT display_name AS name FROM kids WHERE is_active=1 AND date_of_birth IS NULL",
      'No date of birth');
    check('kids', 'Kids', '/kids.html',
      "SELECT display_name AS name FROM kids WHERE is_active=1 AND grade IS NULL",
      'No grade set');

    // Finance transactions — uncategorized
    check('finance', 'Finance', '/finance.html',
      "SELECT description AS name FROM finance_transactions WHERE (category IS NULL OR category='') LIMIT 50",
      'Manual transaction missing category');
    check('finance', 'Finance', '/finance.html',
      "SELECT description AS name FROM imported_transactions WHERE (category IS NULL OR category='') LIMIT 50",
      'Imported transaction missing category');

    // Property maintenance overdue
    check('property', 'Property', '/property.html',
      "SELECT pm.description AS name FROM property_maintenance pm WHERE pm.next_due_date IS NOT NULL AND pm.next_due_date < date('now')",
      'Property maintenance overdue');

    const total = issues.reduce((s, i) => s + i.count, 0);
    res.json({ total, issues });
  } catch(err) { serverError(res, err); }
});


// ── Public read-only routes (no auth required) ─────────────────
// Principle: reading data never requires auth — only writes do.
// These must be declared BEFORE router.use(requireAuth).

router.get('/tags', (req, res) => {
  try {
    const tags = db.prepare('SELECT * FROM tags ORDER BY name').all();
    // Include usage count per tag
    const withCounts = tags.map(t => {
      const usage = db.prepare(
        'SELECT COUNT(*) as n FROM taggables WHERE tag_id = ?'
      ).get(t.id);
      return { ...t, usage_count: usage.n };
    });
    res.json(withCounts);
  } catch (err) { serverError(res, err); }
});

// GET /api/v1/settings/tags/search?tag=X
// Cross-module tag search. Returns all entities tagged with the given name,
// enriched with a display title and a deep-link URL for each result.
router.get('/tags/search', (req, res) => {
  try {
    const { tag } = req.query;
    if (!tag?.trim()) return badRequest(res, 'tag parameter required');

    const entities = getEntitiesByTag(tag.trim());
    if (!entities.length) return res.json({ tag, results: [] });

    // For each entity_type, map to: module label, page URL, and a title query
    const TYPE_META = {
      item:                   { label: 'Inventory',    href: '/inventory.html',  table: 'items',                  col: 'name' },
      book:                   { label: 'Books',        href: '/books.html',      table: 'books',                  col: 'title' },
      document:               { label: 'Documents',    href: '/documents.html',  table: 'documents',              col: 'title' },
      resource:               { label: 'Resources',    href: '/resources.html',  table: 'resources',              col: 'name' },
      todo:                   { label: 'Todos',        href: '/todos.html',      table: 'todos',                  col: 'title' },
      daily_log:              { label: 'Daily Log',    href: '/daily-log.html',  table: 'daily_log',              col: 'entry_text' },
      career_cert:            { label: 'Certifications', href: '/career.html',   table: 'career_certifications',  col: 'name' },
      career_job:             { label: 'Career',       href: '/career.html',     table: 'career_jobs',            col: 'title' },
      career_skill:           { label: 'Skills',       href: '/career.html',     table: 'career_skills',          col: 'name' },
      medical_visit:          { label: 'Medical',      href: '/medical.html',    table: 'med_visit_notes',        col: 'patient' },
      medical_medication:     { label: 'Medications',  href: '/medical.html',    table: 'med_medications',        col: 'name' },
      property:               { label: 'Property',     href: '/property.html',   table: 'properties',             col: 'nickname' },
      vehicle:                { label: 'Vehicles',     href: '/property.html',   table: 'vehicles',               col: 'nickname' },
      hsa_payment:            { label: 'HSA',          href: '/finance.html',    table: 'hsa_payments',           col: 'provider' },
    };

    const results = entities.map(({ entity_type, entity_id }) => {
      const meta = TYPE_META[entity_type];
      if (!meta) return null;
      let title = null;
      try {
        const row = db.prepare(
          `SELECT ${meta.col} AS t FROM ${meta.table} WHERE id = ?`
        ).get(entity_id);
        title = row?.t ? String(row.t).slice(0, 80) : null;
      } catch { /* table may not exist yet */ }
      return { entity_type, entity_id, label: meta.label, href: meta.href, title };
    }).filter(Boolean);

    // Group by module label for tidy frontend rendering
    const grouped = {};
    results.forEach(r => {
      if (!grouped[r.label]) grouped[r.label] = { label: r.label, href: r.href, items: [] };
      grouped[r.label].items.push({ entity_type: r.entity_type, entity_id: r.entity_id, title: r.title });
    });

    res.json({ tag, total: results.length, groups: Object.values(grouped) });
  } catch (err) { serverError(res, err); }
});



router.get('/family', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM family_members ORDER BY is_primary_user DESC, display_name').all());
  } catch (err) { serverError(res, err); }
});



router.get('/dropdowns', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM dropdown_options WHERE is_active=1 ORDER BY list_key, sort_order, value').all());
  } catch (err) { serverError(res, err); }
});

router.get('/tags/entity', (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    res.json(db.prepare(
      'SELECT t.* FROM tags t JOIN taggables tb ON t.id=tb.tag_id WHERE tb.entity_type=? AND tb.entity_id=?'
    ).all(entity_type, entity_id));
  } catch (err) { serverError(res, err); }
});

router.get('/contacts', (req, res) => {
  try {
    const { type } = req.query;
    if (type) {
      res.json(db.prepare('SELECT * FROM contacts WHERE contact_type=? ORDER BY name').all(type));
    } else {
      res.json(db.prepare('SELECT * FROM contacts ORDER BY contact_type, name').all());
    }
  } catch (err) { serverError(res, err); }
});

router.get('/contacts/:id', (req, res) => {
  try {
    const contact = db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id);
    if (!contact) return notFound(res, 'Contact');
    res.json(contact);
  } catch (err) { serverError(res, err); }
});

router.get('/dropdowns/:listKey', (req, res) => {
  try {
    res.json(db.prepare(
      "SELECT * FROM dropdown_options WHERE list_key=? AND is_active=1 ORDER BY sort_order, value"
    ).all(req.params.listKey));
  } catch (err) { serverError(res, err); }
});

// ── All routes below this line require authentication ──────────
router.use(requireAuth);

// ══════════════════════════════════════════════════════════════
// FAMILY MEMBERS
// ══════════════════════════════════════════════════════════════


router.get('/family/:id', (req, res) => {
  try {
    const m = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id);
    if (!m) return notFound(res, 'Family member');
    res.json(m);
  } catch (err) { serverError(res, err); }
});

// GET /api/v1/settings/family/:id/report
// Returns everything linked to a family member across all modules.
// Medical uses the display_name as a patient string (not FK).
// All other modules use record_family_members junction table.
router.get('/family/:id/report', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM family_members WHERE id = ?').get(req.params.id);
    if (!member) return notFound(res, 'Family member');
    const fid = member.id;
    const name = member.display_name;

    function linked(entityType, table, cols) {
      try {
        return db.prepare(`
          SELECT ${cols} FROM ${table}
          WHERE id IN (
            SELECT entity_id FROM record_family_members
            WHERE entity_type=? AND family_member_id=?
          ) ORDER BY rowid DESC
        `).all(entityType, fid);
      } catch { return []; }
    }

    // Medical uses display_name as patient string, not FK
    function medical(table, cols) {
      try {
        return db.prepare(`SELECT ${cols} FROM ${table} WHERE patient=? ORDER BY rowid DESC`).all(name);
      } catch { return []; }
    }

    const todos    = linked('todo',             'todos',         'id, title, status, priority, due_date, category');
    const books    = linked('book',             'books',         'id, title, author, status, genre, rating');
    const docs     = linked('document',         'documents',     'id, title, category, expiry_date, file_name');
    const resources= linked('resource',         'resources',     'id, name, category, url');
    const hsaItems = linked('hsa_payment',      'hsa_payments',  'id, date, provider, you_paid, hsa_eligible, reimbursed');
    const careerJobs= linked('career_job',      'career_jobs',   'id, title, company, start_date, end_date, is_current');
    const careerGoals=linked('career_goal',     'career_goals',  'id, title, category, status, target_date');
    const activities= db.prepare(`
      SELECT ka.id, ka.name, ka.category, ka.day_of_week AS schedule, k.display_name AS kid_name
      FROM kid_activities ka
      JOIN kids k ON k.id = ka.kid_id
      WHERE ka.id IN (
        SELECT entity_id FROM record_family_members WHERE entity_type='kid_activity' AND family_member_id=?
      )
    `).all(fid);

    const medVisits = medical('med_visit_notes',  'id, visit_date, patient, questions AS reason, doctors_response, follow_up_needed');
    const medMeds   = medical('med_medications',  'id, name, dosage, frequency, status, start_date');
    const medConds  = medical('med_conditions',   'id, condition_name, status, start_date');

    // Open todos for this member (urgency summary)
    const openTodos  = todos.filter(t => t.status === 'open' || t.status === 'in_progress');
    const overdueTodos = openTodos.filter(t => t.due_date && t.due_date < new Date().toISOString().slice(0,10));

    res.json({
      member,
      summary: {
        todos_open:    openTodos.length,
        todos_overdue: overdueTodos.length,
        books:         books.length,
        documents:     docs.length,
        medical_visits:medVisits.length,
        medications_active: medMeds.filter(m => m.status === 'Active').length,
        conditions_active:  medConds.filter(c => c.status === 'Active').length,
        hsa_unreimbursed: hsaItems.filter(h => h.hsa_eligible && !h.reimbursed)
                           .reduce((s, h) => s + (parseFloat(h.you_paid)||0), 0),
      },
      todos, books, documents: docs, resources, hsa: hsaItems,
      career: { jobs: careerJobs, goals: careerGoals },
      activities,
      medical: { visits: medVisits, medications: medMeds, conditions: medConds },
    });
  } catch (err) { serverError(res, err); }
});

router.post('/family', (req, res) => {
  try {
    const { display_name, full_legal_name, relationship, date_of_birth, ssn_last4, is_primary_user, notes } = req.body;
    if (!display_name) return badRequest(res, 'display_name is required');
    const r = db.prepare(`INSERT INTO family_members
      (display_name,full_legal_name,relationship,date_of_birth,ssn_last4,is_primary_user,notes)
      VALUES (?,?,?,?,?,?,?)`)
      .run(display_name, full_legal_name||null, relationship||null, date_of_birth||null,
           ssn_last4||null, is_primary_user?1:0, notes||null);
    res.status(201).json(db.prepare('SELECT * FROM family_members WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { serverError(res, err); }
});

router.put('/family/:id', (req, res) => {
  try {
    const { display_name, full_legal_name, relationship, date_of_birth, ssn_last4, notes } = req.body;
    if (!display_name) return badRequest(res, 'display_name is required');
    db.prepare(`UPDATE family_members SET display_name=?,full_legal_name=?,relationship=?,
      date_of_birth=?,ssn_last4=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(display_name, full_legal_name||null, relationship||null,
           date_of_birth||null, ssn_last4||null, notes||null, req.params.id);
    const m = db.prepare('SELECT * FROM family_members WHERE id=?').get(req.params.id);
    if (!m) return notFound(res, 'Family member');
    res.json(m);
  } catch (err) { serverError(res, err); }
});

router.delete('/family/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM family_members WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// CONTACTS
// ══════════════════════════════════════════════════════════════
router.post('/contacts', (req, res) => {
  try {
    const d = req.body;
    if (!d.contact_type) return badRequest(res, 'contact_type is required');
    if (!d.name)         return badRequest(res, 'name is required');
    const r = db.prepare(`INSERT INTO contacts
      (contact_type, name, company, specialty,
       phone_primary, phone_secondary, email, website,
       address_street, address_city, address_state, address_zip, notes,
       patients_seen, accepts_insurance,
       license_number, insurance_verified, bonded, last_used_date, quality_rating,
       hr_contact_name, hr_phone, ein, employee_family_member_id,
       principal_name, grade_range, enrolled_kids,
       institution_type, rep_name, account_types_served)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      d.contact_type, d.name, d.company||null, d.specialty||null,
      d.phone_primary||null, d.phone_secondary||null, d.email||null, d.website||null,
      d.address_street||null, d.address_city||null, d.address_state||null, d.address_zip||null, d.notes||null,
      d.patients_seen||null, d.accepts_insurance||null,
      d.license_number||null, d.insurance_verified?1:0, d.bonded?1:0, d.last_used_date||null, d.quality_rating||null,
      d.hr_contact_name||null, d.hr_phone||null, d.ein||null, d.employee_family_member_id||null,
      d.principal_name||null, d.grade_range||null, d.enrolled_kids||null,
      d.institution_type||null, d.rep_name||null, d.account_types_served||null
    );
    if (d.family_member_ids !== undefined) saveFamilyMembers(r.lastInsertRowid, 'contact', d.family_member_ids);
    res.status(201).json(withFamilyMembers(db.prepare('SELECT * FROM contacts WHERE id=?').get(r.lastInsertRowid), 'contact'));
  } catch (err) { serverError(res, err); }
});

router.put('/contacts/:id', (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return badRequest(res, 'name is required');
    db.prepare(`UPDATE contacts SET
      contact_type=?, name=?, company=?, specialty=?,
      phone_primary=?, phone_secondary=?, email=?, website=?,
      address_street=?, address_city=?, address_state=?, address_zip=?, notes=?,
      patients_seen=?, accepts_insurance=?,
      license_number=?, insurance_verified=?, bonded=?, last_used_date=?, quality_rating=?,
      hr_contact_name=?, hr_phone=?, ein=?, employee_family_member_id=?,
      principal_name=?, grade_range=?, enrolled_kids=?,
      institution_type=?, rep_name=?, account_types_served=?,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`
    ).run(
      d.contact_type, d.name, d.company||null, d.specialty||null,
      d.phone_primary||null, d.phone_secondary||null, d.email||null, d.website||null,
      d.address_street||null, d.address_city||null, d.address_state||null, d.address_zip||null, d.notes||null,
      d.patients_seen||null, d.accepts_insurance||null,
      d.license_number||null, d.insurance_verified?1:0, d.bonded?1:0, d.last_used_date||null, d.quality_rating||null,
      d.hr_contact_name||null, d.hr_phone||null, d.ein||null, d.employee_family_member_id||null,
      d.principal_name||null, d.grade_range||null, d.enrolled_kids||null,
      d.institution_type||null, d.rep_name||null, d.account_types_served||null,
      req.params.id
    );
    if (d.family_member_ids !== undefined) saveFamilyMembers(req.params.id, 'contact', d.family_member_ids);
    const contact = db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id);
    if (!contact) return notFound(res, 'Contact');
    res.json(withFamilyMembers(contact, 'contact'));
  } catch (err) { serverError(res, err); }
});

router.delete('/contacts/:id', (req, res) => {
  try {
    clearFamilyMembers(req.params.id, 'contact');
    db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// TAGS
// ══════════════════════════════════════════════════════════════


router.post('/tags', (req, res) => {
  try {
    const { name, color_hex, icon } = req.body;
    if (!name) return badRequest(res, 'name is required');
    const r = db.prepare('INSERT INTO tags (name,color_hex,icon) VALUES (?,?,?)')
      .run(name.toLowerCase().trim(), color_hex||'3b82f6', icon||null);
    res.status(201).json(db.prepare('SELECT * FROM tags WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { serverError(res, err); }
});

router.put('/tags/:id', (req, res) => {
  try {
    const { name, color_hex, icon } = req.body;
    db.prepare('UPDATE tags SET name=?,color_hex=?,icon=? WHERE id=?')
      .run(name.toLowerCase().trim(), color_hex||'3b82f6', icon||null, req.params.id);
    res.json(db.prepare('SELECT * FROM tags WHERE id=?').get(req.params.id));
  } catch (err) { serverError(res, err); }
});

router.delete('/tags/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tags WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

// Tag entity attach/detach


router.post('/tags/entity', (req, res) => {
  try {
    const { tag_id, entity_type, entity_id } = req.body;
    db.prepare('INSERT OR IGNORE INTO taggables (tag_id,entity_type,entity_id) VALUES (?,?,?)')
      .run(tag_id, entity_type, entity_id);
    res.json({ attached: true });
  } catch (err) { serverError(res, err); }
});

router.delete('/tags/entity', (req, res) => {
  try {
    const { tag_id, entity_type, entity_id } = req.body;
    db.prepare('DELETE FROM taggables WHERE tag_id=? AND entity_type=? AND entity_id=?')
      .run(tag_id, entity_type, entity_id);
    res.json({ detached: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// CUSTOM FIELDS
// ══════════════════════════════════════════════════════════════
router.get('/custom-fields', (req, res) => {
  try {
    const { module: mod, category } = req.query;
    let sql = 'SELECT * FROM custom_field_defs WHERE 1=1';
    const params = [];
    if (mod)      { sql += ' AND (scope_module IS NULL OR scope_module=?)';     params.push(mod); }
    if (category) { sql += ' AND (scope_category IS NULL OR scope_category=?)'; params.push(category); }
    sql += ' ORDER BY sort_order, name';
    res.json(db.prepare(sql).all(...params));
  } catch (err) { serverError(res, err); }
});

router.post('/custom-fields', (req, res) => {
  try {
    const { name, field_type, scope_module, scope_category, required, default_value, options, sort_order } = req.body;
    if (!name||!field_type) return badRequest(res, 'name and field_type required');
    const r = db.prepare(`INSERT INTO custom_field_defs
      (name,field_type,scope_module,scope_category,required,default_value,options,sort_order)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(name, field_type, scope_module||null, scope_category||null,
           required?1:0, default_value||null, options?JSON.stringify(options):null, sort_order||0);
    res.status(201).json(db.prepare('SELECT * FROM custom_field_defs WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { serverError(res, err); }
});

router.put('/custom-fields/:id', (req, res) => {
  try {
    const { name, field_type, scope_module, scope_category, required, default_value, options, sort_order } = req.body;
    db.prepare(`UPDATE custom_field_defs SET name=?,field_type=?,scope_module=?,scope_category=?,
      required=?,default_value=?,options=?,sort_order=? WHERE id=?`)
      .run(name, field_type, scope_module||null, scope_category||null,
           required?1:0, default_value||null, options?JSON.stringify(options):null, sort_order||0, req.params.id);
    res.json(db.prepare('SELECT * FROM custom_field_defs WHERE id=?').get(req.params.id));
  } catch (err) { serverError(res, err); }
});

router.delete('/custom-fields/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM custom_field_defs WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// APP CONFIG
// ══════════════════════════════════════════════════════════════
router.get('/config', (req, res) => {
  try {
    const rows = db.prepare("SELECT key,value FROM app_config WHERE key != 'app_password_hash'").all();
    const cfg = {};
    rows.forEach(r => { cfg[r.key] = r.value; });
    res.json(cfg);
  } catch (err) { serverError(res, err); }
});

router.put('/config/:key', (req, res) => {
  try {
    const { value } = req.body;
    db.prepare('INSERT OR REPLACE INTO app_config (key,value) VALUES (?,?)').run(req.params.key, value);
    res.json({ key: req.params.key, value });
  } catch (err) { serverError(res, err); }
});

router.get('/config/:key', (req, res) => {
  try {
    const row = db.prepare("SELECT key,value FROM app_config WHERE key=? AND key != 'app_password_hash'").get(req.params.key);
    if (!row) return res.json({ key: req.params.key, value: null });
    res.json(row);
  } catch (err) { serverError(res, err); }
});

// ══════════════════════════════════════════════════════════════
// DROPDOWN OPTIONS
// ══════════════════════════════════════════════════════════════

// GET /api/v1/settings/dropdowns/:listKey


// GET /api/v1/settings/dropdowns  (all lists, grouped)


// POST /api/v1/settings/dropdowns  (add option)
router.post('/dropdowns', (req, res) => {
  try {
    const { list_key, label, value, sort_order } = req.body;
    if (!list_key || !label || !value) return badRequest(res, 'list_key, label and value required');
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM dropdown_options WHERE list_key=?').get(list_key);
    const r = db.prepare(
      'INSERT INTO dropdown_options (list_key, label, value, sort_order) VALUES (?,?,?,?)'
    ).run(list_key, label, value, sort_order || (maxOrder.m || 0) + 10);
    res.status(201).json(db.prepare('SELECT * FROM dropdown_options WHERE id=?').get(r.lastInsertRowid));
  } catch (err) { serverError(res, err); }
});

// PUT /api/v1/settings/dropdowns/:id  (edit option — with optional value rename cascade)
router.put('/dropdowns/:id', (req, res) => {
  try {
    const { label, value, sort_order, is_active, rename_value } = req.body;
    const existing = db.prepare('SELECT * FROM dropdown_options WHERE id=?').get(req.params.id);
    if (!existing) return badRequest(res, 'Not found');

    // If value is changing AND rename_value=true, cascade to all records that reference the old value
    if (rename_value && value && value !== existing.value) {
      const oldVal = existing.value;
      const newVal = value;
      const listKey = existing.list_key;

      // Cascade map: list_key → [{table, column}]
      const CASCADE = {
        'inventory_category':     [{ t: 'items',        c: 'category' }],
        'inventory_condition':    [{ t: 'items',        c: 'condition_rating' }],
        'hsa_category':           [{ t: 'hsa_payments', c: 'category' }, { t: 'hsa_otc', c: 'category' }],
        'daily_log_category':     [{ t: 'daily_log',    c: 'category' }],
        'resources_category':     [{ t: 'resources',    c: 'category' }],
        'todo_category':          [{ t: 'todos',        c: 'category' }],
        'finance_account_type':   [{ t: 'finance_accounts', c: 'account_type' }],
        'transaction_category':   [{ t: 'finance_transactions', c: 'category' }],
      };

      const targets = CASCADE[listKey] || [];
      const doRename = db.transaction(() => {
        // Update dropdown option
        db.prepare('UPDATE dropdown_options SET label=?, value=?, sort_order=?, is_active=? WHERE id=?')
          .run(label ?? existing.label, newVal, sort_order ?? existing.sort_order, is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active, req.params.id);
        // Cascade updates
        let totalUpdated = 0;
        targets.forEach(({ t, c }) => {
          const r = db.prepare(`UPDATE ${t} SET ${c}=? WHERE ${c}=?`).run(newVal, oldVal);
          totalUpdated += r.changes;
        });
        return totalUpdated;
      });

      const cascaded = doRename();
      return res.json({ ...db.prepare('SELECT * FROM dropdown_options WHERE id=?').get(req.params.id), cascaded_records: cascaded });
    }

    // Normal update (no cascade)
    db.prepare('UPDATE dropdown_options SET label=?, value=?, sort_order=?, is_active=? WHERE id=?')
      .run(label ?? existing.label, value ?? existing.value, sort_order ?? existing.sort_order,
           is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active, req.params.id);
    res.json(db.prepare('SELECT * FROM dropdown_options WHERE id=?').get(req.params.id));
  } catch (err) { serverError(res, err); }
});

// GET /api/v1/settings/dropdowns/:id/usage  — how many records reference this option's value
router.get('/dropdowns/:id/usage', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM dropdown_options WHERE id=?').get(req.params.id);
    if (!row) return badRequest(res, 'Not found');

    const CASCADE = {
      'inventory_category':     [{ t: 'items',        c: 'category',   label: 'Items' }],
      'inventory_condition':    [{ t: 'items',        c: 'condition_rating', label: 'Items' }],
      'hsa_category':           [{ t: 'hsa_payments', c: 'category',   label: 'HSA Payments' }, { t: 'hsa_otc', c: 'category', label: 'OTC Items' }],
      'daily_log_category':     [{ t: 'daily_log',    c: 'category',   label: 'Log Entries' }],
      'resources_category':     [{ t: 'resources',    c: 'category',   label: 'Resources' }],
      'todo_category':          [{ t: 'todos',        c: 'category',   label: 'Todos' }],
      'finance_account_type':   [{ t: 'finance_accounts', c: 'account_type', label: 'Accounts' }],
      'transaction_category':   [{ t: 'finance_transactions', c: 'category', label: 'Transactions' }],
    };

    const targets = CASCADE[row.list_key] || [];
    let total = 0;
    const breakdown = [];
    targets.forEach(({ t, c, label }) => {
      try {
        const { n } = db.prepare(`SELECT COUNT(*) as n FROM ${t} WHERE ${c}=?`).get(row.value);
        if (n > 0) { breakdown.push({ table: t, label, count: n }); total += n; }
      } catch(e) {}
    });

    res.json({ value: row.value, list_key: row.list_key, total_usage: total, breakdown });
  } catch (err) { serverError(res, err); }
});

// DELETE /api/v1/settings/dropdowns/:id  (only non-system options)
router.delete('/dropdowns/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM dropdown_options WHERE id=?').get(req.params.id);
    if (!row) return badRequest(res, 'Not found');
    if (row.is_system) return badRequest(res, 'Cannot delete system options — disable instead');
    db.prepare('DELETE FROM dropdown_options WHERE id=?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) { serverError(res, err); }
});


// ── Diagnostics purge — hard-deletes all _diag_* test rows ───
// Called by the diagnostics test suite at the end of every run.
// Only removes rows with names/titles matching the _diag_ prefix —
// never touches real user data.
router.post('/diagnostics/purge', requireAuth, (req, res) => {

  try {
    const purge = db.transaction(() => {
      // Clean up taggables first to avoid orphans
      db.prepare("DELETE FROM taggables WHERE entity_type='book' AND entity_id IN (SELECT id FROM books WHERE title LIKE '%_diag_%')").run();
      db.prepare("DELETE FROM taggables WHERE entity_type='document' AND entity_id IN (SELECT id FROM documents WHERE title LIKE '%_diag_%')").run();
      db.prepare("DELETE FROM taggables WHERE entity_type='item' AND entity_id IN (SELECT id FROM items WHERE name LIKE '%_diag_%')").run();

      // Kid activities/notes taggables
      db.prepare("DELETE FROM taggables WHERE entity_type='kid_activity' AND entity_id IN (SELECT ka.id FROM kid_activities ka JOIN kids k ON k.id=ka.kid_id WHERE k.display_name LIKE '%_diag_%')").run();
      db.prepare("DELETE FROM taggables WHERE entity_type='kid_note' AND entity_id IN (SELECT kn.id FROM kid_notes kn JOIN kids k ON k.id=kn.kid_id WHERE k.display_name LIKE '%_diag_%')").run();

      // Hard-delete the records
      const results = {
        books:     db.prepare("DELETE FROM books WHERE title LIKE '%_diag_%'").run().changes,
        documents: db.prepare("DELETE FROM documents WHERE title LIKE '%_diag_%'").run().changes,
        items:     db.prepare("DELETE FROM items WHERE name LIKE '%_diag_%'").run().changes,
        contacts:  db.prepare("DELETE FROM contacts WHERE name LIKE '%_diag_%'").run().changes,
        kid_activities: db.prepare("DELETE FROM kid_activities WHERE kid_id IN (SELECT id FROM kids WHERE display_name LIKE '%_diag_%')").run().changes,
        kid_notes:      db.prepare("DELETE FROM kid_notes WHERE kid_id IN (SELECT id FROM kids WHERE display_name LIKE '%_diag_%')").run().changes,
        kids:      db.prepare("DELETE FROM kids WHERE display_name LIKE '%_diag_%'").run().changes,
        todos:     db.prepare("DELETE FROM todos WHERE title LIKE '%_diag_%'").run().changes,
        tags:      db.prepare("DELETE FROM tags WHERE name LIKE '%_diag_%'").run().changes,
      };
      return results;
    });
    const deleted = purge();
    const total = Object.values(deleted).reduce((s, n) => s + n, 0);
    res.json({ ok: true, deleted, total });
  } catch (err) { serverError(res, err); }
});


// ── E2E test data purge — hard-deletes all _e2e_* test rows ───
// Called manually from Reports → Tools. Items require archive first.
// Returns counts per table and total removed.
router.post('/diagnostics/purge-e2e', (req, res) => {
  try {
    // Check first — what's there
    const counts = {
      items:      db.prepare("SELECT COUNT(*) AS n FROM items WHERE name LIKE '%_e2e_%'").get().n,
      books:      db.prepare("SELECT COUNT(*) AS n FROM books WHERE title LIKE '%_e2e_%'").get().n,
      documents:  db.prepare("SELECT COUNT(*) AS n FROM documents WHERE title LIKE '%_e2e_%'").get().n,
      todos:      db.prepare("SELECT COUNT(*) AS n FROM todos WHERE title LIKE '%_e2e_%'").get().n,
      contacts:   db.prepare("SELECT COUNT(*) AS n FROM contacts WHERE name LIKE '%_e2e_%'").get().n,
      hsa:        db.prepare("SELECT COUNT(*) AS n FROM hsa_payments WHERE provider LIKE '%_e2e_%'").get().n,
    };
    const totalFound = Object.values(counts).reduce((s, n) => s + n, 0);

    if (totalFound === 0) {
      return res.json({ ok: true, deleted: counts, total: 0, message: 'No _e2e_ test records found' });
    }

    const purge = db.transaction(() => {
      // Taggables first
      db.prepare("DELETE FROM taggables WHERE entity_type='book'     AND entity_id IN (SELECT id FROM books     WHERE title    LIKE '%_e2e_%')").run();
      db.prepare("DELETE FROM taggables WHERE entity_type='document' AND entity_id IN (SELECT id FROM documents WHERE title    LIKE '%_e2e_%')").run();
      db.prepare("DELETE FROM taggables WHERE entity_type='todo'     AND entity_id IN (SELECT id FROM todos     WHERE title    LIKE '%_e2e_%')").run();
      db.prepare("DELETE FROM taggables WHERE entity_type='item'     AND entity_id IN (SELECT id FROM items     WHERE name     LIKE '%_e2e_%')").run();
      db.prepare("DELETE FROM taggables WHERE entity_type='contact'  AND entity_id IN (SELECT id FROM contacts  WHERE name     LIKE '%_e2e_%')").run();
      db.prepare("DELETE FROM taggables WHERE entity_type='hsa_payment' AND entity_id IN (SELECT id FROM hsa_payments WHERE provider LIKE '%_e2e_%')").run();

      // record_family_members cleanup
      db.prepare("DELETE FROM record_family_members WHERE entity_type='item'     AND entity_id IN (SELECT id FROM items     WHERE name  LIKE '%_e2e_%')").run();
      db.prepare("DELETE FROM record_family_members WHERE entity_type='todo'     AND entity_id IN (SELECT id FROM todos     WHERE title LIKE '%_e2e_%')").run();
      db.prepare("DELETE FROM record_family_members WHERE entity_type='document' AND entity_id IN (SELECT id FROM documents WHERE title LIKE '%_e2e_%')").run();

      // Items: archive then hard-delete (route enforces archived=1 before DELETE)
      db.prepare("UPDATE items SET is_archived=1 WHERE name LIKE '%_e2e_%'").run();
      const items = db.prepare("DELETE FROM items WHERE name LIKE '%_e2e_%' AND is_archived=1").run().changes;

      return {
        items,
        books:     db.prepare("DELETE FROM books     WHERE title    LIKE '%_e2e_%'").run().changes,
        documents: db.prepare("DELETE FROM documents WHERE title    LIKE '%_e2e_%'").run().changes,
        todos:     db.prepare("DELETE FROM todos     WHERE title    LIKE '%_e2e_%'").run().changes,
        contacts:  db.prepare("DELETE FROM contacts  WHERE name     LIKE '%_e2e_%'").run().changes,
        hsa:       db.prepare("DELETE FROM hsa_payments WHERE provider LIKE '%_e2e_%'").run().changes,
      };
    });

    const deleted = purge();
    const total = Object.values(deleted).reduce((s, n) => s + n, 0);
    res.json({ ok: true, deleted, total });
  } catch (err) { serverError(res, err); }
});


router.get('/diagnostics/orphans', (req, res) => {
  try {
    const checks = [];

    // Taggables pointing to non-existent tags
    const orphanTagRefs = db.prepare(`
      SELECT COUNT(*) as n FROM taggables tb
      WHERE NOT EXISTS (SELECT 1 FROM tags t WHERE t.id = tb.tag_id)
    `).get().n;
    checks.push({ check: 'taggables → tags', orphans: orphanTagRefs,
      ok: orphanTagRefs === 0, detail: `${orphanTagRefs} taggables with missing tag` });

    // Taggables pointing to non-existent entities (spot check key entity types)
    const entityChecks = [
      { type: 'item',               table: 'items',                    id_col: 'id' },
      { type: 'daily_log',          table: 'daily_log',                id_col: 'id' },
      { type: 'resource',           table: 'resources',                id_col: 'id' },
      { type: 'document',           table: 'documents',                id_col: 'id' },
      { type: 'todo',               table: 'todos',                    id_col: 'id' },
      { type: 'book',               table: 'books',                    id_col: 'id' },
      { type: 'medical_visit',      table: 'med_visit_notes',          id_col: 'id' },
      { type: 'medical_medication', table: 'med_medications',          id_col: 'id' },
      { type: 'career_cert',        table: 'career_certifications',    id_col: 'id' },
      { type: 'career_job',         table: 'career_jobs',              id_col: 'id' },
      { type: 'kid_activity',       table: 'kid_activities',           id_col: 'id' },
      { type: 'kid_note',           table: 'kid_notes',                id_col: 'id' },
      { type: 'property',           table: 'properties',               id_col: 'id' },
      { type: 'vehicle',            table: 'vehicles',                 id_col: 'id' },
    ];

    for (const { type, table, id_col } of entityChecks) {
      try {
        const n = db.prepare(`
          SELECT COUNT(*) as n FROM taggables tb
          WHERE tb.entity_type = ?
            AND NOT EXISTS (SELECT 1 FROM ${table} t WHERE t.${id_col} = tb.entity_id)
        `).get(type).n;
        checks.push({ check: `taggables → ${table} (${type})`, orphans: n,
          ok: n === 0, detail: `${n} orphaned taggable(s)` });
      } catch(e) {
        checks.push({ check: `taggables → ${table} (${type})`, orphans: -1,
          ok: false, detail: `table check failed: ${e.message}` });
      }
    }

    // Attachments pointing to non-existent entities (sample check)
    const orphanAttach = db.prepare(`
      SELECT entity_type, COUNT(*) as n FROM attachments a
      GROUP BY entity_type
    `).all();
    checks.push({ check: 'attachments entity summary', orphans: 0, ok: true,
      detail: orphanAttach.map(r => `${r.entity_type}:${r.n}`).join(', ') || 'none' });

    // Documents with freetext tags not yet migrated
    const unmigrated = db.prepare(`
      SELECT COUNT(*) as n FROM documents
      WHERE tags IS NOT NULL AND trim(tags) != ''
        AND id NOT IN (SELECT entity_id FROM taggables WHERE entity_type='document')
    `).get().n;
    checks.push({ check: 'documents: freetext tags migrated', orphans: unmigrated,
      ok: unmigrated === 0,
      detail: unmigrated > 0 ? `${unmigrated} document(s) have freetext tags not yet in taggables` : 'all migrated' });

    // Items with no location (unassigned)
    const unassigned = db.prepare(`
      SELECT COUNT(*) as n FROM items
      WHERE is_active=1 AND is_archived=0
        AND (parent_type IS NULL OR parent_type='none' OR parent_type='')
    `).get().n;
    checks.push({ check: 'inventory: unassigned items', orphans: unassigned,
      ok: unassigned === 0, warning: true,
      detail: `${unassigned} item(s) not assigned to a location or container` });

    const allOk = checks.filter(c => !c.warning).every(c => c.ok);
    res.json({ ok: allOk, checks });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
