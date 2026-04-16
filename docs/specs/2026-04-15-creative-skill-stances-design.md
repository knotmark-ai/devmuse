# Design: Creative-Skill Stances (mu-biz / mu-prd / mu-arch)

> **Date:** 2026-04-15
> **Source:** Issue #5 / v3 mu-route proposal
> **Scope:** docs/scope/2026-04-15-creative-skill-stances.md

## Requirements Reference

- **Scope:** `docs/scope/2026-04-15-creative-skill-stances.md`
- **Covers:** UC-A1, UC-A2, UC-B1..UC-B12, UC-C1..UC-C6, EC-1..EC-5, ER-1..ER-4
- **Deferred to mu-route design cycle:** EC-6 (pipeline-level batch confirmation)
- **NFRs:** detection <5s (cheap heuristics), stance in header + commit (default on, user-togglable), no silent destruction

## Approach Selected

**Approach 3 — per-skill independent stance detection; batch confirmation deferred to mu-route.**

Rejected approaches:
- **Approach 1** (first-skill handles batch): couples upstream skill to downstream skill internals. mu-biz should not know about mu-prd/mu-arch detection rules.
- **Approach 2** (`mu-stance` helper skill): short-lived abstraction — obsolete once mu-route lands. Adds a skill with no durable identity.

Approach 3 layers correctly: creative skills own stance-for-their-own-artifact; routing layer (mu-route, future) owns cross-skill orchestration.

**Inversion test — what would make Approach 3 fail?**
UX cost of 3 sequential confirmations on a full `mu-biz → mu-prd → mu-arch` chain. Mitigation: each confirmation is one-word ("ok" / single-word override); total overhead <30 seconds per chain. mu-route lands shortly after and collapses to one batch confirm.

## Architecture

All changes are markdown. No new runtime components.

```
knowledge/principles/
    stance-detection.md   ← NEW. Single source of truth for detection heuristics.

skills/mu-biz/SKILL.md    ← MODIFY. Insert Phase 0 block referencing stance-detection.md.
skills/mu-prd/SKILL.md    ← MODIFY. Same.
skills/mu-arch/SKILL.md   ← MODIFY. Same.
```

Existing `docs/biz/*.md`, `docs/prd/*.md`, `docs/specs/*-design*.md` artifact formats gain a Stance header + History section (backward compatible — absence treated as "historical, pre-stance").

HARD-GATEs in existing skills unchanged; stance is orthogonal to gating.

## Component Design

### 1. `knowledge/principles/stance-detection.md`

Single source of truth for how to compute a stance from artifact + source-dir state. All 3 creative skills `@`-reference this file; each executes the algorithm locally for its own artifact type.

**Contents**:

**Inputs**:
- artifact type (biz | prd | arch)
- artifact dir (per type)
- legacy locations (per type, listed in the file)
- current task identifier (extracted from user message or scope)
- watched source dirs (per type, listed in the file)

**Detection algorithm** (9-step deterministic procedure):

1. Locate candidates = existing files in conventional dir + legacy fallbacks
2. If 0 candidates AND source dirs empty → stance=`create`, sub_type=null, confidence=high
3. If 0 candidates AND source dirs non-empty → stance=`extract`, sub_type=null, confidence=high
4. If ≥1 candidate, pick most recent by mtime that matches current task identifier (fuzzy — substring or ≥60% token overlap on title/H1)
5. If no candidate matches current task → flag for H2 below
6. Run heuristic H1 (stub)
7. Run heuristic H2 (coverage)
8. Run heuristic H3 (staleness)
9. Apply decision table

**Heuristics** (specific thresholds):

| ID | Heuristic | Thresholds |
|----|-----------|------------|
| H1 | Stub | Clear stub: <100 words OR ≥3 placeholders (`TODO`/`<TBD>`/`FIXME`/`...`). Clear non-stub: >500 words AND 0 placeholders. Gray zone (100-500 words, 1-2 placeholders): flag AMBIGUOUS, lean update(expand). |
| H2 | Coverage | Parse artifact's top-level headings (H1 + H2). Match against current task identifier using substring match or ≥60% Jaccard token overlap. ≥1 match = covered; 0 = gap. |
| H3 | Staleness | Strategy B (fixed directory mapping). Compute `git log -1 --format=%at -- <watched_dirs>`. If any watched dir has a commit timestamp > artifact mtime + 7-day grace → stale. Grace period prevents noise from "wrote artifact, made a follow-up tweak" scenarios. |

