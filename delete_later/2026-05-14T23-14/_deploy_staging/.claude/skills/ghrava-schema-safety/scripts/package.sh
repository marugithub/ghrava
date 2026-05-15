#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# package.sh — Ghrava packaging gate (v1, May 2026)
#
# This script REPLACES manual `zip` commands for building deploy zips.
# It refuses to produce a zip unless the schema-safety gate passes.
#
# Usage:
#     bash .claude/skills/ghrava-schema-safety/scripts/package.sh
#         [--output /path/to/Ghrava_DEPLOY.zip]
#         [--files "file1 file2 file3 ..."]
#
# Gate steps (in order):
#     1. Regenerate SCHEMA.md (Step 1 of the skill)
#     2. Run validate-schema.py (Step 4 of the skill)
#         - Exit 2  → BLOCK: new code has schema bugs. No zip.
#         - Exit 1  → WARN: only pre-existing failures. Allow with notice.
#         - Exit 0  → OK.
#     3. If gate passes, build the zip.
#
# Exit codes:
#     0 = zip built
#     2 = blocked (recent schema failures)
#     3 = invalid invocation
# ─────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SKILL_DIR="$( dirname "$SCRIPT_DIR" )"
REPO_ROOT="$( cd "$SKILL_DIR/../../.." && pwd )"

OUT_PATH="/mnt/user-data/outputs/Ghrava_DEPLOY.zip"
FILES=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --output) OUT_PATH="$2"; shift 2 ;;
        --files)  FILES="$2"; shift 2 ;;
        *) echo "Unknown arg: $1" >&2; exit 3 ;;
    esac
done

cd "$REPO_ROOT"

echo "╭──────────────────────────────────────────────────"
echo "│ Ghrava packaging gate"
echo "│ Repo: $REPO_ROOT"
echo "│ Out:  $OUT_PATH"
echo "╰──────────────────────────────────────────────────"
echo ""

# ── Gate step 1: regenerate SCHEMA.md ─────────────────────────────
echo "▸ Step 1/3: regenerating SCHEMA.md from migrations"
python3 "$SCRIPT_DIR/gen-schema-doc.py"
echo ""

# ── Gate step 2: validate every db.prepare() ──────────────────────
echo "▸ Step 2/3: validating SQL against prod-mirror schema"
set +e
# Validate ONLY the files this drop is shipping. Pre-existing bugs in
# other files don't block this drop — they're tracked in BACKLOG.md.
# If --files was passed, we filter to those. Otherwise validate all
# files in --recent 24h (default sandbox session).
if [ -n "$FILES" ]; then
    JS_FILES=$(echo "$FILES" | tr ' ' '\n' | grep '\.js$' | grep -v '^$' | tr '\n' ' ')
    if [ -n "$JS_FILES" ]; then
        python3 "$SCRIPT_DIR/validate-schema.py" --strict $JS_FILES
    else
        python3 "$SCRIPT_DIR/validate-schema.py" --recent 24
    fi
else
    python3 "$SCRIPT_DIR/validate-schema.py" --recent 24
fi
VALIDATE_EXIT=$?
set -e

case $VALIDATE_EXIT in
    0)
        echo "  ✅ all prepared statements clean"
        ;;
    1)
        echo "  ⚠️  pre-existing schema failures exist but no recent regressions"
        echo "     (logged to BACKLOG.md → Schema audit. Not blocking.)"
        ;;
    2)
        echo ""
        echo "🚨 BLOCKED: recent code has schema failures."
        echo "   Fix the listed errors before retrying."
        echo "   See SCHEMA.md for canonical column names."
        exit 2
        ;;
    *)
        echo "🚨 validate-schema.py crashed with unexpected exit $VALIDATE_EXIT"
        exit 3
        ;;
esac
echo ""

# ── Gate step 3: build the zip ────────────────────────────────────
echo "▸ Step 3/3: building zip"

rm -f "$OUT_PATH"

# Always include the skill itself + SCHEMA.md so future chats inherit it
DEFAULT_INCLUDES="
    app/version.txt
    SCHEMA.md
    .claude/skills/ghrava-schema-safety/SKILL.md
    .claude/skills/ghrava-schema-safety/scripts/gen-schema-doc.py
    .claude/skills/ghrava-schema-safety/scripts/validate-schema.py
    .claude/skills/ghrava-schema-safety/scripts/package.sh
    STATE.md
    HANDOFF.md
    BACKLOG.md
"

if [ -z "$FILES" ]; then
    FILES="$DEFAULT_INCLUDES"
else
    FILES="$DEFAULT_INCLUDES $FILES"
fi

# Build zip
mkdir -p "$( dirname "$OUT_PATH" )"
# shellcheck disable=SC2086
zip -qr "$OUT_PATH" $FILES 2>&1 | grep -v "^zip warning" || true

# Verify it exists and has content
if [ ! -f "$OUT_PATH" ]; then
    echo "🚨 zip did not get created at $OUT_PATH"
    exit 3
fi

SIZE=$(stat -c%s "$OUT_PATH" 2>/dev/null || stat -f%z "$OUT_PATH")
COUNT=$(unzip -l "$OUT_PATH" | tail -1 | awk '{print $2}')
echo "  ✅ wrote $OUT_PATH ($COUNT files, $SIZE bytes)"
echo ""
echo "╭──────────────────────────────────────────────────"
echo "│ Package gate passed. Deploy steps:"
echo "│   1. Download the zip"
echo "│   2. Run ghrava_deploy.ps1 on Windows"
echo "│   3. SSH NAS: docker restart ghrava"
echo "╰──────────────────────────────────────────────────"
