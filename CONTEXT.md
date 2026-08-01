# DevMuse Domain Model

> The concept structure behind DevMuse, settled before any skill edit. Check here before naming anything in skills, rules, principles, or docs.
>
> **Dependency direction (one-way):** this file may cite `docs/specs/`, `docs/plans/` only as *history*, never as authority; skills, rules, and templates cite this file. Stale content here is a bug.
> **Acceptance:** every concept must survive §1 and appear somewhere in §2's walkthrough.

## 1. Principles

- **Guidance over control** — detection, routing, and gates produce recommendations the user overrides in one word. Every path is non-blocking **except HARD-GATEs and safety gates**. A concept that forces the agent's hand without a user-side override, and is neither of those two, does not belong in this system.
- **Skills are code** — a skill edit follows the same discipline as a code change: a failing test first, then the minimal change, then loophole closure. A mechanism that cannot be tested against agent behavior is not ready to ship.
- **One fact, one place** — the same fact stated in two files drifts on the first correction that lands in only one of them. Every concept here names its single home; downstream artifacts cite, never restate.

## 2. Worked Example

> Jeff asks: 「帮我加个批量导出」on a repo he knows well, with no scope file on disk.

1. Routing reads the verb (`implement`) and the filesystem (no `docs/scope/`) → **opening move** = Scope.
2. mu-scope runs **Quick Probe** (~30s), proposes depth, enumerates cases with Jeff, and writes a **Use Case Set** — UC-1…UC-9 plus UC-R1…R3.
3. Jeff approves it. That approval is the **control gate**; the file is now an approved **artifact**.
4. The **Pipeline Graph** names the successor: mu-arch. It consumes the scope as **evidence** and produces a design spec, which goes through its own reviewer loop and Jeff's approval.
5. mu-plan turns the spec into TDD tasks, each carrying `Covers: UC-x` **anchors**.
6. mu-code implements task by task; TDD and verification-before-completion are **safety gates** — Jeff cannot waive those the way he can waive a recommendation.
7. mu-review audits coverage against the UC anchors, then merges.

Every concept below is validated against this run.

## 3. Concept Table

Archetypes: **Role** · **Thing** · **Moment** (has a lifecycle) · **Description** (type-level, no lifecycle of its own) · **Derived**.

| Concept | Archetype | One line | Who produces | Who maintains |
|---|---|---|---|---|
| **Artifact** | **Moment ⭐ spine** | A durable work product a skill authors, a user approves, and a downstream skill consumes | the authoring skill | the skill that owns its stance |
| **Evidence** | Description | The role an artifact plays for a downstream edge — what the edge actually consumes, as opposed to a file path | — | — |
| **Control gate** | Description | User approval of an artifact before anything depending on it proceeds | — | user |
| **Safety gate** | Description | A non-substitutable discipline (TDD, verification-before-completion, git safety) that no override reaches | — | — |
| **HARD-GATE** | Description | A structural precondition embedded in a skill body, evaluated before stance detection | — | — |
| **Sign-off gate** | Description | The non-blocking stakeholder-approval protocol at a creative skill's exit | — | — |
| **Stance** | Description | The entry mode a creative skill picks from the artifact's current state | detection algorithm | user override |
| **Opening move** | Description | The first skill routing selects for an unprefixed task | routing rules | — |
| **Pipeline Graph** | Description | The single declaration of cross-skill handoffs | `rules/bootstrap.md` | — |
| **Core pipeline** | Description | The ordered auto-routed chain mu-scope → mu-arch → mu-plan → mu-code → mu-review | — | — |
| **Orthogonal skill** | Description | An auto-routed skill running outside the pipeline's order | — | — |
| **On-demand skill** | Description | A skill never auto-routed; slash invocation only | — | — |
| **Creative skill** | Description | A skill authoring a judgment-bearing artifact: stance at entry, sign-off at exit | — | — |
| **Living artifact** | Description | An artifact form with no date in its filename, updated in place with a History row | — | — |
| **Use Case Set** | Thing | The approved list of use cases mu-scope produces; its UC-IDs propagate downstream | mu-scope | mu-scope |
| **Quick Probe** | Description | mu-scope's ~30-second codebase impact scan, run before enumeration | — | — |
| **Anchor** | Description | A verbatim identifier a reviewer must cite in every finding | — | — |
| **Cross-review** | Description | The optional second opinion from a different model family | — | — |
| **Task transition** | Moment | A user message whose intent shifts skill category mid-conversation | user | — |
| **Team-touching** | Derived | The stakeholder-scope value that triggers the sign-off gate | detection | — |
| **Skill CSO** | Description | Writing a skill's `description` purely as triggering conditions | — | — |

