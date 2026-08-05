---
name: mu-mrd
description: "Market requirements — should we build it, who is it for, who are we up against, what's the revenue opportunity. Modes: quick or full."
disable-model-invocation: true
---

# Market Requirements

**Scope:** The MRD answers *whether* to build and *for which market* — premise validation, competitors, target market, revenue opportunity. The PRD (mu-prd, next) answers *what* to build — flows, specs, screens. Technical architecture comes later (mu-arch).

Independent of the main feature-level pipeline. Product-level skill that runs **once per product**, not per feature.

<HARD-GATE>
Do NOT invoke mu-prd or any feature-level skill until the user has approved the MRD artifact.
</HARD-GATE>

## Phase 0: Stance Detection

Before Depth Mode Selection, detect the current state of any existing MRD artifact and pick an entry stance.

1. Read `@../../knowledge/principles/stance-detection.md`
2. Run the detection algorithm with:
   - **Artifact type**: `mrd`
   - **Artifact dir**: `docs/mrd/`
   - **Watched source dirs**: root `README*` only. **Note**: MRD staleness is weakly defined — the market shifting is a human judgment, not a file signal. H3 catches only the coarse "README says something very different now" case. Users override to `update(sync)` manually when they know a pivot has happened. **Never watch** `docs/prd/` (PRD edits don't imply MRD staleness) or `docs/mrd/` itself (circular).
   - **Legacy locations**: `docs/biz/` (mu-biz era), `docs/premise/` (deprecated), root `BUSINESS.md`
3. Apply the Shared Consumption Protocol in that file (confidence handling, slash pre-confirmation, stance metadata), then route below. See **Stance × Depth Mode interaction** for how stance tokens interact with depth-mode tokens like `quick` / `full`.

**Branch routing**:

| Stance | Action |
|--------|--------|
| `create` | Run Depth Mode Selection, then existing Process (Quick or Full) unchanged. |
| `update` | Load existing MRD artifact → apply sub-type logic (`expand` fills stub sections; `gap-fill` adds a new section for a sister-product / new-market; `sync` updates stale market/competitor/revenue claims to current state) → merge via section approval. |
| `extract` | Read product signals (code, commits, README, user interviews if user provides them) and synthesize an MRD section-by-section. Commit prefix: `extract:`. |
| `skip` | Append pass-through history entry; move to downstream (manually if Quick depth mode; Full → the terminal prompt for `/mu-prd create`). |

**Stance × Depth Mode interaction**:

mu-mrd has two independent concepts: **Stance** (Phase 0, `create`/`update`/`extract`/`skip`) and **Depth Mode** (below, `quick`/`full`). Slash hints may specify either or both; tokens are split cleanly:

| User input | Stance | Depth mode |
|------------|--------|-----------|
| `/mu-mrd` | auto-detect in Phase 0 | auto-detect in Depth Mode Selection |
| `/mu-mrd create` | `create` (forced) | auto-detect |
| `/mu-mrd quick` | auto-detect | `quick` (forced) |
| `/mu-mrd create quick` | `create` | `quick` |
| `/mu-mrd full` | auto-detect | `full` |

Phase 0 parses only the stance token; Depth Mode Selection parses only the depth token. They run sequentially and do not interfere.


## Depth Mode Selection

Detect depth mode from user signal, then confirm:

| Signal | Depth mode | Rationale |
|---|---|---|
| "new product", "startup", "market analysis", `/mu-mrd full` | **Full** | Comprehensive market analysis warranted |
| "quick version", "solo project", "is this worth doing?", `/mu-mrd quick`, existing premise/MRD artifact | **Quick** | Lightweight validation sufficient |
| Unclear | Ask the user which depth mode; default to quick |

## Process Flow

```dot
digraph mu_mrd {
    "Detect mode\n(quick or full)" [shape=diamond];
    "Load premise-check.md" [shape=box];
    "Detect context:\ngreenfield vs existing?" [shape=diamond];
    "Quick mode:\n4 forcing questions" [shape=box];
    "Full mode:\nquick + 5 market sections" [shape=box];
    "Evaluate answers" [shape=diamond];
    "Write artifact\n(docs/mrd/)" [shape=box];
    "Quick?" [shape=diamond];
    "Terminal: user proceeds\n(manually to mu-scope or mu-prd)" [shape=doublecircle];
    "Terminal: prompt /mu-prd create" [shape=doublecircle];

    "Detect mode\n(quick or full)" -> "Load premise-check.md";
    "Load premise-check.md" -> "Detect context:\ngreenfield vs existing?";
    "Detect context:\ngreenfield vs existing?" -> "Quick mode:\n4 forcing questions" [label="quick"];
    "Detect context:\ngreenfield vs existing?" -> "Full mode:\nquick + 5 market sections" [label="full"];
    "Quick mode:\n4 forcing questions" -> "Evaluate answers";
    "Full mode:\nquick + 5 market sections" -> "Evaluate answers";
    "User approves MRD?" [shape=diamond];
    "Evaluate answers" -> "Write artifact\n(docs/mrd/)";
    "Write artifact\n(docs/mrd/)" -> "User approves MRD?";
    "User approves MRD?" -> "Write artifact\n(docs/mrd/)" [label="changes requested"];
    "User approves MRD?" -> "Quick?" [label="approved"];
    "Quick?" -> "Terminal: user proceeds\n(manually to mu-scope or mu-prd)" [label="yes"];
    "Quick?" -> "Terminal: prompt /mu-prd create" [label="no (full)"];
}
```

## Quick Mode

Use when: validating whether work is worth doing; solo projects; existing project considering pivot.

**Process:**

1. Load @../../knowledge/principles/premise-check.md
2. Detect context:
   - Greenfield: "Should we build this?"
   - Existing: "Is this change/pivot worth the disruption?"
3. Ask 4 forcing questions one at a time (Q1 → Q2 → Q3 → Q4):
   - Q1: Problem Specificity — "Who exactly has this problem? What do they do today?"
   - Q2: Temporal Durability — "If the world changes in 3 years, is this more or less essential?"
   - Q3: Narrowest Wedge — "What's the smallest thing we could build to test whether this matters?"
   - Q4: Observation Test — "Have you watched someone use a similar solution without helping them?"
4. Evaluate answers:
   - Strong evidence on 3+ questions → "Premise validated"
   - Weak/vague on 2+ questions → "Premise weakly validated — consider narrowing scope"
   - No useful answer after 3 rounds → "Premise not validated — proceeding at user's request"
5. Write artifact to `docs/mrd/YYYY-MM-DD-<name>-quick.md`
6. Commit

**Terminal:** User proceeds manually — either to mu-scope (feature-level work on existing project) or to mu-mrd full + mu-prd (if scaling up to real product).

## Full Mode

Use when: greenfield product, team project, investor-facing analysis, major pivot.

**Process:**

1. Run quick mode first — its 4 questions are premise validation for the full analysis too
2. Then produce 5 market sections (one at a time, user approves each):
   1. **Competitive landscape** — matrix of 3-5+ competitors on key dimensions + a one-paragraph differentiation statement
   2. **Target market & persona** — who has the problem, segment size, context, jobs-to-be-done, buying triggers
   3. **Revenue & opportunity** — who pays, for what, pricing basis, opportunity size (coarse TAM/SAM is enough), and the major cost drivers — opportunity level, not a financial model. When the revenue story needs deeper structure (canvas-level mapping, unit economics, naming), walk the relevant checklist in @../../knowledge/principles/business-canvases.md and fold the conclusions back into this section.
   4. **North Star Metric + funnel** — primary metric + input funnel metrics + success thresholds
   5. **MVP scope boundary** — product-level feature list (not UC-level); free/paid tier boundaries if applicable
3. Write artifact to `docs/mrd/YYYY-MM-DD-<product>.md`
4. Commit
5. User reviews and approves the assembled MRD — this is the HARD-GATE; section approvals alone don't clear it

**Terminal:** mu-prd is explicit-only, so hand the baton to the user: "MRD approved — run `/mu-prd create` to define the product." That invocation hint arrives pre-confirmed per spec §2.5, so mu-prd's Phase 0 presents no dialog. (Greenfield products typically need PRD next.)

## Artifact Format

Drafted per @../../knowledge/principles/prose-discipline.md — conclusion first, derivations shown, negative claims scoped.

**Quick mode:**

```markdown
# MRD Quick Check: <topic>

> **Date:** YYYY-MM-DD
> **Depth mode:** quick
> **Stance:** <create | update | extract | skip>
> **Sub-type:** <expand | gap-fill | sync | —> (omitted on fresh create)
> **Detected at:** YYYY-MM-DD (commit `<short-sha>`) (omitted on fresh create — appears from first update/extract)

## Context
- Greenfield or existing project
- Brief description of what's being evaluated

## Validation

| Question | Answer | Signal |
|---|---|---|
| Problem specificity | <answer> | ✅ strong / ⚠️ weak / ❌ none |
| Temporal durability | <answer> | ✅ / ⚠️ / ❌ |
| Narrowest wedge | <answer> | ✅ / ⚠️ / ❌ |
| Observation test | <answer> | ✅ / ⚠️ / ❌ |

**Status:** Validated / Weakly validated / Not validated (proceeding at user's request)

## History

| Date | Commit | Stance | Sub-type | Change |
|------|--------|--------|----------|--------|
| YYYY-MM-DD | `<sha>` | create | — | Initial creation: <the create round's key decisions — never leave this bare> |
```

**Full mode:** Same header + Validation section + 5 market sections (each its own `##` heading) + History section at the bottom.

### Commit Convention

Commit message prefix reflects the stance and (if update) sub-type:

- `docs(mrd): create: ...` — from-zero creation
- `docs(mrd): update(expand): ...` — filled stub sections
- `docs(mrd): update(gap-fill): ...` — added section for sister product / new market
- `docs(mrd): update(sync): ...` — aligned to current market/product state
- `docs(mrd): extract: ...` — reverse-engineered from product signals
- `docs(mrd): skip: passthrough for <task>` — short history-only commit if header needed initialization

**Opt-out**: the user can pass `--no-stance-meta` on invocation to suppress the Stance / Sub-type / Detected-at header fields for that session. Default is on.

## Key Principles

- **Grill, don't interrogate** — apply @../../knowledge/principles/grilling.md: one question per message with a recommendation, facts self-served, decisions to the user
- **Accept strong evidence quickly** — if user has data, don't interrogate further
- **Respect user override** — if they say "just do it", flag and proceed
- **Context-adaptive framing** — greenfield vs existing codebase changes the question tone
- **Mode is explicit** — confirm with user before running full mode (it's several times more work than quick)
- **Market language** — outputs should be understandable by an investor / co-founder, not tech-heavy
- **Opportunity, not financial model** — revenue answers stay at "who pays, why, roughly how much"; canvas mapping and unit economics live in business-canvases.md, consulted when the fork demands it
- **No technical design** — that's mu-arch's job
- **No feature specs** — that's mu-prd's job (product-level feature list is OK here; user-facing rules/wireframes/flows belong in mu-prd)

**Sign-off gate (before terminal):**

Before terminal (user-decides in Quick mode, invoke mu-prd in Full mode), consult `@../../knowledge/principles/sign-off-gate.md`. If stakeholder-scope indicates team-touching, run the gate protocol. Sign-off gate is skipped when stance was `skip`.

## Integration

- **Invoked by:** user manually (`/mu-mrd` or `/mu-mrd quick` / `/mu-mrd full`). On-demand only — never auto-routed (bootstrap points to the slash command instead)
- **Reads:** @../../knowledge/principles/premise-check.md (always); @../../knowledge/principles/stance-detection.md (Phase 0); @../../knowledge/principles/business-canvases.md (Revenue & opportunity section, when deeper structure is needed); @../../knowledge/principles/sign-off-gate.md (terminal if team-touching); prior MRD/biz/premise artifacts if present
- **Produces:** `docs/mrd/YYYY-MM-DD-<name>[-quick].md`
- **Terminal state:**
  - Quick mode → user decides (no chaining)
  - Full mode → prompt the user to run `/mu-prd create` (the invocation hint arrives pre-confirmed per spec §2.5; mu-prd is explicit-only, so the baton passes through the user's hand)
