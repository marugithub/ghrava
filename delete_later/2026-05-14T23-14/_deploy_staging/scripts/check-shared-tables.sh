#!/bin/bash
# check-shared-tables.sh — strict-warn on NEW parallel shared-table creation.
#
# Locked shared tables (see LOCKED.md → SHARED-*):
#   family_members  — household people
#   contacts         — flat 8-type external people
#   record_links     — universal cross-module link
#   attachments      — universal file table
#
# Smell: a NEW migration creating med_physicians, household_members,
# service_providers, subscription_vendors, file_uploads, etc.
#
# Historical migrations that already ran on prod (med_physicians from
# 002_hsa_medical.sql, dropped by a later migration) are allowlisted
# below. The gate fires only when a future migration introduces a
# parallel pattern.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EXPLAIN=""
for arg in "$@"; do
  case "$arg" in
    --explain=*) EXPLAIN="${arg#*=}" ;;
    --explain) shift; EXPLAIN="$1" ;;
  esac
done

python3 - "$EXPLAIN" <<'PYEOF'
import os, re, sys
explain = sys.argv[1] if len(sys.argv) > 1 else ''

# Parallel-pattern candidates (case-insensitive table names)
forbidden_patterns = [
    (r'\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(household_members|family_persons|household_people|residents)\b', 'family_members'),
    (r'\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(med_physicians|medical_providers|service_providers|subscription_vendors|insurance_agents|external_people|providers)\b', 'contacts'),
    (r'\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(tx_record_links|medical_links|finance_links|module_links|entity_links)\b', 'record_links'),
    (r'\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(file_uploads|module_files|uploaded_files|user_files|module_attachments)\b', 'attachments'),
]

# Historical / already-shipped / already-dropped — never flag these files.
# Locked v.170. Add only when a parallel table is intentionally introduced
# AND there's a documented reason in STATE.md.
HISTORICAL_ALLOWLIST = {
    '002_hsa_medical.sql',     # med_physicians — created here, dropped in a later migration (130_rescue + cleanup)
}

findings = []
mig_dir = 'app/db/migrations'
if os.path.isdir(mig_dir):
    for f in sorted(os.listdir(mig_dir)):
        if f in HISTORICAL_ALLOWLIST: continue
        path = os.path.join(mig_dir, f)
        if not os.path.isfile(path): continue
        try:
            with open(path, encoding='utf-8', errors='ignore') as fh:
                content = fh.read()
        except: continue
        for pattern, canonical in forbidden_patterns:
            for m in re.finditer(pattern, content, re.IGNORECASE):
                tbl = m.group(1)
                if 'DEPRECATED' in tbl.upper() or '_legacy' in tbl.lower():
                    continue
                findings.append((f, tbl, canonical))

if findings:
    print(f"\033[33m⚠  WARNING: {len(findings)} parallel shared-table pattern(s) found:\033[0m")
    for mig, tbl, canonical in findings:
        print(f"  - {mig} creates `{tbl}` (canonical shared table: `{canonical}`)")
    print()
    print("Locked rule (LOCKED.md → SHARED-FAM/CON/LNK/ATT): shared tables are universal.")
    if explain:
        print(f"Override reason: {explain}")
        print("Proceeding under explicit explanation.")
        sys.exit(0)
    else:
        print("If intentional, re-run with --explain=\"<reason>\" and document in STATE.md.")
        print("If accidental, drop the new table and use the canonical one.")
        print()
        print("Historical / already-shipped tables can be added to HISTORICAL_ALLOWLIST")
        print("in this script if the parallel pattern is permanently part of the past.")
        sys.exit(1)

print("  shared-tables: no parallel patterns in non-historical migrations")
PYEOF
