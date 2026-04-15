// @ts-check
'use strict';
/**
 * features/reports/expiry.js
 * Document expiry timeline report.
 * GET /api/v1/reports/expiry
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError } = require('../../shared/errors');

router.get('/', (req, res) => {
  try {
    const months      = parseInt(req.query.months) || 24;
    const showExpired = req.query.show_expired === '1';
    const today       = new Date().toISOString().slice(0, 10);

    let sql = `
      SELECT id, title, category, expiry_date, renewal_reminder_days,
             CAST(julianday(expiry_date) - julianday('now') AS INTEGER) as days_until
      FROM documents
      WHERE is_active = 1
        AND expiry_date IS NOT NULL
        AND expiry_date <= date('now', '+' || ? || ' months')
    `;
    const params = [months];

    if (!showExpired) {
      sql += ` AND expiry_date >= date('now', '-90 days')`;
    }
    sql += ` ORDER BY expiry_date ASC`;

    const docs = db.prepare(sql).all(...params);

    const expired   = docs.filter(d => d.days_until < 0).length;
    const next30    = docs.filter(d => d.days_until >= 0 && d.days_until <= 30).length;
    const next90    = docs.filter(d => d.days_until >= 0 && d.days_until <= 90).length;

    res.json({
      total: docs.length,
      expired,
      next_30_days: next30,
      next_90_days: next90,
      documents: docs
    });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
