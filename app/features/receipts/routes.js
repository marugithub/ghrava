// @ts-check
'use strict';
/**
 * features/receipts/routes.js
 * Insurance report and field templates API.
 * (Receipt OCR/Tesseract omitted — requires npm install tesseract.js + --build deploy)
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const { serverError, badRequest } = require('../../shared/errors');
const { generateInsuranceReport, generateInsuranceHTML } = require('../../shared/insurance-report');
const { getTemplates, saveTemplate, recordUsage } = require('../../shared/field-templates');

// ── Insurance Report ──────────────────────────────────────────
router.get('/insurance-report', (req, res) => {
  try {
    const config = {};
    db.prepare(`SELECT key, value FROM app_config WHERE key LIKE 'insurance_%'`).all()
      .forEach(r => { config[r.key] = r.value; });

    const options = {
      groupBy:   req.query.groupBy   || config.insurance_report_group_by    || 'room',
      minValue:  parseFloat(req.query.minValue   || config.insurance_min_value_threshold || '0'),
    };

    const data = generateInsuranceReport(options);
    const format = req.query.format || 'json';

    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(generateInsuranceHTML(data));
    } else {
      res.json(data);
    }
  } catch(e) { serverError(res, e); }
});

// ── Field Templates ───────────────────────────────────────────
router.get('/templates/:entityType/:fieldName', (req, res) => {
  try {
    res.json(getTemplates(req.params.entityType, req.params.fieldName));
  } catch(e) { serverError(res, e); }
});

router.post('/templates', (req, res) => {
  try {
    const { entityType, fieldName, value, name } = req.body;
    if (!entityType || !fieldName || !value) return badRequest(res, 'entityType, fieldName, value required');
    const id = saveTemplate(entityType, fieldName, value, name);
    res.status(201).json({ id });
  } catch(e) { serverError(res, e); }
});

router.post('/templates/:id/use', (req, res) => {
  try {
    recordUsage(req.params.id);
    res.json({ ok: true });
  } catch(e) { serverError(res, e); }
});

module.exports = router;
