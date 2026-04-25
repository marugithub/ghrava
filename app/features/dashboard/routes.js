'use strict';
/**
 * features/dashboard/routes.js
 *
 * Aggregates data from all modules to power the home screen.
 *
 * GET /          — summary counts + recent activity across all modules
 * GET /attention — items needing action: expiring docs/certs, overdue todos,
 *                  follow-up log entries, low-stock H&W inventory
 *
 * This module is read-only (no writes). It joins multiple tables in a
 * single request so the dashboard loads in one round-trip.
 * All routes are public — no auth required.
 */
const express = require('express');
const router  = express.Router();
const db      = require('../../db/db');
const fs      = require('fs');
const path    = require('path');

const BACKUP_DIR = process.env.BACKUP_DIR || '/app/backups';

function currentYear() { return new Date().getFullYear(); }

function safeGet(fn) { try { return fn(); } catch(e) { return null; } }

// GET /api/v1/dashboard  — public, aggregates all widget data
router.get('/', (req, res) => {
  try {
    const year = currentYear();

    const inv = db.prepare(`
      SELECT
        COUNT(DISTINCT i.id) AS items,
        COALESCE(SUM(i.purchase_price * i.quantity),0) AS est_value,
        COUNT(DISTINCT CASE WHEN hw.expiration_date IS NOT NULL
              AND hw.expiration_date <= date('now','+30 days')
              AND hw.expiration_date >= date('now') THEN i.id END) AS expiring_soon,
        COUNT(DISTINCT CASE WHEN hw.expiration_date < date('now') THEN i.id END) AS expired
      FROM items i
      LEFT JOIN item_hw_details hw ON hw.item_id = i.id
      WHERE i.is_active=1 AND i.is_archived=0
    `).get();

    const hsaPay = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN you_paid ELSE 0 END),0) AS pool
      FROM hsa_payments WHERE strftime('%Y',date) = ?
    `).get(String(year));
    const hsaOtc = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN amount ELSE 0 END),0) AS pool
      FROM hsa_otc WHERE strftime('%Y',date) = ?
    `).get(String(year));
    const hsaPool = (hsaPay.pool || 0) + (hsaOtc.pool || 0);

    const hsaMissing = db.prepare(`
      SELECT COUNT(*) AS n FROM hsa_payments
      WHERE strftime('%Y',date) = ? AND receipt_saved=0 AND hsa_eligible=1
    `).get(String(year)).n;

    const logRecent = db.prepare(`
      SELECT id, log_date, category, entry_text, follow_up_needed, follow_up_date
      FROM daily_log ORDER BY log_date DESC, created_at DESC LIMIT 1
    `).get() || null;

    const followUps = db.prepare(`
      SELECT COUNT(*) AS n FROM daily_log
      WHERE follow_up_needed=1 AND (follow_up_date IS NULL OR follow_up_date >= date('now'))
    `).get().n;

    const overdueFollowUps = db.prepare(`
      SELECT COUNT(*) AS n FROM daily_log
      WHERE follow_up_needed=1 AND follow_up_date < date('now')
    `).get().n;

    const family = db.prepare(
      'SELECT id, display_name, relationship, is_primary_user FROM family_members ORDER BY is_primary_user DESC, display_name'
    ).all();

    const medStats = safeGet(() => db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM contacts WHERE contact_type='Medical') AS physicians,
        (SELECT COUNT(*) FROM med_conditions)   AS conditions,
        (SELECT COUNT(*) FROM med_medications)  AS medications,
        (SELECT COUNT(*) FROM med_visit_notes WHERE visit_date >= date('now','-90 days')) AS recent_visits
    `).get()) || { physicians:0, conditions:0, medications:0, recent_visits:0 };

    const resourceCount = safeGet(() =>
      db.prepare("SELECT COUNT(*) as n FROM resources").get().n
    ) || 0;

    const todoStats = db.prepare(`
      SELECT
        COUNT(*) AS open_count,
        COUNT(CASE WHEN priority='urgent' THEN 1 END) AS urgent_count,
        COUNT(CASE WHEN due_date < date('now') THEN 1 END) AS overdue_count,
        COUNT(CASE WHEN due_date = date('now') THEN 1 END) AS due_today
      FROM todos WHERE status IN ('open','in_progress')
    `).get() || { open_count: 0, urgent_count: 0, overdue_count: 0, due_today: 0 };

    // ── New module stats (graceful — tables may not exist yet) ──

    const gcStats = safeGet(() => db.prepare(`
      SELECT
        COUNT(*) AS count,
        COALESCE(SUM(current_balance),0) AS total_balance,
        COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= date('now','+30 days') AND expiry_date >= date('now') THEN 1 END) AS expiring_soon
      FROM gift_cards WHERE is_active=1
    `).get());

    const nwStats = safeGet(() => db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN current_balance > 0 AND include_net_worth=1 THEN current_balance ELSE 0 END),0) AS assets,
        COALESCE(SUM(CASE WHEN current_balance < 0 AND include_net_worth=1 THEN ABS(current_balance) ELSE 0 END),0) AS liabilities
      FROM finance_accounts WHERE is_active=1
    `).get());

    const certStats = safeGet(() => {
      const s = db.prepare(`
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= date('now','+60 days') AND expiry_date >= date('now') THEN 1 END) AS expiring_soon,
          COUNT(CASE WHEN expiry_date IS NOT NULL AND expiry_date < date('now') THEN 1 END) AS expired
        FROM career_certifications WHERE status != 'Expired'
      `).get();
      const jobs = db.prepare("SELECT COUNT(*) AS n FROM career_jobs WHERE is_current=1").get();
      return { ...s, active_jobs: jobs?.n || 0 };
    });

    const bookStats = safeGet(() => db.prepare(`
      SELECT
        COUNT(CASE WHEN status='Currently Reading' THEN 1 END) AS reading,
        COUNT(CASE WHEN status='Read' THEN 1 END) AS read_count,
        COUNT(CASE WHEN status='Want to Read' THEN 1 END) AS want_count
      FROM books WHERE is_active=1
    `).get());

    const propStats = safeGet(() => {
      const ps = db.prepare(`SELECT current_est_value, mortgage_balance FROM properties WHERE is_active=1`).all();
      const vs = db.prepare(`SELECT current_est_value, loan_balance, registration_expires, inspection_expires FROM vehicles WHERE is_active=1`).all();
      const today = new Date().toISOString().slice(0,10);
      const warn30 = new Date(Date.now()+30*864e5).toISOString().slice(0,10);
      const alerts = vs.filter(v =>
        (v.registration_expires && v.registration_expires <= warn30) ||
        (v.inspection_expires && v.inspection_expires <= warn30)
      ).length;
      return {
        properties: ps.length,
        vehicles: vs.length,
        total_est_value: ps.reduce((s,p)=>s+(parseFloat(p.current_est_value)||0),0) + vs.reduce((s,v)=>s+(parseFloat(v.current_est_value)||0),0),
        total_owed: ps.reduce((s,p)=>s+(parseFloat(p.mortgage_balance)||0),0) + vs.reduce((s,v)=>s+(parseFloat(v.loan_balance)||0),0),
        vehicle_alerts: alerts,
      };
    });

    const kidsStats = safeGet(() => {
      const total = db.prepare('SELECT COUNT(*) AS n FROM kids WHERE is_active=1').get().n;
      const activities = db.prepare('SELECT COUNT(*) AS n FROM kid_activities WHERE is_active=1').get().n;
      return { total, activities };
    });

    // ── Expiring documents (next 90 days) ──────────────────────
    const expiringDocs = safeGet(() => db.prepare(`
      SELECT id, title, doc_type, expiry_date
      FROM documents
      WHERE is_active=1 AND expiry_date IS NOT NULL
        AND expiry_date >= date('now')
        AND expiry_date <= date('now','+90 days')
      ORDER BY expiry_date ASC
      LIMIT 10
    `).all()) || [];

    // ── Backup status ───────────────────────────────────────────
    const backupStatus = safeGet(() => {
      if (!fs.existsSync(BACKUP_DIR)) return { last_backup: null, last_backup_size: null, days_since_backup: null, overdue: true };
      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => ({ filename: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
        .sort((a, b) => b.mtime - a.mtime);
      if (!files.length) return { last_backup: null, last_backup_size: null, days_since_backup: null, overdue: true };
      const latest = files[0];
      const stat = fs.statSync(path.join(BACKUP_DIR, latest.filename));
      const daysSince = Math.floor((Date.now() - latest.mtime) / 864e5);
      return {
        last_backup: latest.mtime.toISOString(),
        last_backup_filename: latest.filename,
        last_backup_size: stat.size,
        days_since_backup: daysSince,
        overdue: daysSince > 7,
      };
    }) || { last_backup: null, last_backup_size: null, days_since_backup: null, overdue: true };

    res.json({
      year,
      inventory:  { items: inv.items, est_value: inv.est_value,
                    expiring_soon: inv.expiring_soon, expired: inv.expired },
      hsa:        { unreimbursed_pool: hsaPool, missing_receipts: hsaMissing },
      daily_log:  { recent: logRecent, follow_ups_pending: followUps,
                    follow_ups_overdue: overdueFollowUps },
      medical:    medStats,
      family,
      resources:  { count: resourceCount },
      todos:      todoStats,
      gift_cards: gcStats,
      net_worth:  nwStats ? { net_worth: (nwStats.assets||0) - (nwStats.liabilities||0),
                              assets: nwStats.assets, liabilities: nwStats.liabilities } : null,
      certifications: certStats,
      books:      bookStats,
      property:   propStats,
      kids:       kidsStats,
      expiring_documents: expiringDocs,
      doc_total: safeGet(() => db.prepare('SELECT COUNT(*) AS n FROM documents WHERE is_active=1').get().n),
      backup:     backupStatus,
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Aggregated attention items ─────────────────────────────────
// Single endpoint that collects ALL "needs attention" signals across modules
router.get('/attention', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const warn30 = new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0,10);
    const warn7  = new Date(Date.now() +  7*24*60*60*1000).toISOString().slice(0,10);

    const items = [];

    // Daily log — overdue follow-ups
    const overdueLog = db.prepare(`
      SELECT id, category, entry_text, follow_up_date
      FROM daily_log WHERE follow_up_needed=1 AND follow_up_date < ?
      ORDER BY follow_up_date ASC LIMIT 10
    `).all(today);
    overdueLog.forEach(r => items.push({
      module: 'daily_log', severity: 'overdue',
      label: `Follow-up overdue`,
      detail: r.entry_text.slice(0,60),
      date: r.follow_up_date,
      href: '/daily-log.html',
    }));

    // Todos — overdue
    const overdueTodos = db.prepare(`
      SELECT id, title, due_date, priority FROM todos
      WHERE status IN ('open','in_progress') AND due_date < ?
      ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, due_date ASC LIMIT 10
    `).all(today);
    overdueTodos.forEach(r => items.push({
      module: 'todos', severity: r.priority === 'urgent' ? 'critical' : 'overdue',
      label: `Todo overdue${r.priority === 'urgent' ? ' — URGENT' : ''}`,
      detail: r.title.slice(0,60),
      date: r.due_date,
      href: '/todos.html',
    }));

    // Gift cards — expired
    const expiredGc = db.prepare(`
      SELECT id, retailer, expiry_date, current_balance FROM gift_cards
      WHERE is_active=1 AND expiry_date IS NOT NULL AND expiry_date < ?
    `).all(today);
    expiredGc.forEach(r => items.push({
      module: 'gift_cards', severity: 'overdue',
      label: `Gift card expired`,
      detail: `${r.retailer} — $${parseFloat(r.current_balance||0).toFixed(2)} remaining`,
      date: r.expiry_date,
      href: '/finance.html',
    }));

    // Gift cards — expiring soon (7 days)
    const expiringGc = db.prepare(`
      SELECT id, retailer, expiry_date, current_balance FROM gift_cards
      WHERE is_active=1 AND expiry_date IS NOT NULL AND expiry_date >= ? AND expiry_date <= ?
    `).all(today, warn7);
    expiringGc.forEach(r => items.push({
      module: 'gift_cards', severity: 'warning',
      label: `Gift card expiring soon`,
      detail: `${r.retailer} — expires ${r.expiry_date}`,
      date: r.expiry_date,
      href: '/finance.html',
    }));

    // HSA — missing receipts
    try {
      const missingHsa = db.prepare(`
        SELECT COUNT(*) AS n FROM hsa_payments WHERE receipt_path IS NULL AND amount > 0
      `).get()?.n || 0;
      if (missingHsa > 0) items.push({
        module: 'hsa', severity: 'warning',
        label: `HSA receipts missing`,
        detail: `${missingHsa} expense${missingHsa > 1 ? 's' : ''} without receipt`,
        date: null,
        href: '/finance.html',
      });
    } catch(e) {}

    // Certifications — expiring or expired
    try {
      const expiredCerts = db.prepare(`
        SELECT id, name, expiry_date FROM certifications
        WHERE expiry_date IS NOT NULL AND expiry_date < ?
      `).all(today);
      expiredCerts.forEach(r => items.push({
        module: 'career', severity: 'overdue',
        label: `Certification expired`,
        detail: r.name,
        date: r.expiry_date,
        href: '/career.html',
      }));

      const expiringCerts = db.prepare(`
        SELECT id, name, expiry_date FROM certifications
        WHERE expiry_date IS NOT NULL AND expiry_date >= ? AND expiry_date <= ?
      `).all(today, warn30);
      expiringCerts.forEach(r => items.push({
        module: 'career', severity: 'warning',
        label: `Certification expiring`,
        detail: `${r.name} — expires ${r.expiry_date}`,
        date: r.expiry_date,
        href: '/career.html',
      }));
    } catch(e) {}

    // Vehicle registrations / inspections expiring
    try {
      const vehicles = db.prepare(`
        SELECT id, nickname, make, model, registration_expires, inspection_expires
        FROM vehicles WHERE is_active=1
      `).all();
      vehicles.forEach(v => {
        if (v.registration_expires && v.registration_expires <= warn30) {
          items.push({
            module: 'property', severity: v.registration_expires < today ? 'overdue' : 'warning',
            label: v.registration_expires < today ? 'Registration expired' : 'Registration expiring',
            detail: `${v.nickname||v.make+' '+v.model}`,
            date: v.registration_expires, href: '/property.html',
          });
        }
        if (v.inspection_expires && v.inspection_expires <= warn30) {
          items.push({
            module: 'property', severity: v.inspection_expires < today ? 'overdue' : 'warning',
            label: v.inspection_expires < today ? 'Inspection expired' : 'Inspection expiring',
            detail: `${v.nickname||v.make+' '+v.model}`,
            date: v.inspection_expires, href: '/property.html',
          });
        }
      });
    } catch(e) {}

    // Property maintenance overdue
    try {
      const overdueMaint = db.prepare(`
        SELECT pm.id, pm.description, pm.next_due_date, p.nickname
        FROM property_maintenance pm
        JOIN properties p ON p.id = pm.property_id
        WHERE pm.next_due_date IS NOT NULL AND pm.next_due_date < ?
          AND (pm.is_completed IS NULL OR pm.is_completed = 0)
        ORDER BY pm.next_due_date ASC LIMIT 5
      `).all(today);
      overdueMaint.forEach(r => items.push({
        module: 'property', severity: 'overdue',
        label: 'Maintenance overdue',
        detail: `${r.nickname} — ${r.description.slice(0,50)}`,
        date: r.next_due_date, href: '/property.html',
      }));
    } catch(e) {}

    // Insurance — expired or expiring (column names verified against schema)
    try {
      const expiredIns = db.prepare(`
        SELECT id, policy_number, coverage_end_date, policy_type FROM insurance_policies
        WHERE coverage_end_date IS NOT NULL AND coverage_end_date < ?
      `).all(today);
      expiredIns.forEach(r => items.push({
        module: 'insurance', severity: 'overdue',
        label: 'Insurance policy expired',
        detail: `${r.policy_type||'Policy'} ${r.policy_number||''}`.trim(),
        date: r.coverage_end_date, href: '/insurance.html',
      }));
      const expiringIns = db.prepare(`
        SELECT id, policy_number, coverage_end_date, policy_type FROM insurance_policies
        WHERE coverage_end_date IS NOT NULL AND coverage_end_date >= ? AND coverage_end_date <= ?
      `).all(today, warn30);
      expiringIns.forEach(r => items.push({
        module: 'insurance', severity: 'warning',
        label: 'Insurance expiring',
        detail: `${r.policy_type||'Policy'} ${r.policy_number||''}`.trim() + ` \u2014 ${r.coverage_end_date}`,
        date: r.coverage_end_date, href: '/insurance.html',
      }));
    } catch(e) {}

    // Subscriptions — billing soon (next 7 days). Schema: next_billing_date, cost.
    try {
      const renewSubs = db.prepare(`
        SELECT id, name, next_billing_date, cost FROM subscriptions
        WHERE next_billing_date IS NOT NULL AND next_billing_date >= ? AND next_billing_date <= ?
      `).all(today, warn7);
      renewSubs.forEach(r => items.push({
        module: 'subscriptions', severity: 'warning',
        label: 'Subscription renewing',
        detail: `${r.name} \u2014 $${Number(r.cost||0).toFixed(2)} on ${r.next_billing_date}`,
        date: r.next_billing_date, href: '/subscriptions.html',
      }));
    } catch(e) {}

    // Inventory warranties expiring (next 30 days) or expired
    try {
      const expiredWarr = db.prepare(`
        SELECT id, name, warranty_expires FROM items
        WHERE warranty_expires IS NOT NULL AND warranty_expires < ?
        ORDER BY warranty_expires DESC LIMIT 5
      `).all(today);
      expiredWarr.forEach(r => items.push({
        module: 'inventory', severity: 'overdue',
        label: 'Warranty expired',
        detail: r.name,
        date: r.warranty_expires, href: '/inventory.html',
      }));
      const expiringWarr = db.prepare(`
        SELECT id, name, warranty_expires FROM items
        WHERE warranty_expires IS NOT NULL AND warranty_expires >= ? AND warranty_expires <= ?
        ORDER BY warranty_expires ASC LIMIT 10
      `).all(today, warn30);
      expiringWarr.forEach(r => items.push({
        module: 'inventory', severity: 'warning',
        label: 'Warranty expiring',
        detail: `${r.name} \u2014 ${r.warranty_expires}`,
        date: r.warranty_expires, href: '/inventory.html',
      }));
    } catch(e) {}

    // Records flagged needs_review across modules — surface as a single roll-up
    try {
      const reviewTables = ['daily_log','todos','items','contacts','hsa_payments',
                            'med_medications','med_conditions','documents','perfumes',
                            'subscriptions','insurance_policies','books','resources',
                            'family_members','kids','properties','vehicles','finance_accounts',
                            'financial_accounts','wardrobe_outfits','career_certifications'];
      let totalNeedsReview = 0;
      for (const t of reviewTables) {
        try {
          const r = db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE needs_review = 1`).get();
          totalNeedsReview += (r?.n || 0);
        } catch(_) {}
      }
      if (totalNeedsReview > 0) items.push({
        module: 'review', severity: 'warning',
        label: 'Records need review',
        detail: `${totalNeedsReview} record${totalNeedsReview!==1?'s':''} flagged`,
        date: null, href: '/reports.html',
      });
    } catch(e) {}

    // Sort: critical → overdue → warning, then by date
    const sev = { critical: 0, overdue: 1, warning: 2 };
    items.sort((a, b) => {
      const sd = (sev[a.severity]||2) - (sev[b.severity]||2);
      if (sd !== 0) return sd;
      if (a.date && b.date) return a.date.localeCompare(b.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });

    res.json({ items, counts: {
      critical: items.filter(i => i.severity === 'critical').length,
      overdue:  items.filter(i => i.severity === 'overdue').length,
      warning:  items.filter(i => i.severity === 'warning').length,
      total:    items.length,
    }});
  } catch(e) {
    res.json({ items: [], counts: { total: 0 } });
  }
});


// GET /api/v1/dashboard/focus — top urgent items for focus strip
router.get('/focus', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const warn7 = new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10);
    const items = [];

    // Critical todos (urgent + overdue)
    db.prepare(`
      SELECT id, title, due_date, priority FROM todos
      WHERE status IN ('open','in_progress') AND (
        priority = 'urgent' OR (due_date IS NOT NULL AND due_date < ?)
      ) ORDER BY CASE priority WHEN 'urgent' THEN 0 ELSE 1 END, due_date LIMIT 5
    `).all(today).forEach(r => items.push({
      module: 'todos', icon: '✓',
      label: r.title.slice(0,50),
      severity: r.priority === 'urgent' ? 'critical' : 'overdue',
      href: '/todos.html',
    }));

    // Documents expiring in 30 days
    db.prepare(`
      SELECT id, title, expiry_date FROM documents
      WHERE is_active=1 AND expiry_date IS NOT NULL AND expiry_date <= date('now','+30 days') AND expiry_date >= date('now','-7 days')
      ORDER BY expiry_date LIMIT 3
    `).all().forEach(r => items.push({
      module: 'documents', icon: '📄',
      label: `${r.title} expires ${r.expiry_date}`,
      severity: r.expiry_date < today ? 'overdue' : 'warning',
      href: '/documents.html',
    }));

    // Certifications expiring in 30 days
    try {
      db.prepare(`
        SELECT id, cert_name, expiry_date FROM career_certifications
        WHERE status != 'Expired' AND expiry_date IS NOT NULL AND expiry_date <= date('now','+30 days')
        ORDER BY expiry_date LIMIT 2
      `).all().forEach(r => items.push({
        module: 'career', icon: '🎖',
        label: `Cert: ${r.cert_name} expires ${r.expiry_date}`,
        severity: 'warning',
        href: '/career.html',
      }));
    } catch {}

    // Overdue follow-ups
    db.prepare(`
      SELECT id, entry_text, follow_up_date FROM daily_log
      WHERE follow_up_needed=1 AND follow_up_date < ? ORDER BY follow_up_date LIMIT 3
    `).all(today).forEach(r => items.push({
      module: 'daily_log', icon: '📋',
      label: `Follow-up: ${r.entry_text.slice(0,40)}`,
      severity: 'overdue',
      href: '/daily-log.html',
    }));

    // Sort: critical first, then overdue, then warning
    const order = { critical: 0, overdue: 1, warning: 2 };
    items.sort((a,b) => (order[a.severity]||3) - (order[b.severity]||3));

    res.json({ items: items.slice(0, 8), count: items.length });
  } catch(e) { serverError(res, e); }
});

// GET /api/v1/dashboard/backup-health — backup status for health widget
router.get('/backup-health', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ status: 'unknown', message: 'Backup dir not found', last_backup: null });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db') || f.endsWith('.zip'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
      .sort((a,b) => b.mtime - a.mtime);
    if (!files.length) return res.json({ status: 'warning', message: 'No backups found', last_backup: null });
    const last = files[0];
    const daysSince = Math.floor((Date.now() - last.mtime.getTime()) / 86400000);
    const warnDays = parseInt(db.prepare("SELECT value FROM app_config WHERE key='backup_reminder_days'").get()?.value || '7');
    const status = daysSince === 0 ? 'ok' : daysSince <= warnDays ? 'ok' : daysSince <= warnDays*2 ? 'warning' : 'overdue';
    res.json({
      status,
      message: daysSince === 0 ? 'Backed up today' : `Last backup ${daysSince}d ago`,
      last_backup: last.mtime.toISOString(),
      days_since: daysSince,
      count: files.length,
    });
  } catch(e) { serverError(res, e); }
});
module.exports = router;
