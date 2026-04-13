# DevMuse Skill Tier Refactor

> **Date:** 2026-04-13
> **Status:** Approved, implementing
> **Triggered by:** Actify project (greenfield product, starting from zero) — DevMuse skill pipeline did not cover the first 80% of the work (business strategy, competitive analysis, MVP scoping, branding, pricing model). Follow-up discussion also identified two cleanup opportunities that should land together.

## Decisions (locked during discussion)

| # | Decision | Choice |
|---|---|---|
| 1 | Add product-level skills | **mu-biz** (business analysis) + **mu-prd** (product requirements) |
| 2 | mu-premise vs mu-biz overlap | **Merge**: drop mu-premise skill. mu-biz provides two modes: quick (= current 4 forcing questions) and full (BMC + VPC + competitive analysis + etc.) |
| 3 | mu-design name is too broad | **Rename mu-design → mu-arch**. "design" is semantically overloaded once mu-prd exists (UX design vs technical design). "arch" is unambiguous. |
| 4 | Bootstrap pipeline vs router | Short-term: keep current bootstrap, document new pipeline paths for greenfield / library / etc. Long-term (separate issue): convert bootstrap to router that picks skill path by project type. |
| 5 | Spec artifact naming | Keep `docs/specs/*-design.md` as-is (spec doc name decoupled from skill name — "design spec" is a generic term) |

---

## Background

Jeff started a **brand-new greenfield project** called Actify (an AI-powered smart tab manager Chrome extension). It is literally a fresh empty directory — no code, no features, no prior decisions. The natural starting point is **business analysis** (market, differentiation, positioning), NOT technical design.

During the first 2+ hours of collaboration, the agent (Claude) spent the entire conversation on:
- Competitive analysis (finding 12+ competitor Chrome extensions)
- Academic research on tab management behavior
- MVP scope definition (free/paid tiers, progressive onboarding)
- Cost model analysis (AI token economics)
- Business model (Lemon Squeezy for individual developers)
- Brand & product naming (Knotmark brand → Actify product)
- Tech stack selection

**Not a single DevMuse skill was invoked during this work.** The agent rationalized its way around them (exactly the anti-pattern bootstrap skill warns about). When the user called this out, the agent's honest reflection was: *none of the existing skills cleanly fit a "greenfield product strategy" discussion*, so it defaulted to ad-hoc conversation — which is wrong, but the skill gap is real.

This proposal fixes the gap.

---

## Current DevMuse Assumption vs. What Greenfield Needs

Current DevMuse pipeline:

```
mu-premise → mu-scope → mu-design → mu-plan → mu-code → mu-review
```

**Implicit assumption in this pipeline:** the product already exists (or at minimum, the product concept, target users, business model, and feature boundaries are already decided). The pipeline picks up at *"now implement this feature"*.

Evidence of this assumption:

| Skill | Assumption |
|-------|-----------|
| mu-premise | "Is this change worth the disruption?" — framed for existing codebases |
| mu-scope | HARD-GATE to mu-design; UC format `When X Then Y` is feature-level, assumes feature set is known |
| mu-design | Explicitly says **"technical direction only (not 'what to build')"**; assumes scope has answered the what |
| mu-plan / mu-code | Implementation-focused |

**What greenfield actually needs (but DevMuse does not currently support):**

| Need | Currently handled by | Works? |
|------|---------------------|--------|
| Competitive analysis | (nothing) | ❌ |
| Business Model Canvas | (nothing) | ❌ |
| Value Proposition | (nothing) | ❌ |
| Target persona & JTBD | (nothing) | ❌ |
| Brand & naming | (nothing) | ❌ |
| North Star + funnel metrics | (nothing) | ❌ |
| MVP feature boundary (product-level, not UC-level) | mu-scope? | ⚠️ wrong granularity |
| Free/paid tiering rules | (nothing) | ❌ |
| Cost model / unit economics | (nothing) | ❌ |
| User flows / wireframes | (nothing) | ❌ |
| Feature specs (user-facing rules, not tech) | mu-design? | ⚠️ wrong layer — mu-design is tech-only |
| Tech architecture | mu-design | ✅ |

**Conclusion:** DevMuse's pipeline assumes everything above the "tech architecture" line is already done outside the system. For greenfield projects, that's exactly the work that needs to be done first — and with skill support, not ad-hoc chat.

---

## Problem Summary

Gaps exposed by greenfield work:

1. **mu-premise is too narrow** — only 4 forcing questions, doesn't cover competitive analysis, business model, branding, MVP feature scoping
2. **mu-scope is use-case-level** — `When X Then Y` format fits single features, not product-level feature prioritization or free/paid tier decisions
3. **mu-design is tech-only** — explicitly "technical direction only", can't host PRD discussions (user flows, wireframes, feature specs)
4. **No skill-gap escalation rule** — when no skill fits, agents default to ad-hoc conversation instead of flagging the gap