**Decision table**:

| 0-candidate | H1 stub | H2 cover | H3 stale | code exists | → stance | → sub-type |
|-------------|---------|----------|----------|-------------|----------|------------|
| yes | — | — | — | no | `create` | — |
| yes | — | — | — | yes | `extract` | — |
| no | — | covered | not | — | `skip` | — |
| no | stub | — | — | — | `update` | `expand` |
| no | not | gap | — | — | `update` | `gap-fill` |
| no | not | covered | stale | — | `update` | `sync` |

**Sub-type priority when multiple update signals fire**: `expand > gap-fill > sync` (structure first, then coverage, then content). Commit message shows highest-priority sub-type; History section records all signals observed.

**Output shape**:
```
stance: <create|update|extract|skip>
sub_type: <expand|gap-fill|sync|null>
confidence: <high|ambiguous>
reason: <one-sentence explanation citing heuristics>
candidate_file: <path or null>
```

### 2. Per-skill SKILL.md integration pattern

Each of the 3 creative skills gets a new **Phase 0** section at the top (immediately after existing HARD-GATEs).

**Template** (parameterized per skill):

```markdown
## Phase 0: Stance Detection

Before engaging the existing process, detect the artifact's current state and pick an entry stance.

1. Read `@../../knowledge/principles/stance-detection.md`
2. Run the detection algorithm with:
   - Artifact type: <biz | prd | arch>
   - Artifact dir: <docs/biz/ | docs/prd/ | docs/specs/>
   - Legacy locations: <per-skill list>
   - Watched source dirs: <per-skill list>
3. Present the recommendation in one sentence:

   > "Detected: stance=<stance> (sub=<sub-type>), confidence=<high|ambiguous>. Reason: <one-line>. OK to proceed, or override?"

4. Accept user override in one word (`create` / `update` / `extract` / `skip`) or proceed on bare "ok". Slash-command hints (`/mu-<skill> create`) treated as pre-confirmed override.
5. Record approved stance. Route to matching branch below.

**Branch routing**:

| Stance | Branch action |
|--------|---------------|
| create | Run existing full Process unchanged |
| update | Load existing artifact → apply sub-type logic → merge changes (re-use existing section-approval loop) |
| extract | Read source dirs → build artifact fresh from code (optionally delegate to mu-explore first for mu-arch) |
| skip | Append pass-through entry to artifact History → hand off to downstream skill immediately |
```

**Per-skill parameter table** (spelled out in each SKILL.md):

| Skill | Artifact dir | Watched source dirs (H3) | Legacy locations |
|-------|--------------|--------------------------|------------------|
| mu-biz | `docs/biz/` | `docs/biz/`, root `README*`, `docs/prd/` | `docs/premise/` (deprecated), root `BUSINESS.md` |
| mu-prd | `docs/prd/` | `docs/prd/`, `src/pages/`, `src/screens/`, `src/views/`, `app/` | root `PRD.md` |
| mu-arch | `docs/specs/*-design*.md` | `src/`, `lib/`, `internal/`, `pkg/`, `cmd/` (whichever exist) | root `ARCHITECTURE.md`, `DESIGN.md` |

### 3. Stance-specific branch behaviors

**create branch** — invokes the existing full Process unchanged. Adds Stance header + History entry on write.

**update branch** — loads the picked candidate file as context. Sub-type drives which part of the existing Process runs:

| Sub-type | Behavior |
|----------|----------|
| expand | Identify empty/stub sections in the artifact. For each, invoke the matching existing Process step, get user approval, merge result back. |
| gap-fill | Append a new section titled "Gap-fill: `<current-task>`" that contains the new feature/subsystem/product coverage. Old content untouched. |
| sync | For each watched source dir with post-artifact-mtime commits, locate the artifact paragraph(s) that reference that area. Propose an update diff per affected paragraph; user approves each. |

