# Scope: Fold routing into bootstrap (retire mu-route)

> **Date:** 2026-07-17
> **Source:** Routing review during 2026-07-16 retro follow-up — user decision "B 方案走管线"

## Context

- mu-route was built as a standalone skill during the April routing-system iteration, when routing logic churned and needed isolated testing. The routing table has been stable for ~3 months.
- Current cost per routed task: a ~186-line SKILL.md load plus one Skill-tool round trip before the actual work skill loads; plus mu-route's description permanently in the skills list; plus a must-agree sync pair (bootstrap category lists ↔ mu-route lists) recorded in CLAUDE.md.
- Fold the essential router (verb lexicon, decision table, confidence behavior, signals) into `rules/bootstrap.md` (target ≤135 total lines), retire `skills/mu-route/`.
- Architecture note: routing moves from the skills/ layer to the rules/ layer — consistent with the four-layer definitions (rules = always-on decision guidance).

## Quick Probe Results

- Files involved: `rules/bootstrap.md` (89L), `skills/mu-route/SKILL.md` (186L, to retire); 15 files reference mu-route — mechanics (bootstrap), contract docs (CLAUDE.md, CONTEXT.md, README, README_CN), generated wiki (4 pages), passing mentions (mu-arch, mu-biz, mu-explore, mu-wiki SKILL.md, docs/explore/_overview.md)
- Fan-out: 0 programmatic invocations of mu-route from other skills — only bootstrap's instruction references it; retirement breaks no call chain
- Test coverage: no tests/ coverage of routing; de-facto regression net = the 8-scenario bootstrap battery + 5-scenario review-row battery built this month
- Risk signal: medium (touches the only always-on file + 15 reference sites; behavior regression bounded by scenario batteries)

## Use Cases

### Happy Paths
- UC-1: When an unprefixed in-domain message arrives with no active skill, Then bootstrap's embedded routing table classifies intent and silently invokes the target skill (high confidence) — no mu-route round trip
- UC-2: When intent is classifiable but ambiguous, Then bootstrap directly issues the one-line check (medium) or full proposal (low)
- UC-3: When the message matches on-demand language, Then respond with a pointer to the slash command; never invoke
- UC-4: When the user types `/mu-*`, Then direct invocation bypasses the routing table (unchanged)
- UC-5: Given an active skill, When intent shifts category (e.g., debug→fix), Then re-classify from the in-context table — zero reload
- UC-6: When the message is out of domain, Then respond normally without routing (unchanged)

### Edge Cases
- UC-7: When multiple intent verbs fire, Then take the primary action per fix > review > reshape > create-feature > implement > understand, at medium confidence
- UC-8: When in-domain with no verb match, Then Explore safe default (former R7)
- UC-9: When intent is implement but no spec artifact exists on disk, Then route Design-tech (repo-state signal preserved in bootstrap)
- UC-10: When the message plausibly matches an installed non-DevMuse skill, Then propose delegating to it (former R6.5)

### Error Cases
- UC-E1: When routing-signal computation fails (git errors, unreadable files), Then do not fabricate signals; ask the user for the opening move (former ER-R1)
- UC-E2: When repo state is pathological (empty repo, shallow clone), Then skip the table and ask the user directly

### Reverse Cases (must NOT happen)
- UC-R1: When the 8+5 scenario batteries re-run against the folded bootstrap, Then every decision is identical to pre-fold
- UC-R2: When any scenario runs, Then on-demand skills remain model-uninvocable (harness disable-model-invocation untouched)
- UC-R3: When the fold completes, Then bootstrap totals ≤135 lines — if over, cut proposal wording, not behavior
- UC-R4: When `skills/mu-route/` is deleted, Then repo-wide grep finds no dangling reference; skill-count docs return to 13; CLAUDE.md canonical map names bootstrap as routing's only home

## Conflicts
- ⚠️ CONFLICT: UC-3 vs UC-R4 — CONTEXT.md's "Opening move" entry defines the term as what *mu-route* selects; retiring mu-route orphans the subject.
  - Resolution: Option A (user, 2026-07-17) — reword the entry's subject to "the routing rules (bootstrap)"; the term itself survives.

## Non-Functional Constraints
- [Tokens] bootstrap ≤135 lines total (UC-R3); every routed task saves ≥ ~145 lines vs status quo
- [Predictability] same process every run: the folded table must preserve rule ordering (first match wins) and confidence tiers

## Constraints & Assumptions
- The 8+5 scenario batteries are the acceptance oracle; current behavior is the spec
- Skill edits require /reload-plugins to take effect in-session (memory: reload-plugins-after-skill-edits)
- Wiki pages (4 affected, incl. workflow-and-routing.md) are regenerated via /mu-wiki update after the fold lands — not hand-edited

## Out of Scope
- Changing any routing DECISIONS (intents, targets, confidence semantics) — this is a relocation, not a redesign
- Native description-based routing (option C) — rejected during review: loses repo-state signals and confidence proposals
- CN twin translation lag beyond the same-commit contract files (README_CN updates in-commit; wiki CN does not exist)

## Impact Analysis
- Affected modules: rules/bootstrap.md (rewrite routing section), skills/mu-route/ (delete), CLAUDE.md, CONTEXT.md, README.md + README_CN.md (Router row + prose), mu-arch/mu-biz/mu-explore/mu-wiki SKILL.md passing mentions, docs/explore/_overview.md (area-local Axis-* row)
- Existing tests that may break: none in tests/; scenario batteries re-run manually
- Migration needs: no — plugin skills glob (`./skills/`) auto-drops the deleted directory; users need /reload-plugins
