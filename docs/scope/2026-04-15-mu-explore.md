# Scope: mu-explore

> **Date:** 2026-04-15
> **Source:** Issue #5 / `docs/proposals/2026-04-15-mu-route-design.md`

## Context

`mu-explore` is the one concrete skill gap identified in the v3 mu-route design proposal. It owns the **Explore** opening move — systematic code-comprehension work that produces a mental model artifact before any modification.

Today, code-understanding tasks are force-fitted into `mu-scope`, which is wrong: `mu-scope` produces a Use Case Set for a *change*; `mu-explore` produces a mental model for *understanding*. Different intent, different artifact, different downstream.

### Boundaries (what mu-explore is NOT)

- Not codebase search (use Grep/Read directly for ephemeral Q&A)
- Not architectural design (that's mu-arch in `extract` mode — reverse-engineer an architecture artifact)
- Not use-case scoping (that's mu-scope — enumerate UCs for a change)
- Not debugging (that's mu-debug — root-cause a reproducible failure)

## Quick Probe Results

- **Files involved (new)**: `skills/mu-explore/SKILL.md`, `knowledge/templates/explore.md`
- **Files involved (updates)**: `rules/bootstrap.md` (pipeline integration), `README.md` + `README_CN.md` (skill listing), `docs/architecture.md` + `docs/architecture_cn.md` (architecture diagram)
- **Files potentially touched**: `hooks/pre-tool-use/pipeline-gate.sh` (if it enforces pipeline order)
- **Fan-out**: 0 (new skill, no existing callers)
- **Test coverage**: n/a (skills are markdown; no unit tests)
- **Risk signal**: low (additive change, integration surface is small)

## Use Cases

### Happy Paths

- **UC-1 (onboarding-clone)**: Given a freshly cloned repo the user has not seen before, When user asks to understand what it does, Then produce a top-level mental-model artifact covering components, entry points, domain terms, and open questions.

- **UC-2 (project-takeover)**: Given the user is taking over a project from someone unavailable, When user requests orientation with takeover intent, Then produce a fuller mental-model artifact that additionally captures tribal-knowledge gaps (undocumented conventions, dead-code suspects, unclear ownership).

- **UC-3 (dependency-evaluation)**: Given a library or SDK the user is evaluating for adoption, When user asks "is this right for us", Then produce a shallower artifact focused on public API surface, architectural posture, quality signals (tests, issues, release cadence); deep source reading only if user asks.

- **UC-4 (pre-change-unfamiliar-area)**: Given user intends to modify a subsystem they don't know, When Explore is triggered before the change, Then produce an artifact focused on target area + blast radius (callers, dependents, tests that would run).

- **UC-5 (pre-debug-unfamiliar-area)**: Given user encountered a bug in code they don't understand, When Explore precedes Reproduce/Debug, Then produce an artifact covering the bug-adjacent area so downstream skills inherit context.

### Edge Cases

- **EC-1 (repeat-explore)**: Given an explore artifact already exists for the area, When user re-triggers Explore, Then read the existing artifact, verify alignment with current code, and update incrementally (not rewrite).

- **EC-2 (monorepo-ambiguity)**: Given the repo contains many services/packages, When user says "explore this repo" without specifying, Then ask user to pick a target (service, package, or `_overview`) before any scanning.

- **EC-3 (no-readme)**: Given the repo has no README or architecture doc, When Explore runs, Then fall back to package/build files, main entry points, and git hotspots; mark "no canonical doc" explicitly in the artifact.

- **EC-4 (polyglot-legacy)**: Given the repo uses multiple languages or uncommon frameworks, When Explore runs, Then explicitly list the tech stack and record "unknowns" for frameworks the agent cannot confidently describe.

- **EC-5 (living-codebase)**: Given the codebase is actively evolving, When the artifact is written, Then record the git commit hash at time of exploration as a baseline; subsequent re-explores compare against this baseline.

- **EC-6 (mid-explore-pivot)**: Given Explore is running and user says "actually I just want to fix a bug", When the pivot happens, Then save the partial mental-model artifact, abort gracefully, and hand off to mu-scope (1-UC repro) / mu-debug.

### Error Cases

- **ER-1 (area-too-large)**: When user requests full-repo explore on a codebase >200k LOC, Then refuse and require user to pick a subsystem. Between 50k-200k LOC, run but degrade to top-level components only (no deep dive). <50k LOC runs fully.

- **ER-2 (no-goal)**: Given the user invokes mu-explore with no directional signal whatsoever (empty message or bare `/mu-explore`), When no onboarding/takeover/pre-change context is inferable, Then ask one clarifying question to lock intent before proceeding. "General understanding" (UC-1) counts as a legitimate goal — ER-2 only fires when even that is absent.

- **ER-3 (unreadable-code)**: Given the target includes binary, obfuscated, or encrypted artifacts, When the agent cannot read the source, Then stop and report readability limits; do not fabricate structure.

- **ER-4 (doc-code-conflict)**: Given README/docs say X but code says Y, When the artifact is produced, Then record both versions side-by-side with "documentation may be stale" flag; do not adjudicate silently.

- **ER-5 (depth-runaway)**: Given a component dependency graph exceeds the default depth, When Explore is building the component map, Then stop at depth 2 by default and surface the deferred branches so user can request deeper dives. UC-4 (pre-change blast radius) overrides depth limit with a **file-count limit** (default 50) instead.

## Conflicts

- ⚠️ CONFLICT: ER-1 vs UC-1 — "Understand this 500k LOC repo" triggers both (UC-1 says produce artifact; ER-1 says refuse).
  - **Resolution**: tiered by size. <50k LOC → full UC-1. 50k-200k → UC-1 but top-level only. >200k → ER-1 fires, force subsystem selection.

- ⚠️ CONFLICT: UC-4 vs ER-5 — Default depth-2 is under-powered for UC-4's full blast-radius intent.
  - **Resolution**: UC-4 swaps the constraint — tracks full call chain depth but caps at 50 files; paginates/truncates beyond.

- ⚠️ CONFLICT: ER-2 vs UC-1 — "Help me understand this repo" seems goal-less but is actually UC-1's canonical trigger.
  - **Resolution**: "general understanding" is a legitimate goal; ER-2 only fires on truly empty input (bare `/mu-explore` with no message).

- ⚠️ CONFLICT: Living-artifact path ambiguity — same repo may have both whole-repo and per-component artifacts.
  - **Resolution**: path scheme —
    - Whole-repo → `docs/explore/_overview.md` (underscore prefix sorts first)
    - Per component → `docs/explore/<component>.md`
    - Per subcomponent → `docs/explore/<component>/<subcomponent>.md`

## Non-Functional Constraints

- **Artifact persistence**: living document (no date in filename). Updates in place. Each update appends a history entry with git commit hash + date at the bottom.
- **Depth discipline**: default depth 2 for component graphs; default file-count cap 50 for call-chain tracing (UC-4 mode). Both configurable per invocation.
- **No fabrication**: when unsure, record as "unknown" in the artifact rather than guessing. Explicit unknowns are the point.

## Constraints & Assumptions

- Skills are markdown files; no unit-test harness. Validation is via dogfooding + mu-review.
- Invocation can come from two paths: (a) `mu-route` dispatches based on signals; (b) user types `/mu-explore` directly (slash-command escape hatch, per proposal Part 6).
- `mu-explore` may internally delegate to Claude Code's built-in `Explore` agent for individual lookups (the skill is workflow; the agent is mechanism). They coexist, not duplicate.

## Out of Scope

- **Codebase Q&A** (UC-6 from earlier discussion) — handled by direct Grep/Read, not mu-explore. No artifact required for ephemeral questions.
- **Architecture documentation as deliverable** — that is mu-arch `extract` mode, not mu-explore. mu-explore produces orientation notes, not full architecture artifacts.
- **Integration with `mu-route`** — this scope covers only the standalone `mu-explore` skill. `mu-route` dispatching is a separate scope cycle (per proposal roadmap step 6).
- **Refactoring `mu-scope` to narrow its focus** — separate concern. mu-scope remains as is; mu-explore simply takes over the "understanding" use cases it never should have owned.

## Impact Analysis

- **Affected modules**:
  - New: `skills/mu-explore/`, `knowledge/templates/explore.md`
  - Modified: `rules/bootstrap.md`, `README*.md`, `docs/architecture*.md`
- **Existing tests that may break**: none (no test suite for skill content)
- **Migration needs**: none. `mu-explore` is additive. Existing skills unchanged by this scope.
- **Downstream implications**: `mu-route` design (future scope) must include Explore in its routing table; mu-scope's docs should later be updated to say "for understanding tasks, see mu-explore" (follow-up, not part of this scope).
