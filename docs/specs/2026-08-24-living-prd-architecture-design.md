# Living, profile-based, use-case-driven PRD and architecture — design

> **Date:** 2026-08-24
> **Status:** Draft for review
> **Requirements Reference:** #63 (UC-D1..UC-D10, UC-DR1..UC-DR4); research #67
> **Relates to:** #62 (manifest already nests `artifacts.architecture.{index, domain_model}`), #68 (case registry builds on this), #47 (mu-model create validation), #40 (iteration)

## Requirements Reference

Implements GitHub issue #63. The accepted direction: replace one-size-fits-all,
time-based PRD/architecture output with a stable, living documentation set driven
by use cases and composable project profiles, and fold domain modeling into the
product/design flow instead of leaving an orphan `CONTEXT.md` and a separate
`mu-model` stage.

## Starting point (verified, not assumed)

The current repo is further toward the target than #63's framing implies:

- **PRD is already living in intent** — `mu-prd/SKILL.md:154`: "A PRD is a living artifact: one per product, iterated in place." But it is *lexically dated* (`docs/prd/YYYY-MM-DD-<product>.md`) and found by directory glob, not by a manifest path. `.devmuse/project.yaml` has `prd: null`.
- **The architecture set already has a manifest home** — `.devmuse/project.yaml` nests, under `artifacts.architecture`, both `index: docs/architecture.md` and `domain_model: CONTEXT.md`. #62's manifest schema (`manifest.mjs`, `project-context.md:53-68`) already declares domain facts as a *member of the architecture set*. `CONTEXT.md` is not an orphan to move; it is a declared member to reframe.
- **A living architecture set already exists** — `docs/wiki/` (mu-wiki) is "the single durable home of current architecture state." `mu-arch` writes *dated* per-change design specs and already redirects "current-state architecture" to `/mu-wiki`.
- **Concern-trigger machinery already exists**, un-composed, in three places: `nfr-checklist.md:9-21` (11 trigger rows already naming transactions, multitenancy, security, public APIs, compliance), `mu-arch` Conditional Design Tools (`:196-221`), and the `mu-prd` Product Object Model trigger (`:138`).
- **No profile concept exists.** The nearest is the flat, mutually-exclusive `architecture-assessment.md:5-17` "Diagram Type by Project Type" table — the exact structure #67 recommends replacing.
- **No packaged worked examples exist.** `CONTEXT.md` itself is the only dogfood domain model; `docs/architecture.md` is a thin, History-less repo-layout doc.

The design therefore *reframes and composes existing machinery* far more than it
builds new subsystems.

## Alternatives Considered

**A. Relocate `CONTEXT.md` into `docs/wiki/`.** Rejected. `docs/wiki/` is
rebuildable-from-source (mu-wiki regenerates it); domain facts are *authored
truth* ("stale here is a bug", `domain-model.md:68`) and must not live in a
regenerated zone. The manifest already gives domain facts a home *as a member of
the architecture set* without moving the file.

**B. Remove `mu-model` entirely; inline its method into mu-prd/mu-arch.**
Rejected for now. The 7-step method and its validation surface (#47, create path
unproven) have value; deleting the skill discards the create-path field evidence
#47 is still collecting. Instead: mu-model stops being a *required gate* and
becomes an *optional explicit tool*, while its method is referenced inline by
mu-prd and mu-arch so domain modeling happens *inside* their flow.

