# mu-route: Scenario-First Skill Router (Draft Proposal v3)

**Status:** Draft for discussion (issue #5)
**Date:** 2026-04-15
**Depends on:** PR #4 (three-tier skill architecture)
**Supersedes:** v1 (8 project types), v2 (two-axis model)

## Why v3

v1 listed 8 overlapping "project types" mixing 5 dimensions.
v2 replaced with a clean 2-axis model (spec completeness × change nature).
**Both started from mechanism, not ground truth.** This version starts from scenarios developers actually face, abstracts to opening moves, and only then discusses routing.

## Part 1 — Ground Truth: Developer Scenarios

Representative, not exhaustive. Grouped for readability; the groups themselves are NOT the routing units.

| Group | Scenarios |
|-------|-----------|
| **Understand (no change)** | Just cloned, want to know what it does · Taking over from someone who left · Reviewing someone's PR · Reading a library to learn · Evaluating whether to adopt a dependency |
| **Create** | Vague idea, validate if worth building · Validated idea, start from zero · Technical spike/prototype · Incubate new service inside existing monorepo |
| **Feature** | Spec clear, add it · Spec unclear, need product work · Direction unclear, need biz check · Implement something designed months ago · Enhance existing feature |
| **Fix** | Bug I just hit · Bug someone reported (reproduce first) · Flaky/intermittent · Performance regression · Security fix (time-sensitive) |
| **Reshape** | Refactor code I know · Refactor code I don't know (risky — explore first) · Large architectural migration · Tech debt cleanup · Dependency upgrade |
| **Integrate/Ops** | CI/CD change · Infra (terraform/docker) · Third-party API integration · Data migration |
| **Collaborate** | Change touches others' code · Write RFC for team review · Implement someone else's design |
| **Document** | Document existing code · Update stale docs · Answer questions about the codebase (no change) |
| **Meta** | Break down large task · Retrospective |

## Part 2 — The Right Unit: Opening Moves

Scenarios cluster not by what they change, but by **what's the correct first action**. **7 routable opening moves** cover task-starting scenarios, plus **1 cadence move** (Retrospect) that isn't routed from a user task but triggered periodically:

| Move | Kind | Fits which scenarios | Exit artifact | Exit criterion |
|------|------|---------------------|---------------|----------------|
| **Explore** | routable | Understand · Reshape-unfamiliar · Fix-in-strange-code · Answer-codebase-questions | Mental model note (components, entry points, domain terms) | Can answer "what does changing X affect?" |
| **Validate** | routable | Vague idea · Direction-unclear feature | biz doc + go/no-go | User confirms direction holds |
| **Design-product** | routable | Spec-unclear feature · Greenfield after validate | prd entry | User flows/screens/spec cover current task |
| **Design-tech** | routable | Large architectural work · Non-trivial new feature · Large refactor · RFC for team | arch doc | Interfaces/data-flow/errors are explicit |
| **Reproduce** | routable | All fix scenarios | Deterministic repro steps | Triggers every time |
| **Plan** | routable | Multi-phase work | Phased plan with checkpoints | Each phase independently verifiable |
| **Implement** | routable | Spec + arch known | Code + tests | Tests pass + reviewed |
| **Retrospect** | **cadence** | Weekly / sprint end | Learning log | Written to memory |

### Why Retrospect is separated

Other tools in the field (Cursor / Aider / Roo / Cline / Copilot) don't have any retrospect mode at all, because it's not triggered by a task — it's triggered by time. Keeping it in the routable list would force mu-route to consider it on every task, which is waste. It's triggered by schedule or explicit `/mu-retro` invocation.

### Why Reproduce stays separate from Explore (considered & rejected)

Both are "understanding" work, but:
- **Explore** → mental model of structure; hands off to any action
- **Reproduce** → deterministic trigger for a specific failing behavior; hands off specifically to mu-debug

Different artifacts, different downstream. Keeping separate.

### What happened to Align and Document?

Earlier drafts treated these as opening moves. They are not — they fold into existing structure:

- **Document** = `extract` mode of mu-biz / mu-prd / mu-arch (reverse-engineer artifact from existing code). Pure README-level edits don't need a skill. *(Note: "answer questions about codebase" was incorrectly tagged Document in v3 Part 1 — it's actually Explore: build mental model, don't persist as a doc.)*
- **Align** = consequence of the **Stakeholder-scope axis**, not a move. When `stakeholder = team-touching`, every creative skill's exit criterion **upgrades** to require sign-off (in addition to user approval). Orthogonal to all modes.

Time estimates deliberately omitted — they vary by orders of magnitude within each move. **Exit artifact + exit criterion** are the right definition.

### Modes shared by creative skills (mu-biz / mu-prd / mu-arch)

| Mode | Trigger | Action |
|------|---------|--------|
| `create` | Artifact absent | Produce from zero |
| `expand` | Artifact is a stub | Flesh it out |
| `gap-fill` | Partial coverage | Add only the section for current task |
| `sync` | Artifact stale vs code | Align to current reality |
| `extract` | Code exists, artifact doesn't | Reverse-engineer from code |
| `skip` | Artifact complete & fit | Pass through |

Stakeholder-scope axis is **orthogonal**: any of the above modes adds a sign-off gate when team-touching.

## Part 2.5 — Axes: Discovery Tool, Not Routing Logic

v1 (8 types) and v2 (2 axes) failed because they put axes at the **routing layer**. Axes still have value, but at two different layers:

### Discovery layer — axes used to enumerate scenarios

The 30+ scenarios in Part 1 weren't pulled from thin air; they were implicitly generated by varying along these axes:

- **Intent** — understand / create / add / fix / reshape / maintain / document
- **Familiarity** — authored-it / know-it / unfamiliar
- **Artifact state** — which of {biz, prd, arch, code, tests} exist & are fit
- **Stakeholder scope** — solo / team-touching / cross-team / public
- **Certainty** — spec clear / spec unclear / direction unclear
- **Time pressure** — exploratory / normal / urgent

Cartesian product is ~1000 points; most meaningless, but traversing systematically surfaces easy-to-forget combinations like "unfamiliar code + urgent fix" → `Explore-fast → Reproduce → Debug`. Use axes here as a **completeness check**, not a decision tree.

### Routing layer — which axes actually predict the opening move?

Derived *backwards* from the scenario→move mapping: if two scenarios differ only on axis X and map to the same move, X doesn't affect routing.

| Axis | Affects routing? | Why |
|------|------------------|-----|
| Intent | ✅ strong | `understand→Explore`, `create→Validate`, `fix→Reproduce` |
| Familiarity | ✅ strong | Unfamiliar triggers Explore; familiar skips it |
| Missing artifact | ✅ strong | `no biz → Validate`; `no prd → Design-product`; `no arch → Design-tech` |
| Stakeholder scope | ✅ strong | Team-touching upgrades exit criterion to require sign-off (cross-cuts all moves) |
| Time pressure | ⚠️ weak | Only changes mode (lightweight), not move |
| Scale (solo/team) | ⚠️ weak | Only changes mode |

**Four axes survive into the router**: three pick the move (Intent, Familiarity, Missing-artifact); one cross-cuts the exit criterion (Stakeholder-scope). Two axes are mode modifiers only. v2's two axes missed Familiarity and Stakeholder — which is why Explore was lost and team-coordination needs had no home.

### The discipline

- Axes are a **tool**, not the model
- Routing axes are **derived**, not declared
- When adding a new opening move, re-run the axis-to-move validation; some axes may become relevant, others may stop mattering

## Part 3 — Coverage Gap Analysis

Mapping opening moves to current devmuse skills:

| Opening move | Current coverage | Status |
|--------------|-----------------|--------|
| Explore | — | ❌ **GAP** — currently forced into mu-scope, which is wrong (scope produces a use-case set, not a mental model) |
| Validate | mu-biz | ✅ |
| Design-product | mu-prd | ✅ |
| Design-tech | mu-arch | ✅ |
| Reproduce | mu-scope (1 UC) | ✅ (via convention, could be stricter) |
| Plan | mu-plan | ✅ |
| Implement | mu-code | ✅ |
| Retrospect | mu-retro | ✅ |

**One concrete skill gap:** `mu-explore` — new skill for code-understanding tasks.

**Mode gap (cross-cutting):** mu-biz / mu-prd / mu-arch don't yet declare the 6 modes (`create | expand | gap-fill | sync | extract | skip`). Adding modes lets each skill audit existing artifacts and pick the right entry posture instead of always doing `create`.

**Sign-off gate gap:** no skill currently upgrades its exit criterion based on stakeholder scope. Need a uniform sign-off mechanism triggered by the Stakeholder-scope axis.

## Part 4 — Opening Move Catalog

Each move defined by four properties: **trigger signals** (when to use), **first action** (concrete first step), **artifact** (what comes out), **hand-off** (what's next).

### Explore *(new skill: `mu-explore`)*

- **Signals**: user says "understand / figure out / read / take over / evaluate / what does this do"; OR wants to modify a subsystem with no recent git activity from them
- **First action**: read top-level docs → trace main entry points → build a component map
- **Artifact**: `docs/explore/YYYY-MM-DD-<area>.md` — components, responsibilities, key flows, unknowns
- **Hand-off**: after user confirms the mental model fits their goal, route to the real task (Implement / Design-tech / Reproduce); Explore artifact passed as input context

### Validate *(skill: `mu-biz`)*

- **Signals**: "想做 / should I build / is this worth / vague idea"; no `docs/biz/` entry covering this direction
- **First action**: quick mode — 4 forcing questions (problem / customer / value / why-now); full mode — BMC + VPC + personas + MVP scope
- **Artifact**: `docs/biz/YYYY-MM-DD-<name>.md` ending with explicit go / no-go / pivot
- **Hand-off**: go → Design-product; no-go → stop; pivot → re-Validate with new framing

### Design-product *(skill: `mu-prd`)*

- **Signals**: biz approved (or trivially given); user describes feature in user-facing terms ("when user X, system should Y"); no prd entry for this feature
- **First action**: identify users → user flows → screens / surfaces → per-feature spec → tier rules
- **Artifact**: prd entry under `docs/prd/` — flows, screens, acceptance criteria, tiering
- **Hand-off**: Reproduce (if it's actually a fix dressed as a feature) or straight to scope → Design-tech

### Design-tech *(skill: `mu-arch`)*

- **Signals**: prd entry exists OR refactor/migration request OR cross-component change; user uses structural terms ("how should we structure / where should X live / what's the right boundary")
- **First action**: components → interfaces → data flow → error handling → alternatives considered
- **Artifact**: `docs/arch/YYYY-MM-DD-<name>.md` — design decisions with rationale
- **Hand-off**: Plan (if multi-phase) or directly to Implement (if single-PR scope)

### Reproduce *(skill: `mu-scope` in 1-UC mode → `mu-debug`)*

- **Signals**: "broken / error / bug / fails / unexpected / regression / flaky"
- **First action**: capture symptom verbatim → minimize input → confirm trigger is deterministic
- **Artifact**: `docs/scope/YYYY-MM-DD-<bug>.md` — single UC with repro steps + expected vs actual + environment
- **Hand-off**: mu-debug (root cause) → Implement (fix + regression test)

### Plan *(skill: `mu-plan`)*

- **Signals**: arch doc exists (or scope set is) larger than one PR; user says "break down / phases / checkpoints / sequence"
- **First action**: phases with dependencies → per-phase exit criterion → identify rollback points
- **Artifact**: `docs/plan/YYYY-MM-DD-<name>.md` — phased plan, each phase independently shippable
- **Hand-off**: Implement, phase by phase

### Implement *(skill: `mu-code`)*

- **Signals**: plan exists OR small well-specified task; user says "implement / build / write / add this"; spec + arch already settled
- **First action**: TDD cycle per task (red → green → refactor); branch + commit per logical unit
- **Artifact**: code + tests + commits (+ optional PR)
- **Hand-off**: mu-review → merge

### Retrospect *(skill: `mu-retro`)*

- **Signals**: weekly / sprint cadence; user says "retro / how did the week go / look back / what did we learn"
- **First action**: gather git metrics (commits, PRs, time per area) → identify patterns → extract lessons
- **Artifact**: memory entries (project + feedback types in `~/.claude/.../memory/`)
- **Hand-off**: terminal — output is durable memory, not a downstream skill

### Cross-cutting: Stakeholder sign-off

When `stakeholder = team-touching`, ANY move's exit criterion appends one step: **circulate artifact → collect sign-off from stakeholders (CODEOWNERS / RFC reviewers / designated team) → only then proceed**. Detection of stakeholder scope is Open Question #5.

## Part 5 — Router Design (Deferred)

Router design is **Phase 2**. It depends on:
- The full opening-move inventory being stable
- Each move having defined trigger signals
- Skill gaps being filled (at least `mu-explore`)

### The router's job

- Pattern-match user message + repo state against trigger signals
- Propose an opening move (one sentence)
- User confirms / overrides in one word
- Invoke the corresponding skill

Deliberately NOT an axis computation, NOT a decision tree over project types. Just pattern → opening move.

### Design principle: plan-as-checkpoint, not HARD-GATE

mu-route follows the **plan-as-checkpoint pattern** (industry convention — Devin Interactive Planning, Cline Plan Mode, Cursor Plan Mode all do this):

- **Propose** a path in one structured sentence
- **Accept** a one-word override or bare confirmation
- **Never block** waiting for perfect clarification
- **Default to proceed** if the user doesn't object

This distinguishes mu-route from the current bootstrap enforcer (which uses HARD-GATE language: "do not proceed until X is complete"). The goal is friction where it earns its keep (actual creative gates like mu-scope before mu-arch), not everywhere.

Structurally, mu-route's "propose + confirm" interaction is identical to mu-plan's "plan + confirm" — same pattern, different object (a routing decision vs a phased implementation plan). Keeping the interaction shape consistent across skills lets users learn one muscle memory.

## Part 6 — Slash-Command Escape Hatch

Industry convention: every major tool exposes direct invocation (`/ask`, `/architect`, `/code` in Aider; `/architect`, `/orchestrator`, `/debug` in Roo; `/edit`, `/commit` in Continue). Users build muscle memory for these.

devmuse should match:

- `/mu-explore`, `/mu-biz`, `/mu-prd`, `/mu-arch`, `/mu-scope`, `/mu-plan`, `/mu-code`, `/mu-review`, `/mu-debug`, `/mu-retro` → **direct skill invocation, bypass mu-route**
- Plain user message with no slash → mu-route classifies + proposes

This gives power users a fast path and aligns with how peer tools work. mu-route remains the default for unprefixed messages, where classification actually adds value.

## Proposed Next Steps

Ordered, dependencies explicit:

1. **Validate this framing with maintainers** — is scenarios → opening moves the right decomposition? (this issue)
2. **Complete opening-move catalog** — flesh out trigger signals, artifact templates, hand-off rules for all 8 moves
3. **Build `mu-explore`** — the one true skill gap (own scope/arch/plan/code cycle)
4. **Add modes to existing creative skills** — mu-biz/mu-prd/mu-arch gain `create | expand | gap-fill | sync | extract | skip`
5. **Add sign-off gate mechanism** — uniform pattern triggered by Stakeholder-scope axis
6. **Design mu-route** — pattern matcher, not decision tree
7. **Migrate bootstrap** — delegate first-move selection to mu-route
8. **Validate with Actify** — the motivating case

## What I'm NOT Proposing

- Not proposing an "axis model" or "project type taxonomy" — both were mechanism-first errors
- Not proposing time-based opening-move definitions — exit artifacts are the right unit
- Not proposing that mu-route classify everything; power users invoking a specific skill should bypass it

## Open Questions

1. ~~Align as skill or mode?~~ **Resolved:** neither — Align is the consequence of the Stakeholder-scope axis upgrading every skill's exit criterion to require sign-off.
2. ~~Document as skill or pattern?~~ **Resolved:** subsumed by `extract` mode of creative skills; pure README edits are direct edits.
3. How does **Explore** compose with subsequent moves? Does Explore's artifact feed mechanically into mu-debug / mu-arch, or is it just absorbed context? Proposal: artifact path is passed as input to the next skill, which can read it but isn't required to.
4. Do we need a **"continue previous work"** move for picking up where you left off? Feels distinct from the 8 above; possibly subsumed by Explore (re-explore the area before resuming).
5. **Sign-off mechanics**: how do creative skills detect the Stakeholder-scope axis? Options: (a) ask user upfront, (b) infer from git contributors / CODEOWNERS, (c) explicit project-level config in CLAUDE.md.
