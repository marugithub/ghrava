#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// gen-schema-doc.js — Node version of gen-schema-doc.py
//
// Generates SCHEMA.md by querying the LIVE running database directly
// (not by replaying migrations). More accurate than the Python version
// because it reflects the actual prod schema, including any drift.
//
// Run inside the Ghrava container — uses better-sqlite3 already
// installed there:
//
//     docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.js
//
// Or run with a path arg to write SCHEMA.md to a different location:
//
//     docker exec ghrava node .../gen-schema-doc.js /app/SCHEMA.md
// ─────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

// Find the DB. Try the standard prod path first, then env var, then arg.
const DB_PATHS = [
  process.env.GHRAVA_DB,
  '/app/data/lifetracker.db',
  '/data/lifetracker.db',
  path.join(__dirname, '../../../../app/data/lifetracker.db'),
].filter(Boolean);

let dbPath = null;
for (const p of DB_PATHS) {
  try {
    if (fs.existsSync(p)) { dbPath = p; break; }
  } catch (e) {}
}

if (!dbPath) {
  console.error('ERROR: could not find lifetracker.db. Tried:');
  for (const p of DB_PATHS) console.error('  ' + p);
  console.error('Pass an explicit path via GHRAVA_DB env var.');
  process.exit(1);
}

// Output path: arg, or SCHEMA.md at repo root (4 levels up from script)
let outPath = process.argv[2];
if (!outPath) {
  // From .claude/skills/ghrava-schema-safety/scripts/ up to repo root
  outPath = path.resolve(__dirname, '../../../..', 'SCHEMA.md');
}

console.error(`Reading schema from ${dbPath}`);
console.error(`Writing to ${outPath}`);

const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true });

// Get all tables (skip sqlite_ internals + migration marker tables)
const tables = db.prepare(`
  SELECT name FROM sqlite_master
  WHERE type='table'
    AND name NOT LIKE 'sqlite_%'
    AND name NOT LIKE '_migrations%'
  ORDER BY name
`).all().map(r => r.name);

let totalCols = 0;
const lines = [];
lines.push('# SCHEMA.md — Ghrava database reference');
lines.push('');
lines.push(`> **Auto-generated** by \`.claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.js\``);
lines.push(`> Last generated: \`${new Date().toISOString()}\``);
lines.push(`> Source: live prod DB at \`${dbPath}\``);
lines.push('>');
lines.push('> **DO NOT EDIT BY HAND.** Regenerated before every package.');
lines.push('> If a column is missing here, it does not exist on prod.');
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`- **${tables.length} tables**`);

// Count columns up-front for the summary
for (const t of tables) {
  totalCols += db.prepare(`PRAGMA table_info("${t}")`).all().length;
}
lines.push(`- **${totalCols} columns total**`);
lines.push('');
lines.push('## Tables');
lines.push('');

for (const t of tables) {
  const cols = db.prepare(`PRAGMA table_info("${t}")`).all();
  lines.push(`### \`${t}\``);
  lines.push('');
  lines.push('| Column | Type | NN | Default | PK |');
  lines.push('|---|---|---|---|---|');
  for (const c of cols) {
    const dflt = c.dflt_value == null ? '' : `\`${c.dflt_value}\``;
    lines.push(`| \`${c.name}\` | ${c.type || '—'} | ${c.notnull ? '✓' : ''} | ${dflt} | ${c.pk ? '✓' : ''} |`);
  }
  lines.push('');
}

// Footer with known gotchas
lines.push('---');
lines.push('');
lines.push('## Schema gotchas — read before writing SQL');
lines.push('');
lines.push('These caused real prod crashes. Always verify against the table reference above, never against memory.');
lines.push('');
lines.push('| Wrong (DO NOT use) | Right |');
lines.push('|---|---|');
lines.push('| `accounts.account_type` | `accounts.type` |');
lines.push('| `transactions.merchant` | `transactions.description` |');
lines.push('| `transactions.family_member_id` | (column does not exist) |');
lines.push('| `hsa_payments.payment_date` | `hsa_payments.date` |');
lines.push('| `hsa_payments.vendor` | `hsa_payments.provider` |');
lines.push('| `hsa_payments.expense_type` | `hsa_payments.category` |');
lines.push('| `contacts.type` | `contacts.contact_type` |');
lines.push('| `contacts.practice_name` | `contacts.company` |');
lines.push('| `contacts.phone` | `contacts.phone_primary` |');
lines.push('| `family_members.is_active` | (column does not exist) |');
lines.push('| `subscriptions.merchant` | `subscriptions.name` |');
lines.push('| `contact_type = "medical_provider"` | `contact_type = "Medical"` |');
lines.push('');
lines.push('### Two-table traps');
lines.push('');
lines.push('Concepts that have two tables — never assume only one exists:');
lines.push('');
lines.push('- `hsa_plan_info` (older HSA-only) **and** `fsa_plan_info` (newer, multi-plan via `plan_type` column)');
lines.push('- `finance_accounts` (VIEW) **and** `financial_accounts` (VIEW) — both wrap unified `accounts` (mig 130)');
lines.push('- `kids` (per-kid extras) **and** `family_members` (canonical identity) — kids has `family_member_id` FK');
lines.push('');

// Ensure the parent dir exists
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join('\n'));

console.error(`✅ Wrote ${outPath}`);
console.error(`   ${tables.length} tables, ${totalCols} columns from live DB`);
db.close();
