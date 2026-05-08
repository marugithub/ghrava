// @ts-check
'use strict';
/**
 * shared/folder-watcher.js
 * Watches NAS folders and auto-imports files based on rules.
 * Requires: chokidar (npm install chokidar)
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const db     = require('../db/db');

let _watchers   = [];
let _isWatching = false;

// ── Prepared statements ───────────────────────────────────────
const stmt = {
  getByPath:   db.prepare(`SELECT id, file_hash, import_status FROM watcher_file_registry WHERE file_path = ?`),
  upsertFile:  db.prepare(`
    INSERT INTO watcher_file_registry (file_path, file_hash, file_size, file_modified, import_status)
    VALUES (?, ?, ?, ?, 'pending')
    ON CONFLICT(file_path) DO UPDATE SET
      file_hash = excluded.file_hash, file_size = excluded.file_size,
      file_modified = excluded.file_modified, last_scanned = CURRENT_TIMESTAMP
  `),
  setStatus:   db.prepare(`UPDATE watcher_file_registry SET import_status=?, import_error=?, imported_at=CURRENT_TIMESTAMP WHERE id=?`),
  logStart:    db.prepare(`INSERT INTO watcher_import_history (file_registry_id, rule_name, module, account_id, started_at, status) VALUES (?,?,?,?,CURRENT_TIMESTAMP,'processing')`),
  logFinish:   db.prepare(`UPDATE watcher_import_history SET completed_at=CURRENT_TIMESTAMP, status=?, transactions_imported=?, error_message=? WHERE id=?`),
  getPending:  db.prepare(`SELECT * FROM watcher_file_registry WHERE import_status='pending' ORDER BY last_scanned DESC LIMIT ?`),
  getStats:    db.prepare(`SELECT import_status, COUNT(*) as n FROM watcher_file_registry GROUP BY import_status`),
  getConfig:   db.prepare(`SELECT value FROM app_config WHERE key='folder_watcher_config'`),
  getEnabled:  db.prepare(`SELECT value FROM app_config WHERE key='folder_watcher_enabled'`),
};

// ── Helpers ───────────────────────────────────────────────────
async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash   = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end',  () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function getConfig() {
  try { return JSON.parse(stmt.getConfig.get()?.value || '{"watch_paths":[],"rules":[],"catch_all":{"enabled":true}}'); }
  catch { return { watch_paths: [], rules: [], catch_all: { enabled: true } }; }
}

function matchRule(filePath, rule) {
  if (!rule.enabled) return false;
  const lpath = filePath.toLowerCase();
  if (rule.path_contains?.length) {
    if (!rule.path_contains.some(p => lpath.includes(p.toLowerCase()))) return false;
  }
  if (rule.patterns?.length) {
    const fname = path.basename(filePath).toLowerCase();
    if (!rule.patterns.some(pat => {
      const regex = '^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$';
      return new RegExp(regex, 'i').test(fname);
    })) return false;
  }
  return true;
}

// ── Core file processor ───────────────────────────────────────
async function processFile(filePath, ruleOverride) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return;
    const hash = await hashFile(filePath);
    stmt.upsertFile.run(filePath, hash, stat.size, stat.mtime.toISOString());
    const rec = stmt.getByPath.get(filePath);
    if (!rec) return;

    // Already imported with same hash — skip
    if (rec.import_status === 'imported') { return; }
    if (rec.import_status === 'ignored')  { return; }

    const rule = ruleOverride || getConfig().rules?.find(r => matchRule(filePath, r));
    const histId = stmt.logStart.run(rec.id, rule?.name || 'catch-all', rule?.module || 'pending', rule?.account_id || null).lastInsertRowid;

    if (!rule) {
      // No match — leave as pending (inbox)
      stmt.logFinish.run('pending', 0, null, histId);
      return;
    }

    // Route to importer
    let imported = 0;
    try {
      if (rule.module === 'eob') {
        imported = await importEob(filePath, rule);
      } else if (rule.module === 'statement') {
        imported = await importStatement(filePath, rule);
      } else if (rule.module === 'attach') {
        // v202604.140 — Generic attach-as-draft rule. Reusable across
        // modules (HSA receipts, future modules). See importAsAttachment.
        imported = await importAsAttachment(filePath, rule);
      } else {
        throw new Error(`Module '${rule.module}' not implemented`);
      }
      stmt.setStatus.run('imported', null, rec.id);
      stmt.logFinish.run('completed', imported, null, histId);
      console.log(`[Watcher] ✓ ${path.basename(filePath)} → ${imported} items`);
    } catch(e) {
      stmt.setStatus.run('failed', e.message, rec.id);
      stmt.logFinish.run('failed', 0, e.message, histId);
      console.error(`[Watcher] ✗ ${path.basename(filePath)}: ${e.message}`);
    }
  } catch(e) {
    console.error(`[Watcher] processFile error ${path.basename(filePath)}:`, e.message);
  }
}

async function importEob(filePath, rule) {
  const parser = rule.parser || 'mhbp';
  if (parser !== 'mhbp') throw new Error(`Parser '${parser}' not implemented`);
  const buf = fs.readFileSync(filePath);
  const fname = path.basename(filePath);

  // ── v202604.147 — go through the same dedup gate as manual /eob/import ──
  // File-level hash gate first (cheapest). Then per-statement record-level
  // gate via the dedup helper. Anything ambiguous lands in med_pending_review
  // and an auto-todo is created so the user is notified.
  const dedup = require('../features/medical/dedup');
  const stmtCols = db.prepare("PRAGMA table_info(med_eob_statements)").all().map(r => r.name);
  const hasFileHash = stmtCols.includes('file_hash');
  const fileHash = hasFileHash ? dedup.fileHash(buf) : null;
  if (hasFileHash && fileHash) {
    const sameFile = db.prepare('SELECT id FROM med_eob_statements WHERE file_hash=? LIMIT 1').get(fileHash);
    if (sameFile) {
      // Already imported — silent skip. Watcher counts 0.
      return 0;
    }
  }

  const { parseEobPdf } = require('../features/medical/eob-parser');
  const statements = await parseEobPdf(buf, fname);

  const { resolvePatient } = require('./namematch');
  const { flagRecord } = require('./needs-review');

  let claimsImported = 0;

  const tx = db.transaction(() => {
    for (const s of statements) {
      if (!s.statement_date || !s.member_id) continue;

      const sHash = dedup.eobStatementHash(s);
      const exists = db.prepare(
        'SELECT id, file_hash FROM med_eob_statements WHERE statement_date=? AND member_id=?'
      ).get(s.statement_date, s.member_id);

      if (exists) {
        // Same record key, different file → re-issued EOB → queue for review.
        // Watcher source is non-manual so queueReview auto-creates a todo.
        if (!exists.file_hash || exists.file_hash !== fileHash) {
          dedup.queueReview(db, {
            source: 'watcher',
            entity_type: 'eob_statement',
            proposed_action: 'review_reissue',
            payload: s,
            existing_id: exists.id,
            dedup_hash: sHash,
            file_hash: fileHash,
            reason: `Re-issued EOB for ${s.statement_date} (${path.basename(filePath)}) — file differs from already-imported version`,
          });
        }
        continue;
      }

      // Insert statement row
      const stmtId = db.prepare(`
        INSERT INTO med_eob_statements
          (insurer,plan_name,group_name,member_id,group_number,member_name,
           statement_date,period_start,period_end,
           amount_billed,allowed_amount,pending_not_payable,deductible_applied,
           copay_total,coinsurance_total,plan_paid_total,your_share_total,
           amount_saved,healthfund_applied,
           deductible_annual,deductible_used,deductible_remaining,
           oop_max_annual,oop_used,oop_remaining,
           healthfund_total,healthfund_used,healthfund_remaining,source_filename)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        s.insurer||'MHBP', s.plan_name||null, s.group_name||null,
        s.member_id, s.group_number||null, s.member_name||null,
        s.statement_date, s.period_start||null, s.period_end||null,
        s.amount_billed||null, s.allowed_amount||null, s.pending_not_payable||null,
        s.deductible_applied||null, s.copay_total||null, s.coinsurance_total||null,
        s.plan_paid_total||null, s.your_share_total||null,
        s.amount_saved||null, s.healthfund_applied||null,
        s.deductible_annual||null, s.deductible_used||null, s.deductible_remaining||null,
        s.oop_max_annual||null, s.oop_used||null, s.oop_remaining||null,
        s.healthfund_total||null, s.healthfund_used||null, s.healthfund_remaining||null,
        s.source_filename||fname
      ).lastInsertRowid;

      // Provenance + dedup hash
      if (hasFileHash) {
        db.prepare(`
          UPDATE med_eob_statements SET file_hash=?, dedup_hash=?, auto_imported=1 WHERE id=?
        `).run(fileHash, sHash, stmtId);
      }

      // Insert claims with dedup hashes
      const claimCols = db.prepare("PRAGMA table_info(med_eob_claims)").all().map(r => r.name);
      const claimHasDedup = claimCols.includes('dedup_hash');
      for (const c of (s.claims || [])) {
        const patientRaw = c.patient || 'Unknown';
        const nameMatch = resolvePatient(patientRaw);
        const claimId = db.prepare(`
          INSERT INTO med_eob_claims
            (eob_id,patient,family_member_id,claim_id,received_date,provider,network_status,send_date,
             amount_billed,member_rate,pending_not_payable,applied_to_deductible,
             copay,plan_paid,fund_paid,coinsurance,your_share)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).run(
          stmtId, patientRaw, nameMatch.id||null, c.claim_id||null, c.received_date||null,
          c.provider||null, c.network_status||null, c.send_date||null,
          c.amount_billed||null, c.member_rate||null, c.pending_not_payable||null,
          c.applied_to_deductible||null, c.copay||null, c.plan_paid||null,
          c.fund_paid||null, c.coinsurance||null, c.your_share||null
        ).lastInsertRowid;
        claimsImported++;
        if (claimHasDedup) {
          const cHash = dedup.eobClaimHash({ patient: patientRaw, claim_id: c.claim_id, send_date: c.send_date });
          db.prepare('UPDATE med_eob_claims SET dedup_hash=? WHERE id=?').run(cHash, claimId);
        }
        if (nameMatch.confidence !== 'exact') {
          try {
            const reason = nameMatch.confidence === 'none'
              ? `Patient not matched: "${patientRaw}"`
              : nameMatch.confidence === 'ambiguous'
                ? `Patient ambiguous: "${patientRaw}"`
                : `Patient auto-matched: "${patientRaw}"`;
            const cat = nameMatch.confidence === 'none' ? 'name_unmatched' : 'data_quality';
            flagRecord('med_eob_claims', claimId, reason, cat);
          } catch {}
        }
        // Insert services
        for (const sv of (c.services || [])) {
          db.prepare(`
            INSERT INTO med_eob_services
              (claim_id,service_description,service_code,service_date,
               amount_billed,member_rate,plan_share,your_share)
            VALUES (?,?,?,?,?,?,?,?)
          `).run(
            claimId, sv.service_description||null, sv.service_code||null,
            sv.service_date||null, sv.amount_billed||null, sv.member_rate||null,
            sv.plan_share||null, sv.your_share||null
          );
        }
      }
      for (const b of (s.balances || [])) {
        db.prepare(`
          INSERT INTO med_eob_balances (eob_id,person,balance_type,annual_limit,amount_used,amount_remaining)
          VALUES (?,?,?,?,?,?)
        `).run(stmtId, b.person, b.balance_type, b.annual_limit||null, b.amount_used||null, b.amount_remaining||null);
      }
    }
  });
  tx();
  return claimsImported;
}

async function importStatement(filePath, rule) {
  if (!rule.account_id) throw new Error('No account_id in rule');
  const account = db.prepare('SELECT account_type FROM financial_accounts WHERE id=?').get(rule.account_id);
  if (!account) throw new Error(`Account ${rule.account_id} not found`);
  // Routing — actual parse + insert mirrors /finance/transactions/import-file
  // For now: count rows in CSV as a placeholder (real parser wired per account type)
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines   = content.split('\n').filter(l => l.trim()).length - 1; // minus header
  return Math.max(0, lines);
}

/**
 * v202604.140 — Generic "attach as draft" importer.
 *
 * Rule shape:
 *   {
 *     name: 'HSA receipts',
 *     watch_path: '/.../_inbox/receipts',
 *     module: 'attach',
 *     target_module: 'hsa',           // module folder + entity_type prefix
 *     target_table:  'hsa_payments',  // where the draft row lands
 *     pot:           'hsa'            // optional, for HSA-vs-FSA routing
 *   }
 *
 * Behavior:
 *   1. Hash file (already done by caller).
 *   2. Skip if same hash already attached anywhere (true duplicate).
 *   3. Move file into <target_module>/ folder using hash-prefix naming.
 *   4. Insert attachments row with entity_type='draft' (placeholder).
 *   5. Insert minimal draft row in target_table (status='draft', linked
 *      to attachment via inbox_attachment_id).
 *   6. Update attachments.entity_id to point at the new draft row.
 *
 * The user later opens the inbox modal, fills the 4 fields, and the
 * draft becomes a final row.
 */
