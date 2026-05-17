/**
 * forecast-chart.spec.js — v.172 #26.1.5 cash-flow forecast (live)
 *
 * The smoke spec proves /api/v1/finance/forecast answers; this proves
 * the wired chart actually paints. Loads /reports.html?tab=charts and
 * checks card c115 renders the live forecast SVG (not the loading,
 * empty, or error placeholder).
 *
 * Usage:
 *   npm run forecast            # from tests/
 *   npx playwright test forecast-chart.spec.js
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.GHRAVA_URL || 'http://192.168.4.62:3001';

test('#26.1.5 forecast card paints a live SVG', async ({ page }) => {
  // 'load' not 'networkidle' — reports.html polls notifications on a
  // 30s interval (same reason as the other reports specs).
  await page.goto(`${BASE}/reports.html?tab=charts`, { waitUntil: 'load' });

  // renderChartsPreview() builds the grid, then setTimeout(50) →
  // renderMockCharts() → renderForecastChart() does an async fetch
  // before injecting. Give the canvas room to paint.
  const canvas = page.locator('#canvas-c115');
  await expect(canvas.locator('svg')).toBeVisible({ timeout: 12_000 });

  // It must be the real forecast line, not a placeholder. The live
  // SVG draws the running-balance <path> and a "Projected balance"
  // legend; the loading/empty/error states are plain <div> text.
  expect(await canvas.locator('svg path').count()).toBeGreaterThan(0);
  await expect(canvas).toContainText('Projected balance');
  await expect(canvas).not.toContainText('Could not load the forecast');
  await expect(canvas).not.toContainText('Loading forecast');

  // Footer should now read "live", not "mockup".
  const card = page.locator('.ch-card[data-chart="c115"]');
  await expect(card.locator('.ch-card-status')).toHaveText(/live/);
});