All three reuse the skill's existing section-approval dialog; no new UX pattern.

**extract branch** — builds a fresh artifact from source code.
- mu-arch in extract mode MAY optionally delegate to mu-explore first (pre-build mental model); otherwise reads source dirs directly.
- Each section of the output artifact is populated by reading relevant code regions; each presented for user approval.
- Write same as create, but commit message prefix = `extract:` and reason cites which code regions were read.

**skip branch** — shortest path.
- Append an entry to the artifact's History section: `| <date> | <commit-hash> | skip | — | passthrough for <task> |`
- Commit only if header/History needed initialization (backward-compat for old artifacts).
- Invoke downstream skill per existing Integration section.

### 4. Artifact header + commit conventions

**Artifact header additions** (all 3 artifact types):

```markdown
> **Date:** YYYY-MM-DD
> **Source:** <link>
> **Stance:** <create | update | extract | skip>
> **Sub-type:** <expand | gap-fill | sync | —>
> **Detected at:** YYYY-MM-DD (commit `<short-sha>`)
```

**History section** (all 3, at the bottom of the artifact):

```markdown
## History

| Date | Commit | Stance | Sub-type | Change |
|------|--------|--------|----------|--------|
| 2026-04-15 | `abcd123` | create | — | Initial creation |
| 2026-04-20 | `def456` | update | expand | Filled persona section |
```

**Commit message prefix patterns**:

| Stance | Example prefix |
|--------|----------------|
| create | `docs(biz): create: ...` |
| update | `docs(prd): update(expand): ...` / `update(gap-fill)` / `update(sync)` |
| extract | `docs(specs): extract: ...` |
| skip | `docs(biz): skip: passthrough for <task>` |

**User opt-out**: invoking with `--no-stance-meta` (or equivalent user message) suppresses header additions and falls back to the pre-stance commit convention. Default is on.

### 5. Process Flow dot-graph updates

Each of the 3 skill dot graphs gains a Phase 0 subgraph at the top:

```dot
"Detect stance\n(H1/H2/H3)" [shape=box];
"Present recommendation" [shape=box];
"User confirms/overrides" [shape=diamond];
"create branch" [shape=box];
"update branch\n(sub-type: expand/gap-fill/sync)" [shape=box];
"extract branch" [shape=box];
"skip branch\n(append history, handoff)" [shape=doublecircle];

"Detect stance" -> "Present recommendation";
"Present recommendation" -> "User confirms/overrides";
"User confirms/overrides" -> "create branch" [label="create"];
"User confirms/overrides" -> "update branch..." [label="update"];
"User confirms/overrides" -> "extract branch" [label="extract"];
"User confirms/overrides" -> "skip branch..." [label="skip"];

"create branch" -> "<existing flow entry>";
"update branch..." -> "<existing section-approval loop>";
"extract branch" -> "<existing flow entry, source-sourced>";
```

Existing sub-graphs unchanged; all 4 branches eventually converge on the existing "Write artifact + commit" or "invoke next skill" nodes.

## Data Flow

No runtime state. All data flow is:
1. Agent reads user message + scope (if applicable) + existing artifact (if any)
2. Agent computes stance via stance-detection.md procedure
3. Agent presents; user replies
4. Agent executes branch
5. Agent writes artifact + commits

No shared state across skill invocations.

## Error Handling

Maps directly to scope ER-1..ER-4:

| Error | Handling |
|-------|----------|
| ER-1 detection-impossible (heuristic contradictions) | Output `confidence=ambiguous`, propose best guess, do NOT block — user's one-word override resolves. |
| ER-2 malformed-artifact | Catch parse failures in H1/H2/H3. Treat artifact as absent (flow to create or extract); flag filename in reason. |
| ER-3 extract-target-missing | User picked extract but source dirs empty → degrade to create with reason "no source to extract from". |
| ER-4 sync-contradicts-code | During update(sync) branch, if proposed diff is logically inconsistent (artifact asserts X, code shows ¬X, both plausibly intended), present both to user and record both in final artifact; do not silently pick. |

