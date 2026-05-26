// Throwaway debug config — used to run trade-debug.spec.js without
// touching the deploy gate's playwright.config.js testMatch list.
// Delete after the v.201.x trade.html fix lands.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['trade-debug.spec.js'],
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.GHRAVA_URL || 'http://192.168.4.62:3001',
    headless: true,
    navigationTimeout: 15_000,
    actionTimeout: 5_000,
  },
});
