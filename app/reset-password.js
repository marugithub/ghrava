#!/usr/bin/env node
/**
 * Ghrava Password Reset Utility
 * ─────────────────────────────────────────────────────────────
 * Run from inside the container:
 *
 *   docker exec ghrava node /app/reset-password.js yourNewPassword
 *
 * Or from the NAS shell (if you have the app directory mapped):
 *
 *   docker exec ghrava node /app/reset-password.js yourNewPassword
 *
 * This will:
 *   1. Set a new bcrypt-hashed password in app_config
 *   2. Clear ALL active sessions (everyone is logged out)
 *   3. Mark setup as complete so the login prompt appears
 *
 * After running, open the app — you'll be prompted for the new password.
 * ─────────────────────────────────────────────────────────────
 */

const bcrypt = require('bcryptjs');
const path   = require('path');

// Load DB from same location server.js uses
const db = require(path.join(__dirname, 'db/db'));

async function main() {
  const newPassword = process.argv[2];

  if (!newPassword) {
    console.error('\n  ✗  Usage: node reset-password.js <new-password>\n');
    console.error('  Example: docker exec ghrava node /app/reset-password.js myNewPass123\n');
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error('\n  ✗  Password must be at least 6 characters\n');
    process.exit(1);
  }

  console.log('\n  Ghrava — Password Reset');
  console.log('  ───────────────────────');

  try {
    // Hash the new password
    console.log('  Hashing password…');
    const hash = await bcrypt.hash(newPassword, 10);

    // Store in app_config
    const existing = db.prepare("SELECT 1 FROM app_config WHERE key = 'app_password_hash'").get();
    if (existing) {
      db.prepare("UPDATE app_config SET value = ? WHERE key = 'app_password_hash'").run(hash);
    } else {
      db.prepare("INSERT INTO app_config (key, value) VALUES ('app_password_hash', ?)").run(hash);
    }
    console.log('  ✓  Password updated');

    // Mark setup complete
    db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('setup_complete', '1')").run();

    // Clear all sessions — everyone must log in again
    const cleared = db.prepare('DELETE FROM _sessions').run();
    console.log(`  ✓  Cleared ${cleared.changes} active session(s)`);

    console.log('\n  Done. Open Ghrava and log in with your new password.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n  ✗  Error:', err.message, '\n');
    process.exit(1);
  }
}

main();
