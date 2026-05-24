// @ts-check
/**
 * features/preferences/routes.js
 * PRIVATE — requireAuth applied at top, covers all routes in this file.
 *
 * User preferences for UI surfaces that need persistent personalisation.
 * First consumer: the Pinned strip on /reports.html (Reports Redesign
 * Foundation, v.197). Future consumers can add fields without migrating
 * — the column shape stays narrow on purpose.
 *
 * Single-user model: every read/write keys off user_key='default'. If
 * Ghrava ever grows multi-user, this is the seam to plumb a real user
 * key through.
 */
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../auth/middleware');
const db = require('../../db/db');
const { serverError, badRequest } = require('../../shared/errors');

router.use(requireAuth);

// GET /api/v1/preferences/pinned-reports
// Returns { pinned_reports: [<slug>, ...] }. Always 200 — empty array
// when nothing pinned, never 404, so the frontend Pinned strip can render
// the empty state without special-casing.
router.get('/pinned-reports', (req, res) => {
  try {
    // schema: user_preferences(user_key TEXT, pinned_reports TEXT JSON)
    const row = db.prepare(
      `SELECT pinned_reports FROM user_preferences WHERE user_key = 'default' LIMIT 1`
    ).get();
    if (!row) return res.json({ pinned_reports: [] });
    try {
      const arr = JSON.parse(row.pinned_reports);
      res.json({ pinned_reports: Array.isArray(arr) ? arr : [] });
    } catch {
      res.json({ pinned_reports: [] });   // corrupt JSON → treat as empty, don't surface a 500
    }
  } catch (e) { serverError(res, e); }
});

// PUT /api/v1/preferences/pinned-reports
// Body: { pinned_reports: [<slug>, ...] }
// Server enforces: array-of-strings, deduped, capped at 4 (per locked spec).
// Returns the normalised list so the client can reconcile on response.
router.put('/pinned-reports', (req, res) => {
  try {
    const incoming = req.body?.pinned_reports;
    if (!Array.isArray(incoming)) return badRequest(res, 'pinned_reports must be an array of slugs');
    // Filter to non-empty strings, dedupe (preserves first-seen order), cap at 4.
    const seen = new Set();
    const slugs = [];
    for (const s of incoming) {
      if (typeof s !== 'string') continue;
      const k = s.trim();
      if (!k || seen.has(k)) continue;
      seen.add(k); slugs.push(k);
      if (slugs.length >= 4) break;
    }
    // schema: user_preferences(pinned_reports TEXT JSON, updated_at DATETIME)
    const result = db.prepare(
      `UPDATE user_preferences SET pinned_reports = ?, updated_at = CURRENT_TIMESTAMP WHERE user_key = 'default'`
    ).run(JSON.stringify(slugs));
    // If the seed row was somehow missing (mig 147 not applied yet), insert it.
    if (result.changes === 0) {
      // schema: user_preferences(user_key, pinned_reports)
      db.prepare(
        `INSERT INTO user_preferences (user_key, pinned_reports) VALUES ('default', ?)`
      ).run(JSON.stringify(slugs));
    }
    res.json({ ok: true, pinned_reports: slugs });
  } catch (e) { serverError(res, e); }
});

module.exports = router;