All error paths are non-blocking — detection always produces an output, even if uncertain.

## Testing Strategy

Per mu-write-skill Iron Law, every SKILL.md edit goes through RED-GREEN-REFACTOR.

**Per-skill test scenarios** (RED baseline):
- **mu-arch**: subagent invoked on repo with existing stale arch doc; user says "add new module X". Baseline behavior expected (without stance): mu-arch creates a new doc from scratch, ignoring the existing stale one. GREEN behavior: mu-arch proposes `update(sync)`.
- **mu-biz**: subagent invoked with stub biz doc (<100 words, placeholder); user says "complete the biz plan". Baseline: mu-biz may start from scratch. GREEN: propose `update(expand)`.
- **mu-prd**: subagent invoked with full prd covering 3 features; user says "add feature Y". Baseline: mu-prd may rewrite entire prd. GREEN: propose `update(gap-fill)`.

**Shared test** (after all 3 done): end-to-end dogfood on a synthetic small repo — does mu-biz → mu-prd → mu-arch chain produce 3 correct stance recommendations in sequence without contradictions?

**Rollout order**: mu-arch first (no mode-word collision, simplest integration) → mu-biz next → mu-prd last (most complex existing Process structure). Write stance-detection.md alongside the first skill edit.

## Rollout Plan

1. Write `knowledge/principles/stance-detection.md` with full detection algorithm + heuristic thresholds + decision table.
2. Edit `skills/mu-arch/SKILL.md`: add Phase 0 section, update Process Flow, run RED/GREEN/REFACTOR.
3. Commit. Verify pipeline-gate.sh still passes (skip-stance scenario: existing spec file satisfies glob).
4. Edit `skills/mu-biz/SKILL.md`: add Phase 0. Disambiguate "Mode" vocabulary — existing quick/full renamed in docstring to "Depth mode" to avoid collision with Stance. Run RED/GREEN/REFACTOR.
5. Edit `skills/mu-prd/SKILL.md`: add Phase 0. Same "Depth mode" disambiguation for lightweight/full. Run RED/GREEN/REFACTOR.
6. Update `docs/architecture.md` + `docs/architecture_cn.md`: reference new knowledge file in principles table.
7. Update `rules/bootstrap.md`: add a sentence noting "creative skills auto-detect stance on entry — users can override in one word."
8. End-to-end dogfood via synthetic scenario.
9. mu-review for full change set.

## Out of Scope

- **EC-6 pipeline-level batch confirmation** — deferred to mu-route design cycle. The batch pattern belongs to routing, not to creative skills. Explicit in commit messages and documented as "mu-route will consume stance-detection.md to produce batch recommendations."
- **Sign-off gate mechanism** (Stakeholder-scope axis) — separate scope cycle per v3 roadmap step 5.
- **mu-scope / mu-plan / mu-code / mu-review stances** — not creative skills; stance concept doesn't apply. Not pursued.
- **Retrofitting old artifacts with stance headers** — optional one-time migration, not skill behavior. Not pursued in this design.
- **Visual companion mockups** — all-text feature, no UI surface.

## Migration / Backward Compatibility

- Old artifacts without Stance header continue to work. On first touch by a stance-aware skill, header is lazily initialized.
- `hooks/pre-tool-use/pipeline-gate.sh` still passes for `skip` stance because the existing spec file still satisfies the `*-design*.md` glob; no hook changes needed.
- Commit messages without stance prefix still work; stance prefix is additive.

## Appendix A: Integration with mu-explore

mu-arch in `extract` stance MAY invoke mu-explore as a preamble when source dirs are unfamiliar (user has never touched them, fresh clone, etc.). This is opportunistic, not required — extract works on its own against known code.

The composition: mu-arch Phase 0 → user confirms `extract` → mu-arch checks familiarity → if unfamiliar, invoke mu-explore (pre-change variant) → consume mu-explore artifact → proceed with extract.

Documented in mu-arch SKILL.md after Phase 0 section.
