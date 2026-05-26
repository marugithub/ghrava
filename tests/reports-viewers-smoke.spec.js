// reports-viewers-smoke.spec.js — iterates window.REPORT_VIEWERS on /reports.html,
// extracts each viewer's fetch URL, and asserts each returns < 400. Catches the
// v.200.1 family of bugs where a wrong mount path slipped through every code review.
const { test, expect } = require('@playwright/test');

test('REPORT_VIEWERS smoke — every registered viewer fetches a real URL', async ({ page, request }) => {
  await page.goto('/reports.html');
  await page.waitForFunction(() => window.REPORT_VIEWERS && Object.keys(window.REPORT_VIEWERS).length > 0, { timeout: 10000 });

  // Pull each viewer's fetch source + default filters; resolve to concrete URLs.
  const callsByViewer = await page.evaluate(() => {
    const out = {};
    for (const [slug, viewer] of Object.entries(window.REPORT_VIEWERS)) {
      const src = viewer.fetch ? viewer.fetch.toString() : '';
      // Extract any '/api/v1/...' literal URLs the fetch source references.
      // Capture full URL including query string (stop at closing quote only, not at '?').
      const urls = [...src.matchAll(/['"`](\/api\/v1\/[^'"`]+)/g)].map(m => m[1]);
      // Substitute year filter if defaultFilters() supplies one (most common param).
      const filters = (viewer.defaultFilters ? viewer.defaultFilters() : []) || [];
      const year = (filters.find(f => f.key === 'year') || {}).value;
      out[slug] = urls.map(u => year && src.includes('?year=') ? u + '?year=' + year : u);
    }
    return out;
  });

  const failures = [];
  for (const [slug, urls] of Object.entries(callsByViewer)) {
    if (!urls.length) {
      // Viewer doesn't fetch at all (acceptable — e.g. pending-tab shortcut).
      continue;
    }
    for (const url of urls) {
      const resp = await request.get(url);
      if (resp.status() >= 400) failures.push(`${slug}: GET ${url} → ${resp.status()}`);
    }
  }

  expect(failures, `viewer endpoint failures:\n${failures.join('\n')}`).toHaveLength(0);
});
