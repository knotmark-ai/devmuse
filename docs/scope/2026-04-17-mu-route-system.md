# Scope: mu-route System (Steps 5+6+7 combined)

> **Date:** 2026-04-17
> **Source:** Issue #5 / v3 mu-route proposal
> **Combines** Roadmap Steps 5 (sign-off gate), 6 (mu-route skill), 7 (bootstrap migration) into one scope cycle because they form a single integration unit.

## Context

Three remaining tasks from the v3 mu-route roadmap, bundled because they integrate tightly:
- **Step 5**: sign-off gate mechanism (triggered by Stakeholder-scope axis → upgrades exit criteria across creative skills)
- **Step 6**: `mu-route` skill itself (the pattern-matching router)
- **Step 7**: migrate `rules/bootstrap.md` to delegate first-move selection to `mu-route`

**Step 8** (Actify validation) requires external repo access; marked as user-action-required, not scoped here.

## Quick Probe

- **Files involved (new)**: `skills/mu-route/SKILL.md`, `knowledge/principles/sign-off-gate.md`
- **Files involved (modify)**: `rules/bootstrap.md` (delegate to mu-route), 3 creative SKILL.md (add sign-off gate consumption), `docs/architecture.md` + `_cn.md`, `README.md` + `README_CN.md`
- **Fan-out**: mu-route called at session-start for every task (highest-traffic skill). Sign-off gate consumed by creative skills when stakeholder-scope triggers.
- **Architecture impact**: adds a routing layer at top of pipeline; all existing skills are reachable via mu-route OR direct slash hint (power-user escape hatch from v3 proposal Part 6).
- **Risk**: medium — mu-route is a gateway, poor implementation regresses every session.

## Use Cases

### Happy paths

**mu-route core (from v3 Part 5)**:
- **UC-R1** trigger-signal match: mu-route reads user message + repo state, computes best-match opening move, proposes path, user confirms in one word
- **UC-R2** pattern match → 1 of 7 routable opening moves (Explore / Validate / Design-product / Design-tech / Reproduce / Plan / Implement)
- **UC-R3** cadence move (Retrospect) is never auto-routed; only triggered by explicit `/mu-retro` or cron
- **UC-R4** slash-command escape hatch: `/mu-<skill>` bypasses mu-route entirely; user goes direct
- **UC-R5** plan-as-checkpoint UX (propose + confirm in one sentence, not HARD-GATE blocking)

**Trigger signals (concretely)**:
- **UC-R6** Axis Intent (verb in user message): "understand/figure out/read/take over" → Explore; "should I / worth / idea" → Validate; "add / build / implement" → Design-product or Design-tech or Implement (per other axes); "fix / bug / broken" → Reproduce; "refactor / clean up / rename" → Design-tech (reshape path)
- **UC-R7** Axis Familiarity: unfamiliar code (no recent git activity from user OR user asks to modify an area they've never touched per `git log --author`) → Explore precedes all else
- **UC-R8** Axis Missing-artifact: `docs/biz/` empty + product intent → Validate; `docs/prd/` empty + feature intent → Design-product; `docs/specs/` empty + tech change intent → Design-tech
- **UC-R9** Axis Stakeholder-scope: `team-touching` (detected via CODEOWNERS presence + git log multi-contributor OR explicit user signal) → upgrades exit criteria with sign-off gate

**sign-off gate (Step 5)**:
- **UC-S1** when creative skill finishes its artifact AND stakeholder-scope = team-touching, require sign-off before terminal
- **UC-S2** sign-off mechanism: agent prompts "circulate artifact to <stakeholders>; reply when approved" — not blocking indefinitely, user controls timing
- **UC-S3** stakeholder detection heuristics (parallel to stance-detection.md pattern): CODEOWNERS presence + multi-author git log + explicit user declaration
- **UC-S4** sign-off record in artifact History: "Signed off by <N> stakeholders at <date>"

**bootstrap migration (Step 7)**:
- **UC-B1** bootstrap.md's "Choosing a path" section collapsed to "Invoke mu-route; it picks"
- **UC-B2** backward-compat: if user has CLAUDE.md override, that takes precedence per existing Instruction Priority in bootstrap
- **UC-B3** direct slash invocations still work(v3 Part 6 escape hatch) — mu-route is only invoked for unprefixed user messages

### Edge cases

- **EC-R1** ambiguous pattern match: 2+ opening moves tie → propose best-guess + uncertainty flag (same pattern as stance-detection ER-1)
- **EC-R2** user's message doesn't match any trigger signal → propose Explore (safe default: understand before acting)
- **EC-R3** user has CLAUDE.md override that conflicts with mu-route's proposal → bootstrap's Instruction Priority rules (user > skill > default)
- **EC-R4** mu-route invoked in a worktree with unusual state (empty repo, shallow clone, submodule) → degrade to asking user's intent directly

### Error cases

- **ER-R1** mu-route fails to compute path (heuristics error) → fall through to "ask user which move" — non-blocking
- **ER-R2** sign-off gate invoked but CODEOWNERS missing → ask user to name stakeholders; don't guess
- **ER-R3** deferred EC-6 (batch confirm) now landing: mu-route MAY produce batch stance recommendations for creative-skill chains, replacing the §2.5 pre-confirmed hint mechanism

## Conflicts

- ⚠️ **CONFLICT-A**: mu-route competes with existing bootstrap flowchart (Skill Priority & Pipeline Paths section). Resolution: bootstrap delegates to mu-route; existing paths become mu-route's internal routing table.

- ⚠️ **CONFLICT-B**: `§2.5 Pipeline-handoff regression guard` (stance spec) was a workaround until mu-route existed. When mu-route lands, it should take over batch-stance recommendation. Resolution: keep §2.5 mechanism as fallback; mu-route adds a smarter batch layer on top. Both coexist (no removal) to avoid breaking existing flows.

- ⚠️ **CONFLICT-C**: slash-command escape hatch(UC-R4) vs mu-route default invocation. Resolution: if user's message starts with `/mu-<skill>`, skip mu-route; otherwise run mu-route. Explicit precedence.

## Non-Functional

- mu-route detection cost: <5 seconds (same NFR as stance-detection)
- mu-route output: propose + confirm pattern, one sentence, one-word user reply accepted
- sign-off gate: non-blocking — user controls pace
- bootstrap backward-compat: existing CLAUDE.md overrides honored

## Out of Scope

- **Step 8 Actify validation**: requires external repo access; user-action-required
- **Retrofitting existing sessions to use mu-route**: one-time migration, not skill behavior
- **Batch stance computation**: hinted at in ER-R3; defer detailed design to future if needed, mu-route v1 only routes the first move

## Impact Analysis

- Affected: `rules/bootstrap.md` (major — path section restructured), creative SKILL.md × 3 (sign-off gate consumption — minor), 4 doc files
- New: `skills/mu-route/SKILL.md`, `knowledge/principles/sign-off-gate.md`
- Rollout: sign-off-gate.md + sign-off consumption in creative skills first; then mu-route skill; then bootstrap migration; final review and doc.
