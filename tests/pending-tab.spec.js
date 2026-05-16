/**
 * pending-tab.spec.js — v.171 Pending Items Report tab
 *
 * Loads /reports.html?tab=pending and checks the transaction-linking
 * report renders its shell: heading, filter chips, and the shared
 * grid/list view toolbar. If the test instance has pending rows, it
 * also checks a row expands into its picker drawer.
 *
 * Shallow on purpose — this guards against the Pending module failing
 * to mount (pending-report.js not loading, GH_VIEW missing, the
 * /pending API 500ing), not against business logic.
 *
 * Usage:
 *   npm run pending              # from tests/
 *   npx playwright test pending-tab.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.GHRAVA_URL || 'http://192.168.4.62:3001';

test('Pending tab renders shell (heading, chips, view toolbar)', async ({ page }) => {
  // 'load' not 'networkidle' — reports.html polls notifications on a
  // 30s interval so networkidle never settles (same reason as the
  // e2e suite's checkNoRawHtml helper).
  await page.goto(`${BASE}/reports.html?tab=pending`, { waitUntil: 'load' });

  // PendingReport.mount() fetches counts + items before painting the
  // shell, so wait for the title rather than asserting immediately.
  const title = page.locator('h2.pr-title', { hasText: 'Pending items' });
  await expect(title).toBeVisible({ timeout: 10_000 });

  // Filter chips: the "All" chip always renders even with zero items.
  const chips = page.locator('.pr-chips .pr-chip');
  expect(await chips.count()).toBeGreaterThan(0);
  await expect(page.locator('.pr-chip', { hasText: 'All' })).toBeVisible();

  // Shared GH_VIEW toolbar — grid + list buttons. Storage prefix is
  // 'pending', so GH_VIEW renders #pending-vgrid / #pending-vlist
  // inside #pendingViewToolbar.
  await expect(page.locator('#pendingViewToolbar .gh-view-toolbar')).toBeVisible();
  await expect(page.locator('#pending-vgrid')).toBeVisible();
  await expect(page.locator('#pending-vlist')).toBeVisible();
});

test('Pending row (if any) expands into its picker drawer', async ({ page }) => {
  await page.goto(`${BASE}/reports.html?tab=pending`, { waitUntil: 'load' });
  await expect(page.locator('h2.pr-title')).toBeVisible({ timeout: 10_000 });

  const rows = page.locator('.pr-row');
  const rowCount = await rows.count();
  test.skip(rowCount === 0, 'No pending items in this instance — nothing to expand');

  // Clicking the row's click-zone calls PendingReport.toggle(), which
  // adds .expanded and renders the inline .pr-picker drawer.
  await rows.first().locator('.pr-row-click').click();
  await expect(rows.first()).toHaveClass(/expanded/);
  await expect(page.locator('.pr-picker').first()).toBeVisible();
});
