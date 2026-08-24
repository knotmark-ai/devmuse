# Project Profiles

**When to use:** `mu-prd` and `mu-arch`, when composing a document's sections.
A profile answers "what *kind* of thing is this project?" and selects which
sections a PRD or architecture document emits. Profiles compose with
**concern triggers** (@nfr-checklist.md) — the profile decides the document's
spine; concerns add conditional sections when their evidence fires.

## The composition rule

A document is **common core + profile sections + concern-triggered sections**.
Nothing else. Three hard rules:

- **A profile never commits to a technology or product for an empty slot.** A
  "stateful service" profile does not invent a database, a queue, or a tenancy
  model the project has not shown. Emit a section only when the project's own
  evidence populates it. (An empty slot is a question to the user, never a
  default answer.)
- **Profiles compose; they are not mutually exclusive labels.** A data/AI system
  exposed over a public API is both `data-ai` and `service` with the
  `public-api` concern; it takes the union of their sections, deduplicated.
- **A profile is a lens, not a gate.** Misclassifying the profile costs an
  extra or missing section, never a blocked workflow. When unsure between two,
  take the union and let the user prune.

## The profile set

The smallest set that produces materially different documents. Prove a new
profile earns its place with a test before adding it; collapse two that emit the
same sections.

| Profile | The project is… | Spine sections it adds (beyond core) |
|---|---|---|
| `library-sdk` | a library or SDK others build against | public API surface, versioning/compat contract, integration examples; no UI, no deployment |
| `cli-devtool` | a command-line or developer tool | command/flag surface, exit-code and output contract, config discovery; usually no server state |
| `client-app` | a user-facing application (web/mobile/desktop) | information architecture, core user flows, key screens, tiering rules |
| `stateful-service` | a service that owns a lifecycle-bearing datastore | domain state machines, consistency/transaction boundaries, API contract, operational surface |
| `event-driven` | a system coordinated by events/messages | event catalog, delivery guarantees, ordering/idempotency, consumer lifecycles |
| `infrastructure` | infrastructure or a platform others deploy on | resource/topology model, failure domains, SLOs, upgrade/rollback path |
| `plugin-agent` | a plugin, extension, or agent workflow inside a host | host-relationship boundary, invocation/routing contract, capability and permission model |
| `data-ai` | a data or AI/model system | data flow and lineage, model/tool boundaries, evaluation and guardrails, cost/latency envelope |

## Core sections (every profile)

Purpose and users · scope and non-goals · the use-case spine (stable UC-IDs,
authored by mu-scope, referenced everywhere downstream) · open questions ·
History/Changelog. The domain model (terms, invariants, state machines) is a
member of the architecture set (@domain-model.md), not a per-document section —
documents cite it and never restate it.

## Worked examples

To see profile + concern composition on a real shape, consult the packaged
examples (@../examples/README.md): `@../examples/reference-booking.md` is a broad
`stateful-service` reference case exercising state, transactions, concurrency,
async delivery, multitenancy, a public API, and SLOs; the maintained DevMuse
dogfood domain model is the repository's own `CONTEXT.md`. These are illustrative
knowledge, never this repository's own product truth (UC-DR3).

## Stateless degradation

A profile that would add a state-machine section only does so when a lifecycle
spine survives verification (@state-modeling.md, @domain-model.md). A stateless
or pure-transformation project organizes by data flow and does **not** invent a
central entity to fill the slot — the same rule the domain model already applies,
lifted to document composition.
