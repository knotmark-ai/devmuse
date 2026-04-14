# Design: Skill Tier Refactor

> **Date:** 2026-04-13

## Requirements Reference

- Scope: docs/scope/2026-04-13-skill-tier-refactor.md
- Covers: UC-1 through UC-20 (all)
- NFRs: Backward-compat (historical docs untouched), plugin auto-discovery unchanged, knowledge reuse (premise-check.md shared), documentation consistency

## Overview

Three-tier skill architecture with five coordinated changes:

1. **Drop mu-premise** — content absorbed by mu-biz quick mode
2. **Add mu-biz** — business analysis skill with two modes (quick / full)
3. **Add mu-prd** — product requirements skill
4. **Rename mu-design → mu-arch** — disambiguate "design" now that mu-prd exists
5. **Update bootstrap** — document greenfield vs feature-addition pipeline paths

## New Three-Tier Structure

```
Product-level tier (runs once per product; optional for existing projects)
├── mu-biz         Business analysis (two modes: quick / full)
└── mu-prd         Product requirements (two modes: lightweight / full)

Feature-level tier (runs per feature iteration)
├── mu-scope       Use case elicitation (unchanged behavior, updated references)
├── mu-arch        Technical architecture (renamed from mu-design)
├── mu-plan        Task breakdown (unchanged behavior, updated references)
├── mu-code        Implementation (unchanged behavior, updated references)
└── mu-review      Review + integration (unchanged behavior, updated references)

Orthogonal (pipeline-external, invoke as needed)
├── mu-debug       Root cause analysis
├── mu-retro       Periodic retrospective
└── mu-write-skill Meta: create/edit skills
```

Total: **10 skills** (was 9: drop mu-premise, drop mu-design from skill list but rename not remove; add mu-biz, mu-prd, mu-arch).

Net change: +2 skills (mu-biz, mu-prd), -1 (mu-premise removed), 1 renamed (mu-design → mu-arch).

## Pipeline Paths

Two documented paths (bootstrap will reference, but not route yet):

**Greenfield product path:**
```
mu-biz (full) → mu-prd → [per feature: mu-scope → mu-arch → mu-plan → mu-code → mu-review]
```

**Feature-addition path (existing project):**
```
mu-scope → mu-arch → mu-plan → mu-code → mu-review
```

**Quick ideation path (solo / small scope):**
```
mu-biz (quick) → mu-scope → mu-arch → mu-plan → mu-code → mu-review
```

## Component Design

### mu-biz skill

**File:** `skills/mu-biz/SKILL.md`

**Frontmatter:**
```yaml
---
name: mu-biz
description: "Business analysis — validate premise and define product strategy (market, BMC, VPC, personas, MVP scope). Two modes: quick (4 forcing questions) or full (comprehensive analysis)."
---
```

**Mode detection:** First message detects signal:
- Signals for **quick mode**: "quick version", "solo project", "is this worth doing?", explicit `/mu-biz quick`
- Signals for **full mode**: "new product", "startup", "business plan", explicit `/mu-biz full`
- Default: quick mode (cheaper; user can upgrade to full later)

**Quick mode process:**
1. Load `@../../knowledge/principles/premise-check.md`
2. Detect context (greenfield vs existing) — adapt question framing
3. Ask 4 forcing questions (Q1-Q4) one at a time
4. Evaluate → write `docs/biz/YYYY-MM-DD-<name>-quick.md`

**Full mode process:**
1. Load quick mode first (the 4 questions are premise validation for the full analysis too)
2. Additional sections:
   - Competitive analysis (matrix + differentiation)
   - Business Model Canvas (9 blocks)
   - Value Proposition Canvas
   - Target persona (detailed) + JTBD
   - Brand & naming (optional)
   - North Star Metric + funnel
   - MVP feature scope + tiering (product-level, not UC-level)
   - Cost/revenue model
3. Write `docs/biz/YYYY-MM-DD-<name>.md`

**Terminal state:**
- Quick mode → user proceeds manually to mu-scope (for existing projects) or mu-prd (for greenfield)
- Full mode → invoke mu-prd (greenfield products typically need PRD next)

**Artifact location:** `docs/biz/` (new directory)

### mu-prd skill

**File:** `skills/mu-prd/SKILL.md`

**Frontmatter:**
```yaml
---
name: mu-prd
description: "Product requirements — user flows, screens, per-feature specs, tiering rules. For product/UX requirements (not technical architecture — that's mu-arch)."
---
```

**Input:** biz artifact (or skip with explicit user override)

**Process:**
1. Read biz artifact if present
2. Persona deepening (concrete scenarios)
3. Information architecture / feature map
4. Core user flows (journey/sequence diagrams)
5. Key screen wireframes (text/mermaid; Visual Companion recommended)
6. Per-feature specs (what / why / rules)
7. Tiering rules (free vs paid behavioral boundaries)
8. NFRs (performance, privacy, compliance)
9. Success metrics → instrumentation design
10. Write `docs/prd/YYYY-MM-DD-<product>.md`

**Two modes:**
- **Lightweight** (solo / small project): core flows + key specs only
- **Full** (team/investor/formal): all 9 sections

**Terminal state:** Invoke mu-scope for the first MVP feature (user picks which).

**Artifact location:** `docs/prd/` (new directory)

### mu-arch (renamed from mu-design)

**File:** `skills/mu-arch/SKILL.md` (directory renamed)

