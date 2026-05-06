# mu-route System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `devmuse:mu-code` to execute. Markdown edits + subagent verification per mu-write-skill Iron Law. Checkbox syntax for tracking.

**Goal:** Land the remaining devmuse framework — `mu-route` skill (Step 6), `sign-off-gate.md` principle (Step 5), bootstrap migration (Step 7).

**Architecture:** mu-route as pattern-matching router at the top of the pipeline; sign-off gate as orthogonal exit-criterion upgrade for creative skills; bootstrap delegates to mu-route.

**Spec Reference:** `docs/specs/2026-04-17-mu-route-system-design.md`
**Scope Reference:** `docs/scope/2026-04-17-mu-route-system.md`

---

## Task 1: Write `knowledge/principles/sign-off-gate.md`

**Covers:** UC-S1, UC-S2, UC-S3, UC-S4, ER-R2

- [ ] **Step 1: Write the principle file per design Component 2 content outline**

Sections: When it fires / When it doesn't / Detection heuristics / Gate protocol / Consumption pattern / Integration note.

- [ ] **Step 2: Commit**

```bash
git add knowledge/principles/sign-off-gate.md
git commit -m "feat(knowledge): add sign-off-gate principle

Shared principle consumed by mu-biz / mu-prd / mu-arch when
stakeholder-scope axis detects team-touching work. Non-blocking
gate protocol with CODEOWNERS-based stakeholder inference and
user override ('skip sign-off'). Orthogonal to stance; evaluated
after existing HARD-GATEs and artifact approval.

Refs: docs/specs/2026-04-17-mu-route-system-design.md Component 2"
```

---

## Task 2: Write `skills/mu-route/SKILL.md`

**Covers:** UC-R1..UC-R9, UC-B3 (slash escape hatch), EC-R1..EC-R4, ER-R1

**Depends on:** Task 1 (not strictly, but sign-off gate should exist first so mu-route can reference it in its docs)

- [ ] **Step 1: Write SKILL.md per design Component 1**

Structure: frontmatter, overview, Process Flow dot graph, Checklist, Trigger Signal Table, Routing Decision Table, Plan-as-Checkpoint principle, Integration.

- [ ] **Step 2: Verification subagent dispatch**

Scenario: user types "help me take over this project and add login auth". Verify mu-route proposes Explore first (ambiguous project → understand before build), routes after explore to Design-product (biz/prd empty + add-feature intent).

- [ ] **Step 3: Commit**

---

## Task 3: Creative-skill sign-off-gate consumption

**Covers:** UC-S1 (consumption side), integration sentence

- [ ] **Step 1: Add one-sentence reference to each creative SKILL.md**

In each of mu-biz / mu-prd / mu-arch, add near the end of their Process section:

> "Before terminal invocation, consult `@../../knowledge/principles/sign-off-gate.md` if stakeholder-scope indicates team-touching."

- [ ] **Step 2: Commit**

---

## Task 4: Bootstrap migration

**Covers:** UC-B1, UC-B2, UC-B3

- [ ] **Step 1: Restructure `rules/bootstrap.md` "Skill Priority & Pipeline Paths" section**

Replace the 4-path table with:
- Primary rule: "For unprefixed user messages, invoke mu-route"
- Escape hatch: "Direct slash invocations (`/mu-<skill>`) bypass mu-route"
- Keep Instruction Priority intact
- Keep stance note intact
- Reframe Examples as "mu-route will propose ..."

- [ ] **Step 2: Commit**

---

## Task 5: Doc updates

- [ ] **Step 1: Update architecture + README + architecture_cn + README_CN**

Add `mu-route` to skills list (placed as "router" category), add `sign-off-gate.md` to principles table.

- [ ] **Step 2: Commit**

---

## Task 6: Final self-review

- [ ] **Step 1: Dispatch mu-reviewer review-coverage**

Verify all UCs in scope file land in implementation; flag any orphaned.

- [ ] **Step 2: Address findings (if any)**

---

## Phase Boundaries

Each Task is a commit. Phases 1 through 5 each leave the codebase working. Task 6 is review-only.
