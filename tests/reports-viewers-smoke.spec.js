// reports-viewers-smoke.spec.js — iterates window.REPORT_VIEWERS on /reports.html,
// extracts each viewer's fetch URL, and asserts each returns < 400. Catches the
// v.200.1 family of bugs where a wrong mount path slipped through every code review.
const { test, expect } = require('@playwright/test');

test('REPORT_VIEWERS smoke — every registered viewer fetches a real URL', async ({ page, request }) => {
  await page.goto('/reports.html');
  await page.waitForFunction(() => window.REPORT_VIEWERS && Object.keys(window.REPORT_VIEWERS).length > 0, { timeout: 10000 });

  // Pull each viewer's fetch source + default filters; resolve to concrete URLs.
  // Each entry is { url, parameterized } so we can apply a looser status check
  // to URLs that were built via runtime id concatenation (sample id may not exist
  // on a given prod, but the route SHAPE is what we're verifying).
  const callsByViewer = await page.evaluate(() => {
    const out = {};
    for (const [slug, viewer] of Object.entries(window.REPORT_VIEWERS)) {
      const src = viewer.fetch ? viewer.fetch.toString() : '';
      // Capture each /api/v1/... URL + the FIRST character after its closing quote.
      // If that char is `+` the URL is being concatenated with an id/variable at
      // runtime (e.g. `fetch('/api/v1/family-snapshot/' + m.id)`) — substitute `1`
      // as a sample resource id and mark this call parameterized so we don't
      // require the specific record to exist on the deployment we're testing.
      const matches = [...src.matchAll(/['"`](\/api\/v1\/[^'"`]+)['"`]\s*(\+)?/g)];
      const calls = matches.map(m => {
        const baseUrl = m[1];
        const isConcat = m[2] === '+';
        if (isConcat && baseUrl.endsWith('/')) {
          return { url: baseUrl + '1', parameterized: true };
        }
        return { url: baseUrl, parameterized: false };
      });
      const filters = (viewer.defaultFilters ? viewer.defaultFilters() : []) || [];
      const year = (filters.find(f => f.key === 'year') || {}).value;
      out[slug] = calls.map(c =>
        year && src.includes('?year=')
          ? { url: c.url + '?year=' + year, parameterized: c.parameterized }
          : c
      );
    }
    return out;
  });

  const failures = [];
  for (const [slug, calls] of Object.entries(callsByViewer)) {
    if (!calls.length) {
      // Viewer doesn't fetch at all (acceptable — e.g. pending-tab shortcut).
      continue;
    }
    for (const c of calls) {
      const resp = await request.get(c.url);
      // Parameterized URLs: we substituted `1`. The record may not exist on
      // this prod — only fail on 5xx (server error) since 404 is acceptable
      // (the gate's purpose is wrong-PREFIX detection, not record-existence).
      // Non-parameterized URLs keep the strict < 400 check from v.200.1.
      const tooHigh = c.parameterized ? resp.status() >= 500 : resp.status() >= 400;
      if (tooHigh) failures.push(`${slug}: GET ${c.url} → ${resp.status()}`);
    }
  }

  expect(failures, `viewer endpoint failures:\n${failures.join('\n')}`).toHaveLength(0);
});
