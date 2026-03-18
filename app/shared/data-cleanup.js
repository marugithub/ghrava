'use strict';
/**
 * shared/data-cleanup.js — Data cleanup utility
 *
 * Runs a set of cleanup passes on inventory items:
 *   1. Title bloat   — items with long names get parsed; fields distributed
 *                      into brand/description/size if those fields are blank.
 *   2. Qty default   — items with NULL or 0 quantity get set to 1.
 *
 * Safe rules:
 *   - Never overwrites a field that already has a value.
 *   - Flags every changed record with needs_review=1 + reason.
 *   - Skips items already flagged (avoids double-processing).
 *
 * Called from:
 *   - server.js on startup (background, 5s delay)
 *   - inventory/routes.js after CSV import
 *   - settings routes (manual button)
 */

const db = require('../db/db');

// Inline title parser (same logic as /parse-title route — no HTTP call needed)
function parseTitle(raw) {
  raw = raw.trim();

  // Size extraction
  const sizePatterns = [
    /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|kg|oz|fl\s*oz|lb|lbs|ml|l|L)\b)/i,
    /\b(\d+\s*(?:ct|count|pack|pk|pc|pcs|piece|pieces|tablets?|caps?|capsules?|caplets?))\b/i,
    /\b(\d+[-\s](?:pack|pk|count|ct))\b/i,
  ];
  let size = '';
  for (const p of sizePatterns) {
    const m = raw.match(p);
    if (m) { size = m[1].replace(/\s+/g, ' ').trim(); break; }
  }

  // Category inference
  const categoryMap = [
    { cat: 'Health & Wellness', kw: /\b(vitamin|supplement|medicine|tablet|capsule|ibuprofen|acetaminophen|tylenol|advil|aspirin|antibiotic|probiotic|melatonin|allergy|antacid|bandage|first.?aid)\b/i },
    { cat: 'Food & Beverage',   kw: /\b(coffee|tea|juice|soda|water|snack|chips|cereal|sauce|oil|vinegar|sugar|flour|protein|bar|shake)\b/i },
    { cat: 'Electronics',       kw: /\b(cable|charger|battery|usb|hdmi|adapter|speaker|headphone|earphone|monitor|keyboard|mouse|router|hub)\b/i },
    { cat: 'Cleaning',          kw: /\b(detergent|cleaner|soap|shampoo|conditioner|bleach|disinfect|wipes|spray|laundry|dish)\b/i },
    { cat: 'Office',            kw: /\b(pen|pencil|notebook|paper|staple|binder|folder|tape|scissors|marker|highlighter)\b/i },
    { cat: 'Kitchen',           kw: /\b(utensil|spatula|pan|pot|bowl|plate|cup|mug|knife|fork|spoon|container|storage)\b/i },
    { cat: 'Baby & Kids',       kw: /\b(baby|infant|toddler|diaper|wipe|formula|toy|children)\b/i },
    { cat: 'Pet',               kw: /\b(dog|cat|pet|kibble|treat|collar|leash|litter|aquarium|bird|fish)\b/i },
    { cat: 'Personal Care',     kw: /\b(lotion|moisturizer|deodorant|razor|toothbrush|toothpaste|floss|sunscreen|makeup|face|skin)\b/i },
    { cat: 'Tools',             kw: /\b(drill|wrench|hammer|screwdriver|plier|tool|tape.?measure|level|bit|nail|screw|bolt)\b/i },
  ];
  let category = '';
  for (const { cat, kw } of categoryMap) {
    if (kw.test(raw)) { category = cat; break; }
  }

  // Clean name — strip size token, trim to 60 chars
  let name = raw;
  if (size) name = name.replace(new RegExp(size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim();
  name = name.replace(/\s{2,}/g, ' ').replace(/,\s*$/, '').trim();
  if (name.length > 60) name = name.slice(0, 60).trim();

  return { name, category, size, description: raw };
}

/**
 * runDataCleanup — main entry point
 * @param {object} opts
 * @param {string}   opts.source     — 'startup' | 'import' | 'manual'
 * @param {number[]} opts.itemIds    — optional: only process these IDs (for post-import)
 * @returns {{ titles, quantities, errors }}
 */
function runDataCleanup(opts = {}) {
  const { source = 'manual', itemIds = null } = opts;
  const results = { titles: 0, quantities: 0, errors: [] };

  try {
    // ── Pass 1: Qty = NULL or 0 → set to 1 ───────────────────
    const qtyFix = db.prepare(`
      UPDATE items SET quantity=1, updated_at=CURRENT_TIMESTAMP
      WHERE (quantity IS NULL OR quantity < 1)
      AND is_archived=0
      ${itemIds ? `AND id IN (${itemIds.map(() => '?').join(',')})` : ''}
    `);
    const qtyResult = itemIds ? qtyFix.run(...itemIds) : qtyFix.run();
    results.quantities = qtyResult.changes;

    // ── Pass 2: Title bloat → parse and distribute ────────────
    // Target: name > 60 chars AND brand/description blank
    const candidates = db.prepare(`
      SELECT id, name, brand, description, category
      FROM items
      WHERE length(name) > 60
      AND is_archived = 0
      AND needs_review = 0
      ${itemIds ? `AND id IN (${itemIds.map(() => '?').join(',')})` : ''}
    `).all(...(itemIds || []));

    const updateStmt = db.prepare(`
      UPDATE items SET
        name        = ?,
        brand       = CASE WHEN (brand IS NULL OR brand = '') THEN ? ELSE brand END,
        description = CASE WHEN (description IS NULL OR description = '') THEN ? ELSE description END,
        category    = CASE WHEN (category IS NULL OR category = '') THEN ? ELSE category END,
        notes       = CASE WHEN (notes IS NULL OR notes = '') AND ? != '' THEN ? ELSE notes END,
        needs_review      = 1,
        review_flagged_at = CURRENT_TIMESTAMP,
        review_reason     = ?,
        updated_at        = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const cleanupTx = db.transaction(() => {
      for (const item of candidates) {
        try {
          const parsed = parseTitle(item.name);
          // Only process if name actually changed or we'd fill in a blank field
          const wouldChange = parsed.name !== item.name
            || (!item.brand && parsed.category)
            || (!item.description)
            || (!item.category && parsed.category);

          if (!wouldChange) continue;

          updateStmt.run(
            parsed.name,
            parsed.category,    // brand field: not extracted from title, leave as-is
            parsed.description, // description: full original title
            parsed.category,    // category
            parsed.size,        // size → notes (only if notes blank)
            parsed.size ? `Size: ${parsed.size}` : '',
            `Title cleanup (${source}): fields extracted from long name`,
            item.id
          );
          results.titles++;
        } catch (e) {
          results.errors.push(`Item ${item.id}: ${e.message}`);
        }
      }
    });
    cleanupTx();

    // Create/update review todo if anything was changed
    if (results.titles > 0 || results.quantities > 0) {
      try {
        const { createReviewTodo } = require('./needs-review');
        const parts = [];
        if (results.titles > 0) parts.push(`${results.titles} item title(s) cleaned`);
        if (results.quantities > 0) parts.push(`${results.quantities} item quantity/quantities set to 1`);
        createReviewTodo(`Data cleanup (${source}): ${parts.join(', ')}`);
      } catch {}
    }

    console.log(`[data-cleanup] source=${source} titles=${results.titles} qty=${results.quantities} errors=${results.errors.length}`);
  } catch (e) {
    results.errors.push(`Cleanup failed: ${e.message}`);
    console.error('[data-cleanup] error:', e.message);
  }

  return results;
}

module.exports = { runDataCleanup };
