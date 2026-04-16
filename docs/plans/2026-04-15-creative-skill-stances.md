# Creative-Skill Stances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `devmuse:mu-code` to execute. Each SKILL.md edit invokes `devmuse:mu-write-skill` which enforces RED-GREEN-REFACTOR on documentation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-stance capability (`create / update / extract / skip`) to mu-biz, mu-prd, and mu-arch so each creative skill audits existing artifacts and enters with the right posture.

**Architecture:** Per-skill independent stance detection. Shared principle at `knowledge/principles/stance-detection.md`. Each creative SKILL.md gains a Phase 0 section that references the principle and runs detection locally. Pipeline-level batch confirmation is deferred to mu-route (future).

**Tech Stack:** Markdown (SKILL.md + principle docs); subagents as test harness per mu-write-skill Iron Law; git for commit conventions.

**Spec Reference:** `docs/specs/2026-04-15-creative-skill-stances-design.md`
**Scope Reference:** `docs/scope/2026-04-15-creative-skill-stances.md`

---

## Task 1: Write shared principle file `stance-detection.md`

**Covers:** UC-C1, UC-C2, UC-C3, UC-C4, UC-C5, UC-C6 (shared heuristics), ER-1 (non-blocking detection), EC-3 (legacy-location handling via Step 1 of algorithm)

**Files:**
- Create: `knowledge/principles/stance-detection.md`

- [ ] **Step 1: Write the principle document**

Structure must match design §1 exactly:
- `## Inputs` section listing artifact type, dir, legacy locations, current task identifier, watched source dirs
- `## Detection Algorithm` as 9-step procedure
- `## Heuristics` — H1 (stub), H2 (coverage), H3 (staleness) with exact thresholds from design lines 73-77
- `## Decision Table` — 6 rows (R1-R6) with "rows evaluated top-to-bottom" note, legacy-location note
- `## Sub-type priority` — `expand > gap-fill > sync`, with scope CONFLICT-3 cross-reference
- `## Forced-stance overrides` — 4-row table from design lines 96-103
- `## Output Format` — stance / sub_type / confidence / reason / candidate_file

- [ ] **Step 2: Sanity-check the algorithm on a paper scenario**

Walk through: 250-word biz doc with 1 placeholder, 5-day-old watched commits, current task = "expand persona section". Expected output: `stance=update, sub_type=expand, confidence=ambiguous (gray zone for stub)`.

- [ ] **Step 3: Commit**

```bash
git add knowledge/principles/stance-detection.md
git commit -m "feat(knowledge): add stance-detection principle

Single source of truth for stance detection across mu-biz / mu-prd /
mu-arch. 9-step algorithm + H1/H2/H3 heuristics + decision table +
forced-stance overrides. Consumed by Phase 0 in each creative skill.

Refs: docs/specs/2026-04-15-creative-skill-stances-design.md §1"
```

---

## Task 2: mu-arch SKILL.md edit (Phase 0 integration)

**Covers:** UC-A1, UC-A2, UC-B9, UC-B10, UC-B11, UC-B12, EC-4, EC-5, ER-2, ER-3, ER-4

mu-arch first because it has no pre-existing Depth-mode concept — simplest integration, validates the Phase 0 pattern before layering it onto mu-biz/mu-prd's existing Mode Selection.

**Files:**
- Modify: `skills/mu-arch/SKILL.md`
- Reference (read-only): `knowledge/principles/stance-detection.md`

### 2.1 RED: Baseline scenarios

- [ ] **Step 1: Dispatch baseline subagent — Scenario A1 (`update(sync)`)**

Dispatch a general-purpose subagent with this prompt:
```
You're in a repo that has an existing design doc at
docs/specs/2025-12-01-auth-design.md (last modified 4 months ago),
but src/auth/ has had 15 commits in the last 30 days.
User says "add SSO to the auth design."
Produce the design. No rules to follow; use your judgment.
Cap: 10 tool calls.
```
Observe: Does agent recognize existing doc? Does it sync or blindly create?