**Changes to frontmatter:**
```yaml
---
name: mu-arch
description: "Technical architecture — components, interfaces, data flow, error handling. For product/UX requirements use mu-prd."
---
```

**Changes to body (minimal):**
- Title: `# Design` → `# Technical Architecture`
- Add header note: "This skill is technical only. For product requirements (user flows, specs, tiering), use mu-prd first."
- `mu-design` self-references → `mu-arch`
- Terminal state still invokes mu-plan
- Everything else (checklist, process flow, visual companion, spec review loop, etc.) stays identical

**Artifact path stays:** `docs/specs/YYYY-MM-DD-<topic>-design.md` (artifact name decoupled from skill name per Decision #5)

### mu-premise removal

- Delete directory `skills/mu-premise/`
- Knowledge file `knowledge/principles/premise-check.md` stays — now referenced only by mu-biz (quick mode) and mu-scope (inline premise check)
- Old premise artifacts under `docs/premise/*.md` keep working (not actively migrated; mu-biz can read them as context if present)

### Skill cross-reference updates

All references to `mu-design` in other skill files update to `mu-arch`:

| File | Change |
|---|---|
| `skills/mu-scope/SKILL.md` | "invoke mu-design" → "invoke mu-arch"; "mu-design requires a scope artifact" → "mu-arch requires a scope artifact" |
| `skills/mu-plan/SKILL.md` | "worktree (created by mu-design)" → "worktree (created by mu-arch)" |
| `skills/mu-code/SKILL.md` | Check for mu-design references |
| `skills/mu-review/SKILL.md` | Check for mu-design references |
| `agents/mu-reviewer.md` | Check for mu-design references |

### Bootstrap update

**File:** `rules/bootstrap.md`

**Changes:**
- Update skill priority section to show new tier structure
- Add a "Pipeline paths" subsection documenting greenfield / feature-addition / quick ideation paths
- Update the skill decision flow to mention mu-biz and mu-prd as possible first steps for greenfield
- Do NOT add router logic — keep bootstrap as-is structurally, just update documentation content

### Documentation updates

| File | Change |
|---|---|
| `README.md` | Skills table 9 → 10; add mu-biz and mu-prd rows; rename mu-design → mu-arch; add "Product-level tier" section above pipeline |
| `README_CN.md` | Same changes, translated |
| `docs/architecture.md` | Skills classification (Product / Feature / Orthogonal / Meta); agents table unchanged; knowledge tree unchanged |

## Migration Strategy

**Backward compatibility:** None for skill renames (plugin users reload → mu-design disappears, mu-arch appears). This is acceptable because:
1. Skill names are invoked by user/agent in conversation, not imported programmatically
2. Historical git commits/docs keep their mu-design references; git history is immutable
3. docs/specs/*-design.md filename pattern survives (artifact decoupled from skill name)

**CHANGELOG entry:** Add to CHANGELOG.md (or create if missing):
```
- BREAKING: `/mu-premise` removed — use `/mu-biz quick` instead
- BREAKING: `/mu-design` renamed to `/mu-arch`
- NEW: `/mu-biz` skill with two modes (quick/full)
- NEW: `/mu-prd` skill with two modes (lightweight/full)
- UPDATED: bootstrap documents greenfield vs feature-addition pipeline paths
```

## Failure Mode Analysis (Inversion Test)

Applied to each approach per `@../knowledge/principles/inversion.md`:

| Component | Failure mode | Mitigation |
|---|---|---|
| mu-biz two-mode detection | Mode ambiguity — user signal unclear, wrong mode runs | Default to quick (cheaper). User can re-run with explicit `/mu-biz full`. |
| mu-prd without biz artifact | Agent proceeds without business context → shallow PRD | UC-18: require explicit user override with context inline, log "no biz artifact" |
| mu-design → mu-arch rename | Historical doc cross-references become stale (e.g., "see mu-design docs") | UC-17: accept it. Git history is immutable; going back to rewrite docs creates more problems. |
| Skill-triggering tests reference mu-design by name | Tests break on rename | Audit + update tests in same PR |
| Plugin reload during active session | User has mu-design loaded, plugin update renames it → user invokes mu-design, nothing matches | UC-20: document; nothing we can do; agent will suggest mu-arch based on error |
| Knowledge file `premise-check.md` loaded by two skills | Drift between mu-biz quick mode and mu-scope inline check | Single source of truth (the knowledge file); skills just reference it |

## Phasing

All changes land in one PR (atomic). The migration is **not backward compatible** by design — doing it in phases would create a worse intermediate state.

**Implementation order (to minimize intermediate breakage during coding):**
1. Add `mu-arch/` directory (copy of mu-design), update internal self-references
2. Add `mu-biz/` directory + SKILL.md
3. Add `mu-prd/` directory + SKILL.md
4. Update all cross-references in other skills (mu-scope, mu-plan, mu-code, mu-review, agents/mu-reviewer.md) from mu-design to mu-arch
5. Update bootstrap.md
6. Update README, README_CN, architecture.md
7. Delete `mu-design/` directory
8. Delete `mu-premise/` directory
9. Add CHANGELOG entry
10. Verify tests pass, no stale mu-design references anywhere

Step 7 is intentionally late — it's the last "breaking" move. Everything before step 7 is additive.

## Out of Scope (for this design)

- Bootstrap full router behavior (separate issue)
- mu-biz / mu-prd knowledge templates (deferred)
- mu-simplify skill (future)
- Skill matrix reorg (long-term)
- Historical doc rewrite (immutable)
- Actify dogfood validation (next session)
