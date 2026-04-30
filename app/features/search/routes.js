// @ts-check
'use strict';
/**
 * features/search/routes.js
 * Cross-module global search across all major modules.
 * GET /api/v1/search?q=<query>
 *
 * Per Ghrava rules:
 * - Records display as-is. No `is_active=1` or `is_archived=0` filters that hide data.
 * - All columns verified against live schema before query.
 * - Read-only and public.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError } = require('../../shared/errors');

const MIN_LEN = 2;
const PER_MODULE_LIMIT = 8;

/**
 * Run a search query safely. Returns [] on any error so one bad module
 * doesn't break the whole search.
 */
function safe(sql, params, mapFn) {
  try {
    return db.prepare(sql).all(...params).map(mapFn);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[search] query failed:', e.message);
    }
    return [];
  }
}

router.get('/', (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < MIN_LEN) return res.json({ groups: {}, total: 0, query: q });

    // Optional module-scoping. Comma-separated allowed: ?module=Inventory,Wardrobe
    // Match is case-insensitive against the group names this route emits.
    // When omitted, returns everything (current behavior).
    const moduleParam = String(req.query.module || '').trim().toLowerCase();
    const moduleSet = moduleParam ? new Set(moduleParam.split(',').map(s => s.trim()).filter(Boolean)) : null;

    const like = `%${q}%`;
    const groups = {};

    function add(module, items) {
      if (!items.length) return;
      // Skip the entire `add()` call if a scope is set and this module isn't in it.
      // Cheaper than running the query and filtering after, but this fn is invoked
      // AFTER `safe()` already ran — so we still pay the DB cost. Keep simple:
      // filter by module name here. The DB queries are tiny (LIMIT 8).
      if (moduleSet && !moduleSet.has(module.toLowerCase())) return;
      groups[module] = (groups[module] || []).concat(items);
    }

    // Daily Log
    add('Daily Log', safe(
      `SELECT id, log_date, category, entry_text, is_memory, memory_category
       FROM daily_log WHERE entry_text LIKE ?
       ORDER BY log_date DESC LIMIT ?`,
      [like, PER_MODULE_LIMIT],
      r => ({
        module: 'Daily Log', id: r.id,
        label: (r.entry_text || '').split('\n')[0].slice(0, 80),
        sub: r.is_memory ? `\u2726 ${r.memory_category || 'Memory'} \u00b7 ${r.log_date}` : `${r.category} \u00b7 ${r.log_date}`,
        href: '/daily-log.html', icon: r.is_memory ? '\u2726' : '\ud83d\udccb'
      })
    ));

    // Todos
    add('Todos', safe(
      `SELECT id, title, notes, due_date, status, category FROM todos
       WHERE title LIKE ? OR notes LIKE ?
       ORDER BY CASE WHEN status IN ('done','dismissed') THEN 1 ELSE 0 END, due_date
       LIMIT ?`,
      [like, like, PER_MODULE_LIMIT],
      r => ({
        module: 'Todos', id: r.id,
        label: r.title,
        sub: [r.status, r.due_date, r.category].filter(Boolean).join(' \u00b7 '),
        href: '/todos.html', icon: '\u2713'
      })
    ));

    // Inventory items (wardrobe items live in same table — split by category)
    add('Inventory', safe(
      `SELECT id, name, brand, category, model_number, wardrobe_nickname FROM items
       WHERE name LIKE ? OR brand LIKE ? OR model_number LIKE ? OR description LIKE ? OR notes LIKE ? OR wardrobe_nickname LIKE ?
       LIMIT ?`,
      [like, like, like, like, like, like, PER_MODULE_LIMIT],
      r => {
        const isWardrobe = ['Clothing','Shoes','Accessories','Jewelry','Hats','Bags'].includes(r.category);
        return {
          module: isWardrobe ? 'Wardrobe' : 'Inventory', id: r.id,
          label: r.wardrobe_nickname || r.name,
          sub: [r.brand, r.category, r.model_number].filter(Boolean).join(' \u00b7 '),
          href: isWardrobe ? '/wardrobe.html' : '/inventory.html',
          icon: isWardrobe ? '\ud83d\udc55' : '\ud83d\udce6'
        };
      }
    ));

    // Outfits
    add('Outfits', safe(
      `SELECT id, name, notes FROM wardrobe_outfits
       WHERE name LIKE ? OR notes LIKE ? LIMIT ?`,
      [like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Outfits', id: r.id, label: r.name, sub: null, href: '/wardrobe.html', icon: '\ud83d\udc57' })
    ));

    // Perfumes
    add('Perfume', safe(
      `SELECT id, name, brand, status FROM perfumes
       WHERE name LIKE ? OR brand LIKE ? OR top_notes LIKE ? OR base_notes LIKE ? OR notes LIKE ?
       LIMIT ?`,
      [like, like, like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Perfume', id: r.id, label: r.name, sub: [r.brand, r.status].filter(Boolean).join(' \u00b7 '), href: '/perfume.html', icon: '\ud83c\udf38' })
    ));

    // Books
    add('Books', safe(
      `SELECT id, title, author, status FROM books
       WHERE title LIKE ? OR author LIKE ? OR notes LIKE ? LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Books', id: r.id, label: r.title, sub: [r.author, r.status].filter(Boolean).join(' \u00b7 '), href: '/books.html', icon: '\ud83d\udcda' })
    ));

    // Resources
    add('Resources', safe(
      `SELECT id, name, category, description FROM resources
       WHERE name LIKE ? OR category LIKE ? OR description LIKE ? LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Resources', id: r.id, label: r.name, sub: r.category, href: '/resources.html', icon: '\ud83d\udd17' })
    ));

    // Contacts
    add('Contacts', safe(
      `SELECT id, name, contact_type, company, phone_primary, email FROM contacts
       WHERE name LIKE ? OR company LIKE ? OR phone_primary LIKE ? OR email LIKE ? OR notes LIKE ?
       LIMIT ?`,
      [like, like, like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Contacts', id: r.id, label: r.name, sub: [r.contact_type, r.company].filter(Boolean).join(' \u00b7 '), href: '/settings.html#contacts', icon: '\ud83d\udc64' })
    ));

    // Family members
    add('Family', safe(
      `SELECT id, display_name, relationship, date_of_birth FROM family_members
       WHERE display_name LIKE ? OR notes LIKE ? OR relationship LIKE ? LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Family', id: r.id, label: r.display_name, sub: r.relationship, href: `/reports.html?open=family-snap&member=${r.id}`, icon: '\ud83d\udc65' })
    ));

    // Medical
    add('Medical', safe(
      `SELECT 'med' as kind, id, name as label, dosage, status, patient FROM med_medications
         WHERE name LIKE ? OR notes LIKE ?
       UNION ALL
       SELECT 'cond' as kind, id, condition_name as label, NULL as dosage, status, patient FROM med_conditions
         WHERE condition_name LIKE ? OR notes LIKE ?
       LIMIT ?`,
      [like, like, like, like, PER_MODULE_LIMIT],
      r => ({
        module: 'Medical', id: r.id, label: r.label,
        sub: [r.kind === 'med' ? r.dosage : 'Condition', r.status, r.patient].filter(Boolean).join(' \u00b7 '),
        href: '/medical.html', icon: r.kind === 'med' ? '\ud83d\udc8a' : '\ud83e\ude7a'
      })
    ));

    // Properties
    add('Property', safe(
      `SELECT id, nickname, property_type, address_street FROM properties
       WHERE nickname LIKE ? OR property_type LIKE ? OR address_street LIKE ? OR notes LIKE ?
       LIMIT ?`,
      [like, like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Property', id: r.id, label: r.nickname || r.address_street, sub: r.property_type, href: '/property.html', icon: '\ud83c\udfe0' })
    ));

    // Vehicles
    add('Vehicles', safe(
      `SELECT id, nickname, make, model, vin, license_plate FROM vehicles
       WHERE nickname LIKE ? OR make LIKE ? OR model LIKE ? OR vin LIKE ? OR license_plate LIKE ? OR notes LIKE ?
       LIMIT ?`,
      [like, like, like, like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Vehicles', id: r.id, label: r.nickname || `${r.make} ${r.model}`.trim(), sub: r.license_plate, href: '/property.html', icon: '\ud83d\ude97' })
    ));

    // Insurance
    add('Insurance', safe(
      `SELECT id, policy_number, status, notes FROM insurance_policies
       WHERE policy_number LIKE ? OR notes LIKE ? LIMIT ?`,
      [like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Insurance', id: r.id, label: r.policy_number, sub: r.status, href: '/insurance.html', icon: '\ud83d\udee1\ufe0f' })
    ));

    // Subscriptions
    add('Subscriptions', safe(
      `SELECT id, name, category, status FROM subscriptions
       WHERE name LIKE ? OR category LIKE ? OR notes LIKE ? LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Subscriptions', id: r.id, label: r.name, sub: [r.category, r.status].filter(Boolean).join(' \u00b7 '), href: '/subscriptions.html', icon: '\ud83d\udd01' })
    ));

    // Career
    add('Career', safe(
      `SELECT 'job'  as kind, id, title  as label, company   as sub FROM career_jobs           WHERE title LIKE ? OR company LIKE ? OR description LIKE ?
       UNION ALL
       SELECT 'cert' as kind, id, name   as label, status    as sub FROM career_certifications WHERE name LIKE ? OR notes LIKE ?
       UNION ALL
       SELECT 'skill' as kind, id, name  as label, category  as sub FROM career_skills         WHERE name LIKE ? OR notes LIKE ?
       UNION ALL
       SELECT 'goal' as kind, id, title  as label, status    as sub FROM career_goals          WHERE title LIKE ? OR notes LIKE ?
       UNION ALL
       SELECT 'learn' as kind, id, title as label, provider  as sub FROM career_learning       WHERE title LIKE ? OR description LIKE ? OR notes LIKE ?
       LIMIT ?`,
      [like,like,like, like,like, like,like, like,like, like,like,like, PER_MODULE_LIMIT],
      r => {
        const icon = { job:'\ud83d\udcbc', cert:'\ud83c\udf93', skill:'\ud83d\udee0\ufe0f', goal:'\ud83c\udfaf', learn:'\ud83d\udcd6' }[r.kind] || '\ud83d\udcbc';
        return { module: 'Career', id: r.id, label: r.label, sub: r.sub, href: '/career.html', icon };
      }
    ));

    // Documents
    add('Documents', safe(
      `SELECT id, title, category, description FROM documents
       WHERE title LIKE ? OR category LIKE ? OR description LIKE ? LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Documents', id: r.id, label: r.title, sub: r.category, href: '/documents.html', icon: '\ud83d\udcc4' })
    ));

    // Kids
    add('Kids', safe(
      `SELECT id, display_name, grade, allergies FROM kids
       WHERE display_name LIKE ? OR notes LIKE ? OR allergies LIKE ? LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Kids', id: r.id, label: r.display_name, sub: r.grade, href: '/kids.html', icon: '\ud83e\uddd2' })
    ));

    // Kid activities & notes
    add('Kids', safe(
      `SELECT 'act' as kind, id, name as label, category as sub FROM kid_activities WHERE name LIKE ? OR notes LIKE ?
       UNION ALL
       SELECT 'note' as kind, id, title as label, category as sub FROM kid_notes WHERE title LIKE ?
       LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Kids', id: r.id, label: r.label, sub: r.sub, href: '/kids.html', icon: r.kind === 'act' ? '\u26bd' : '\ud83d\udcdd' })
    ));

    // Finance accounts (banking)
    add('Finance', safe(
      `SELECT id, name, institution FROM finance_accounts
       WHERE name LIKE ? OR institution LIKE ? OR notes LIKE ? LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Finance', id: r.id, label: r.name, sub: r.institution, href: '/finance.html', icon: '\ud83c\udfe6' })
    ));

    // Investments (separate from finance per rules)
    add('Investments', safe(
      `SELECT id, nickname, institution FROM financial_accounts
       WHERE nickname LIKE ? OR institution LIKE ? OR notes LIKE ? LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({ module: 'Investments', id: r.id, label: r.nickname, sub: r.institution, href: '/finance.html', icon: '\ud83d\udcc8' })
    ));

    // Finance transactions
    add('Transactions', safe(
      `SELECT id, date, description, amount, category FROM finance_transactions
       WHERE description LIKE ? OR category LIKE ? OR notes LIKE ?
       ORDER BY date DESC LIMIT ?`,
      [like, like, like, PER_MODULE_LIMIT],
      r => ({
        module: 'Transactions', id: r.id, label: r.description,
        sub: `${r.date} \u00b7 $${Number(r.amount||0).toFixed(2)} \u00b7 ${r.category||''}`,
        href: '/finance.html', icon: '\ud83d\udcb0'
      })
    ));

    // (Tags removed from global search — they are configuration, not data.
    // Search them via Settings → Tags if needed.)

    const total = Object.values(groups).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
    res.json({ groups, total, query: q });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
