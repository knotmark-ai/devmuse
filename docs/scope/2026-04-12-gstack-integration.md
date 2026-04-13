# Scope: gstack Integration

> **Date:** 2026-04-12
> **Source:** Conversation — absorb valuable patterns from gstack into devmuse

## Context

- **Background:** gstack (Garry Tan's Claude Code skill system) uses a role-based, on-demand architecture with 30+ skills. devmuse uses a process-based, enforced 5-step pipeline (scope → design → plan → code → review). After deep comparative analysis, we identified concrete gaps in devmuse that gstack's patterns can fill — without abandoning devmuse's enforced pipeline philosophy.
- **Scope of impact:** Changes touch hooks infrastructure, knowledge layer, 2 existing skills (mu-scope, mu-design), 1 agent (mu-reviewer), and add 2 new skills (mu-premise, mu-retro). Also introduces shared template fragments across skills.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | PreToolUse hooks | A+C: pipeline gate (scope+design existence) + destructive command warnings. No worktree boundary check (B dropped) |
| 2 | Template generation | Lightweight shared fragments only — extract duplicated HARD-GATE, anti-pattern, task-tool text |
| 3 | Learnings JSONL | Skip — reuse Claude Code auto memory instead. Skills read/write memory at key moments |
| 4 | Content absorption | All 4 directions (security, design audit, inversion, premise check), phased: A+B as P0, C+D as P1 |
| 5 | mu-security form | mu-reviewer new mode (review-security), not standalone skill |
| 6 | Pipeline-external skills | Absorb few: mu-premise + mu-retro as independent skills (like mu-debug) |
| 7 | Knowledge layout | Hybrid: shared principles → `knowledge/principles/`, review checklists → `skills/mu-review/checklists/` or `knowledge/reviews/`, language refs → `knowledge/languages/` (unchanged) |

## Quick Probe Results

- Files involved:
  - NEW: `hooks/pre-tool-use/` (hook scripts)
  - MODIFY: `hooks/hooks.json` (add PreToolUse entries)
  - NEW: `knowledge/principles/{premise-check,inversion}.md`
  - NEW: `knowledge/reviews/{security-checklist,design-audit-rubric}.md`
  - MODIFY: `agents/mu-reviewer.md` (add review-security mode)
  - MODIFY: `skills/mu-scope/SKILL.md` (reference premise-check, inline lightweight version)
  - MODIFY: `skills/mu-design/SKILL.md` (reference inversion.md in approach proposal phase)
  - NEW: `skills/mu-premise/SKILL.md` (independent skill)
  - NEW: `skills/mu-retro/SKILL.md` (independent skill)
  - NEW or MODIFY: shared template fragments mechanism (TBD in design)
- Fan-out: 5 existing files modified / 8+ new files
- Test coverage: `tests/` has skill-triggering and claude-code dirs; no hook tests yet
- Risk signal: **medium** — new hook infrastructure could block Edit/Write if buggy; skill modifications affect whole pipeline

## Use Cases

### Happy Paths

#### Workflow A: PreToolUse Hooks (pipeline enforcement + safety)

- UC-1: Given no scope artifact exists under `docs/scope/`, When agent calls Edit/Write on a file outside the devmuse plugin directory, Then PreToolUse hook returns `{"permissionDecision":"deny"}` with message "No scope artifact found. Run mu-scope first."
- UC-2: Given scope artifact exists but no design spec under `docs/specs/`, When agent calls Edit/Write on a file outside the devmuse plugin directory, Then hook denies with "No design spec found. Run mu-design first."
- UC-3: Given scope + design artifacts both exist, When agent calls Edit/Write, Then hook allows
- UC-4: When agent runs a destructive bash command (rm -rf, git push -f, DROP TABLE, git reset --hard), Then hook returns `{"permissionDecision":"ask"}` with warning message explaining the risk

#### Workflow B: Knowledge files + mu-reviewer new mode

- UC-5: When mu-reviewer is dispatched in `review-security` mode, Then it loads `knowledge/reviews/security-checklist.md` and applies 5-phase methodology (architecture mental model → attack surface census → secrets archaeology → dependency supply chain → CI/CD pipeline). Blocks merge on any CRITICAL/HIGH finding.
- UC-6: When mu-reviewer is dispatched in `review-design` mode, Then it additionally loads `knowledge/reviews/design-audit-rubric.md` (architecture audit: data flow diagrams, failure mode mapping, max 8 issues per section)
- UC-7: When mu-design proposes 2-3 approaches, Then it loads `knowledge/principles/inversion.md` and applies inversion reflex ("what would make this approach fail?") to each approach before presenting

#### Workflow C: Shared template fragments

- UC-9: When multiple skills contain duplicated text (HARD-GATE blocks, anti-pattern warnings, task-tool usage conventions), Then a shared include mechanism is used so editing shared text in one place updates all referencing skills

#### Workflow D: Pipeline-external independent skills

- UC-10: When user invokes `/mu-premise`, Then agent runs office-hours style interrogation with 3-4 forcing questions (problem specificity, status quo, narrowest wedge). Produces premise validation artifact. When mu-scope starts and no premise artifact exists, mu-scope inline executes a lightweight 3-question version within Quick Probe.
- UC-11: When user invokes `/mu-retro`, Then agent gathers git log, per-author contributions, file hotspots, test coverage ratio for a time window (default 7d). Produces structured retrospective with metrics + actionable insights. Writes relevant findings to Claude Code memory (project type).

### Edge Cases

- UC-12: Given scope artifact exists but is empty/malformed, When agent calls Edit, Then hook allows — hook checks file existence only, not content quality
- UC-13: Given agent is editing files inside the devmuse plugin directory (skills/, agents/, knowledge/, rules/), When hook runs, Then hook exempts — devmuse self-editing (mu-write-skill, mu-debug on plugin) bypasses pipeline gate
- UC-14: Given agent is running mu-debug on user project code, When agent calls Edit without scope artifacts, Then hook exempts — mu-debug edits are identified by [TBD: mechanism from design phase, likely file-path heuristic or mu-debug sets an env marker]
- UC-15: Given destructive command matches a known-safe pattern (rm -rf node_modules, rm -rf dist, rm -rf .next), When hook intercepts, Then hook allows without ask
- UC-16: Given multiple scope artifacts exist under docs/scope/ from different features, When hook checks existence, Then any valid scope artifact satisfies the gate
- UC-17: When review-security runs on a project with no auth/input/secrets/network code, Then reviewer reports "No significant attack surface found" with low-priority recommendations only
- UC-18: When knowledge/principles/inversion.md is loaded but user says "skip inversion analysis", Then mu-design respects user override (user instructions > skill behavior per bootstrap priority)
- UC-19: When mu-scope loads premise-check and user has already provided strong evidence of problem validity, Then premise check passes quickly without lengthy interrogation
- UC-20: When a shared template fragment is overridden locally in a skill, Then local override takes precedence
- UC-21: When mu-premise runs on an existing codebase (not greenfield), Then questions adapt: "is this change worth the disruption?" instead of "should we build this?"
- UC-22: When mu-retro runs but time window has zero commits, Then agent reports "No activity" and only asks for qualitative reflection
- UC-23: When mu-retro writes findings to Claude Code memory and similar memory already exists, Then it updates existing memory instead of creating duplicate

### Error Cases

- UC-24: When hook script fails (bash error, permission denied, syntax error), Then hook returns no decision (fail-open), agent proceeds normally, error logged to stderr — does not block user work. Secondary defense: skill-level HARD-GATE prompt constraints still apply.
- UC-25: When knowledge/reviews/security-checklist.md is missing or unreadable, When mu-reviewer runs review-security, Then reviewer falls back to built-in code quality review and logs warning
- UC-26: When mu-premise forcing questions get no useful answer after 3 rounds, Then mu-premise flags "Premise not validated — proceeding at user's request" in artifact and flow continues to mu-scope
- UC-27: When PreToolUse hook denies an Edit but user manually approves via Claude Code's permission prompt, Then hook respects Claude Code's override mechanism

## Conflicts (all resolved)

- ⚠️ CONFLICT: UC-1/2 vs UC-13/14 — Hook gate vs mu-debug/mu-write-skill exemption
  - Resolution: Use file path to distinguish. Edits to devmuse plugin directory are exempt. mu-debug on user code: TBD mechanism in design (env marker or file-path heuristic).

- ⚠️ CONFLICT: UC-3 vs UC-16 — Three-layer check vs any-scope-satisfies
  - Resolution: Simplify to two-layer check (scope + design exist). No plan check — mu-code's skill-level HARD-GATE handles plan verification.

- ⚠️ CONFLICT: UC-8 (removed) vs UC-10 — Premise check in mu-scope vs standalone mu-premise
  - Resolution: Merged into UC-10. mu-premise is standalone skill for full interrogation; mu-scope inlines lightweight 3-question version in Quick Probe when no premise artifact exists.

- ⚠️ CONFLICT: UC-24 vs UC-1/2 — Fail-open vs safety gate purpose
  - Resolution: Both hook types fail-open. Secondary defenses exist: skill HARD-GATE for pipeline, Claude Code framework for destructive commands.

## Non-Functional Constraints

- [Reliability] Hook scripts must execute in <500ms to avoid perceptible delay on every Edit/Write
- [Safety] Hook fail-open policy: never block user work due to hook bugs
- [Compatibility] All hooks must work with Claude Code's plugin hook system (hooks.json format)
- [Maintainability] Knowledge files must be self-contained markdown — no build step required to use them
- [Portability] No external dependencies (no npm packages, no database, no daemon processes)

## Constraints & Assumptions

- Claude Code's PreToolUse hook receives tool name + parameters as JSON stdin, returns `{"permissionDecision":"allow"|"deny"|"ask"}` or empty for default
- Claude Code auto memory system at `~/.claude/projects/{slug}/memory/` is available and functional
- devmuse is distributed as a Claude Code plugin; all changes must fit the plugin architecture (hooks.json, skills/, agents/, knowledge/)
- Shared template fragments mechanism must not require a build step — must work at plugin load time or via Claude Code's existing `@path` include syntax

## Out of Scope

- **Worktree boundary enforcement** (Decision 1, option B) — too complex for this phase, can add later
- **Learnings JSONL system** — reusing Claude Code auto memory instead
- **Browser daemon / QA skill** — gstack's browse infrastructure is UI-specific and architecturally heavy
- **Ship/deploy automation** (mu-ship) — teams have diverse CI/CD; not generalizable
- **CEO strategic review** (mu-ceo) — low value for engineering-focused tasks
- **UI design review** — devmuse targets backend/engineering workflows
- **DX review mode** — deferred; can add as mu-reviewer mode later if needed for API/CLI projects
- **Full template generation system** (gstack's gen-skill-docs.ts) — overkill when skills are pure markdown

## Impact Analysis

- Affected modules:
  - `hooks/` — new PreToolUse infrastructure
  - `knowledge/` — 4 new files across 2 new subdirs
  - `skills/mu-scope/SKILL.md` — add premise check inline reference
  - `skills/mu-design/SKILL.md` — add inversion reference in approach phase
  - `agents/mu-reviewer.md` — add review-security mode description
  - 2 new skill directories (mu-premise, mu-retro)
- Existing tests that may break: unlikely — changes are additive. But skill-triggering tests may need update if bootstrap routing changes.
- Migration needs: no — all changes are backward-compatible additions
