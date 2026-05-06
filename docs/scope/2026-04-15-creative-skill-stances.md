# Scope: Creative-Skill Stances (mu-biz / mu-prd / mu-arch)

> **Date:** 2026-04-15
> **Source:** Issue #5 / `docs/proposals/2026-04-15-mu-route-design.md` Part 2

## Context

The v3 mu-route proposal identified a **mode gap** in creative skills: mu-biz, mu-prd, and mu-arch always default to `create` (produce artifact from zero), even when artifacts already exist in various states (stub, partial, stale). This scope adds **stance** capability so each skill can audit existing artifacts and pick the right entry posture.

### Terminology decisions

- **Stance** (not "mode" — mu-biz already uses "quick/full mode", mu-prd uses "lightweight/full mode"; reusing "mode" would collide. Also rejected "entry" — collides with "prd entry / biz entry" in existing vocabulary.)
- **4 stances** (not 6 from the v3 proposal):
  - `create` — no artifact exists → produce from zero
  - `update` — artifact exists but needs work → modify in place (internal sub-types: `expand` / `gap-fill` / `sync`, not exposed to user)
  - `extract` — code/product exists but no artifact → reverse-engineer
  - `skip` — artifact fits current task → pass through

Collapsed from 6 to 4 based on user-facing simplicity. expand/gap-fill/sync are all "modify existing" from the user's view; agent decides sub-type internally. Sub-type is still recorded in history + commit prefix for traceability.

### Design philosophy (feedback from review)

**Guidance over control.** The stance system proposes and user confirms/overrides in one word. No blocking, no forced archives, no hard stops. When detection is ambiguous, agent proposes best guess with an uncertainty flag; user can always override.

## Quick Probe Results

- **Files involved (modify)**:
  - `skills/mu-biz/SKILL.md` — add Stance section, update Process Flow to include detection step
  - `skills/mu-prd/SKILL.md` — same
  - `skills/mu-arch/SKILL.md` — same (no existing mode section — introduces stance concept fresh)
- **Files involved (new)**:
  - `knowledge/principles/stance-detection.md` — shared heuristics for detecting artifact state, reused by all 3 creative skills
- **Files potentially touched**:
  - `rules/bootstrap.md` — pipeline path examples may need a sentence noting stance auto-detection
  - `hooks/pre-tool-use/pipeline-gate.sh` — verify it doesn't break when `skip` stance produces no new artifact (it checks for ANY `*-design*.md`, so existing file satisfies)
- **Fan-out**:
  - 3 creative skills reference each other (biz → prd → scope; scope → arch → plan). Stance detection is skill-local; no cross-skill state.
- **Test coverage**: n/a (skills are markdown); validation via mu-write-skill TDD per skill edit
- **Architecture impact**: adds a shared principle file; each skill's preamble gains a stance-detection step; no new agents; no hook changes expected
- **Risk signal**: medium (modifies 3 production skills + adds shared principle; but additive and individually testable)

## Use Cases

### Happy Paths

#### Horizontal (applies to all 3 creative skills)

- **UC-A1 (stance-detection)**: When a creative skill is invoked, Then before any work it runs stance detection using `knowledge/principles/stance-detection.md` heuristics and presents the recommended stance to the user in one sentence.

- **UC-A2 (user-override)**: Given a recommended stance, When the user gives a one-word override (`create` / `update` / `extract` / `skip` / `no change <preferred>`), Then the skill uses the user's choice without further challenge.

#### Per-skill × per-stance matrix (12 UCs)

| Stance | mu-biz action | mu-prd action | mu-arch action |
|--------|---------------|---------------|----------------|
| **create** (UC-B1/B5/B9) | Produce biz artifact from zero (quick or full mode as declared) | Produce prd artifact from zero (lightweight or full mode) | Produce arch artifact from zero based on scope |
| **update** (UC-B2/B6/B10) | Modify existing biz file; sub-type = expand/gap-fill/sync chosen by detection | Modify existing prd file; same sub-type logic | Modify existing arch file; same |
| **extract** (UC-B3/B7/B11) | Reverse-engineer biz artifact from product usage, commits, user interviews | Reverse-engineer prd artifact from code + user flows + UI | Reverse-engineer arch artifact from code structure |
| **skip** (UC-B4/B8/B12) | Mark existing artifact as current, emit pass-through, move to downstream | Same | Same |