- [ ] **Step 2: Dispatch Scenario A2 (`extract`)**

```
Repo has src/payments/ with 40 files, zero files in docs/specs/.
User says "document the payments architecture."
Cap: 10 tool calls.
```
Observe: Does agent extract from code? Does it write to correct dir?

- [ ] **Step 3: Dispatch Scenario A3 (`skip`)**

```
Repo has docs/specs/2026-04-01-reports-design.md (complete, 3000 words,
0 placeholders, mtime 3 days ago, covering "Reports Engine" feature).
User says "build the reports engine per the existing design."
Cap: 5 tool calls.
```
Observe: Does agent bypass redesign? Or re-do it unnecessarily?

- [ ] **Step 4: Dispatch Scenario A4 (`create` forced over existing)**

```
Repo has docs/specs/2026-03-01-billing-design.md.
User says "/mu-arch create — I want a fresh billing design."
Cap: 5 tool calls.
```
Observe: Does agent preserve old file? Warn? Silently overwrite?

- [ ] **Step 5: Document baseline failures**

Write findings to task notes (not committed). For each scenario, record: what the agent did vs what the skill should cause it to do. Failures inform GREEN content.

### 2.2 GREEN: Write the Phase 0 section

- [ ] **Step 6: Add Phase 0 section to mu-arch SKILL.md**

Insert immediately after the two existing `<HARD-GATE>` blocks, before "Anti-Pattern: This Is Too Simple To Need A Design". Content follows design §2 template. Instantiate parameters per design line 160:
- Artifact type: `arch`
- Artifact dir: `docs/specs/*-design*.md`
- Watched source dirs: `src/, lib/, internal/, pkg/, cmd/` (whichever exist; else `insufficient-signal`)
- Legacy locations: root `ARCHITECTURE.md`, `DESIGN.md`

Include branch routing table. Include mu-explore optional delegation note (design Appendix A).

- [ ] **Step 7: Update checklist to add "Phase 0" as step 0**

Existing steps 1-11 become steps 1-11 with a new step 0 at top: "Phase 0: Stance Detection — see §Phase 0 above". All subsequent references to step numbers stay the same (Phase 0 is gating, not numbering).

- [ ] **Step 8: Update Process Flow dot graph**

Add Phase 0 node at the top of the graph per design §5 pattern. 4 branches route to existing subgraphs (create → full existing flow; update → section-approval loop adapted; extract → read source + section-approval; skip → append history, handoff).

- [ ] **Step 9: Add HARD-GATE ordering note**

Add a short sentence after the existing HARD-GATEs and before Phase 0:
> "HARD-GATEs evaluated BEFORE Phase 0. A `skip` stance does not bypass them."

### 2.3 REFACTOR: Verify compliance

- [ ] **Step 10: Re-dispatch all 4 scenarios WITH the updated skill**

Paste updated SKILL.md + stance-detection.md into each subagent prompt. Same scenarios as 2.1. For each, verify:
- A1 → stance=`update(sync)`, artifact modified not replaced
- A2 → stance=`extract`, output written to `docs/specs/`
- A3 → stance=`skip`, no rewrite, history appended, handoff to mu-plan
- A4 → warning emitted, old file preserved, new file written

- [ ] **Step 11: Close any loopholes found in REFACTOR**

If any agent rationalized its way around the new Phase 0, add explicit anti-rationalization entries to the skill (anti-pattern table).

- [ ] **Step 12: Commit**

```bash
git add skills/mu-arch/SKILL.md
git commit -m "feat(mu-arch): add Phase 0 stance detection

mu-arch now runs stance detection before engaging design flow. 4
branches: create / update / extract / skip. Existing HARD-GATEs
unchanged and evaluated before Phase 0.

RED-GREEN-REFACTOR via mu-write-skill: scenarios A1-A4 verified
pass (update(sync) / extract / skip / forced-create-with-warning).

Refs: docs/specs/2026-04-15-creative-skill-stances-design.md §2"
```

---

## Task 3: mu-biz SKILL.md edit (Phase 0 + Depth-mode disambiguation)

