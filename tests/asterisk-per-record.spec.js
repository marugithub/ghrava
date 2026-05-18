/**
 * asterisk-per-record.spec.js — v.173 acceptance
 *
 * Proves the /api/v1/pending/asterisk probe honors record_id
 * (per-record math) while keeping the v.171 global probe intact.
 *
 * Expected state by deploy:
 *   - Against v.172 (current NAS): the record_id=999999 case FAILS,
 *     because v.172 ignores record_id and returns the GLOBAL fuel
 *     count (non-zero / colored). That red is intentional — it flips
 *     green once v.173 is packaged and deployed.
 *   - Against v.173: all three pass.
 *
 * Usage:
 *   npx playwright test asterisk-per-record.spec.js
 * Targets GHRAVA_URL (default http://192.168.4.62:3001).
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.GHRAVA_URL || 'http://192.168.4.62:3001';

// Every asterisk response must carry exactly this shape.
function expectShape(body, path) {
  for (const k of ['card', 'record_id', 'color', 'count', 'hint']) {
    expect(body, `${path}: missing key "${k}"`).toHaveProperty(k);
  }
  expect(typeof body.count, `${path}: count must be a number`).toBe('number');
  expect(
    body.color === null || ['amber', 'red'].includes(body.color),
    `${path}: color must be null|amber|red (got ${body.color})`
  ).toBe(true);
}

async function getJson(request, path) {
  const res = await request.get(`${BASE}${path}`);
  expect(res.status(), `${path} should return HTTP 200`).toBe(200);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${path} did not return JSON (got: ${text.slice(0, 120)})`);
  }
}

test('hsa_payment global probe (no record_id) — back-compat preserved', async ({ request }) => {
  const path = '/api/v1/pending/asterisk?card=hsa_payment';
  const body = await getJson(request, path);
  expectShape(body, path);
  expect(body.record_id, 'global probe echoes record_id: null').toBeNull();
  expect(body.count, 'global count is >= 0').toBeGreaterThanOrEqual(0);
  expect(body.hint, 'hint mentions "medical expense"').toContain('medical expense');
});

test('hsa_payment per-record probe — record_id honored, hint format unchanged', async ({ request }) => {
  // Discover a live account id; fall back to 1 if the data-table
  // allowlist doesn't expose accounts. The assertion below does not
  // depend on the exact count, only on shape + echo + hint format.
  let acctId = 1;
  try {
    const rows = await getJson(request, '/api/v1/data/table?name=accounts');
    const list = Array.isArray(rows) ? rows : rows.rows || rows.data || [];
    if (list.length && list[0].id) acctId = list[0].id;
  } catch {
    /* allowlist may exclude accounts — record_id=1 still exercises the path */
  }
  const path = `/api/v1/pending/asterisk?card=hsa_payment&record_id=${acctId}`;
  const body = await getJson(request, path);
  expectShape(body, path);
  expect(body.record_id, 'per-record probe echoes the id sent').toBe(acctId);
  expect(
    body.hint,
    'hint keeps the "N medical expense(s) missing receipt" format'
  ).toMatch(/^\d+ medical expenses? missing receipt$/);
});

test('vehicle_fuel for a nonexistent vehicle → count 0, color null', async ({ request }) => {
  // THE discriminator. v.173 filters by record_id (no rule points at
  // vehicle 999999 → zero). v.172 ignores record_id and returns the
  // global fuel backlog, so this assertion is red until v.173 ships.
  const path = '/api/v1/pending/asterisk?card=vehicle_fuel&record_id=999999';
  const body = await getJson(request, path);
  expectShape(body, path);
  expect(body.count, 'no fuel charges for a nonexistent vehicle').toBe(0);
  expect(body.color, 'count 0 → no asterisk').toBeNull();
});
