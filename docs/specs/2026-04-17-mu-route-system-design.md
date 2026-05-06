# Design: mu-route System

> **Date:** 2026-04-17
> **Source:** docs/scope/2026-04-17-mu-route-system.md
> **Combines:** Steps 5 (sign-off gate), 6 (mu-route skill), 7 (bootstrap migration)

## Requirements Reference

- **Scope:** docs/scope/2026-04-17-mu-route-system.md
- **Covers:** UC-R1..UC-R9, UC-S1..UC-S4, UC-B1..UC-B3, EC-R1..EC-R4, ER-R1..ER-R3
- **NFRs:** detection <5s; propose+confirm UX; non-blocking sign-off; bootstrap backward-compat

## Architecture

Three components, all markdown:

```
rules/bootstrap.md (modify)
    ↓ "For unprefixed user input, invoke mu-route"
skills/mu-route/SKILL.md (new)
    ↓ reads user message + cheap repo signals
    ↓ computes best-match opening move via routing table
    ↓ proposes + user confirms
    → hands off to target skill (1 of 7 routable moves)

knowledge/principles/sign-off-gate.md (new)
    ↑ @-referenced by mu-biz / mu-prd / mu-arch at exit-criterion time
    when stakeholder-scope = team-touching
```

**Layering**: bootstrap → mu-route → target skill. Sign-off gate is orthogonal, consumed by creative skills at their exit gate only when stakeholder-scope fires.

## Component 1: `skills/mu-route/SKILL.md`

### Structure

Following devmuse skill conventions (see mu-explore, mu-retro for patterns):

- Frontmatter: `name` + `description`
- Brief overview
- `Process Flow` dot graph
- `## Checklist` (steps for routing decision)
- `## Trigger Signal Tables` (maps signals → opening moves)
- `## Slash-Command Escape Hatch` (direct invocation bypass)
- `## Plan-as-Checkpoint Design Principle`
- `## Integration`

### Input signals

mu-route consumes **5 cheap signals** (all computable in <5s):

1. **User message verbs** — regex/keyword match against intent lexicon
2. **Artifact presence** — `ls docs/biz/ docs/prd/ docs/specs/ docs/scope/` file-exists check
3. **Repo activity** — `git log --author="$USER" --since="30 days ago" -- <target-area>` to detect familiarity
4. **CODEOWNERS presence** — `test -f .github/CODEOWNERS || test -f CODEOWNERS` for stakeholder-scope hint
5. **Slash prefix** — first token of user message

### Routing algorithm

```
1. If first token starts with `/mu-<skill>` → bypass mu-route, invoke target directly
2. Parse user message for Axis-Intent keywords (table below)
3. Check Axis-Familiarity via git log for target area (if area inferable)
4. Check Axis-Missing-artifact via file-existence on biz/prd/specs dirs
5. Check Axis-Stakeholder via CODEOWNERS + recent multi-author activity (cheap heuristic)
6. Apply routing table (top-to-bottom, first match wins) to produce one opening move
7. Propose in one sentence: "Looks like <move>. Confirm (ok) or override (1 word)?"
8. On user confirmation → invoke target skill (with stance hint if applicable, per stance-detection §2.5)
9. On override → accept new move in one word; invoke
```

### Trigger Signal Table

| Verb / phrase in user message | Axis-Intent | Default opening move |
|-------------------------------|-------------|----------------------|
| "understand", "figure out", "read", "take over", "evaluate", "what does this do" | understand | **Explore** |
| "should I build", "is this worth", "validate idea", "vague idea" | validate | **Validate** |
| "add feature", "build feature", "product idea" (with biz existing, no prd) | create-product | **Design-product** |
| "refactor", "clean up", "rename", "restructure" (familiar code) | reshape | **Design-tech** |
| "refactor" (unfamiliar code per Axis-Familiarity) | reshape+unfamiliar | **Explore** (then Design-tech) |
| "fix", "broken", "error", "bug", "test failing", "crash" | fix | **Reproduce** |
| "implement", "write", "build this" (with design existing) | implement | **Implement** |
| "retro", "look back", "how did X go" | retrospect | **Retrospect** (cadence, not routed unless explicit) |

### Routing Decision Table (precedence)

Rows evaluated top-to-bottom; first match wins.

| # | slash prefix | Axis-Intent | Axis-Missing-artifact | Axis-Familiarity | → Opening Move |
|---|--------------|-------------|----------------------|-----------------|----------------|
| R1 | `/mu-<skill>` | — | — | — | **bypass** (direct skill call) |
| R2 | none | understand | — | — | **Explore** |
| R3 | none | fix | — | — | **Reproduce** |
| R4 | none | reshape | — | unfamiliar | **Explore** (then Design-tech) |
| R5 | none | — | no biz, but validate/create-product intent | — | **Validate** |
| R6 | none | create-product | no prd | — | **Design-product** |
| R7 | none | reshape or create-product | no specs | familiar | **Design-tech** |
| R8 | none | implement | specs exist | — | **Implement** |
| R9 | none (no match) | — | — | — | **Explore** (safe default per scope EC-R2) |

### Plan-as-Checkpoint

Per v3 proposal Part 5 design principle:
- **Propose** move in one structured sentence: `"Looks like <move>. Axes: Intent=<x>, Familiarity=<y>, Missing=<z>. Confirm (ok) or override (word)?"`
- **Accept** bare "ok" OR any opening-move word as override (Explore / Validate / Design-product / Design-tech / Reproduce / Plan / Implement / Retrospect)
- **Never block** — if user types something unrelated, mu-route treats it as override to "ask user to restate" rather than failing

### HARD-GATE status

mu-route itself has **no HARD-GATE**. It's a router, not a gatekeeper. The target skills still enforce their own gates (e.g., mu-arch still requires scope).

