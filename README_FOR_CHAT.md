# README_FOR_CHAT.md — read this first, then start work

This is the ONLY required reading per chat. STATE.md, HANDOFF.md, and
BACKLOG.md are searchable reference material — consult them on demand
via `grep`, do NOT claim to have "read" them.

## The 9 rules (each enforced by a gate or by Al)

1. **Build mode.** Confirm decisions in 1 line. Ask blocking questions only. Build. No recaps. No explanations unless asked.
2. **No packaging without explicit "package"** from Al. Bigger builds preferred. Bundle multiple fixes into one drop.
3. **Run `bash gates.sh` before claiming a drop is done.** Paste the output. Zero failures required. Documented in `app/scripts/README.md`.
4. **Verify-after-write.** Any claim of "saved to X", "added Y", or "updated Z" MUST be followed by `view` output of the changed lines in the same turn. Saying "saved" without showing contents = not done.
5. **Visual designs ONLY in `app/public/_templates.html`** with a row in `LOCKED.md`. No prose descriptions of tiles, cards, layouts, or visual structure in STATE/HANDOFF/BACKLOG. Prose = drift. The `check-no-design-prose` gate flags this.
6. **Shared tables are universal — never create parallel ones.** Locked shared tables:
   - `family_members` — every person in the household. Kids, owners, patients reference this.
   - `contacts` — flat 8-type table. ALL providers/vendors/people-outside-household live here. `contact_type` distinguishes (medical_provider, vendor, emergency, etc.). NO `med_physicians`, NO `subscription_vendors`, NO `service_providers` tables.
   - `record_links` — universal cross-module link table.
   - `attachments` — universal file attachments.
   The `check-shared-tables` gate WARNS strictly if a new migration creates a parallel pattern. The chat must explain why before proceeding.
7. **Schema safety is mandatory before any SQL.** Read `app/.claude/skills/ghrava-schema-safety/SKILL.md` and run its 4-step gate. Schema bugs crash the container on restart. This is non-negotiable.
8. **Every new schema column → register in `app/public/js/lens-config.js`.** Every new CLI command → register in `app/public/help.html` COMMANDS. Every new locked visual → row in `LOCKED.md`. The corresponding gates check these.
9. **"Done" is defined by gates, not by claim.** A chat saying "done" without `gates.sh` green output is "claimed done", not done. Al moves a drop from "claimed" to "verified" by manual smoke on prod.

## Working directory

- Sandbox: `/home/claude/<branch>/ghrava/` (or wherever you cloned the share zip)
- NAS prod path: `/share/Docker/home-core/ghrava/` (mapped to Windows `Z:\ghrava\`)
- Deploy zip layout: top-level (`app/`, `STATE.md`, etc. — NO `ghrava/` wrapper)
- Apply via `ghrava_deploy.ps1`. `docker restart ghrava` unless `package.json` changed.

## Where to look when you need context

| You need | Look at |
|---|---|
| Current state, version, what's staged | `STATE.md` (search by version number) |
| Next chat's task list | `HANDOFF.md` |
| Every deferred idea / known bug | `BACKLOG.md` |
| Locked visual designs | `_templates.html` + `LOCKED.md` |
| Database schema (canonical) | `SCHEMA.md` (regenerate via gen-schema-doc.py) |
| Operational CLI commands | `app/public/help.html` (rendered) |

**You do not "read" these upfront. You grep them when you need an answer.**

## The standard turn

1. Read THIS file. (That's it. Eight rules, two pages.)
2. Reply with the start-of-chat checklist (see below).
3. Wait for Al's first task.
4. For any task: scope in 1 line, ask blocking Qs, build, run `gates.sh`, paste output, stop.
5. Never package without "package".

## Start-of-chat checklist (paste this verbatim at the start of every new chat)

```
GHRAVA CHAT START
[ ] Read README_FOR_CHAT.md — 9 rules
[ ] Ran `bash gates.sh` — <N> failures (baseline; will not regress)
[ ] Current version: <from app/version.txt>
[ ] Today's task: <what Al said>
[ ] Blocking questions: <list or "none">
```

If you can't fill in the brackets, you haven't done the prerequisites. Don't fake them.