Result: for any greenfield product, the first 80% of work bypasses the skill system entirely.

---

## Proposed Refactor: Three-Tier Separation

Map DevMuse skills to real org roles with clear hand-offs:

| Tier | Skill | Role | Dimension | Output |
|------|-------|------|-----------|--------|
| Product-level | mu-premise | (existing) | Worth doing? | `docs/premise/*.md` |
| Product-level | **mu-biz** (NEW) | Founder/Strategy | Market, business model | `docs/biz/*.md` |
| Product-level | **mu-prd** (NEW) | Product Manager | User experience, feature logic | `docs/prd/*.md` |
| Feature-level | mu-scope | (existing) | UC enumeration for one feature | `docs/scope/*.md` |
| Feature-level | mu-design | (existing, clarified) | Tech architecture | `docs/specs/*.md` |
| Feature-level | mu-plan → mu-code → mu-review | (existing) | Implementation | — |

**Key principle:** product-level skills run **once per product**; feature-level skills run **per feature iteration**.

---

## New Skill Specs (Summary)

### mu-biz (Business Analysis)

**Invoke when:** greenfield product, or major pivot on existing product.

**Input:** premise artifact

**Checklist:**
1. Competitive analysis (matrix + differentiation)
2. Business Model Canvas (9 blocks)
3. Value Proposition Canvas (pain/gain/painkiller/gain creator)
4. Target persona (who, context, jobs-to-be-done)
5. Brand & naming (optional)
6. North Star Metric + funnel metrics
7. MVP feature scope (feature list + tiering — NOT detailed specs)
8. Cost/revenue model

**Boundaries:**
- Does NOT discuss "how to build" (→ PRD/design)
- Does NOT discuss UX details (→ PRD)
- Output should be understandable by investor/co-founder

**Output:** `docs/biz/YYYY-MM-DD-<product>.md`

**Terminal:** invoke mu-prd

---

### mu-prd (Product Requirements)

**Invoke when:** biz layer done, need to define what the product actually looks like to users.

**Input:** biz artifact (feature list + tiering)

**Checklist:**
1. Persona deepening (concrete scenarios)
2. Information architecture / feature map
3. Core user flows (journey map, sequence diagram)
4. Key screen wireframes (text/mermaid, Visual Companion strongly recommended)
5. Per-feature specs (what / why / rules)
6. Tiering rules (free vs paid behavioral boundaries)
7. Non-functional requirements (performance, privacy, compliance)
8. Success metrics → instrumentation design

**Boundaries:**
- Does NOT do tech selection (→ mu-design)
- Does NOT enumerate UCs (→ mu-scope, per-feature basis)
- User-facing: what they see, what they do, how system responds

**Output:** `docs/prd/YYYY-MM-DD-<product>.md`

**Terminal:** invoke mu-scope (per-feature, starting MVP features)

---

### mu-design (Tech Architecture) — clarifications only

Existing skill stays, with these clarifications in SKILL.md:

- Header explicitly states: "This is a TECHNICAL architecture skill. For product requirements, use mu-prd."
- Remove/rephrase any language that suggests it handles user intent
- Input may be either a scope artifact OR (for first feature in a new product) PRD + scope artifact
- Clarify tier boundary: "Product strategy decisions belong in mu-biz; user experience decisions belong in mu-prd; this skill is about components, interfaces, data flow."

---

## Cross-Cutting Additions

### 1. Skill-Gap Escalation Rule

Add to bootstrap skill red flags:
> **"None of the skills fit exactly"** → Do NOT default to ad-hoc conversation. Announce the gap: "No existing skill cleanly matches. I suggest we use X with adaptations, OR flag this as a DevMuse gap." Let user decide.

### 2. Lightweight Mode

Every product-level skill should support lightweight mode for solo developers:
- **mu-biz lightweight:** competitive analysis + MVP boundary only (1 page)
- **mu-prd lightweight:** core flows + key specs only
- Full mode reserved for team/investor/formal projects

Signal: user says "quick version" / "solo project" / small-scope indicator in premise.

### 3. Backtracking Paths

Flow graph must allow:
- mu-design → back to mu-prd (infeasibility discovered)
- mu-prd → back to mu-biz (MVP scope needs adjustment)
- mu-scope → back to mu-prd (feature spec unclear)

Currently only intra-skill revision is supported.

---

## Migration Plan

1. **Phase 1 — Define:** Write SKILL.md for mu-biz and mu-prd based on this proposal
2. **Phase 2 — Knowledge support:** Add templates under `knowledge/templates/` (biz-canvas, value-prop, prd-template)
3. **Phase 3 — Update existing:**
   - Clarify mu-design header (tech-only)
   - Update bootstrap skill with skill-gap escalation rule and new priority order