**Open ambiguities** — none.

## 4. Spine: the life of an artifact

**How it was derived:**

```
1. Tag every concept with an archetype (§3)
2. Moments: Artifact · Task transition
3. Dependency count: Artifact is referenced by stance, control gate,
   HARD-GATE, evidence, Pipeline Graph, living-artifact, Use Case Set,
   sign-off gate — 8. Task transition: 1.
4. Candidate = Artifact
5. Verify: can DevMuse be told as "the life of an artifact"? → yes (below)
∴ spine = Artifact
```

> This derivation found a hole: **`Artifact` had no entry at all** before 2026-07-31 — the model carried eight concepts *about* artifacts (stance, gates, evidence, living-artifact) without the object they are about. So did `Evidence`, `Control gate`, and `Safety gate`, all three load-bearing in `rules/bootstrap.md`.

**The shape.** Everything DevMuse does is one loop: *a skill authors an artifact, a user approves it, the graph hands it to the next skill as evidence.* Skills are the verbs; the artifact is the noun that persists.

```mermaid
stateDiagram-v2
    [*] --> Drafted: authoring skill produces it
    Drafted --> Drafted: reviewer loop (max 3 iterations)
    Drafted --> Approved: user approves — the control gate
    Approved --> Consumed: a downstream edge takes it as evidence
    Consumed --> Frozen: dated snapshot (docs/scope|specs|plans)
    Consumed --> Drafted: living artifact, re-entered via update stance
    Frozen --> Superseded: a later artifact replaces its decisions
    Frozen --> [*]
    Superseded --> [*]
```

**Stance is the entry map** — where detection finds the artifact decides how the skill enters:

| Artifact state found | Stance |
|---|---|
| absent | `create` |
| living, sections stubbed | `update(expand)` |
| living, behind current code | `update(sync)` |
| living, new area to append | `update(gap-fill)` |
| absent, but the code already implies it | `extract` |
| approved and untouched by this task | `skip` |

**Domain guarantees:**

- **A control gate never yields to an override.** Guidance-over-control governs recommendations, not approvals — the user *is* the approver, so waiving it has no meaning.
- **Safety gates outlive every stance.** A `skip` stance passes through artifact work and the sign-off gate, never a HARD-GATE or a safety gate.
- **Edges consume evidence, not paths.** An equivalent that answers the same questions satisfies the edge; the substitution is recorded in the consuming artifact's header.
- **Frozen is terminal.** Dated snapshots are never retro-edited; a superseding decision opens a new artifact and the old one stays as history.

### Time axis

| # | Trigger | State change |
|---|---|---|
| 1 | User states an unprefixed task | Routing picks the **opening move** from verbs + filesystem facts |
| 2 | Skill entered | Phase 0 detects the artifact's state → **stance** |
| 3 | Skill authors | artifact → `Drafted` |
| 4 | Reviewer loop (creative skills) | stays `Drafted` until approved or 3 iterations elapse |
| 5 | User approves — **control gate** | → `Approved` |
| 6 | Pipeline Graph names the successor | — |
| 7 | Downstream skill reads it as **evidence** | → `Consumed` |
| 8a | Dated snapshot | → `Frozen`, never retro-edited |
| 8b | Living artifact | → back to `Drafted` via an update stance, History row appended |
| — | **Task transition** fires at any point | re-route from step 1 |

## 5. Structure Overview

