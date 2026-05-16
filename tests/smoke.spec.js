/**
 * smoke.spec.js — Ghrava 20-second smoke test
 *
 * Hits the handful of aggregator/health endpoints that prove the
 * container started and the routes are mounted. One test per endpoint.
 * Plain pass/fail: HTTP 200 + a non-empty JSON body. No deep
 * assertions — the goal is to catch "container won't start" or
 * "route didn't mount" in seconds, not to validate payload shape.
 *
 * Usage:
 *   npm run smoke                 # from tests/
 *   npx playwright test smoke.spec.js
 *
 * Targets GHRAVA_URL (default http://192.168.4.62:3001 via the
 * playwright config baseURL).
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.GHRAVA_URL || 'http://192.168.4.62:3001';

// Endpoints that must answer for the app to be considered "up".
// /health is top-level (not /api/v1); the rest are module aggregators.
const ENDPOINTS = [
  '/health',
  '/api/v1/pending/counts',
  '/api/v1/finance/landing',
  '/api/v1/finance/forecast?days=30',
  '/api/v1/medical/summary',
  '/api/v1/today',
  '/api/v1/data/table?name=vehicles',
  '/api/v1/data/table?name=subscriptions',
];

for (const path of ENDPOINTS) {
  test(`GET ${path} → 200 + non-empty JSON`, async ({ request }) => {
    const res = await request.get(`${BASE}${path}`);
    expect(res.status(), `${path} should return HTTP 200`).toBe(200);

    // Body must parse as JSON and carry something — an object with
    // at least one key, or a non-empty array. An empty object/array
    // or HTML error page is a fail.
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${path} did not return JSON (got: ${text.slice(0, 120)})`);
    }
    const nonEmpty = Array.isArray(body)
      ? body.length > 0
      : body && typeof body === 'object' && Object.keys(body).length > 0;
    expect(nonEmpty, `${path} returned an empty JSON body`).toBe(true);
  });
}
