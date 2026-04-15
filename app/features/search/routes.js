// @ts-check
'use strict';
/**
 * features/search/routes.js
 * Cross-module global search. GET /api/v1/search?q=
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError, badRequest } = require('../../shared/errors');

const MIN_LEN = 2;

function searchModule(sql, params, module, labelFn, hrefFn, iconFn) {
  try {
    return db.prepare(sql).all(...params).map(r => ({
      module,
      id:    r.id,
      label: labelFn(r),
      sub:   r.sub || null,
      href:  hrefFn(r),
      icon:  iconFn(r),
    }));
  } catch { return []; }
}

router.get('/', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < MIN_LEN) return res.json({ groups: {}, total: 0, query: q });

    const like = `%${q}%`;
    const results = [];

    // Inventory items
    results.push(...searchModule(
      `SELECT id, name as label, brand, category FROM items WHERE is_active=1 AND is_archived=0 AND (name LIKE ? OR brand LIKE ? OR model_number LIKE ?) LIMIT 5`,
      [like, like, like], 'Inventory',
      r => r.label,
      r => `/inventory.html?q=${encodeURIComponent(q)}`,
      () => '📦'
    ));

    // Todos
    results.push(...searchModule(
      `SELECT id, title as label, status FROM todos WHERE status NOT IN ('done','dismissed') AND title LIKE ? LIMIT 5`,
      [like], 'Todos',
      r => r.label,
      () => '/todos.html',
      () => '✓'
    ));

    // Documents
    results.push(...searchModule(
      `SELECT id, title as label, category FROM documents WHERE is_active=1 AND (title LIKE ? OR category LIKE ?) LIMIT 5`,
      [like, like], 'Documents',
      r => r.label,
      () => '/documents.html',
      () => '📄'
    ));

    // Contacts
    results.push(...searchModule(
      `SELECT id, name as label, contact_type as sub FROM contacts WHERE name LIKE ? OR phone_primary LIKE ? OR email LIKE ? LIMIT 5`,
      [like, like, like], 'Contacts',
      r => r.label,
      () => '/settings.html',
      () => '👤'
    ));

    // Medications
    results.push(...searchModule(
      `SELECT id, name as label, patient as sub FROM med_medications WHERE status='Active' AND name LIKE ? LIMIT 5`,
      [like], 'Medical',
      r => r.label,
      () => '/medical.html',
      () => '💊'
    ));

    // Finance transactions
    results.push(...searchModule(
      `SELECT id, description as label, amount FROM finance_transactions WHERE description LIKE ? ORDER BY date DESC LIMIT 5`,
      [like], 'Finance',
      r => r.label,
      () => '/finance.html',
      () => '💰'
    ));

    // Books
    results.push(...searchModule(
      `SELECT id, title as label, author as sub FROM books WHERE is_active=1 AND (title LIKE ? OR author LIKE ?) LIMIT 5`,
      [like, like], 'Books',
      r => r.label,
      () => '/books.html',
      () => '📚'
    ));

    // Kids
    results.push(...searchModule(
      `SELECT k.id, k.display_name as label, k.grade as sub FROM kids k WHERE k.is_active=1 AND k.display_name LIKE ? LIMIT 3`,
      [like], 'Kids',
      r => r.label,
      () => '/kids.html',
      () => '👧'
    ));

    // Resources
    results.push(...searchModule(
      `SELECT id, name as label, category as sub FROM resources WHERE name LIKE ? LIMIT 5`,
      [like], 'Resources',
      r => r.label,
      () => '/resources.html',
      () => '🔗'
    ));

    // Daily log entries
    results.push(...searchModule(
      `SELECT id, content as label, date as sub FROM daily_log WHERE content LIKE ? ORDER BY date DESC LIMIT 3`,
      [like], 'Daily Log',
      r => r.label?.slice(0, 60) + (r.label?.length > 60 ? '…' : ''),
      () => '/daily-log.html',
      () => '📋'
    ));

    // Group by module
    const groups = {};
    results.forEach(r => {
      if (!groups[r.module]) groups[r.module] = [];
      groups[r.module].push(r);
    });

    res.json({ groups, total: results.length, query: q });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
