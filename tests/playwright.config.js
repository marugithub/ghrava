// tests/playwright.config.js
// Playwright configuration for Ghrava E2E test suite

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'ghrava-e2e.spec.js',
  timeout: 30_000,
  retries: 1,                    // retry once on flake — network hiccups on LAN
  workers: 1,                    // sequential — avoid concurrent CRUD conflicts
  use: {
    baseURL: process.env.GHRAVA_URL || 'http://192.168.4.62:3001',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },
  reporter: [
    ['list'],                     // console output
    ['json', { outputFile: 'test-results/results.json' }],
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
  ],
});