#### Shared stance-detection heuristics (6 UCs, producing `knowledge/principles/stance-detection.md`)

- **UC-C1 (stub-detection)**: Given an artifact <300 words or containing placeholders (`TODO`, `<TBD>`, `...`), Then recommend `update` sub-type `expand`.
- **UC-C2 (staleness-detection)**: Given artifact's last-modified date predates significant related code changes, Then recommend `update` sub-type `sync`.
- **UC-C3 (coverage-gap-detection)**: Given artifact's topic/feature list does not contain current task identifier, Then recommend `update` sub-type `gap-fill`.
- **UC-C4 (emptiness-detection)**: Given no artifact exists in any conventional OR legacy location (covered by EC-3), Then recommend `create`.
- **UC-C5 (code-without-doc)**: Given target code exists but no corresponding artifact, Then recommend `extract` (optionally delegate to mu-explore for code-comprehension prerequisite).
- **UC-C6 (fitness-check)**: Given artifact covers the current task AND is current, Then recommend `skip`. "Fit" = fit for CURRENT TASK, not fit overall.

### Edge Cases

- **EC-1 (ambiguous-state)**: Given detection signals are ambiguous (e.g., file borderline short but substantive), When stance is proposed, Then default to `update` with an ambiguity flag in the proposal sentence; user can correct.
- **EC-2 (multiple-artifacts)**: Given multiple files in the target directory, When picking which to audit, Then use most-recent-mtime + topic-match-to-current-task; if still ambiguous, ask user which file.
- **EC-3 (legacy-location)**: Given no file in `docs/<type>/` but a conventional-ish file exists elsewhere (root-level `BUSINESS.md`, `ARCHITECTURE.md`, etc.), When detecting emptiness, Then treat legacy file as existing and propose `update`; do not silently create a duplicate.
- **EC-4 (mid-flow-switch)**: Given user asks to change stance mid-work, Then gracefully transition — append work-in-progress to artifact history, re-run detection or honor new stance, continue.
- **EC-5 (partial-overlap)**: Given artifact covers ~70% of current task, Then propose `update` sub-type `gap-fill`; artifact clearly marks the new section as gap-fill-added.
- **EC-6 (posture-stacking / pipeline batch-confirm)**: Given 3 creative skills will chain (biz → prd → arch), When the first skill runs stance detection, Then present all 3 recommended stances at once for a batch confirmation; user can accept all ("ok") or override individually ("ok, but arch=create").

### Error Cases

- **ER-1 (detection-impossible)**: Given detection heuristics contradict one another (e.g., signals for both `skip` and `extract`), When no clear best stance emerges, Then propose the best guess with an explicit uncertainty flag and let the user choose in one word. Do NOT block.
- **ER-2 (malformed-artifact)**: Given a file exists but is unreadable / corrupted / not markdown, When detecting state, Then treat as absent (fall through to `create`) and flag the file's location so user can investigate.
- **ER-3 (extract-target-missing)**: Given user picks `extract` but the source code region is empty or missing, Then degrade to `create` with a flag noting "no source to extract from".
- **ER-4 (sync-contradicts-code)**: Given `update(sync)` is in progress and artifact and code disagree irreconcilably, Then surface the specific conflict to user; record both versions in the artifact; do not silently pick one.

## Conflicts (all resolved)

- ⚠️ **CONFLICT-1**: UC-C6 "fit → skip" conflicts with partial-coverage cases.
  - **Resolution**: "fit" in C6 redefined as "fit FOR CURRENT TASK", not overall coverage. Skip only when the specific task-at-hand is already fully handled.

- ⚠️ **CONFLICT-2**: UC-C4 "empty → create" conflicts with EC-3 "legacy-location".
  - **Resolution**: C4 fires only after broader scan (conventional dir + common legacy paths: root `*.md`, README sections). Legacy matches are treated as existing artifacts.

- ⚠️ **CONFLICT-3**: UC-C1/C2/C3 can all fire simultaneously (stub AND stale AND gap).
  - **Resolution**: sub-type priority = **stub > gap-fill > sync** (structure-first, then coverage, then content). Commit prefix shows highest-priority sub-type; history records all signals observed.