**Covers:** UC-A1, UC-A2, UC-B1, UC-B2, UC-B3, UC-B4, EC-1, EC-2

mu-biz is second because it has a pre-existing "Mode Selection" (quick/full) that must coexist with Phase 0 without vocabulary collision.

**Files:**
- Modify: `skills/mu-biz/SKILL.md`

### 3.1 RED: Baseline scenarios

- [ ] **Step 1: Dispatch Scenario B1 (`update(expand)`)**

```
Repo has docs/biz/2025-11-pilot.md — 120 words, 1 TODO placeholder.
User says "complete the biz plan for this pilot."
Cap: 10 tool calls.
```
Observe: does agent start from scratch or expand existing?

- [ ] **Step 2: Dispatch Scenario B2 (`update(gap-fill)`)**

```
Repo has docs/biz/2025-10-main-product.md — 800 words covering Product A.
User says "add new sister product B under the same company."
Cap: 10 tool calls.
```
Observe: does agent extend with gap-fill section or rewrite whole file?

- [ ] **Step 3: Dispatch Scenario B3 (`extract`)**

```
Repo has substantial README.md + src/ but no docs/biz/.
User says "write the business case for this product retrospectively."
Cap: 10 tool calls.
```
Observe: does agent synthesize from available signals?

- [ ] **Step 4: Dispatch Scenario B4 (slash precedence)**

```
User says "/mu-biz create quick — write a quick biz case for project X."
Cap: 8 tool calls.
```
Observe: does agent parse BOTH tokens correctly (stance=create, depth=quick)?

- [ ] **Step 5: Document baseline failures**

### 3.2 GREEN: Write Phase 0 + disambiguate depth mode

- [ ] **Step 6: Add Phase 0 section to mu-biz SKILL.md**

Insert after existing HARD-GATE, before "Mode Selection". Parameters per design line 158:
- Artifact type: `biz`
- Artifact dir: `docs/biz/`
- Watched source dirs: root `README*` only (explicit caveat that biz staleness is weak)
- Legacy locations: `docs/premise/` (deprecated), root `BUSINESS.md`

- [ ] **Step 7: Rename existing "Mode Selection" to "Depth Mode Selection"**

In mu-biz/SKILL.md line 16-24, rename heading + update table header. This is the vocabulary disambiguation called for in design line 270. All references to "mode" within this existing section updated to "depth mode" for clarity. The slash hints `/mu-biz quick` / `/mu-biz full` remain unchanged.

- [ ] **Step 8: Add §2.5 interaction text inline**

Short paragraph between Phase 0 and Depth Mode Selection explaining: Phase 0 consumes only stance tokens; Depth Mode Selection consumes only depth tokens; they run sequentially.

- [ ] **Step 9: Update checklist + Process Flow graph**

Phase 0 is step 0 of the flow. Graph gets stance-detection node at top with 4 branches.

- [ ] **Step 10: Full-mode terminal passes `stance=create` to mu-prd**

Update existing Full-mode terminal description (mu-biz/SKILL.md line 97 area): "Invoke `mu-prd create`" instead of "Invoke mu-prd". Preserves biz(full)→prd auto-handoff without regression.

### 3.3 REFACTOR: Verify

- [ ] **Step 11: Re-dispatch B1-B4 with updated skill**

Verify:
- B1 → `update(expand)`, existing file filled in
- B2 → `update(gap-fill)`, new section for product B appended
- B3 → `extract`, new biz doc synthesized, acknowledges data sources
- B4 → parser extracts `create` and `quick` correctly, no confirmation dialog for stance (pre-confirmed)

- [ ] **Step 12: Close loopholes, commit**

```bash
git add skills/mu-biz/SKILL.md
git commit -m "feat(mu-biz): add Phase 0 stance detection + disambiguate depth mode

- Phase 0 runs before existing Depth Mode Selection
- Existing quick/full 'mode' renamed to 'Depth Mode Selection' to
  avoid collision with stance terminology
- Full-mode terminal now passes stance=create to mu-prd, preserving
  biz(full)→prd auto-handoff per design §2.5 regression guard
- Scenarios B1-B4 verified pass

Refs: docs/specs/2026-04-15-creative-skill-stances-design.md §2, §2.5"
```

