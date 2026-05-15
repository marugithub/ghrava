#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// validate-schema.js — Node version of validate-schema.py
//
// Runs inside the Ghrava container against the LIVE prod schema. For
// every db.prepare(`SQL`) call in app/, runs EXPLAIN against the live
// DB and reports any "no such column / no such table" errors.
//
//     docker exec ghrava node /app/.claude/skills/ghrava-schema-safety/scripts/validate-schema.js
//
// Flags:
//     --strict       Block on ANY failure (default: report only)
//     --files <list> Validate only specific files (space-separated)
//
// Exit code:
//     0 = clean
//     1 = failures found (reporting mode)
//     2 = failures found (strict mode → blocks package)
// ─────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

// Args
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const filesIdx = args.indexOf('--files');
const explicitFiles = filesIdx >= 0 ? args.slice(filesIdx + 1).filter(a => !a.startsWith('--')) : null;

// Find DB
const DB_PATHS = [
  process.env.GHRAVA_DB,
  '/app/data/lifetracker.db',
  '/data/lifetracker.db',
].filter(Boolean);

let dbPath = null;
for (const p of DB_PATHS) {
  try { if (fs.existsSync(p)) { dbPath = p; break; } } catch (e) {}
}
if (!dbPath) {
  console.error('ERROR: could not find lifetracker.db');
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true });

// Walk app/ for .js files
const APP_DIR = '/app';
function walkJs(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'migrations' || entry.name === 'data') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJs(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

let files = walkJs(APP_DIR);
if (explicitFiles && explicitFiles.length) {
  const wanted = new Set(explicitFiles.map(f => path.resolve(APP_DIR, '..', f)));
  files = files.filter(f => wanted.has(f));
}

console.error(`Validating ${files.length} JS file(s) against live schema (${dbPath})…`);

const fails = [];
let checked = 0;

// Match db.prepare(`...`) — single statement in backticks, no JS interpolation
const re = /db\.prepare\(\s*`([^`]+)`\s*\)/g;

for (const fp of files) {
  let content;
  try { content = fs.readFileSync(fp, 'utf8'); } catch (e) { continue; }
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(content)) !== null) {
    const sql = m[1].trim();
    if (sql.includes('${')) continue;
    checked++;
    try {
      db.prepare('EXPLAIN ' + sql);
    } catch (e) {
      const es = String(e.message || e);
      if (/no such column|has no column|no such table/.test(es)) {
        const lineNo = content.slice(0, m.index).split('\n').length;
        const rel = path.relative('/app', fp);
        fails.push({ file: rel, line: lineNo, sql: sql.slice(0, 120), err: es });
      }
    }
  }
}

if (fails.length === 0) {
  console.error(`✅ ${checked} prepared statements validated against live schema`);
  process.exit(0);
}

if (strict) {
  console.error(`\n🚨 BLOCKING (--strict): ${fails.length} schema failure(s):\n`);
} else {
  console.error(`\n⚠️  ${fails.length} schema failure(s) found (use --strict to block):\n`);
}

for (const f of fails) {
  console.error(`  app/${f.file}:${f.line}`);
  console.error(`    SQL: ${f.sql}${f.sql.length >= 120 ? '...' : ''}`);
  console.error(`    ERR: ${f.err}\n`);
}

db.close();
process.exit(strict ? 2 : 1);
