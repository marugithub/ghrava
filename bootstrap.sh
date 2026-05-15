#!/bin/bash
# bootstrap.sh — MANDATORY first action of every Ghrava chat.
#
# Prints a fixed-format report. The chat MUST paste this output verbatim
# in its first reply, BEFORE asking Al any questions or doing any work.
#
# Pasting fabricated text instead of running this script is a rule violation.
# The chat must run it. If it can't, it says so plainly.
#
# Usage:
#   bash bootstrap.sh

set +e
cd "$(dirname "$0")"

# Width of section dividers
DIV="==========================================================="

echo ""
echo "$DIV"
echo "GHRAVA CHAT BOOTSTRAP REPORT"
echo "$DIV"
echo ""

# ── Section 1: version & repo identity ───────────────────────
echo "## VERSION & REPO"
echo ""
if [ -f app/version.txt ]; then
    echo "  app/version.txt:    $(cat app/version.txt | tr -d '\r\n')"
else
    echo "  app/version.txt:    MISSING"
fi
echo "  repo root:          $(pwd)"
echo "  bootstrap run at:   $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo ""

# ── Section 2: gates result (this is the new definition of "done") ──
echo "## GATES (the definition of 'done')"
echo ""
if [ -f gates.sh ]; then
    GATE_OUT="$(bash gates.sh 2>&1)"
    GATE_CODE=$?
    # Strip ANSI color codes AND carriage returns (gates.sh overwrites its own
    # status lines for the live progress effect — that looks ugly when pasted)
    CLEAN="$(echo "$GATE_OUT" | sed -E 's/\x1B\[[0-9;]*[mGKH]//g' | tr -d '\r' | grep -v '^[[:space:]]*·')"
    echo "$CLEAN" | sed 's/^/  /'
    echo ""
    if [ $GATE_CODE -eq 0 ]; then
        echo "  GATES_STATUS: GREEN"
    else
        echo "  GATES_STATUS: RED  (must fix before any new work)"
    fi
else
    echo "  gates.sh MISSING — this is not a valid Ghrava v.170+ repo"
fi
echo ""

# ── Section 3: schema source of truth ────────────────────────
echo "## SCHEMA SOURCE OF TRUTH"
echo ""
for f in app/SCHEMA.md SCHEMA.md; do
    if [ -f "$f" ]; then
        FIRST_LINE="$(head -1 "$f" | tr -d '\r\n')"
        TABLE_COUNT="$(grep -c '^### `' "$f")"
        # Mod time, portable across linux/mac/qnap
        if stat -c '%y' "$f" > /dev/null 2>&1; then
            MTIME="$(stat -c '%y' "$f" | cut -d. -f1)"
        else
            MTIME="$(stat -f '%Sm' "$f" 2>/dev/null || echo unknown)"
        fi
        echo "  $f"
        echo "    first line:  $FIRST_LINE"
        echo "    tables:      $TABLE_COUNT"
        echo "    modified:    $MTIME"
    fi
done
echo ""
echo "  RULE: SCHEMA.md is prod-truth (generated from live DB during share)."
echo "  When memory disagrees with SCHEMA.md, SCHEMA.md wins."
echo ""

# ── Section 4: most recent versions shipped ──────────────────
echo "## LAST 5 VERSIONS (from STATE.md)"
echo ""
if [ -f STATE.md ]; then
    grep -E '^## (✅|⏪|🚨).*v\.' STATE.md | head -5 | sed 's/^/  /'
else
    echo "  STATE.md MISSING"
fi
echo ""

# ── Section 5: backlog top items ─────────────────────────────
echo "## BACKLOG — TOP ITEMS"
echo ""
if [ -f BACKLOG.md ]; then
    # Show the first 5 H2 sections (proxy for "open" items at the top)
    grep -E '^## ' BACKLOG.md | head -8 | sed 's/^/  /'
else
    echo "  BACKLOG.md MISSING"
fi
echo ""

# ── Section 6: locks (count + first 5) ───────────────────────
echo "## LOCKS REGISTRY"
echo ""
if [ -f LOCKED.md ]; then
    VISUAL="$(awk '/^## Visual designs/,/^## Schema rules/' LOCKED.md | grep -cE '^\| #')"
    SCHEMA="$(awk '/^## Schema rules/,/^## Architectural decisions/' LOCKED.md | grep -cE '^\| SHARED|^\| FIN-')"
    ARCH="$(awk '/^## Architectural decisions/,0' LOCKED.md | grep -cE '^\| [A-Z]')"
    echo "  Visual locks:  $VISUAL"
    echo "  Schema locks:  $SCHEMA"
    echo "  Arch locks:    $ARCH"
    echo ""
    echo "  Rule: if a request says 'use the agreed X design',"
    echo "  the chat asks 'which row in LOCKED.md?' If no row exists,"
    echo "  the design is not locked — it is drift."
else
    echo "  LOCKED.md MISSING"
fi
echo ""

# ── Section 7: migration count + most recent ──────────────────
echo "## MIGRATIONS"
echo ""
if [ -d app/db/migrations ]; then
    COUNT="$(ls app/db/migrations | wc -l | tr -d ' ')"
    LATEST="$(ls app/db/migrations | sort -r | head -3 | tr '\n' ' ')"
    echo "  Total files:   $COUNT"
    echo "  Latest 3:      $LATEST"
fi
echo ""

# ── Section 8: rule reminders ────────────────────────────────
echo "## RULES IN EFFECT (locked v.170)"
echo ""
echo "  0. Run bootstrap.sh first. Paste output verbatim."
echo "  1. Read START_HERE.md. That's the only required reading."
echo "  2. grep other docs (STATE, HANDOFF, BACKLOG, SCHEMA, LOCKED) on demand."
echo "  3. 'Done' = bash gates.sh shows 8 passed, 0 failed. Pasted output required."
echo "  4. Visual designs ONLY in _templates.html + row in LOCKED.md."
echo "  5. SQL workflow: read SCHEMA.md → write // schema: comment → validate."
echo "  6. Shared tables (family_members, contacts, record_links, attachments)"
echo "     are universal. Parallel patterns require --explain."
echo "  7. No packaging without Al saying 'package'."
echo "  8. No 'saved/added/updated' claim without 'view' of the changed lines."
echo "  9. Build mode: 1-line confirm, blocking Qs only, build, no recap."
echo ""

echo "$DIV"
echo "END BOOTSTRAP REPORT — paste above verbatim in first reply"
echo "$DIV"
echo ""