## Component 2: `knowledge/principles/sign-off-gate.md`

### Structure

Shared principle consumed by mu-biz / mu-prd / mu-arch when Stakeholder-scope = team-touching. Parallels stance-detection.md structure.

### Content outline

```markdown
# Sign-off Gate (Stakeholder-scope axis)

## When it fires
- Stakeholder-scope = team-touching (detected or declared)
- An artifact has just completed its normal exit criterion (user has approved)
- The skill is about to commit + transition to next step

## When it does NOT fire
- stakeholder-scope = solo (no gate)
- existing HARD-GATEs NOT satisfied (those fire first; sign-off gate comes after)

## Detection heuristics (stakeholder-scope = team-touching)
1. `.github/CODEOWNERS` or `CODEOWNERS` file exists
2. git log --since="90 days ago" shows ≥3 distinct author emails touching watched dirs
3. User explicitly declares "team project" / "shared code" / "need RFC"
Any one sufficient. If all absent → solo (no gate).

## Gate protocol
1. Agent announces: "This artifact touches team territory. Circulate to <stakeholders inferred from CODEOWNERS / recent authors> and collect sign-off. Reply 'signed off' when done; or 'skip sign-off' to override."
2. Agent waits for user reply.  NOT blocking — user can say "skip" at any time per guidance-over-control.
3. On 'signed off', append to artifact History: `| <date> | <commit> | sign-off | — | approved by: <names or count> |`
4. On 'skip sign-off', append: `| <date> | <commit> | sign-off | — | skipped by user |`
5. Proceed to existing terminal (next skill invocation).

## Consumption pattern in creative skills
At the end of each creative skill's Process (after artifact approval, before terminal invocation):
    IF stance ∈ {create, update, extract} AND stakeholder-scope = team-touching:
        read sign-off-gate.md
        run gate protocol
    (`skip` stance is pass-through; no gate needed)
```

### Integration with creative skills

mu-biz / mu-prd / mu-arch each gain one sentence at the end of their Process:

> "Before terminal invocation, consult `@../../knowledge/principles/sign-off-gate.md` if stakeholder-scope indicates team-touching."

This is additive, doesn't change any existing terminal logic.

## Component 3: `rules/bootstrap.md` migration

### What changes

The existing "Skill Priority & Pipeline Paths" section currently lists 4 paths users follow based on task type. This gets **replaced** with a single instruction:

> "For any unprefixed user message (no `/mu-*` slash hint), invoke `mu-route` first. It will propose the right opening move and ask for confirmation."

The old path table becomes mu-route's internal routing table (Component 1 above), moved from bootstrap to `skills/mu-route/SKILL.md`.

### What stays

- **Instruction Priority** rules (user > skill > default) — unchanged
- **Slash-command escape hatch** — documented as bypass
- **Examples** section — kept as illustration but reframed as "mu-route will propose <X>"
- **HARD-GATE stance** — creative skills still evaluate HARD-GATEs before Phase 0

### Backward compat

- Existing CLAUDE.md overrides take precedence (Instruction Priority)
- Slash hints bypass mu-route entirely
- Users who always invoke skills directly (e.g., `/mu-arch`) are unaffected

## Data Flow

```
User message (unprefixed)
    → bootstrap reads → "invoke mu-route"
    → mu-route reads: message verbs + artifact state + git log + CODEOWNERS + slash prefix
    → apply R1..R9
    → propose in one sentence → user "ok" or override
    → invoke target skill with hint (stance = pre-confirmed if applicable)
    → target skill runs its Phase 0 (if creative) / full Process
    → at exit, if stakeholder-scope = team-touching, run sign-off gate
    → transition to next skill in pipeline
```

All synchronous, all markdown-driven, no state persisted between sessions.

## Error Handling

- **ER-R1** detection failure → mu-route outputs "I can't confidently route this; which opening move? (Explore / Validate / ... / Implement)"
- **ER-R2** sign-off gate with missing CODEOWNERS and ambiguous git history → ask user to name stakeholders
- **ER-R3** ambiguous verb match (e.g., "refactor and add feature") → propose primary move + note ambiguity

## Testing Strategy

Per mu-write-skill Iron Law:
- **RED** for mu-route: dispatch subagent with a user message that SHOULD trigger Explore (e.g., "help me take over this project"); observe whether without the skill, agent correctly routes. Baseline: without mu-route, agent would likely jump to mu-scope.
- **GREEN**: write SKILL.md + routing table; re-dispatch; verify correct Explore routing.
- **REFACTOR**: dispatch with ambiguous messages ("add a button"), verify sensible routing.

For sign-off gate: dispatch subagent with a "team project, multiple contributors" scenario + stub CODEOWNERS; verify gate fires at creative-skill exit and does not fire on solo scenario.

For bootstrap: no subagent test needed; verify by reading resulting bootstrap.md for correctness (smaller than before, more focused).

## Rollout Plan

1. `knowledge/principles/sign-off-gate.md` — write principle file
2. `skills/mu-route/SKILL.md` — write new skill
3. Dispatch verification subagent for mu-route (single representative scenario, like we did for stance)
4. Creative SKILL.md × 3 — add sign-off-gate consumption sentence at end of Process
5. `rules/bootstrap.md` — migrate pipeline paths section
6. `docs/architecture.md` + `_cn.md` + `README.md` + `README_CN.md` — reference new skill + principle
7. Self-review via mu-reviewer review-coverage
8. Commit

## Out of Scope (preserved from scope)

- Step 8 Actify validation (external, user-action-required)
- Batch stance computation in mu-route (future enhancement; v1 routes first move only)
- Removing §2.5 stance pre-confirmed hint (kept as fallback)
