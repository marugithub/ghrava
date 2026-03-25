// tests/playwright.config.js
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: 'ghrava-e2e.spec.js',
  timeout: 20_000,               // 20s per test max — app is local LAN
  retries: 1,                    // retry once on flake
  workers: 1,                    // sequential — no concurrent CRUD conflicts

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
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
  ],
});
