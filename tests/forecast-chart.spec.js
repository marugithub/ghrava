/**
 * forecast-chart.spec.js — v.172 #26.1.5 cash-flow forecast (live)
 *
 * v.198 Reports Redesign update — the old reports.html `?tab=charts`
 * pane that hosted the inline forecast SVG was replaced with a tile
 * grid. The cash-flow forecast now lives as a tile under the Money
 * tab; clicking it opens `/reports.html?run=cash-flow`, a viewer page
 * that renders summary cards (Starting Balance / Net Change / Ending
 * Balance / Lowest Point) sourced from the same /finance/forecast
 * endpoint. The smoke spec proves the endpoint answers; this spec
 * proves the wired viewer renders.
 *
 * Usage:
 *   npm run forecast            # from tests/
 *   npx playwright test forecast-chart.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.GHRAVA_URL || 'http://192.168.4.62:3001';

test('#26.1.5 cash-flow forecast viewer renders summary cards', async ({ page }) => {
  // 'load' not 'networkidle' — reports.html polls notifications on a
  // 30s interval (same reason as the other reports specs).
  await page.goto(`${BASE}/reports.html?run=cash-flow`, { waitUntil: 'load' });

  // Viewer root toggles visible when ?run=<slug> is honored.
  await expect(page.locator('#repViewerRoot')).toBeVisible({ timeout: 12_000 });

  // Title row renders the report's friendly name.
  await expect(page.locator('#repViewerTitle')).toContainText(/cash[- ]flow/i, { timeout: 5_000 });

  // Summary cards populate after the async fetch resolves. The card grid
  // has at least one div child once data lands.
  await page.locator('#repViewerSummary > div').first()
    .waitFor({ state: 'visible', timeout: 12_000 });

  // At least one of the expected summary labels should appear.
  const summaryText = await page.locator('#repViewerSummary').textContent();
  expect(summaryText.toLowerCase(),
    'forecast summary should label starting/net/ending/lowest balance'
  ).toMatch(/starting balance|net change|ending balance|lowest point/);

  // The forecast body table should render — either rows with dates OR a
  // friendly empty state when no recurring transactions are configured.
  const bodyText = await page.locator('#repViewerBody').textContent();
  expect(bodyText.length, 'forecast viewer body should not be empty').toBeGreaterThan(0);
});
