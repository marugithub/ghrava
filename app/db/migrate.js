// @ts-nocheck
/**
 * db/migrate.js
 *
 * MIGRATION NAMING NOTE: 002_hsa_medical.sql and 002_inventory_v3.sql both
 * have the "002_" prefix — this is a legacy naming quirk. Both are already
 * applied on any existing DB (tracked by filename in _migrations table).
 * Do NOT rename them — that would cause them to re-run on existing installs.
 * All new migrations must use unique sequential numbers: 015_, 016_, etc.
 * — runs any .sql files in db/migrations/ not yet applied.
 * Called automatically on every server start — safe to run repeatedly.
 * To change the schema: add a new numbered file (003_xxx.sql, etc.)
 * Never edit an already-applied migration file.
 *
 * Each migration runs inside a transaction — either all statements succeed
 * and are committed, or the whole migration rolls back and nothing changes.
 * This prevents the partial-run stuck state that plagued earlier versions.
 */
const fs   = require('fs');
const path = require('path');
const db   = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    filename   TEXT UNIQUE NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const migrationsDir = path.join(__dirname, 'migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') || f.endsWith('.js'))
  .sort();

let applied = 0;
let skipped = 0;

for (const file of files) {
  const already = db.prepare('SELECT 1 FROM _migrations WHERE filename = ?').get(file);
  if (already) { skipped++; continue; }

  try {
    if (file.endsWith('.js')) {
      // JS migration — exports a function(db) that handles its own safety
      const migration = require(path.join(migrationsDir, file));
      migration(db);
    } else {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const statements = sql
        .split(';')
        .map(s => s.replace(/--[^\n]*/g, '').trim())
        .filter(s => s.length > 0)
        .filter(s => !['BEGIN','COMMIT','ROLLBACK'].includes(s.toUpperCase()));
      const runMigration = db.transaction(() => {
        for (const stmt of statements) {
          db.exec(stmt + ';');
        }
      });
      runMigration();
    }
    db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(file);
    console.log(`  apply ${file}`);
    applied++;
  } catch (err) {
    console.error(`  FAILED ${file}: ${err.message}`);
    console.error(`  Nothing was committed — fix the migration and redeploy`);
  }
}

console.log(`Migrations: ${applied} applied, ${skipped} skipped\n`);