---

## Task 4: mu-prd SKILL.md edit (Phase 0 + Depth-mode disambiguation + handoff receiver)

**Covers:** UC-A1, UC-A2, UC-B5, UC-B6, UC-B7, UC-B8

**Files:**
- Modify: `skills/mu-prd/SKILL.md`

### 4.1 RED: Baseline scenarios

- [ ] **Step 1: Dispatch Scenario P1 (`update(gap-fill)`)**

```
Repo has docs/prd/main-product.md covering 3 features (auth, profile,
dashboard). User says "add feature: notifications."
Cap: 10 tool calls.
```

- [ ] **Step 2: Dispatch Scenario P2 (pre-confirmed handoff from mu-biz)**

```
Simulate the invocation "/mu-prd create main-product" coming from
mu-biz Full mode terminal. The repo has no existing prd.
Cap: 6 tool calls.
```
Observe: does agent present a stance dialog, or proceed directly because stance is pre-confirmed?

- [ ] **Step 3: Dispatch Scenario P3 (watched-dirs fallback)**

```
Backend-only repo: only src/ and tests/ exist (no src/pages/,
src/screens/, src/views/, app/). Existing docs/prd/api.md covers
auth endpoint. User says "add search endpoint prd."
Cap: 10 tool calls.
```
Observe: does H3 fall back gracefully or return wrong staleness signal?

- [ ] **Step 4: Document baseline failures**

### 4.2 GREEN: Write Phase 0 + handoff receiver

- [ ] **Step 5: Add Phase 0 section to mu-prd SKILL.md**

Parameters per design line 159:
- Artifact type: `prd`
- Artifact dir: `docs/prd/`
- Watched source dirs: `src/pages/, src/screens/, src/views/, app/` with `src/` fallback, then `insufficient-signal`
- Legacy locations: root `PRD.md`

- [ ] **Step 6: Add pre-confirmed stance handling**

Phase 0's step 4 (user override parsing) must accept `/mu-prd create`, `/mu-prd update`, etc. as **pre-confirmed** — NO dialog, proceed directly. Document this is how mu-biz full-mode handoff stays smooth.

- [ ] **Step 7: Rename existing "Mode Selection" to "Depth Mode Selection"**

Same disambiguation as Task 3 Step 7 — existing lightweight/full concept stays, label changes.

- [ ] **Step 8: Update checklist + Process Flow**

Phase 0 at the top. 4 branches in the graph.

### 4.3 REFACTOR: Verify

- [ ] **Step 9: Re-dispatch P1-P3 with updated skill**

Verify:
- P1 → `update(gap-fill)`, notifications section appended without disturbing existing features
- P2 → `create`, no stance dialog (pre-confirmed), proceeds directly
- P3 → H3 returns `insufficient-signal`, doesn't falsely report fresh/stale

- [ ] **Step 10: Close loopholes, commit**

```bash
git add skills/mu-prd/SKILL.md
git commit -m "feat(mu-prd): add Phase 0 stance detection + pre-confirmed handoff

- Phase 0 runs before existing Depth Mode Selection
- Existing lightweight/full 'mode' renamed to 'Depth Mode Selection'
- Pre-confirmed stance (from mu-biz full-mode handoff or explicit
  slash hint) skips stance dialog per design §2.5
- Full-mode terminal continues to invoke mu-scope (no stance needed —
  mu-scope is not a creative skill)
- Scenarios P1-P3 verified pass including src/ fallback for non-frontend repos

Refs: docs/specs/2026-04-15-creative-skill-stances-design.md §2, §2.5"
```

---

## Task 5: End-to-end pipeline verification

**Covers:** regression guard from design §2.5

**Files:** (no edits; dogfood + notes)

- [ ] **Step 1: Set up synthetic test repo**

