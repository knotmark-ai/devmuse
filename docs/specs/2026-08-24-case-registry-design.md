# Project-wide case registry and mu-setup-driven asset routing — design

> **Date:** 2026-08-24
> **Status:** Reviewed (independent design review passed; migration-safety finding and advisories folded in)
> **Requirements Reference:** #68 (UC-C1..UC-C10, UC-CR1..UC-CR5)
> **Builds on:** #62 (project-context: identity, manifest v1, Git-common cache, capability/authorization), #63 (living architecture set, profiles)
> **Relates to:** #40 (iteration), #47 (mu-model create), #66 (mu-retro removed — its registry role is dropped)

## Goal

Give every project one **logical, project-wide case registry** with stable
identities and revisions, independent of whether each asset kind's canonical data
lives in a SaaS tool, in repository files, or in an explicitly selected local
database. Add `mu-setup` as the idempotent entry point that discovers,
initializes, validates, and evolves the project's durable artifact routing and
preferences.

This connects #62's project-context foundation to #63's living, use-case-driven
documents: a dated Scope Issue is a delivery-specific change set *over* the
registry, never the canonical home of long-lived product or test cases.

## Domain model (authoritative terms)

The registry is one logical view over five asset kinds with **distinct
lifecycles**, related many-to-many — not one generic `UC` record moving through
stages (UC-CR2). The behavioral chain:

```text
Product Use Case  →  Rule  →  Acceptance Example  ↔  Test Case  →  Test Result
```

| Asset kind | What it is | Typical canonical home |
|---|---|---|
| **Product Use Case** | actor-visible intent and its consequence | PRD / requirements provider (Jira, repo) |
| **Rule** | a product rule constraining a use case | PRD / requirements provider |
| **Acceptance Example** | a concrete pass/fail example of a rule | repository (Gherkin/examples) or a test-mgmt tool |
| **Test Case** | an executable or manual test procedure | test-management provider (Xray, qTest…) or repo |
| **Test Result** | one execution's verdict, bound to revisions | CI / test-mgmt provider |

Every asset carries: a **stable DevMuse identity** (survives provider changes,
repo moves, and Scope closure — UC-CR1), a **revision**, **provenance**,
**ownership**, **status**, and typed **relations** to other assets. A
**locator** maps a DevMuse identity to its current provider-specific address.

**Two planes, kept separate:**

- **Behavior data plane** — the registry assets and their relations (above).
- **Control plane** — durable project policy: which provider is canonical for
  each asset kind (the **asset router**), plus schema version and preferences.

## Storage tiers (do not call all of this "memory")