4. **Phase 4 — Dogfood:** Use new pipeline on Actify project end-to-end, capture learnings
5. **Phase 5 — Documentation:** Update main README / pipeline diagram

---

## Validation Case: Actify Project

Our real-world output from ad-hoc conversation should map cleanly onto the new tiers:

| Actify doc | Current location | Would map to |
|------------|-----------------|--------------|
| `01-product-vision.md` | `docs/` | `docs/biz/` (or premise) |
| `02-competitive-analysis.md` | `docs/` | `docs/biz/` (section) |
| `03-mvp-scope.md` | `docs/` | Split: MVP feature list → `docs/biz/`; tiering rules + onboarding flow → `docs/prd/` |
| `04-tech-stack.md` | `docs/` | `docs/specs/` (mu-design output) |

If splitting feels natural → refactor validates. If it feels forced → adjust skill boundaries.

---

## Naming Decision

| Candidate | Verdict |
|-----------|---------|
| **mu-biz** | ✅ Short, parallels mu-prd |
| mu-strategy | Too broad, conflicts with "technical strategy" |
| mu-market | Too narrow, business model ≠ market |
| mu-product | Conflicts with mu-prd conceptually |

**Chosen:** `mu-biz` + `mu-prd`

---

## Use Cases

### Happy Paths

#### Workflow A: mu-premise → mu-biz merger

- UC-1: When the user invokes `/mu-biz` with a greenfield product context, Then mu-biz runs in **full mode** — competitive analysis + BMC + VPC + persona + MVP scope + cost model
- UC-2: When the user invokes `/mu-biz` with a signal of small scope ("quick version" / "solo project" / existing premise artifact), Then mu-biz runs in **quick mode** — 4 forcing questions (problem specificity, temporal durability, narrowest wedge, observation test)
- UC-3: When mu-scope Quick Probe runs and no biz artifact exists under `docs/biz/` or `docs/premise/`, Then mu-scope inlines a lightweight 3-question premise check (same behavior as today, but calling it "premise check" not "mu-premise")
- UC-4: Given `skills/mu-premise/` directory exists, When the refactor completes, Then `skills/mu-premise/` is removed and all references in other skills/docs point to `mu-biz` or `knowledge/principles/premise-check.md` instead

#### Workflow B: mu-prd skill addition

- UC-5: When the user invokes `/mu-prd` after a biz artifact exists, Then mu-prd produces a PRD covering persona deepening, IA/feature map, user flows, key wireframes, per-feature specs, tiering rules, NFRs, success metrics
- UC-6: When mu-prd finishes, Then it invokes `mu-scope` per-feature for the first MVP feature (not the whole product at once)
- UC-7: mu-prd has two modes: **full** (team/investor projects) and **lightweight** (solo dev: core flows + key specs only)

#### Workflow C: mu-design → mu-arch rename

- UC-8: Given `skills/mu-design/` directory exists, When the refactor completes, Then the directory is renamed to `skills/mu-arch/`, frontmatter `name: mu-design` becomes `name: mu-arch`, and description clarifies "TECHNICAL architecture only — for product requirements use mu-prd"
- UC-9: When other skills reference the renamed skill (mu-scope chains to it, mu-plan is chained from it, etc.), Then all references update to `mu-arch`
- UC-10: Given spec artifacts are saved to `docs/specs/*-design.md`, When the rename happens, Then the artifact filename pattern stays `*-design.md` (decoupled from skill name)

#### Workflow D: Documentation + bootstrap updates

- UC-11: When README.md, README_CN.md, docs/architecture.md are read, Then they reflect: 10 skills (not 9), new product-level tier, mu-arch name, mu-biz with two modes, mu-prd existence
- UC-12: When bootstrap.md is read, Then it documents two pipeline paths: (a) greenfield product path (mu-biz → mu-prd → mu-scope → mu-arch → mu-plan → mu-code → mu-review), (b) feature-addition path (mu-scope → mu-arch → mu-plan → mu-code → mu-review). No full router behavior — that's deferred to a follow-up issue.

### Edge Cases

- UC-13: Given user invokes `/mu-biz` on an existing codebase (not greenfield), When mu-biz runs, Then it adapts framing to "is this pivot worth it?" vs "should we build this?" — parallel to existing mu-premise context detection
- UC-14: Given mu-biz quick mode detects strong evidence after 2-3 questions, When the user provides concrete data (existing users, usage stats, research), Then mu-biz completes early without pushing to full mode
- UC-15: Given the user invokes `/mu-scope` directly without running mu-biz or mu-prd first (existing project, feature addition), When mu-scope runs, Then it still works — product-level tier is optional, feature-level pipeline runs standalone
- UC-16: Given the user invokes `/mu-premise` (old command), When it's removed, Then invocation should fail gracefully or auto-route to `/mu-biz` quick mode (plugin marketplace might cache old skill name — plan for it)
- UC-17: Given spec documents exist referencing "mu-design" by name, When mu-design → mu-arch rename happens, Then historical docs are NOT retroactively edited (git history is source of truth; only forward-looking content updates to mu-arch)

