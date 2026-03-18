#!/bin/bash
# LifeTracker — HSA Internal Server Error Diagnostic
# Run from PuTTY: bash /share/homes/admin/lifetracker/diagnose.sh

echo ""
echo "══════════════════════════════════════════════"
echo "  LifeTracker HSA Diagnostic"
echo "══════════════════════════════════════════════"
echo ""

CONTAINER="lifetracker"
DB_PATH="/app/data/lifetracker.db"

# 1. Is the container running?
echo "▶ Container status:"
docker ps --filter "name=$CONTAINER" --format "  {{.Names}} — {{.Status}}"
echo ""

# 2. What migrations have been applied?
echo "▶ Migrations applied to database:"
docker exec $CONTAINER sqlite3 $DB_PATH \
  "SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at;" \
  2>/dev/null || echo "  (schema_migrations table not found — checking tables directly)"
echo ""

# 3. Do the HSA tables exist?
echo "▶ HSA tables in database:"
docker exec $CONTAINER sqlite3 $DB_PATH \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hsa_%' ORDER BY name;"
echo ""

# 4. Do the Medical tables exist?
echo "▶ Medical tables in database:"
docker exec $CONTAINER sqlite3 $DB_PATH \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'med_%' ORDER BY name;"
echo ""

# 5. Does the attachments table exist and what columns does it have?
echo "▶ Attachments table schema:"
docker exec $CONTAINER sqlite3 $DB_PATH \
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='attachments';" \
  2>/dev/null || echo "  (not found)"
echo ""

# 6. Recent container logs (last 30 lines)
echo "▶ Recent container logs (errors only):"
docker logs $CONTAINER --tail 50 2>&1 | grep -iE "error|Error|migration|Migration|fail" | tail -20
echo ""

echo "══════════════════════════════════════════════"
echo "  If HSA tables are missing:"
echo "  → v4 patch has not been deployed yet"
echo "  → Deploy LifeTracker_v4_patch.zip first"
echo "  → Then deploy LifeTracker_v5_patch.zip"
echo "  → Restart container — migrations auto-apply"
echo "══════════════════════════════════════════════"
echo ""
