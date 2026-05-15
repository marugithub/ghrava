#!/bin/bash
# check-no-design-prose.sh — flag prose visual specs in STATE/HANDOFF/BACKLOG.
#
# Goal: catch chats describing visual design in prose instead of writing
# it to _templates.html and locking it in LOCKED.md. Allows retrospective
# "here's what we shipped" entries in version logs.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

python3 - <<'PYEOF'
import re, sys, os

DOCS = ['STATE.md', 'HANDOFF.md', 'BACKLOG.md']

# Visual nouns paired with "should/looks like/displays" = prescriptive prose.
# We deliberately scope tight — past-tense ("rendered", "rendered as") is OK,
# table rows (with leading `|`) are OK (those describe shipped state).
visual_nouns = r'(tile|card|badge|pill|chart|chip|grid|hero|sparkline|widget|drawer|modal)'
prescriptive = r'(should\s+(?:show|display|render|appear|have|be)|looks?\s+like|appears?\s+as)'
pattern = re.compile(
    rf'\b{visual_nouns}\b.{{0,40}}\b{prescriptive}\b|\b{prescriptive}\b.{{0,40}}\b{visual_nouns}\b',
    re.IGNORECASE
)

# Allowlist signals: lines describing the lock (not the design), retrospectives,
# quoted message copy ("text in quotes" is content not design), or living inside
# a markdown table.
allow_signals = re.compile(
    r'(LOCKED\.md'
    r'|_templates\.html'
    r'|template\s+#\d'
    r'|see\s+(?:#|template|LOCKED)'
    r'|byte-identical'
    r'|shipped'
    r'|locked\s+(?:in\s+)?v\.'
    r'|carryover'
    r'|\bv\.\d{2,3}\b.*(?:tile|card|badge|pill|chart)'
    r'|\bcarried\s+from\b'
    r'|copy\s*:\s*["\u201c]'                # "Modal copy: "..."  → it's literal message text
    r'|message\s*:\s*["\u201c]'
    r')',
    re.IGNORECASE
)

# Lines starting with table-row characters describe state, not design.
def is_table_row(line):
    s = line.lstrip()
    return s.startswith('|') or s.startswith('+--')

fails = []
for doc in DOCS:
    if not os.path.exists(doc): continue
    with open(doc, encoding='utf-8') as f:
        for n, line in enumerate(f, 1):
            if is_table_row(line): continue
            if pattern.search(line) and not allow_signals.search(line):
                fails.append((doc, n, line.rstrip()))

if fails:
    print(f"Found {len(fails)} prose visual-spec line(s) — move into _templates.html + LOCKED.md:")
    for doc, n, line in fails[:15]:
        snippet = line.strip()
        if len(snippet) > 120: snippet = snippet[:117] + '...'
        print(f"  {doc}:{n}  {snippet}")
    if len(fails) > 15:
        print(f"  ... and {len(fails)-15} more")
    print()
    print("Visual designs ONLY in _templates.html with a row in LOCKED.md.")
    print("Reference by ID (#18, M3, etc.) — never re-describe.")
    sys.exit(1)

print("  no-design-prose: docs free of prescriptive visual prose")
PYEOF