async function importAsAttachment(filePath, rule) {
  if (!rule.target_module) throw new Error('attach rule missing target_module');
  if (!rule.target_table)  throw new Error('attach rule missing target_table');

  const fname = path.basename(filePath);
  const stat  = fs.statSync(filePath);
  const buf   = fs.readFileSync(filePath);
  const fullHash = crypto.createHash('sha256').update(buf).digest('hex');

  // Duplicate detection — same file content already attached?
  // (We use the registry hash; attachments table doesn't currently store hashes.)
  const dup = db.prepare(`
    SELECT id, file_path FROM attachments
    WHERE file_path LIKE ?
    LIMIT 1
  `).get(`%/${fullHash.slice(0,8)}_%`);
  if (dup) {
    console.log(`[Watcher] duplicate (hash match) ${fname} → existing attachment #${dup.id}`);
    return 0;
  }

  // Move into target module folder using hash-prefix convention
  const lifecycle = require('./attach-lifecycle');
  const newPath = lifecycle.moveToModule(filePath, rule.target_module, fullHash, fname);

  // Detect mime
  const ext = (path.extname(fname) || '').toLowerCase();
  const mime = ({
    '.pdf':'application/pdf', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
    '.png':'image/png', '.gif':'image/gif', '.webp':'image/webp',
    '.heic':'image/heic', '.heif':'image/heif', '.txt':'text/plain'
  })[ext] || 'application/octet-stream';

  // Insert as a placeholder attachment first (entity_id NULL — the draft
  // row doesn't exist yet). We backfill entity_id after creating the draft.
  const attRes = db.prepare(`
    INSERT INTO attachments (entity_type, entity_id, attachment_type, file_name, file_path, file_size, mime_type, label)
    VALUES ('draft', NULL, 'upload', ?, ?, ?, ?, 'Inbox draft')
  `).run(fname, newPath, stat.size, mime);
  const attachmentId = attRes.lastInsertRowid;

  // Create the minimal draft row in the target table.
  // Schema-aware: we know hsa_payments and fsa_payments shape from the v140 migration.
  let draftId;
  if (rule.target_table === 'hsa_payments') {
    const r = db.prepare(`
      INSERT INTO hsa_payments (date, amount, status, inbox_attachment_id, hsa_eligible)
      VALUES (date('now'), 0, 'draft', ?, 0)
    `).run(attachmentId);
    draftId = r.lastInsertRowid;
  } else if (rule.target_table === 'fsa_payments') {
    const r = db.prepare(`
      INSERT INTO fsa_payments (date, amount, status, inbox_attachment_id, fsa_eligible)
      VALUES (date('now'), 0, 'draft', ?, 0)
    `).run(attachmentId);
    draftId = r.lastInsertRowid;
  } else {
    // Roll back the attachment row if we don't know how to draft into target
    db.prepare('DELETE FROM attachments WHERE id=?').run(attachmentId);
    throw new Error(`attach target_table '${rule.target_table}' not supported yet`);
  }

  // Now backfill the attachment to point at the draft
  // entity_type uses the SINGULAR row name to match existing conventions
  // ('hsa_payment', 'fsa_payment')
  const entityType = rule.target_table.replace(/s$/, '');
  db.prepare(`
    UPDATE attachments SET entity_type=?, entity_id=? WHERE id=?
  `).run(entityType, draftId, attachmentId);

  console.log(`[Watcher] attach ${fname} → ${rule.target_table} draft #${draftId}`);
  return 1;
}