**C. Make dated design specs living.** Rejected. A per-change design spec
describes "what one change will do" — inherently a point-in-time record. #62
already routes PR-specific design/plan to the Draft PR and durable current truth
to living repo docs. So: the *architecture set* (index + domain model) is living
and is the default 3.0 output; per-change design records remain dated snapshots
(or Draft-PR-managed under #62), demoted from "the default output" to "history."

## Canonical model (the target)

One project has:

- **One PRD truth** — living, `artifacts.prd` in the manifest, update-in-place, History.
- **One architecture documentation set** — the manifest's `artifacts.architecture`:
  - `index` — a living architecture overview (what the system *is*), History-bearing.
  - `domain_model` — the living domain model (terms, invariants, state machines); `CONTEXT.md` by default, now a *declared member of the architecture set*, not an orphan root truth.
  - the detailed `docs/wiki/` remains the rebuildable expansion of the index.
- **Every fact has one home; one home does not mean one writer** — both mu-prd and mu-arch may contribute to the domain model, editing the single `domain_model` member.
- **Dated snapshots remain history** — `docs/scope|specs|plans/YYYY-MM-DD-*.md` are not the default 3.0 output; `artifact-succession.md` governs only that historical corpus.

## Functional design

### D1. Profiles and concern triggers (composition, not one-size-fits-all)

New knowledge file `knowledge/principles/project-profiles.md` defines the
**smallest useful profile set** proven by tests, plus the composition rule.
Candidate profiles (compose, not mutually exclusive): library/SDK, CLI/dev tool,
client application, stateful service, event-driven system, infrastructure/platform,
plugin/agent workflow, data/AI system. A profile selects which *sections* a
document emits; it never adds a technology commitment for an empty slot (UC-DR2).

Template model: **common core + profile sections + concern-triggered sections.**
- `mu-prd` replaces its fixed lightweight/full section list with core + profile.
- `mu-arch` replaces the flat `architecture-assessment.md` project-type table with profile-driven diagram/section selection.
- Concern triggers are unified and extended: reuse `nfr-checklist.md`'s trigger table, add the two missing concerns #63 names (AI/model/tool boundary; accessibility/localization), and let mu-prd/mu-arch scan them (UC-D5).

### D2. Use-case spine (UC-D3)

Use-case identifiers become the traceable spine flowing PRD → architecture →
plan → tests → coverage. mu-scope already owns per-feature UCs (`scope.md`
template). This design keeps mu-scope as the UC author but requires the
architecture set and plans to reference stable UC-IDs, so coverage review (#62's
review-coverage) traces them end to end.

### D3. Domain modeling folded in (UC-D6, UC-D7)

- mu-model's method (`domain-model.md`, `state-modeling.md`) is referenced inline by mu-prd (§ object model) and mu-arch (state realization), so modeling runs *inside* those flows.
- mu-model becomes an *optional explicit tool*, not a routing gate: bootstrap no longer points requirements work at `/mu-model` first; mu-prd/mu-arch run the qualification + change-first questioning method themselves and write to the `domain_model` member.
- The **stateless degradation rule** (`domain-model.md:47`, `state-modeling.md`) is preserved verbatim: no spine survives → organize by data flow, do not invent a centre (UC-D7).

### D4. Living defaults + iteration (UC-D1, UC-D2, UC-D8)

- Absent canonical doc → create it at the manifest path and record the path in project memory; present → update in place + append History/Changelog.
- Requirement change mid-architecture re-enters the update stance on the living docs; a parallel dated document is not spawned merely because time passed (UC-D8, absorbing #40's remaining slice).

### D5. Examples (UC-D9, UC-DR3)

Package two worked examples in `knowledge/examples/`: a DevMuse-dogfood slice and
a broad reference case exercising state, transactions, concurrency, async, tenancy,
public APIs, and operations. They are packaged knowledge, never mistaken for this
repo's own product truth (UC-DR3).

## Reverse cases (must NOT happen)

- UC-DR1: updating one area erases unrelated current PRD/architecture context — prevented by update-in-place section merges, never whole-file rewrites.
- UC-DR2: a profile adds a technology/product commitment for an empty slot — prevented by "emit section only when profile/concern fires."
- UC-DR3: worked examples mistaken for this repo's product truth — prevented by packaging under `knowledge/examples/` with an explicit banner.
- UC-DR4: historical dated artifacts retro-edited — prevented; `artifact-succession.md` still governs the frozen corpus, untouched.

## Staged delivery

Because this touches mu-prd, mu-model, mu-arch, mu-wiki, five knowledge
principles, templates, `CONTEXT.md`, bootstrap, the manifest principle, tests,
and CN twins, it lands in reviewable stages:

1. **Foundation (this round):** reframe `CONTEXT.md` as the manifest-declared `domain_model` member (wording only, no move); add `project-profiles.md`; extend concern triggers with the two missing concerns; change mu-model from routing gate to optional tool with its method referenced inline by mu-prd/mu-arch. Update bootstrap, CLAUDE.md, README(+CN), regenerate adapters, and update routing/platform tests.
2. **Composition:** rewrite the mu-prd section model and mu-arch project-type table to profile + concern composition; add the PRD template.
3. **Examples + traceability:** package the two examples; wire UC-ID traceability through the architecture set and coverage review.

Each stage follows mu-write-skill's test-before-deploy and updates the CN twins.

## Out of scope

- Case registry and `mu-setup` (#68).
- Removing `mu-model` entirely (kept as optional tool; revisit after #47 closes).
- Making dated design specs living (they stay historical per #62's routing).

## History

| Date | Commit | Change |
|---|---|---|
| 2026-08-24 | (this revision) | Initial design: living architecture set via the existing manifest `artifacts.architecture` members, profile+concern composition, mu-model folded from gate to inline method, staged delivery |