```
user intent
    │  routing rules (bootstrap): verbs + git/fs facts, never inference
    ▼
opening move ──▶ skill
                  │  Phase 0: stance detection ── artifact state → entry mode
                  ▼
             ARTIFACT  drafted → reviewed → approved
                  │  control gate: user approval
                  ▼
             Pipeline Graph names the successor
                  │  the edge consumes EVIDENCE (equivalents substitute)
                  ▼
             downstream skill  ⟲
                  │
     safety gates (TDD · verification · git) apply throughout,
     reachable by no override
```

**Walked through §2's example:** the verb `implement` plus an empty `docs/scope/` selects Scope as the opening move (step 1); mu-scope finds no artifact → `create` (2); the Use Case Set reaches `Drafted` (3), then `Approved` when Jeff signs off (5); the graph names mu-arch (6), which consumes the scope as evidence (7); the scope file, being a dated snapshot, ends `Frozen` (8a). TDD inside mu-code is a safety gate — Jeff can waive the plan, never the red-green cycle.

## 6. Concepts in Detail

### Artifact

A durable work product a skill authors, a user approves, and a downstream skill consumes. Two forms: **dated snapshots** (`docs/scope|specs|plans/YYYY-MM-DD-*.md`) freeze on approval and are never retro-edited; **living artifacts** (CONTEXT.md, `docs/wiki/`, explore artifacts) carry no date, update in place, and append a History row per revision.

**Succession** — dated snapshots relate to each other explicitly, since a feature worked twice leaves two of them. An **unconsumed** artifact is revised in place, filename and date unchanged. A **consumed** one is either *superseded* (its decisions replaced) or *extended* (added to without invalidating), with the link written in **both** directions. Which applies is checkable, not a judgment call: a scope is consumed once a spec's Requirements Reference cites it, a plan once any checkbox reads `[x]`. See `knowledge/principles/artifact-succession.md`.

_Avoid_: document, deliverable, output file

### Evidence

The role an artifact plays for a downstream edge — what the edge consumes, as opposed to which file supplies it. The Pipeline Graph's edges are declared over evidence precisely so an equivalent can substitute: a detailed PRD feature section plus its `CONTEXT.md` §6 machine stands in for a scope artifact, an inline plan stands in for `docs/plans` at mu-code. Missing evidence obliges a recommendation, not a refusal — the recommendation is the agent's duty, declining it is the user's right, and a declined recommendation is flagged in the consuming artifact.

_Avoid_: input file, prerequisite doc

### Control gate

User approval of an artifact before anything that depends on it proceeds. Distinct from every other gate by who holds it: the user does. Guidance-over-control makes recommendations overridable — it does not make approvals waivable, because the user is the approver.

_Avoid_: approval step, review gate

### Safety gate

A discipline no override reaches: TDD's red-green cycle, verification-before-completion, git safety. Named separately from HARD-GATEs because they are not embedded in one skill's body — they hold across every skill, stance, and override.

_Avoid_: hard rule, non-negotiable (as a standalone label)

### HARD-GATE

A structural, non-negotiable precondition embedded in a skill body (e.g., no design without an approved scope artifact); evaluated before stance detection and never bypassed by a `skip` stance or a sign-off.

_Avoid_: blocker, hard requirement, checkpoint

### Sign-off gate

The non-blocking stakeholder-approval protocol a creative skill runs at exit when work is team-touching; always skippable with "skip sign-off" — explicitly not a HARD-GATE.

_Avoid_: approval gate, RFC gate

### Stance

The entry mode a creative skill picks at Phase 0 — `create`, `update` (sub-types expand > gap-fill > sync), `extract`, or `skip` — produced by the deterministic detection algorithm in `knowledge/principles/stance-detection.md` and overridable in one word. It is a **function of the artifact's state**, not of the task's phrasing (see §4).

_Avoid_: mode, entry state

### Opening move

The first skill the routing rules select for an unprefixed task — Explore (mu-explore), Design-tech (mu-arch), Reproduce (mu-scope 1-UC repro, then mu-debug), Review (mu-review), or Implement (mu-code). Selected from intent verbs and filesystem facts, never from inference about what the user "really" wants.

_Avoid_: entry skill, first step, initial route