// ── Directory scanner ─────────────────────────────────────────
let _scanRunning = false;
async function scanDirectory(dirPath, recursive = true) {
  if (_scanRunning) return { skipped: true };
  if (!fs.existsSync(dirPath)) return { error: 'Path not found' };
  _scanRunning = true;
  let processed = 0, pending = 0;
  try {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && recursive) { walk(full); }
        else if (entry.isFile()) { processFile(full); processed++; }
      }
    };
    walk(dirPath);
    const stats = getImportStats();
    pending = stats.pending || 0;
  } finally { _scanRunning = false; }
  return { processed, pending };
}

// ── Watcher lifecycle ─────────────────────────────────────────
function startWatcher() {
  if (_isWatching) return;
  const enabled = stmt.getEnabled.get()?.value === '1';
  if (!enabled) return;
  const config = getConfig();
  if (!config.watch_paths?.length) return;

  let chokidar;
  try { chokidar = require('chokidar'); }
  catch { console.error('[Watcher] chokidar not installed — run npm install'); return; }

  _isWatching = true;
  console.log('[Watcher] Starting…');

  for (const wp of config.watch_paths) {
    if (!wp.enabled || !fs.existsSync(wp.path)) continue;
    console.log(`[Watcher] Watching: ${wp.path}`);
    // Initial scan on startup
    scanDirectory(wp.path, wp.recursive !== false);
    const w = chokidar.watch(wp.path, {
      ignored:         /(^|[/\\])\..|\.processed|\.error|\.ignored/,
      persistent:      true,
      ignoreInitial:   true,
      depth:           wp.recursive !== false ? undefined : 0,
      awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 },
    });
    w.on('add', fp => processFile(fp));
    _watchers.push(w);
  }
}

function stopWatcher() {
  _watchers.forEach(w => w.close());
  _watchers   = [];
  _isWatching = false;
}

function restartWatcher() { stopWatcher(); setTimeout(startWatcher, 1000); }

function getPendingFiles(limit = 100) { return stmt.getPending.all(limit); }

function getImportStats() {
  const rows   = stmt.getStats.all();
  const result = { total: 0, pending: 0, imported: 0, failed: 0, ignored: 0, skipped: 0 };
  rows.forEach(r => { result[r.import_status] = r.n; result.total += r.n; });
  return result;
}

module.exports = { startWatcher, stopWatcher, restartWatcher, scanDirectory, processFile, getPendingFiles, getImportStats, getConfig };
