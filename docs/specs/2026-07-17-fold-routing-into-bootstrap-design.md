# Architecture: Fold routing into bootstrap (retire mu-route)

> **Date:** 2026-07-17
> **Scope reference:** docs/scope/2026-07-17-fold-routing-into-bootstrap.md
> **Stance:** create
> **Sub-type:** —
> **Detected at:** 2026-07-17 (commit ed3af6b)

## Requirements Reference
- Scope: docs/scope/2026-07-17-fold-routing-into-bootstrap.md
- Use cases covered: UC-1..UC-10, UC-E1, UC-E2, UC-R1..UC-R4
- NFRs: Tokens, Predictability

## Alternatives Considered

| Approach | Pros | Cons | Failure Modes | Verdict |
|----------|------|------|---------------|---------|
| A1: Single-section inline fold | Zero round trip; zero reload on transitions; kills the bootstrap↔mu-route must-agree pair; single canonical home | Bootstrap (always-on) grows ~+20 net lines | Sloppy compression flips a decision → bounded by the 8+5 battery (UC-R1); overgrowth → bounded by the ≤135 cap (UC-R3) | **Selected** |
| A2: Fold + disclosed reference file | Smallest bootstrap growth | Routing runs BEFORE any skill loads; a disclosed file needs a Read round trip | Recreates the very hop this work eliminates — structural, not fixable | **Rejected** |
| A3: Keep skill, slim to ~80 lines | No reference cleanup | Sync pair and per-route load remain | Same liabilities at smaller scale | **Rejected** — overruled by user decision (Option B) |

## C4 Positioning

### Component Level (rules layer ↔ skills layer, one boundary move)

```mermaid
graph TD
    subgraph rules layer — always-on via SessionStart hook
        B["rules/bootstrap.md ✏️<br/>+ Routing section (inlined router)"]
    end
    subgraph skills layer — loaded on demand
        R["skills/mu-route/ ➖ retired"]
        T["target skills<br/>mu-scope / mu-arch / mu-review / mu-code / mu-explore"]
    end
    B -->|after: classify + invoke directly| T
    B -.->|before: load 186-line SKILL.md| R
    R -.->|then invoke| T
```

Routing moves from the skills/ layer to the rules/ layer — consistent with the four-layer definitions (rules = always-on decision guidance; routing is decision guidance needed before any skill loads).

## Functional Design

### Interface Contract: the folded Routing section

Replaces bootstrap's current ~12-line "Routing" subsection. Final text (~32 lines):

- Header rule: unprefixed in-domain messages, at task start or transition, classify and route from this section; `/mu-*` bypasses.
- **Signals block**: intent verbs; artifact existence (`docs/scope|specs|prd|biz/*.md`, on-disk only); recent-author familiarity (git log 30d) when reshape fires; installed non-DevMuse skill match. Never fabricate — on computation error, ask the user for the opening move (UC-E1).
- **Intent → opening move table** (9 rows, first match wins; multi-verb priority fix > review > reshape > create-feature > implement > understand): understand→Explore; fix→Reproduce; review→Review; reshape+unfamiliar→Explore(pre-change)→Design-tech; reshape/create-feature+familiar+no-specs→Design-tech(stance=auto); implement+no-specs→Design-tech(stance=auto); implement+specs→Implement; plugin-match→propose delegation; no-match/pathological→Explore default / ask user (UC-E2).
- **Confidence rule** (3 tiers): silent invoke / one-line check / full proposal with one-word overrides. An unparseable reply to a proposal → ask the user to restate with one word from the override list (non-blocking; former ER-R2).

Preserved semantics from mu-route not restated elsewhere: stance=auto hint to mu-arch; on-demand pointer behavior (already a separate bootstrap block, unchanged).

Dropped (not folded): Axis-Stakeholder (owned by sign-off-gate.md, informational only in routing); proposal wording variants beyond the three tiers; mu-route's process-flow digraph and integration notes (self-referential).

### Reference cleanup (16 live reference sites: 15 to reword/regenerate + `skills/mu-route/` to delete; dated snapshots under `docs/{plans,proposals,scope,specs}` exempt as historical records)