### Pipeline Graph

The single declaration of cross-skill handoffs, in `rules/bootstrap.md`: skills announce completion, the graph names the successor; edges consume evidence, not file paths.

_Avoid_: terminal chain, hardwired terminal

### Core pipeline

The ordered, auto-routed skill chain mu-scope → mu-arch → mu-plan → mu-code → mu-review, where each stage's artifact is the next stage's evidence.

_Avoid_: main flow, workflow chain

### Orthogonal skill

An auto-routed skill that runs at any point outside the core pipeline's order (mu-explore, mu-debug).

_Avoid_: side skill, utility skill

### On-demand skill

A skill that is never auto-routed and runs only via explicit slash invocation (mu-mrd, mu-prd, mu-wiki, mu-retro, mu-grill); the routing rules answer matching intents with a pointer, not an invocation.

_Avoid_: slash-only skill, manual skill

### Creative skill

One of mu-mrd, mu-prd, mu-arch — the skills that author a judgment-bearing artifact, run stance detection at Phase 0, and face the sign-off gate at exit.

_Avoid_: authoring skill, artifact skill

### Living artifact

The artifact form with no date in its filename, updated in place with a History row appended per revision (explore artifacts, wiki, this file) — as opposed to the dated snapshots under `docs/scope|specs|plans`.

_Avoid_: evergreen doc

### Use Case Set

The approved list of use cases (UC-1, UC-2, …) produced by mu-scope; UC-IDs propagate through design, plan tasks, code, and tests, and are what coverage review audits against.

_Avoid_: requirements list, feature list

### Quick Probe

mu-scope's automatic ~30-second codebase impact scan, run before use-case enumeration to ground the depth recommendation.

_Avoid_: impact scan, pre-scan

### Anchor

A verbatim identifier (UC-ID, task number, file path, component name) that mu-reviewer must extract from the reviewed artifact and cite in every finding; findings without anchors are treated as hallucinations and deleted.

_Avoid_: citation, reference, evidence

### Cross-review

The optional mu-review step that dispatches the OpenAI Codex CLI for a second opinion from a different model family; entirely invisible when `codex` is not installed.

_Avoid_: second review, external review

### Task transition

A user message whose intent shifts skill category mid-conversation (debug→fix, explore→implement), requiring re-classification by the routing rules — versus a continuation, which stays inside the active skill.

_Avoid_: context switch

### Team-touching

The stakeholder-scope value meaning the artifact affects code others own — detected via CODEOWNERS, ≥3 recent authors on watched dirs, or explicit user declaration — and the sole trigger of the sign-off gate.

_Avoid_: shared-code, multi-owner (as scope labels)

### Skill CSO

Claude Search Optimization — writing a skill's `description` frontmatter purely as triggering conditions ("Use when…"), never as a workflow summary, so future Claude finds the skill and reads its body instead of shortcutting from the description.

_Avoid_: skill SEO, discoverability tuning

## 7. History

| Date | Commit | Change |
|---|---|---|
| 2026-07-13 | — | "UC" ruled exclusive to mu-scope; mu-explore's five exploration types renamed **variant**. Bare "gate" retired — always qualified (HARD-GATE / sign-off gate / size-area gate). |
| 2026-04-14 | `108f3f6` | mu-design renamed **mu-arch** (hook straggler fixed in `304043d`). Dated plan snapshots keep the old name as history. |
| 2026-08-01 | — (uncommitted) | **Succession** added to the Artifact entry, and `Superseded` added to its machine as a state reachable from `Frozen`. Frozen was previously terminal, which left no way to say "this snapshot is still immutable but no longer the one to read". Driven by measurement: one feature in a real repo carried four spec files with zero links between them. |
| 2026-07-31 | `c6a4a60` | Restructured from glossary to domain model (7 sections). Spine derived: **Artifact**. Added four load-bearing concepts the glossary had never carried — `Artifact`, `Evidence`, `Control gate`, `Safety gate` — all three of the latter already load-bearing in `rules/bootstrap.md`. Stance re-stated as a function of artifact state rather than of task phrasing. |
