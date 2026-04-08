// @ts-nocheck
'use strict';
/** @typedef {import('./types')} */
/**
 * shared/autoTodos.js
 * Auto-generation engine for todos.
 *
 * Queries other modules' tables to detect actionable conditions and
 * upserts/resolves auto-generated todos accordingly.
 *
 * Called by todos/routes.js on every GET / request.
 * Extracted here so todos/routes.js has no direct cross-module table queries.
 *
 * Auto-todo types:
 *  hsa_missing_receipt   — hsa_payments: hsa_eligible=1, no receipt/attachment
 *  hsa_unreimbursed      — unreimbursed HSA pool > $500 for current year
 *  inv_expiring          — item expiration_date within 60 days
 *  inv_warranty_expiring — item warranty_expires within 90 days, no lifetime warranty
 *  inv_missing_doc       — item purchase_price >= $200 with zero attachments
 *  follow_up_overdue     — daily_log entry with overdue follow_up_date
 *  med_discontinued      — medication Discontinued with no end_date
 *  vehicle_service_due   — vehicle_service next_due_date within 30 days
 *  property_maint_due    — property_maintenance next_due_date within 30 days
 */

const db = require('../db/db');

// ── Helpers ────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function currentYear() { return String(new Date().getFullYear()); }

// ── Auto-generation engine ─────────────────────────────────────
// Idempotent: will not create duplicate open auto-todos for the same source.
// Auto-resolves todos whose triggering condition has cleared.
function syncAutoTodos() {
  const now  = todayStr();
  const in60 = daysFromNow(60);
  const in90 = daysFromNow(90);
  const year = currentYear();

  // Insert only if no open/in_progress todo exists for this source
  const upsert = db.prepare(`
    INSERT INTO todos
      (title, notes, due_date, priority, category, is_auto,
       auto_type, auto_source_type, auto_source_id, status)
    SELECT ?,?,?,?,?,1,?,?,?,'open'
    WHERE NOT EXISTS (
      SELECT 1 FROM todos
      WHERE is_auto=1 AND auto_type=? AND auto_source_type=? AND auto_source_id=?
        AND status IN ('open','in_progress')
    )
  `);

  // Mark resolved — only updates open/in_progress
  const resolve = db.prepare(`
    UPDATE todos SET status='done', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
    WHERE is_auto=1 AND auto_type=? AND auto_source_type=? AND auto_source_id=?
      AND status IN ('open','in_progress')
  `);

  // ── 1. HSA payments missing receipt ────────────────────────
  try {
    /** @type {import('./types').HsaPayment[]} */
    const payments = db.prepare(
      `SELECT id, date, patient, provider, you_paid
       FROM hsa_payments WHERE hsa_eligible=1`
    ).all();

    for (const p of payments) {
      const hasAtt = db.prepare(
        `SELECT 1 FROM attachments WHERE entity_type='hsa_payment' AND entity_id=? LIMIT 1`
      ).get(p.id);
      const saved = db.prepare(
        `SELECT receipt_saved FROM hsa_payments WHERE id=?`
      ).get(p.id)?.receipt_saved;

      if (!hasAtt && !saved) {
        const provider = p.provider || 'HSA expense';
        const amt = p.you_paid ? ` ($${Number(p.you_paid).toFixed(2)})` : '';
        upsert.run(
          `Add receipt: ${provider}${amt}`,
          `HSA payment on ${p.date} — attach a receipt or EOB to qualify for reimbursement.`,
          null, 'high', 'HSA',
          'hsa_missing_receipt', 'hsa_payment', p.id,
          'hsa_missing_receipt', 'hsa_payment', p.id
        );
      } else {
        resolve.run('hsa_missing_receipt', 'hsa_payment', p.id);
      }
    }
  } catch (e) { console.error('[todos] hsa_missing_receipt:', e.message); }

  // ── 2. HSA unreimbursed pool > $500 ────────────────────────
  try {
    const payPool = db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN you_paid ELSE 0 END),0) AS p
       FROM hsa_payments WHERE strftime('%Y',date)=?`
    ).get(year)?.p || 0;
    const otcPool = db.prepare(
      `SELECT COALESCE(SUM(CASE WHEN hsa_eligible=1 AND reimbursed=0 THEN amount ELSE 0 END),0) AS p
       FROM hsa_otc WHERE strftime('%Y',date)=?`
    ).get(year)?.p || 0;
    const total = payPool + otcPool;

    const existing = db.prepare(
      `SELECT id FROM todos WHERE is_auto=1 AND auto_type='hsa_unreimbursed'
       AND status IN ('open','in_progress') LIMIT 1`
    ).get();

    if (total > 500 && !existing) {
      db.prepare(
        `INSERT INTO todos (title, notes, due_date, priority, category, is_auto, auto_type, status)
         VALUES (?,?,?,?,?,1,'hsa_unreimbursed','open')`
      ).run(
        `Submit HSA reimbursement — $${Math.round(total).toLocaleString()} available`,
        `You have $${Number(total).toFixed(2)} in unreimbursed HSA-eligible expenses for ${year}. Log into Fidelity / HSA provider to request reimbursement.`,
        daysFromNow(30), 'high', 'HSA'
      );
    } else if (total <= 500 && existing) {
      db.prepare(
        `UPDATE todos SET status='done', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
         WHERE is_auto=1 AND auto_type='hsa_unreimbursed' AND status IN ('open','in_progress')`
      ).run();
    }
  } catch (e) { console.error('[todos] hsa_unreimbursed:', e.message); }

  // ── 3. Inventory items expiring within 60 days ─────────────
  try {
    /** @type {Array<{id:number,name:string,expiration_date:string}>} */
    const expiring = db.prepare(
      `SELECT i.id, i.name, hw.expiration_date
       FROM items i
       JOIN item_hw_details hw ON hw.item_id = i.id
       WHERE i.is_active=1 AND i.is_archived=0
         AND hw.expiration_date IS NOT NULL
         AND hw.expiration_date >= ? AND hw.expiration_date <= ?`
    ).all(now, in60);

    const expiringIds = new Set(expiring.map(i => i.id));

    // Resolve todos for items no longer in expiry window
    const openExp = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='inv_expiring' AND auto_source_type='item'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openExp) {
      if (!expiringIds.has(sid)) resolve.run('inv_expiring', 'item', sid);
    }

    for (const item of expiring) {
      const days = Math.ceil((new Date(item.expiration_date) - new Date(now)) / 86400000);
      const prio = days <= 7 ? 'urgent' : days <= 21 ? 'high' : 'medium';
      upsert.run(
        `Expiring soon: ${item.name}`,
        `"${item.name}" expires ${item.expiration_date} (${days} day${days !== 1 ? 's' : ''}). Use, replace, or dispose.`,
        item.expiration_date, prio, 'Inventory',
        'inv_expiring', 'item', item.id,
        'inv_expiring', 'item', item.id
      );
    }
  } catch (e) { console.error('[todos] inv_expiring:', e.message); }

  // ── 4. Inventory warranty expiring within 90 days ──────────
  try {
    const warr = db.prepare(
      `SELECT id, name, warranty_expires FROM items
       WHERE is_active=1 AND is_archived=0 AND lifetime_warranty=0
         AND warranty_expires IS NOT NULL
         AND warranty_expires >= ? AND warranty_expires <= ?`
    ).all(now, in90);

    const warrIds = new Set(warr.map(i => i.id));
    const openWarr = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='inv_warranty_expiring' AND auto_source_type='item'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openWarr) {
      if (!warrIds.has(sid)) resolve.run('inv_warranty_expiring', 'item', sid);
    }

    for (const item of warr) {
      const days = Math.ceil((new Date(item.warranty_expires) - new Date(now)) / 86400000);
      upsert.run(
        `Warranty expiring: ${item.name}`,
        `Warranty expires ${item.warranty_expires} (${days} days). Consider extended coverage, note serial number, or file a claim if needed.`,
        item.warranty_expires, days <= 30 ? 'high' : 'medium', 'Inventory',
        'inv_warranty_expiring', 'item', item.id,
        'inv_warranty_expiring', 'item', item.id
      );
    }
  } catch (e) { console.error('[todos] inv_warranty_expiring:', e.message); }

  // ── 5. High-value items (>=$200) missing any attachment ─────
  try {
    const highValue = db.prepare(
      `SELECT id, name, purchase_price FROM items
       WHERE is_active=1 AND is_archived=0 AND purchase_price >= 200
         AND id NOT IN (
           SELECT DISTINCT entity_id FROM attachments WHERE entity_type='item'
         )`
    ).all();

    const hvIds = new Set(highValue.map(i => i.id));
    const openHv = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='inv_missing_doc' AND auto_source_type='item'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openHv) {
      if (!hvIds.has(sid)) resolve.run('inv_missing_doc', 'item', sid);
    }

    for (const item of highValue) {
      upsert.run(
        `Add photo/receipt: ${item.name}`,
        `"${item.name}" ($${Number(item.purchase_price).toFixed(2)}) has no attached photos or documents. Attach a receipt, warranty card, or photo for insurance purposes.`,
        null, 'low', 'Inventory',
        'inv_missing_doc', 'item', item.id,
        'inv_missing_doc', 'item', item.id
      );
    }
  } catch (e) { console.error('[todos] inv_missing_doc:', e.message); }

  // ── 6. Daily log overdue follow-ups ────────────────────────
  try {
    const overdue = db.prepare(
      `SELECT id, log_date, entry_text, follow_up_date
       FROM daily_log WHERE follow_up_needed=1 AND follow_up_date < ?`
    ).all(now);

    const odIds = new Set(overdue.map(e => e.id));
    const openOd = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='follow_up_overdue' AND auto_source_type='daily_log'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openOd) {
      if (!odIds.has(sid)) resolve.run('follow_up_overdue', 'daily_log', sid);
    }

    for (const entry of overdue) {
      const preview = (entry.entry_text || '').slice(0, 100).trim();
      upsert.run(
        `Overdue follow-up: ${entry.log_date}`,
        `Log entry from ${entry.log_date}: "${preview}${preview.length >= 100 ? '…' : ''}" — follow-up was due ${entry.follow_up_date}.`,
        entry.follow_up_date, 'urgent', 'General',
        'follow_up_overdue', 'daily_log', entry.id,
        'follow_up_overdue', 'daily_log', entry.id
      );
    }
  } catch (e) { console.error('[todos] follow_up_overdue:', e.message); }

  // ── 7. Discontinued medications with no end_date ───────────
  try {
    const disc = db.prepare(
      `SELECT id, name, patient FROM med_medications
       WHERE status='Discontinued' AND (end_date IS NULL OR end_date='')`
    ).all();

    const discIds = new Set(disc.map(m => m.id));
    const openDisc = db.prepare(
      `SELECT auto_source_id FROM todos
       WHERE is_auto=1 AND auto_type='med_discontinued' AND auto_source_type='med_medication'
         AND status IN ('open','in_progress')`
    ).all().map(r => r.auto_source_id);
    for (const sid of openDisc) {
      if (!discIds.has(sid)) resolve.run('med_discontinued', 'med_medication', sid);
    }

    for (const med of disc) {
      upsert.run(
        `Update med record: ${med.name}`,
        `"${med.name}" (${med.patient}) is marked Discontinued but has no end date. Add the discontinuation date for accurate medical history.`,
        null, 'low', 'Medical',
        'med_discontinued', 'med_medication', med.id,
        'med_discontinued', 'med_medication', med.id
      );
    }
  } catch (e) { console.error('[todos] med_discontinued:', e.message); }

  // ── 8. Vehicle service next_due_date within 30 days ─────────
  try {
    const in30 = daysFromNow(30);
    const dueService = db.prepare(`
      SELECT vs.id, vs.service_type, vs.next_due_date, v.nickname, v.make, v.model
      FROM vehicle_service vs
      JOIN vehicles v ON v.id = vs.vehicle_id
      WHERE vs.next_due_date IS NOT NULL AND vs.next_due_date <= ?
        AND v.is_active = 1
    `).all(in30);

    const openSvcIds = new Set(
      db.prepare(`SELECT auto_source_id FROM todos
        WHERE is_auto=1 AND auto_type='vehicle_service_due' AND auto_source_type='vehicle_service'
          AND status IN ('open','in_progress')`).all().map(r => r.auto_source_id)
    );
    const dueSvcIds = new Set(dueService.map(s => s.id));
    // Resolve todos for service records no longer due
    for (const sid of openSvcIds) {
      if (!dueSvcIds.has(sid)) resolve.run('vehicle_service_due', 'vehicle_service', sid);
    }
    for (const svc of dueService) {
      const vname = svc.nickname || `${svc.make||''} ${svc.model||''}`.trim() || 'Vehicle';
      const overdue = svc.next_due_date < now;
      upsert.run(
        `${svc.service_type} due — ${vname}`,
        `${overdue ? 'Overdue' : 'Due'}: ${svc.service_type} for ${vname} (next due ${svc.next_due_date}).`,
        svc.next_due_date, overdue ? 'high' : 'medium', 'Property',
        'vehicle_service_due', 'vehicle_service', svc.id,
        'vehicle_service_due', 'vehicle_service', svc.id
      );
    }
  } catch (e) { console.error('[todos] vehicle_service_due:', e.message); }

  // ── 9. Property maintenance next_due_date within 30 days ────
  try {
    const in30 = daysFromNow(30);
    const dueMaint = db.prepare(`
      SELECT pm.id, pm.category, pm.description, pm.next_due_date, p.nickname
      FROM property_maintenance pm
      JOIN properties p ON p.id = pm.property_id
      WHERE pm.next_due_date IS NOT NULL AND pm.next_due_date <= ?
        AND p.is_active = 1
    `).all(in30);

    const openMaintIds = new Set(
      db.prepare(`SELECT auto_source_id FROM todos
        WHERE is_auto=1 AND auto_type='property_maint_due' AND auto_source_type='property_maintenance'
          AND status IN ('open','in_progress')`).all().map(r => r.auto_source_id)
    );
    const dueMaintIds = new Set(dueMaint.map(m => m.id));
    for (const sid of openMaintIds) {
      if (!dueMaintIds.has(sid)) resolve.run('property_maint_due', 'property_maintenance', sid);
    }
    for (const maint of dueMaint) {
      const pname = maint.nickname || 'Property';
      const overdue = maint.next_due_date < now;
      upsert.run(
        `${maint.category} maintenance due — ${pname}`,
        `${overdue ? 'Overdue' : 'Due'}: ${maint.description} at ${pname} (next due ${maint.next_due_date}).`,
        maint.next_due_date, overdue ? 'high' : 'medium', 'Property',
        'property_maint_due', 'property_maintenance', maint.id,
        'property_maint_due', 'property_maintenance', maint.id
      );
    }
  } catch (e) { console.error('[todos] property_maint_due:', e.message); }
}


// ── Medication Refill Reminders ──────────────────────────────
function syncMedRefillTodos(db) {
  const upsert = db.prepare(`
    INSERT INTO todos (title, notes, due_date, priority, status, category, is_auto, auto_type, auto_source_type, auto_source_id)
    VALUES (?,?,?,?,  'open','Medical',1,'med_refill','med_medication',?)
    ON CONFLICT(auto_type, auto_source_id) DO UPDATE SET
      title=excluded.title, notes=excluded.notes, due_date=excluded.due_date,
      priority=excluded.priority, status=CASE WHEN status='done' THEN 'open' ELSE status END,
      updated_at=CURRENT_TIMESTAMP
  `);
  const resolve = db.prepare(`
    UPDATE todos SET status='done', updated_at=CURRENT_TIMESTAMP
    WHERE auto_type='med_refill' AND auto_source_id=? AND status!='done'
  `);

  const today = new Date().toISOString().slice(0,10);
  const in14  = new Date(Date.now() + 14*86400000).toISOString().slice(0,10);

  // Active meds with refills info
  const meds = /** @type {any[]} */ (db.prepare(`
    SELECT m.id, m.name, m.dosage, m.refills_remaining, m.next_refill_date, m.end_date,
           fm.display_name AS member_name
    FROM med_medications m
    LEFT JOIN family_members fm ON fm.id = m.family_member_id
    WHERE m.status = 'Active'
      AND (m.next_refill_date IS NOT NULL OR m.refills_remaining IS NOT NULL)
  `).all());

  for (const med of meds) {
    const label = med.dosage ? `${med.name} ${med.dosage}` : med.name;
    const who   = med.member_name ? ` — ${med.member_name}` : '';

    // Resolve if discontinued or end_date passed
    if (med.end_date && med.end_date < today) {
      resolve.run(med.id); continue;
    }

    const needsRefill =
      (med.refills_remaining !== null && med.refills_remaining <= 1) ||
      (med.next_refill_date  && med.next_refill_date <= in14);

    if (!needsRefill) { resolve.run(med.id); continue; }

    const priority = med.refills_remaining === 0 ? 'high' : 'medium';
    const refillNote = med.refills_remaining === 0
      ? 'No refills remaining — contact prescriber for renewal.'
      : (med.refills_remaining === 1 ? '1 refill remaining.' : '');
    const title = `Refill: ${label}${who}`;
    const notes = [refillNote, med.next_refill_date ? `Due: ${med.next_refill_date}` : ''].filter(Boolean).join(' ');

    upsert.run(title, notes||null, med.next_refill_date||in14, priority, med.id);
  }
}

module.exports = { syncAutoTodos, syncMedRefillTodos };