| File | Change |
|------|--------|
| `skills/mu-route/` | Delete directory (git history preserves; no tombstone) |
| `rules/bootstrap.md` | Replace Routing subsection with the folded section |
| `CLAUDE.md` | Canonical homes: routing's only home = bootstrap (delete the must-agree pair); remove mu-route row from the touch list |
| `CONTEXT.md` | Reword subjects in **Opening move**, **On-demand skill**, **Task transition** entries: "mu-route" → "the routing rules (bootstrap)" (per scope conflict resolution A) |
| `README.md`, `README_CN.md` | Skills table: delete Router row (13 skills); prose Routing paragraph reworded |
| `skills/{mu-arch,mu-biz,mu-explore,mu-wiki}/SKILL.md` | 1-line Integration/prose mentions reworded |
| `docs/explore/_overview.md` | Area-local `Axis-*` row reworded; History row appended |
| `docs/wiki/` (5 pages: `_index`, `workflow-and-routing`, `four-layer-architecture`, `on-demand-skills`, `docs-maintenance-contract`) | Regenerated via `/mu-wiki update` after implementation lands — never hand-edited |

### Data Model / State Machine / Sequence Diagrams

Not applicable — no data entities, no lifecycle, no multi-party runtime interaction (single-context prompt mechanics).

## Non-Functional Design

### Tokens
- Concern: bootstrap is paid every session (and per compaction); mu-route was paid per route.
- How addressed: net bootstrap growth ~+20 lines (89→~109, cap 135); saves ~186 lines × routes-per-session + one Skill-tool round trip; transitions become zero-reload.
- Trade-off: chat-only sessions in DevMuse repos pay +20 lines for unused routing — accepted (rare in a dev repo).

### Predictability
- Concern: relocation must not change any routing decision.
- How addressed: the 8+5 scenario batteries run against the folded bootstrap; acceptance = decisions identical to pre-fold (UC-R1). Rule ordering (first match wins) and confidence tiers preserved verbatim in compressed form.
- Trade-off: none if the battery passes; any flip fails acceptance.

## Architecture Decision Records

### ADR-1: Inline the full router rather than disclose details to a knowledge file
- **Context:** Folding routing into bootstrap can either inline everything or keep a disclosed detail file (A2).
- **Decision:** Inline (A1). Routing executes before any skill or knowledge file is loaded; the router must be fully operational from always-on context alone.
- **Alternatives:** A2 rejected — a disclosed file re-introduces the load round trip this work eliminates; A3 rejected by user decision.
- **Consequences:** + zero-hop routing, single canonical home, zero-reload transitions; − bootstrap carries ~+20 always-on lines; any future routing change edits the always-on file (higher blast radius per edit, mitigated by the scenario battery as regression net).

### ADR-2: Retire mu-route with no tombstone
- **Context:** The directory could keep a stub README pointing to bootstrap.
- **Decision:** Delete cleanly; git history is the record.
- **Alternatives:** Tombstone stub — rejected: it re-registers as a skill via the `./skills/` glob and pollutes the plugin.
- **Consequences:** + clean skills list (13); − external links to skills/mu-route/ break (none known outside dated snapshots, which are exempt as historical records).

## Error Handling
- Signal computation failure → ask the user for the opening move (UC-E1); never fabricate.
- Pathological repo state → skip the table, ask directly (UC-E2).
- Post-fold discovery of a missed reference → grep gate in implementation plan (UC-R4) catches before commit.

## Testing Strategy
- Acceptance oracle: 8-scenario bootstrap battery + 5-scenario review battery, re-run against the folded bootstrap in a fresh subagent; every decision must match pre-fold (UC-R1).
- Structural checks: `grep -r "mu-route"` clean outside dated snapshots (UC-R4); `wc -l rules/bootstrap.md` ≤135 (UC-R3).
- UC coverage mapping: UC-1..10 exercised by the batteries; UC-E1/E2 asserted by battery scenarios with simulated signal failure; UC-R2 asserted by harness behavior (unchanged frontmatter).

## Out of Scope
- Any change to routing decisions, intents, targets, or confidence semantics — relocation only.
- Native description-based routing (option C).
- Wiki CN twins (do not exist).

## History

| Date | Commit | Change |
|------|--------|--------|
| 2026-07-17 | — | Initial creation |
