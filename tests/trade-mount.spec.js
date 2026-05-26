// trade-mount.spec.js — single hard gate against the v.196 → v.201.1 regression
// where a stray JSX fragment left #root empty. Captures any pageerror and
// asserts the React tree actually mounted with non-trivial content.
const { test, expect } = require('@playwright/test');

test('trade.html — React root mounts without page errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(`${err.name}: ${err.message}`));

  await page.goto('/trade.html', { waitUntil: 'domcontentloaded' });
  // Babel-standalone in-browser transform takes a few seconds on first paint.
  await page.waitForTimeout(5000);

  const rootHTML = await page.locator('#root').innerHTML();
  expect(pageErrors, `unexpected pageerror events:\n${pageErrors.join('\n')}`).toHaveLength(0);
  expect(rootHTML.length, 'React tree did not mount (#root is empty or near-empty)').toBeGreaterThan(100);
});
