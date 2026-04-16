# Creative-Skill Stances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `devmuse:mu-code` to execute. Each SKILL.md edit invokes `devmuse:mu-write-skill` which enforces RED-GREEN-REFACTOR on documentation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-stance capability (`create / update / extract / skip`) to mu-biz, mu-prd, and mu-arch so each creative skill audits existing artifacts and enters with the right posture.

**Architecture:** Per-skill independent stance detection. Shared principle at `knowledge/principles/stance-detection.md`. Each creative SKILL.md gains a Phase 0 section that references the principle and runs detection locally. Pipeline-level batch confirmation is deferred to mu-route (future).

**Tech Stack:** Markdown (SKILL.md + principle docs); subagents as test harness per mu-write-skill Iron Law; git for commit conventions.

**Spec Reference:** `docs/specs/2026-04-15-creative-skill-stances-design.md`
**Scope Reference:** `docs/scope/2026-04-15-creative-skill-stances.md`

---

## Task 1: Write shared principle file `stance-detection.md`

**Covers:** UC-C1, UC-C2, UC-C3, UC-C4, UC-C5, UC-C6 (shared heuristics), ER-1, ER-2, ER-3, ER-4 (all error paths landed in the principle file's Error Handling section so per-skill scenarios can verify behavior), EC-3 (legacy-location handling via Step 1 of algorithm)

**Files:**
- Create: `knowledge/principles/stance-detection.md`

- [ ] **Step 1: Write the principle document**

Structure must match design §1 (Heuristics / Decision Table / Sub-type priority / Forced-stance overrides) exactly:
- `## Inputs` section listing artifact type, dir, legacy locations, current task identifier, watched source dirs
- `## Detection Algorithm` as 9-step procedure
- `## Heuristics` — H1 (stub), H2 (coverage), H3 (staleness) with exact thresholds from design §1 Heuristics table
- `## Decision Table` — 6 rows (R1-R6) with "rows evaluated top-to-bottom; first match wins" note, legacy-location note
- `## Sub-type priority` — `expand > gap-fill > sync`, with scope CONFLICT-3 cross-reference (stub → expand 1:1 mapping)
- `## Forced-stance overrides` — 4-row table from design §1 (forced create / forced extract / forced skip / forced update over missing)
- `## Error Handling` — ER-1 through ER-4 mapping (non-blocking detection, malformed-artifact parse-fail handling, extract-target-missing degradation, sync-contradiction surfacing) per design §Error Handling
- `## Output Format` — stance / sub_type / confidence / reason / candidate_file; include the `insufficient-signal` value for H3 when no watched dirs exist

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

**Depends on:** Task 1 committed (`stance-detection.md` must exist for Phase 0 `@`-reference to resolve).

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

Insert immediately after the two existing `<HARD-GATE>` blocks, before "Anti-Pattern: This Is Too Simple To Need A Design". Content follows design §2 Phase 0 template. Instantiate parameters per design §2 per-skill parameter table, mu-arch row:
- Artifact type: `arch`
- Artifact dir: `docs/specs/*-design*.md`
- Watched source dirs: `src/, lib/, internal/, pkg/, cmd/` (whichever exist; else `insufficient-signal`)
- Legacy locations: root `ARCHITECTURE.md`, `DESIGN.md`

Include branch routing table. Include mu-explore optional delegation note (design Appendix A). Include the "General rule: artifact dir never in its own watched set" line (design §2, per-skill parameter table note).

The recommendation sentence wording (design §2 Phase 0 template: `"Detected: stance=<stance> (sub=<sub-type>), confidence=<high|ambiguous>. Reason: <one-line>. OK to proceed, or override?"`) should be treated as **exemplary, not verbatim** — the skill describes the shape, agents may adapt phrasing while preserving the stance / sub-type / confidence / reason slots.

- [ ] **Step 7: Update checklist to add "Phase 0" as step 0**

Existing steps 1-11 become steps 1-11 with a new step 0 at top: "Phase 0: Stance Detection — see §Phase 0 above". All subsequent references to step numbers stay the same (Phase 0 is gating, not numbering).

- [ ] **Step 8: Update Process Flow dot graph**

Add Phase 0 node at the top of the graph per design §5 pattern. 4 branches route to existing subgraphs (create → full existing flow; update → section-approval loop adapted; extract → read source + section-approval; skip → append history, handoff).

- [ ] **Step 9: Add HARD-GATE ordering note**

Add a short sentence after the existing HARD-GATEs and before Phase 0:
> "HARD-GATEs evaluated BEFORE Phase 0. A `skip` stance does not bypass them."

- [ ] **Step 9b: Update Artifact Format / output sections per design §4**

Update mu-arch/SKILL.md's artifact-output description to show the new header fields (`Stance`, `Sub-type`, `Detected at`) and a History section template. Add a "Commit convention" sub-section citing the `docs(specs): <stance>[(sub-type)]: ...` prefix pattern per design §4. Include the `--no-stance-meta` opt-out mention per design §4 and scope NFR CONFLICT-5 resolution.

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

**Depends on:** Task 1 committed.

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

- [ ] **Step 4: Dispatch Scenario B4 (`skip` — mu-biz UC-B4)**

```
Repo has docs/biz/2026-04-pilot.md — 2200 words, covering current
product in full. User says "run mu-biz to double-check the biz case
for this pilot before we invest more."
Cap: 6 tool calls.
```
Observe: does agent recognize artifact is fit and skip the whole analysis flow with a passthrough?

- [ ] **Step 4b: Dispatch Scenario B-slash (slash precedence parsing, UC-A2)**

```
User says "/mu-biz create quick — write a quick biz case for project X."
Cap: 8 tool calls.
```
Observe: does agent parse BOTH tokens correctly (stance=create, depth=quick) without asking either question?

- [ ] **Step 5: Document baseline failures**

### 3.2 GREEN: Write Phase 0 + disambiguate depth mode

- [ ] **Step 6: Add Phase 0 section to mu-biz SKILL.md**

Insert after existing HARD-GATE, before "Mode Selection". Parameters per design line 158:
- Artifact type: `biz`
- Artifact dir: `docs/biz/`
- Watched source dirs: root `README*` only (explicit caveat that biz staleness is weak)
- Legacy locations: `docs/premise/` (deprecated), root `BUSINESS.md`

- [ ] **Step 7: Rename existing "Mode Selection" to "Depth Mode Selection"**

In mu-biz/SKILL.md line 16-24 (heading `## Mode Selection`), rename heading + update table header to use "Depth Mode" column. This is the vocabulary disambiguation called for in the design §2.5 Stance × Depth-mode interaction. All references to the bare word "mode" within this existing section updated to "depth mode" for clarity. The slash hints `/mu-biz quick` / `/mu-biz full` remain unchanged.

Also update the parameter row for mu-biz at Step 6 to include the explicit "Never watch `docs/prd/` (not a biz staleness signal) or `docs/biz/` itself (circular)" caveat per design §2 mu-biz row.

- [ ] **Step 8: Add §2.5 interaction text inline**

Short paragraph between Phase 0 and Depth Mode Selection explaining: Phase 0 consumes only stance tokens; Depth Mode Selection consumes only depth tokens; they run sequentially.

- [ ] **Step 9: Update checklist + Process Flow graph**

Phase 0 is step 0 of the flow. Graph gets stance-detection node at top with 4 branches.

- [ ] **Step 10: Full-mode terminal passes `stance=create` to mu-prd**

Update Full-mode terminal in mu-biz/SKILL.md (currently line 97 — exact text: `**Terminal:** Invoke mu-prd skill (greenfield products typically need PRD next).`) to read: `**Terminal:** Invoke mu-prd skill with pre-confirmed stance \`create\` — per design §2.5 Pipeline-handoff regression guard, passes stance hint so mu-prd's Phase 0 does not present a confirmation dialog. (Greenfield products typically need PRD next.)`. Preserves biz(full)→prd auto-handoff without regression.

- [ ] **Step 10b: Update Artifact Format sections per design §4**

Update both the Quick-mode and Full-mode Artifact Format examples in mu-biz/SKILL.md (currently lines 99-125) to show the new header fields (`Stance`, `Sub-type`, `Detected at`) alongside the existing Date/Mode fields. Add a "Commit convention" sub-section citing the `docs(biz): <stance>[(sub-type)]: ...` prefix pattern per design §4. Include the `--no-stance-meta` opt-out mention.

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

**Depends on:** Task 1 committed.

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

- [ ] **Step 3b: Dispatch Scenario P4 (`skip` — mu-prd UC-B8)**

```
Repo has docs/prd/notes.md covering "note CRUD" fully (all 3 features
current, mtime 2 days ago, no watched-dir churn). User says
"run mu-prd to pick up from where we left off — first MVP feature."
Cap: 6 tool calls.
```
Observe: does agent recognize fit, skip re-derivation, and hand off to mu-scope with pass-through history entry?

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

In mu-prd/SKILL.md line 16-22 (heading `## Mode Selection`), same disambiguation as Task 3 Step 7 — existing lightweight/full concept stays, label changes to "Depth Mode Selection". All references to bare "mode" within this section updated.

Include the explicit "Never watch `docs/prd/` itself (circular)" note per design §2 mu-prd row, and confirm the `src/` fallback wording per design §2.

- [ ] **Step 8: Update checklist + Process Flow**

Phase 0 at the top. 4 branches in the graph.

- [ ] **Step 8b: Update Artifact Format section per design §4**

Update mu-prd/SKILL.md Artifact Format section to include Stance / Sub-type / Detected-at header fields and a History section template. Add a "Commit convention" sub-section citing the `docs(prd): <stance>[(sub-type)]: ...` prefix pattern. Include the `--no-stance-meta` opt-out.

### 4.3 REFACTOR: Verify

- [ ] **Step 9: Re-dispatch P1-P4 with updated skill**

Verify:
- P1 → `update(gap-fill)`, notifications section appended without disturbing existing features
- P2 → `create`, no stance dialog (pre-confirmed), proceeds directly
- P3 → H3 returns `insufficient-signal`, doesn't falsely report fresh/stale
- P4 → `skip`, no re-derivation, history appended, hand off to mu-scope

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
"Start a new business analysis for a note-taking app, full mode,
then run mu-prd, then pick the first MVP feature and scope + design it."
Follow mu-biz → mu-prd → mu-scope → mu-arch as far as the chain goes.
Cap: 35 tool calls.
```

Expected behavior:
1. mu-biz Phase 0 detects `create` (empty `docs/biz/`)
2. mu-biz Full mode runs (8 sections)
3. Terminal invocation: `mu-prd create main-product` (pre-confirmed)
4. mu-prd Phase 0 accepts pre-confirmed `create`, no stance dialog
5. mu-prd produces PRD
6. mu-prd terminal: invoke mu-scope for first feature (no stance — mu-scope not creative)
7. mu-scope produces UC set
8. mu-scope terminal: invoke mu-arch
9. mu-arch Phase 0 runs — for the first feature, docs/specs/ is empty, code is also empty → should propose `create`; user confirms with bare "ok"
10. mu-arch produces design for the first feature

Validate no unexpected stance dialogs or regressions at ANY of the 3 creative-skill hops (mu-biz, mu-prd, mu-arch). The most important regression to catch is an unsolicited stance confirmation inside the pre-confirmed mu-biz → mu-prd handoff, or a failure mode at mu-arch's Phase 0 on first-run empty repo.

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

- [ ] **Step 1: Dispatch mu-reviewer in review-coverage mode**

Inputs: scope path `docs/scope/2026-04-15-creative-skill-stances.md`, commit range `<Task-1-sha>..HEAD`. This mode produces the UC-coverage matrix and catches any UC orphaned by the implementation.

- [ ] **Step 1b: Dispatch mu-reviewer in review-design mode on `knowledge/principles/stance-detection.md`**

Focus: internal consistency of the heuristics vs decision table, soundness of thresholds, error-handling completeness. review-design is the right mode for principle-file content.

- [ ] **Step 1c: Lightweight cross-file consistency check (manual or subagent)**

Verify by grep: per-skill parameter tables in each SKILL.md match the design §2 table; commit-prefix pattern consistent across all 4 new commits (Tasks 2-4 + Task 6); HARD-GATE ordering note present in all 3 SKILL.md files.

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

- **EC-6 (pipeline-level batch confirmation)** — explicitly deferred to mu-route design cycle per spec §Requirements Reference. The `stance=create` pre-confirmed hint added in §2.5 is a targeted regression guard, not a general batch mechanism.
- mu-route integration (own scope cycle per v3 proposal roadmap step 6)
- Sign-off gate (own scope cycle per step 5)
- Retrofitting old artifacts with stance headers (optional follow-up)
- Stance concept in non-creative skills (mu-scope, mu-plan, mu-code, mu-review) — not applicable

## UC Coverage Map

Traceability — which task covers which scope UC:

| Scope UC | Task |
|----------|------|
| UC-A1, UC-A2 | Tasks 2, 3, 4 (each skill's Phase 0) |
| UC-B1..UC-B4 (mu-biz 4 stances) | Task 3 scenarios B1, B2, B3, B4 |
| UC-B5..UC-B8 (mu-prd 4 stances) | Task 4 scenarios P1 (B6 update), P2 (B5 create), P3 (B6 update/insufficient-signal), P4 (B8 skip). Note: P1/P3 both exercise update variants; B5 create is covered by P2 pre-confirmed handoff; B7 extract receives implicit coverage via the principle file's Error Handling section and Task 5 e2e — if this proves insufficient, add explicit P5 extract scenario. |
| UC-B9..UC-B12 (mu-arch 4 stances) | Task 2 scenarios A1, A2, A3, A4 |
| UC-C1..UC-C6 | Task 1 (heuristic definitions in principle file) |
| EC-1 ambiguous-state | Task 1 Error Handling section + Task 3 scenarios observing ambiguous-case behavior |
| EC-2 multiple-artifacts | Task 1 algorithm Step 4 (most-recent-mtime + topic-match) |
| EC-3 legacy-location | Task 1 algorithm Step 1 (legacy fallbacks) |
| EC-4 mid-flow-switch | Task 2 (documented in mu-arch via re-enter Phase 0 semantics) |
| EC-5 partial-overlap | Task 2 update(gap-fill) branch description |
| **EC-6 batch-confirm** | **DEFERRED** to mu-route cycle; `stance=create` pre-confirmed hint in §2.5 is a partial mitigation |
| ER-1 detection-impossible | Task 1 Error Handling section |
| ER-2 malformed-artifact | Task 1 Error Handling section + Task 2 robustness |
| ER-3 extract-target-missing | Task 1 Error Handling section + Task 2 A2 verification |
| ER-4 sync-contradicts-code | Task 1 Error Handling section |
