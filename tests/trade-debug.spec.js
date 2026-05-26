// Throwaway diagnostic — loads /trade.html, captures all console + page errors,
// reports whether the React root mounted. Delete after v.201.x fix lands.
const { test, expect } = require('@playwright/test');

test('trade.html — capture boot errors', async ({ page }) => {
  const consoleMsgs = [];
  const pageErrors = [];

  page.on('console', msg => {
    consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    pageErrors.push(`${err.name}: ${err.message}\n${err.stack || ''}`);
  });

  await page.goto((process.env.GHRAVA_URL || 'http://192.168.4.62:3001') + '/trade.html', { waitUntil: 'domcontentloaded' });

  // Give Babel + React time to transform + mount
  await page.waitForTimeout(5000);

  // Did the root mount anything?
  const rootHTML = await page.locator('#root').innerHTML();
  const rootMounted = rootHTML && rootHTML.length > 50;

  // Title sanity
  const title = await page.title();

  console.log('\n========= TRADE.HTML DIAGNOSTIC =========');
  console.log('Title:', title);
  console.log('Root mounted (>50 chars):', rootMounted);
  console.log('Root inner length:', rootHTML.length);
  console.log('Root first 200 chars:', rootHTML.slice(0, 200));
  console.log('\n--- pageerror events (' + pageErrors.length + ') ---');
  pageErrors.forEach(e => console.log(e));
  console.log('\n--- console messages (' + consoleMsgs.length + ') ---');
  consoleMsgs.forEach(m => console.log(m));
  console.log('=========================================\n');

  // Don't fail — we just want the output. But assert we got SOMETHING.
  expect(title).toContain('Trade');
});
