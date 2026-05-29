// @ts-nocheck
'use strict';
// ─────────────────────────────────────────────────────────────────────
// shared/effects/dispatch.js  (effect dispatcher — the engine)
//
// applyVerb()    — look up a verb (data), run its effects (code primitives)
//                  inside ONE transaction, recording each to the action
//                  ledger with before/after snapshots.
// reverseAction()— replay an action's effects in reverse, restoring before.
//
// Design: docs/superpowers/plans/2026-05-29-effect-dispatcher-design.md §5.
// ─────────────────────────────────────────────────────────────────────

const db = require('../../db/db');
const { primitives } = require('./primitives');
const verbs = require('./verbs');

// Resolve `$name` arg references against the call payload. Non-string args
// and plain strings pass through unchanged.
function resolveArgs(args, payload) {
  const out = {};
  for (const [k, v] of Object.entries(args || {})) {
    if (typeof v === 'string' && v.startsWith('$')) out[k] = payload[v.slice(1)];
    else out[k] = v;
  }
  return out;
}

// Tiny `when` evaluator — intentionally a closed vocabulary, not eval().
function evalWhen(when, ctx) {
  if (!when) return true;
  switch (when) {
    case 'qty_reaches_zero':
      return ctx.resulting_qty != null && ctx.resulting_qty <= 0;
    case 'zero_or_no_qty':
      // fires for quantity entities that hit 0 AND for entities with no
      // quantity at all (book/perfume) — used by the generic `discard` verb.
      return ctx.resulting_qty == null || ctx.resulting_qty <= 0;
    default:
      throw new Error(`effects: unknown when '${when}'`);
  }
}

/**
 * Apply a verb to a subject. Returns { action_id, status, effects }.
 * `effects` lists what ran (op/target/skipped/needs_review) for the caller.
 */
function applyVerb({ verb, subjectType, subjectId, payload = {}, actor = 'user' }) {
  const def = verbs[verb];
  if (!def) throw new Error(`effects: unknown verb '${verb}'`);
  if (!def.subjects.includes(subjectType)) {
    throw new Error(`effects: verb '${verb}' does not accept subject '${subjectType}'`);
  }

  const run = db.transaction(() => {
    const action = db.prepare(`
      INSERT INTO actions (verb, subject_type, subject_id, payload, actor, status)
      VALUES (?, ?, ?, ?, ?, 'applied')
    `).run(verb, subjectType, subjectId, JSON.stringify(payload), actor);
    const actionId = action.lastInsertRowid;

    const ctx = { ...derivedCtxSeed(payload) };
    const effects = [];
    let anyReview = false;
    let seq = 0;

    for (const eff of def.effects) {
      if (!evalWhen(eff.when, ctx)) {
        effects.push({ op: eff.op, skipped: true, reason: 'when' });
        continue;
      }
      const prim = primitives[eff.op];
      if (!prim) throw new Error(`effects: unknown primitive '${eff.op}'`);

      // Target defaults to the subject; an effect may retarget later (cross-module).
      const targetType = eff.target_type || subjectType;
      const targetId   = eff.target_id   || subjectId;
      const args = resolveArgs(eff.args, payload);
      const confidence = eff.confidence || 'auto';
      const needsReview = confidence === 'review' ? 1 : 0;

      // review effects are recorded but NOT applied until confirmed (D2).
      let before = null, after = null, skipped = false, out = null;
      if (needsReview) {
        skipped = true;
        anyReview = true;
      } else {
        const r = prim.apply({ db, targetType, targetId, args, ctx });
        before = r.before; after = r.after; out = r.out; skipped = !!r.skipped;
        if (out) Object.assign(ctx, out);
      }

      db.prepare(`
        INSERT INTO action_effects
          (action_id, seq, op, target_type, target_id, before, after, confidence, needs_review)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(actionId, seq, eff.op, targetType, targetId,
             before != null ? JSON.stringify(before) : null,
             after  != null ? JSON.stringify(after)  : null,
             confidence, needsReview);

      effects.push({ op: eff.op, target_type: targetType, target_id: targetId, skipped, needs_review: !!needsReview });
      seq++;
    }

    if (anyReview) {
      db.prepare(`UPDATE actions SET status='needs_review' WHERE id=?`).run(actionId);
    }
    return { action_id: actionId, status: anyReview ? 'needs_review' : 'applied', effects };
  });

  return run();
}

// Seed ctx with anything later effects might gate on before the first
// effect runs. (Currently empty; resulting_qty etc. are added at runtime.)
function derivedCtxSeed(/* payload */) { return {}; }

/**
 * Reverse a previously-applied action. Replays applied effects in reverse
 * order, restoring their `before` snapshot. Idempotent: a reversed action
 * is a no-op. Returns { reversed: true } | { reversed: false, reason }.
 */
function reverseAction(actionId) {
  const action = db.prepare(`SELECT * FROM actions WHERE id=?`).get(actionId);
  if (!action) return { reversed: false, reason: 'not found' };
  if (action.status === 'reversed') return { reversed: false, reason: 'already reversed' };

  const def = verbs[action.verb];
  if (def && def.reversible === false) return { reversed: false, reason: 'verb not reversible' };

  const rows = db.prepare(`SELECT * FROM action_effects WHERE action_id=? ORDER BY seq DESC`).all(actionId);

  const run = db.transaction(() => {
    for (const e of rows) {
      if (e.needs_review) continue; // never applied → nothing to undo
      const prim = primitives[e.op];
      if (!prim || !prim.reverse) continue;
      const before = e.before ? JSON.parse(e.before) : null;
      const after  = e.after  ? JSON.parse(e.after)  : null;
      prim.reverse({ db, targetType: e.target_type, targetId: e.target_id, before, after });
    }
    db.prepare(`UPDATE actions SET status='reversed', reversed_at=CURRENT_TIMESTAMP WHERE id=?`).run(actionId);
  });
  run();
  return { reversed: true };
}

module.exports = { applyVerb, reverseAction };