- ⚠️ **CONFLICT-4**: EC-6 "each skill independent" conflicts with user ergonomics (3 sequential confirmations).
  - **Resolution**: pipeline-level batch confirmation — first creative skill in a chain presents recommended stances for the whole chain; user confirms once. Individual override still supported.

- ⚠️ **CONFLICT-5**: UC-A3/A4 drafted as UCs implying "MUST" conflict with "guidance > control" philosophy.
  - **Resolution**: A3/A4 downgraded from UCs to **default output formats** (listed under Non-Functional below). Header/commit stance tracking is on by default; user can opt out.

## Non-Functional Constraints

- **Detection cost**: stance detection must complete in <5 seconds (cheap heuristics per v3 proposal).
- **Default output format**:
  - Artifact header gains a `> **Stance:** <create|update|extract|skip>` line (plus `> **Sub-type:** <expand|gap-fill|sync>` when update). On by default; user can opt out for a given invocation.
  - Commit messages carry stance prefix in scope (e.g., `docs(biz): update(expand)(...)`). On by default; user can opt out.
  - Artifact History section gains one entry per stance transition: date + commit hash + stance + sub-type.
- **No silent destruction**: `create` over existing artifact never archives, moves, or deletes the old file. User who forces `create` gets a warning once; old file stays where user put it; user decides what to do with it.
- **Orthogonal to existing depth modes**: stance (entry decision) and quick/full / lightweight/full depth modes are independent axes. A biz invocation can be `stance=update, depth=full`.
- **Orthogonal to sign-off axis**: stance decisions are independent of Stakeholder-scope sign-off gating (future work). Stance is about artifact state; sign-off is about collaboration. Both apply independently.

## Constraints & Assumptions

- Skills remain rigid in enforcing their existing HARD-GATEs (e.g., mu-arch still blocks if no scope artifact). Stance is orthogonal; does not relax existing gates.
- Stance detection is skill-local — mu-route can provide hints via cheap detection but does not own the decision.
- Sub-types within `update` are implementation detail. User never needs to pick between `expand` / `gap-fill` / `sync`; agent infers and shows in history.
- Slash-command hint supported: `/mu-biz create` / `/mu-biz update` etc. treated as user override per UC-A2.

## Out of Scope

- **Sign-off gate mechanism** — triggered by Stakeholder-scope axis. Separate scope cycle (roadmap step 5 in v3 proposal).
- **mu-route integration** — mu-route may pass a stance hint, but that's part of mu-route's own scope cycle (step 6).
- **Applying stances to non-creative skills** (mu-scope, mu-plan, mu-code, mu-review, etc.). Those skills produce per-task artifacts; stance concept doesn't apply. If ever needed, separate scope.
- **Retrofitting old artifacts with stance metadata** — one-time migration, not part of the skill behavior. Optional follow-up.

## Impact Analysis

- **Affected modules**:
  - Modify: `skills/mu-biz/SKILL.md`, `skills/mu-prd/SKILL.md`, `skills/mu-arch/SKILL.md`
  - New: `knowledge/principles/stance-detection.md`
  - Minor update: `rules/bootstrap.md` (example sentence), `docs/architecture.md` (knowledge/principles listing)
- **Existing tests that may break**: none (no test suite for skill content). Each skill edit goes through mu-write-skill RED-GREEN-REFACTOR per Iron Law.
- **Migration needs**:
  - Existing artifacts lack stance header — optional one-time migration as a follow-up. Absence treated as "historical".
  - Existing pipeline-gate.sh behavior verified: its glob `*-design*.md` check passes whether arch produces a new file or reuses an existing one. No hook change needed.
- **Downstream implications**:
  - mu-scope reads prd artifact (for feature context). Stance-aware biz/prd feeds scope without change.
  - mu-route design (future) can read stance history to avoid re-auditing when possible.
- **Implementation path**:
  - Scope → mu-arch → mu-plan
  - Execution: per-skill edits go through mu-write-skill (RED baseline + GREEN write + REFACTOR verify), in order: mu-arch (simplest, no existing mode collision) → mu-biz → mu-prd.
  - Shared knowledge file (`stance-detection.md`) written alongside first skill edit; other skills reference via `@../../knowledge/principles/`.