Create `/tmp/stance-e2e-test/` with:
- `README.md` (10 lines, describing a fictional "note-taking app")
- No `docs/biz/`, `docs/prd/`, `docs/specs/`
- `src/pages/NoteList.tsx` (empty placeholder)

- [ ] **Step 2: Dispatch full-chain subagent**

Prompt:
```
You are in /tmp/stance-e2e-test/. User says:
"Start a new business analysis for a note-taking app, full mode."
Follow mu-biz full mode through to the next skill in the chain.
Cap: 20 tool calls.
```

Expected behavior:
1. mu-biz Phase 0 detects `create` (empty `docs/biz/`)
2. mu-biz Full mode runs (8 sections)
3. Terminal invocation: `mu-prd create main-product`
4. mu-prd Phase 0 accepts pre-confirmed `create`, no stance dialog
5. mu-prd produces PRD
6. mu-prd terminal: invoke mu-scope for first feature

Validate no unexpected stance dialogs or regressions vs current biz→prd flow.

- [ ] **Step 3: Document findings** (no commit; feed into Task 7 if issues)

---

## Task 6: Documentation updates

**Covers:** traceability, discoverability of new principle file

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/architecture_cn.md`
- Modify: `README.md`
- Modify: `README_CN.md`
- Modify: `rules/bootstrap.md`

- [ ] **Step 1: Update architecture docs**

Add `stance-detection.md` to the principles table in both `docs/architecture.md` (around line 128) and `docs/architecture_cn.md` (around line 128). Reference: "stance-detection | Artifact-audit heuristics for creative skills | mu-biz, mu-prd, mu-arch".

- [ ] **Step 2: Update README skill descriptions**

In README.md and README_CN.md skill-description sections, add a sentence noting that mu-biz/mu-prd/mu-arch now auto-detect artifact state on entry and propose a stance (create/update/extract/skip) that users can override in one word.

- [ ] **Step 3: Update bootstrap.md**

Add a short sentence in the Skill Priority & Pipeline Paths section: "Creative skills (mu-biz / mu-prd / mu-arch) auto-detect artifact state on entry and propose a stance. Users override with one word or via `/<skill> <stance>` hints."

- [ ] **Step 4: Commit**

```bash
git add docs/architecture.md docs/architecture_cn.md README.md README_CN.md rules/bootstrap.md
git commit -m "docs: surface stance capability in architecture + README + bootstrap

Makes the new stance-detection principle discoverable from the
canonical entry points. Brief mentions only; authoritative source
remains docs/specs/2026-04-15-creative-skill-stances-design.md."
```

---

## Task 7: Final mu-review pass

**Covers:** integration + regression check across the full change set

**Files:** (no edits; review-only)

- [ ] **Step 1: Dispatch mu-reviewer in review-code mode**

Context: all commits from Task 1 through Task 6. Focus: cross-file consistency (stance-detection.md heuristics match per-skill parameter tables; commit prefix pattern used consistently; HARD-GATE ordering preserved).

- [ ] **Step 2: Address any findings**

Per mu-review loop. Max 3 iterations, then surface to human.

- [ ] **Step 3: No commit unless fixes required**

---

## Phase Boundaries

Each Task is an independent phase with its own commit(s). Phases can be paused between:

- Phase 1 (Task 1): principle file standalone — consumable even if skills not updated
- Phase 2 (Task 2): mu-arch functional — other skills still on old behavior; mixed state OK per design §2.5 regression guard
- Phase 3 (Task 3): mu-biz functional; mu-prd still old
- Phase 4 (Task 4): all 3 skills functional
- Phase 5 (Task 5): dogfood verification (no code change)
- Phase 6 (Task 6): docs updated
- Phase 7 (Task 7): final review

Each phase leaves the codebase in a consistent working state.

## Out of Scope for This Plan

- mu-route integration (own scope cycle per v3 proposal roadmap step 6)
- Sign-off gate (own scope cycle per step 5)
- Retrofitting old artifacts with stance headers (optional follow-up)
- Stance concept in non-creative skills (mu-scope, mu-plan, mu-code, mu-review) — not applicable