### Error Cases

- UC-18: When mu-prd is invoked without a biz artifact and user cannot provide business context, Then mu-prd asks the user to either run mu-biz first OR provide biz info inline (but logs "no biz artifact referenced" in the PRD)
- UC-19: When mu-biz quick mode runs but user provides no useful answers after 3 rounds, Then mu-biz flags "Premise not validated — proceeding at user's request" in the artifact (same behavior as current mu-premise)
- UC-20: When the rename breaks an active user session (somebody has mu-design loaded in their session when they update the plugin), Then nothing we can do about it — user reloads the plugin; document this in the migration section

## Non-Functional Constraints

- [Backward-compat] Old mu-premise references in historical docs must not break — git history is source of truth, forward-looking docs only update
- [Plugin load] All skill directory additions/renames must work via devmuse's existing `plugin.json` auto-discovery (`"skills": ["./skills/"]`) — no changes to plugin.json structure
- [Knowledge reuse] `knowledge/principles/premise-check.md` stays, referenced by both mu-biz (quick mode) and mu-scope (inline lightweight check) — no duplication
- [Documentation consistency] README, README_CN, architecture.md must update in the same commit as skill changes — no drift window

## Constraints & Assumptions

- Bootstrap router refactor is OUT OF SCOPE for this work — documented as follow-up issue
- mu-biz/mu-prd templates under `knowledge/templates/` can be added but are NOT required for initial landing
- Actify project validation (dogfooding) happens after this refactor merges, in a separate session
- Spec reviewer won't block on "this description is different now" — only on real gaps

## Out of Scope

- **Bootstrap full router behavior** — deferred to follow-up GitHub issue (long-term design discussion)
- **Full skill matrix reorganization** (product/feature/impl × business/ux/eng/security axes) — deferred
- **mu-biz + mu-prd knowledge templates** (biz-canvas.md, value-prop.md, prd-template.md) — nice-to-have, defer if they slow landing
- **Re-running Actify workflow through new skills** — separate validation session
- **Migration of historical docs** that reference "mu-design" — history stays, forward-looking only

## Impact Analysis

### Files Affected

**New files (~5):**
- `skills/mu-biz/SKILL.md`
- `skills/mu-prd/SKILL.md`
- (optional: `knowledge/templates/{biz-canvas,value-prop,prd}.md` — defer)

**Renamed (1 skill):**
- `skills/mu-design/` → `skills/mu-arch/` (directory rename + frontmatter update)

**Removed (1 skill):**
- `skills/mu-premise/` (content absorbed by mu-biz quick mode)

**Modified (multiple skills + docs):**
- `skills/mu-scope/SKILL.md` — update terminal state from "invoke mu-design" to "invoke mu-arch", update premise check reference
- `skills/mu-plan/SKILL.md` — update references from mu-design to mu-arch
- `skills/mu-code/SKILL.md` — update references
- `skills/mu-review/SKILL.md` — update references
- `skills/mu-arch/SKILL.md` (after rename) — add header clarification "technical only — for product use mu-prd"
- `rules/bootstrap.md` — document new pipeline paths (no router logic yet)
- `agents/mu-reviewer.md` — update any mu-design references
- `docs/architecture.md` — update skills table (9 → 10: +mu-biz, +mu-prd, -mu-premise; rename mu-design → mu-arch)
- `README.md`, `README_CN.md` — same updates + product-level tier description

### Existing tests that may break
- `tests/hooks/test-pipeline-gate.sh` — unaffected (doesn't reference skill names)
- `tests/hooks/test-destructive-guard.sh` — unaffected
- Skill-triggering tests under `tests/skill-triggering/prompts/` — may reference mu-design by name; need audit

### Migration needs
- Plugin users: they `/plugin update devmuse` — on next reload, mu-premise disappears and mu-biz appears. Document in CHANGELOG.
- Old references in historical git history: untouched (history is immutable)

## Next Steps

1. ✅ Scope approved (this document)
2. → mu-design: architectural approach for the refactor (how to sequence rename, what goes in each new SKILL.md)
3. → mu-plan: task breakdown
4. → mu-code: execute
5. After merge: open GitHub issue for long-term bootstrap router discussion
6. Validate: restart Actify project workflow with new pipeline (separate session)
