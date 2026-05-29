// @ts-nocheck
// ─────────────────────────────────────────────────────────────────────
// Migration 146 — action ledger (v202605.211)
//
// Foundation for the EFFECT DISPATCHER / action grammar
// (see docs/superpowers/plans/2026-05-29-effect-dispatcher-design.md).
//
// A "verb" applied to a subject (e.g. donate an item) fires a set of
// effects across modules. Every application is recorded here so it can be:
//   • reversed   — `action_effects.before` holds a pre-change snapshot
//   • deduped    — the action id is the idempotency anchor
//   • audited    — this ledger IS the cross-module history (the memory layer)
//
// `actions`        = one row per verb application.
// `action_effects` = one row per primitive effect that ran, in order, with
//                    before/after JSON snapshots used to undo.
//
// All changes ADDITIVE. No DROP. No CASCADE (DB-NO-CASCADE lock — reversal
// is explicit via the app, not the database). Idempotent on retry.
// ─────────────────────────────────────────────────────────────────────

'use strict';

module.exports = function migrate146(db) {
  const tableExists = (name) =>
    !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);

  const tx = db.transaction(() => {

    // ──────────────────────────────────────────────────────────────
    // A. actions — one row per verb application
    // ──────────────────────────────────────────────────────────────
    // status:  applied | reversed | needs_review
    //   needs_review = at least one effect was held for confirmation
    //   (per the D2 decision: value/cross-module pushes review first).
    // payload = the JSON the verb was called with (qty, fmv, etc.) —
    //   kept verbatim so the action is self-describing.
    if (!tableExists('actions')) {
      db.exec(`
        CREATE TABLE actions (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          verb         TEXT NOT NULL,            -- 'donate' | 'consume' | ...
          subject_type TEXT NOT NULL,            -- 'item' | 'perfume' | 'book' | ...
          subject_id   INTEGER NOT NULL,
          payload      TEXT,                      -- JSON the verb was invoked with
          actor        TEXT,                      -- 'user' | 'auto:<linker>' | null
          status       TEXT NOT NULL DEFAULT 'applied',
          created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
          reversed_at  DATETIME
        )
      `);
      db.exec(`CREATE INDEX idx_actions_subject ON actions(subject_type, subject_id, created_at DESC)`);
      db.exec(`CREATE INDEX idx_actions_verb    ON actions(verb, created_at DESC)`);
      db.exec(`CREATE INDEX idx_actions_status  ON actions(status) WHERE status = 'needs_review'`);
    }

    // ──────────────────────────────────────────────────────────────
    // B. action_effects — the ordered primitives that ran for an action
    // ──────────────────────────────────────────────────────────────
    // before/after = JSON snapshots. Reverse replays these in DESC seq
    // order, restoring `before`. confidence/needs_review let a single
    // effect be held for confirmation without blocking auto effects.
    if (!tableExists('action_effects')) {
      db.exec(`
        CREATE TABLE action_effects (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          action_id    INTEGER NOT NULL REFERENCES actions(id),
          seq          INTEGER NOT NULL,          -- run order within the action
          op           TEXT NOT NULL,             -- primitive name (decrement_qty, ...)
          target_type  TEXT NOT NULL,
          target_id    INTEGER NOT NULL,
          before       TEXT,                       -- JSON snapshot pre-change
          after        TEXT,                       -- JSON snapshot post-change
          confidence   TEXT NOT NULL DEFAULT 'auto',  -- auto | review
          needs_review INTEGER NOT NULL DEFAULT 0,
          created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`CREATE INDEX idx_action_effects_action ON action_effects(action_id, seq)`);
    }

    // ──────────────────────────────────────────────────────────────
    // C. Marker
    // ──────────────────────────────────────────────────────────────
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations_action_ledger_done (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes       TEXT
      )
    `);
    db.exec(`INSERT INTO _migrations_action_ledger_done (notes) VALUES ('v202605.211 — actions + action_effects NEW (effect dispatcher foundation)')`);
  });

  tx();
};