| Information | Home | Contract |
|---|---|---|
| Project identity, canonical artifact locations, provider routes, team-approved policy | **Tracked, versioned project configuration** (`.devmuse/project.yaml`, extended) | Reviewable in Git; the source of authority |
| Personal defaults across projects | **User-level configuration** | Never overrides team project policy (UC-C9) |
| Worktree pointers, capability probes, sync cursors, interrupted-operation recovery | **Disposable Git-common cache** (#62's `project-context.v1.json`) | Hints/evidence only; rebuildable |
| Current delivery's delta, acceptance obligations, owners, blockers | **Scope Issue or explicit local fallback** (#62) | Selects/changes registry assets; not their long-term home (UC-CR1) |
| Provider credentials and tokens | **Host/provider credential system** | Never in project config or cache (UC-CR3) |

This reuses #62's tiers verbatim; the registry adds only the **asset router** to
the tracked configuration and **sync cursors** to the disposable cache.

## Control plane: the asset router (manifest evolution)

The #62 manifest is `schema_version: 1` with a fixed key set. The registry adds a
`cases:` routing block. Because v1 forbids unknown keys, this is an **explicit
schema step to v2** — v1 is never reinterpreted with undeclared keys (UC-CR:
"Manifest evolution is versioned; v1 is never reinterpreted with undeclared
keys").

```yaml
schema_version: 2          # v2 adds `cases:`
# ... all v1 members unchanged (project, collaboration, artifacts) ...
cases:
  registry: repository     # where the logical registry's normalized records + edges live
  routes:
    product_requirements: jira
    rules: jira
    acceptance_examples: repository
    test_cases: xray
    test_results: ci
```

Routing is **per asset kind** because requirements, test design, and execution
often live in different systems (UC-C3). Any kind with no configured provider
defaults to `repository`. `registry` names where DevMuse keeps the normalized
references, revisions, and cross-provider edges that have no provider-owned home.

**Cross-version behavior — and a required parser change (do not claim
"reuses #62 exactly").** Both outcomes below are read-only and never rewrite the
file, so there is no data-loss risk either way. But the shipped v1 parser
(`manifest.mjs`) rejects an unknown key *during* line iteration (line 108/112)
*before* it reaches the `schema_version` test (line 119). Verified empirically: a
real v2 manifest — which always carries `cases:` — fed to today's v1 reader
returns `unknown-key`, not `unsupported-schema`. That reads like corruption, not
"your DevMuse is older than this manifest," which is exactly the signal UC-C8
(an older checkout meeting a newer manifest) and AC#9 ("safe under unsupported
schemas") need. **Stage-1 task:** reorder the parser to test `schema_version`
before the unknown-key screen, so any future-versioned manifest degrades to
`unsupported-schema` regardless of the new keys it carries. This is a small, safe
change to shipped foundation code and must be scoped in stage 1, not assumed.
`mu-setup` is the only writer that performs a v1→v2 migration, and only after
presenting it (below).

## Provider and local-backend contract

- The registry is **logical**; it does not require every project to run the same
  physical database.
- When an external SaaS owns an asset kind, **that provider is canonical for the
  payload**. DevMuse stores normalized references, revisions, and any
  cross-provider edges the provider cannot hold — never a drifting prose copy.
- When no provider is selected, DevMuse supplies a **complete repository-backed
  local implementation** (UC-C2), fully functional with no SaaS account and no
  optional database runtime (acceptance criterion).
- **Temporary unavailability ≠ "no provider"** (UC-C6). An outage records a
  pending synchronization or stops for a decision; it never silently forks a
  second canonical local record (UC-CR: no silent duplicate authority).
- **Provider migration is explicit** and preserves old→new ID mappings and
  provenance (UC-C7). Stable DevMuse identities survive it.
- **Test results bind** the requirement/example revision, test revision, code
  revision, and environment, so stale coverage is detectable (UC-C10).

### Cross-provider edge ownership (fork resolved)

A relation whose endpoints live in different providers (e.g. a Jira requirement ↔
an Xray test) usually has **no provider-owned home**. Decision: **DevMuse's
repository-backed registry is canonical for any edge no single provider can
store.** Edges that a provider *can* represent natively (e.g. an Xray test
covering an Xray requirement) stay provider-owned and are mirrored as normalized
references only. This keeps exactly one home per fact (UC-CR2) without forcing all
edges into one provider.

### Local backend (fork resolved)

**Default canonical local backend: Git-reviewable files.** Rationale:

| Criterion | Git-reviewable files | SQLite | Hybrid |
|---|---|---|---|
| Merge / multi-worktree | native 3-way merge, human-resolvable | binary, conflicts unresolvable in review | files canonical + db derived |
| Review | diffs in PRs (#62 fit) | opaque blob | diffs review, db ignored |
| Portability | no runtime | needs SQLite | no runtime for truth |
| Query cost | linear scans | indexed | indexed via derived db |
| Recovery | rebuild from Git | restore file | rebuild db from files |

Decision: **canonical registry = Git-reviewable files** (one file per asset kind,
or per asset for large sets, under a `registry/` tree the manifest points at).
**SQLite is an optional, derived query index** — built from the files, never the
source of truth, and safe to delete/rebuild. It must not silently replace shared,
mergeable project truth (explicit issue constraint). This mirrors #62's
tracked-files-own-durable-truth principle (`project-context.md`: "tracked files
own durable project truth") and #63's living-doc default. (The release engine's
local-first ADR-0001 is a separate record; the three registry-specific ADRs below
are new.)

**Revision model (stage-1 blocker for UC-C10 / AC#11).** Staleness cannot be
computed until "revision" is defined for the Git-reviewable backend. Proposed and
to be locked in stage 1: a **content-hash revision** per asset (SHA-256 of the
asset's normalized fields), monotonic per file via the Git history, so a revision
is stable across checkouts and needs no central counter. A **Test Result is the
anchor**: it records the revisions of the requirement/example, the test case, the
code (commit), and the environment it ran against. Coverage is **stale** when any
of those bound asset revisions differs from the asset's *current* revision — the
result-revision axis is the comparison basis, and `environment` is an additional
recorded axis, never a substitute for it (AC#11 lists requirement/example, test,
code, and result revisions; all four are compared against the latest result).

### Provider capability model (design-time; validate before shipping any adapter)

A provider-neutral capability matrix drives what DevMuse can rely on per tool.
The columns are the operations the registry needs; the rows are the researched
tools. **This table is a design-time model built from public API knowledge and
must be validated against each live provider before its adapter is marked
supported — no implied parity, per the #62/#54 precedent.**

| Capability | Xray | qTest | Qase | PractiTest | TestRail | IBM ELM/DOORS |
|---|---|---|---|---|---|---|
| Requirements read | via Jira | ✓ | partial | ✓ | partial | ✓ (DOORS) |
| Test cases CRUD | ✓ (GraphQL/REST) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Runs/results | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Custom links/traceability | via Jira issue links | ✓ | limited | ✓ | limited | ✓ (native) |
| Revision reads | issue history | ✓ | limited | ✓ | limited | ✓ (baselines) |
| Conditional write (optimistic) | Jira version | partial | unknown | unknown | limited | ✓ |
| Web + API availability | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Where a provider lacks revision reads or custom links, DevMuse's local registry
holds those normalized facts (edges, revision cursors) as canonical — the same
cross-provider-edge rule above.

## `mu-setup` contract

`mu-setup` is the idempotent project initialization/maintenance workflow. The
canonical behavior lives in one contract; surface naming may vary by host
(`/mu-setup` or equivalent). It:

1. Resolves project identity and reads the current versioned configuration (reuses #62's resolver).
2. Discovers existing PRD, architecture, test code, case catalogs, CI, and available provider integrations.
3. Infers facts where evidence suffices; asks only about unresolved choices that change canonical ownership.
4. **Presents the proposed configuration or migration before any tracked write** (UC-C5 idempotent, no destructive rewrite).
5. Initializes the repository-backed registry when no external provider owns the assets (UC-C2).
6. Validates provider read capability and local backend integrity **without treating current capability as standing write authorization** (reuses #62's capability/grant split — UC-CR3).
7. Is safe and idempotent on rerun; supports status, update, schema migration, and provider migration paths.
8. Never stores credentials, cached authorization, or provider tokens in tracked configuration (UC-CR3).
9. Never replaces a temporarily unavailable configured provider with a new local authority without explicit approval (UC-C6).

### State machines

**Setup lifecycle:** `Uninitialized → (discover) → Proposed → (approve) → Initialized → (rerun) → Reported`; a schema-version bump enters `MigrationProposed → (approve) → Migrated`. Every transition to a tracked write passes the presentation gate.

**Provider adoption / outage / migration (per asset kind):**
`Local → (adopt provider, approved) → ProviderCanonical`;
`ProviderCanonical → (outage) → PendingSync` (never → Local without approval);
`ProviderCanonical → (migrate, approved) → ProviderCanonical'` preserving old→new ID map + provenance.

## Shape decision (fork resolved)

**`mu-setup` is a thin skill over a shared setup contract plus a `project-registry`
runtime**, exactly paralleling #62's `project-context`:

- `plugin/runtime/project-registry/` — deterministic modules: manifest v2 parse/migrate, registry file read/write (Git-reviewable), locator/identity, revision + staleness computation, optional SQLite index build. Vendored into consuming skills and drift-checked.
- `plugin/skills/mu-setup/SKILL.md` — the entry-point workflow (discover → propose → approve → write), reusing `project-context` for identity/cache/authorization.
- Not a bootstrap operation (too heavy for every session start) and not only a command (needs a skill's dialogue for the unresolved-choice questions). One canonical contract, host-native surfaces.

## Skill responsibilities (mapping onto #63)

- `mu-prd` creates/updates Product Use Cases, Rules, and actor-visible consequences in their canonical provider (repo or requirements tool).
- `mu-scope` references existing product cases and owns the **delivery-specific delta**, acceptance examples, edge/error/reverse coverage, and regression boundary — a change set over the registry (UC-C4).
- `mu-arch` maps selected cases to domain invariants, contracts, components, and technical realization without copying requirement prose.
- `mu-plan`, `mu-code`, `mu-review` preserve references through tasks, coverage, verification, and delivery evidence; coverage review marks evidence **stale** when a bound revision changed (UC-C10).

## Reverse cases (must NOT happen)

- UC-CR1: closing a Scope deletes/archives the long-lived cases it referenced — prevented; Scope holds only the delta + locators, never the assets.
- UC-CR2: one generic `UC-*` conflates intent, examples, procedures, results — prevented by five distinct asset kinds with own lifecycles.
- UC-CR3: provider discovery or cached capability grants a remote write — prevented; reuses #62's fresh-probe-plus-grant gate.
- UC-CR4: setup invents a SaaS, database, or doc structure because the schema supports it — prevented; emit only what evidence populates (the #63 no-empty-slot rule).
- UC-CR5: existing dated scope/spec/plan artifacts retrofitted into the registry — prevented; they remain immutable history (#62 UC-G10).

## Testing strategy

- Registry entity/relation/revision/locator unit tests (Git-reviewable read/write, many-to-many edges, stale-coverage computation).
- Manifest v1→v2 migration + unsupported-schema handling (extends #62's manifest tests).
- Behavioral coverage for UC-C1..C10: existing-SaaS adoption, local-only, mixed-provider, outage (pending-sync not fork), migration (ID-map preserved), cross-worktree, personal-vs-project precedence, stale verification.
- Provider adapters tested with **fake provider binaries/fixtures** (no network), asserting normalized references and that an outage never forks local authority — mirroring #51's fake-binary discipline.
- The default local path passes with **no SaaS account and no SQLite runtime**.
- Generated-drift + adapter regeneration on any canonical change.

## Architecture Decision Records

- **ADR (new): Git-reviewable files are the canonical local registry; SQLite is a derived, rebuildable index only.**
- **ADR (new): Manifest evolves v1→v2 with an explicit `cases:` block; v1 is never reinterpreted; `mu-setup` is the only migrator, behind a presentation gate.**
- **ADR (new): cross-provider edges with no provider home are canonical in DevMuse's repository registry; provider-native edges are mirrored as references.**

## Staged delivery

Each stage below is **its own plan boundary** — a downstream planner scopes one
stage at a time (stage 2's local-only path alone, not the whole design), so this
one design spawns roughly four plans rather than one oversized plan.

1. **Research + contract:** finalize the provider-neutral entity/relation/revision/locator model (lock the content-hash revision definition above) and the validated capability matrix; lock manifest v2 schema; **reorder the v1 parser's schema-version test ahead of the unknown-key screen** so v2 degrades to `unsupported-schema`. (Closes the 8 research tasks.)
2. **Local registry runtime + mu-setup (local-only):** Git-reviewable backend, identity/locator, staleness, `mu-setup` discover→propose→approve→init, migration path. Full behavioral coverage for the no-provider path.
3. **Provider adapters:** one reference SaaS adapter (proposed: Xray via Jira, the researched primary) behind the capability model, with fake-provider tests; outage/migration state machines.
4. **Skill wiring + traceability:** mu-prd/scope/arch/plan/code/review reference registry assets by stable ID; coverage review marks staleness. CN twins + docs.

## Out of scope

- Building adapters for all six providers at once (prove the model with one; the rest follow the same contract).
- Replacing #62's project-context or #63's living-doc model (this composes onto them).
- A universal database mandate (the default is Git files).

## History

| Date | Commit | Change |
|---|---|---|
| 2026-08-24 | (this revision) | Initial design: logical case registry over five asset kinds; asset router as manifest v2; Git-reviewable canonical backend with optional SQLite index; cross-provider edges owned by DevMuse; `mu-setup` as a thin skill over a `project-registry` runtime reusing #62; staged delivery |
| 2026-08-24 | (this revision) | Review-hardening: corrected the v1→v2 degradation claim (a v1 parser returns `unknown-key`, not `unsupported-schema`, until the parser's schema-version test is reordered — now a scoped stage-1 task); defined the content-hash revision model and result-anchored staleness as the stage-1 blocker for UC-C10/AC#11; fixed the ADR-0001 mis-citation; marked each staged-delivery step as its own plan boundary |
