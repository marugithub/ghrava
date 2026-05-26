// tests/playwright.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  // Pin testDir to this config file's folder so it doesn't get duplicated
  // when Playwright is invoked from a parent directory.
  testDir: __dirname,
  // v.172: was a single-file match ('ghrava-e2e.spec.js'). Broadened so the
  // new smoke + pending-tab specs are discovered by the nightly run and by
  // `playwright test <file>`. Playwright auto-ignores node_modules.
  testMatch: ['ghrava-e2e.spec.js', 'smoke.spec.js', 'pending-tab.spec.js', 'forecast-chart.spec.js', 'asterisk-per-record.spec.js', 'trade-mount.spec.js'],
  timeout: 20_000,               // 20s per test max — app is local LAN
  retries: 1,                    // retry once on flake
  workers: 1,                    // sequential — no concurrent CRUD conflicts

  // Where Playwright stores per-test artifacts (screenshots, traces).
  // Must NOT be the same folder as any reporter output, hence the html
  // reporter writes to playwright-report/ instead of test-results/html.
  outputDir: 'test-results',

  use: {
    baseURL: process.env.GHRAVA_URL || 'http://192.168.4.62:3001',
    headless: true,
    navigationTimeout: 10_000,   // 10s to load a page — prevents networkidle hangs on polling pages
    actionTimeout: 5_000,        // 5s for clicks/selects
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },

  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
