# Project Profiles

**When to use:** `mu-prd` and `mu-arch`, when composing a document's sections. A
project is classified along **four independent, composable axes** — a product
profile, one or more interaction surfaces, one or more implementation profiles,
and concern triggers. Each axis contributes sections; the document is their
deduplicated union. Classify once (here); `mu-arch` reuses the same axes for
diagram selection (@architecture-assessment.md).

Keeping the axes distinct is the point: "a CLI developer tool backed by a
stateful service with a public API" is a *product* (developer tool) with an
*interaction surface* (CLI + public API) and an *implementation* (stateful
service) — three answers, not one label. Collapsing them forces invented
sections.

## The composition rule

A document is **common core + the sections activated by each axis + concern-
triggered sections**. Nothing else. Three hard rules:

- **No axis commits to a technology or product for an empty slot.** A
  stateful-service implementation profile does not invent a database, a queue, or
  a tenancy model the project has not shown; a `public-api` surface does not
  invent versioning the project has not committed to. Emit a section only when
  the project's own evidence populates it — an empty slot is a question to the
  user, never a default answer (UC-DR2).
- **Axes compose; they are not mutually exclusive labels.** Take the union of the
  activated axes' sections, deduplicated. A data/AI product served over a public
  API is `data-ai` (product) + `api` (surface) + the `ai-tool-boundary` concern.
- **A classification is a lens, not a gate.** Misclassifying costs an extra or
  missing section, never a blocked workflow. When unsure between two, take the
  union and let the user prune.

## Axis 1 — Product profile (what it *is* to whoever consumes it)

| Product | The project is… | Sections it adds (beyond core) |
|---|---|---|
| `library-sdk` | a library or SDK others build against | public API surface, versioning/compat contract, integration examples |
| `developer-tool` | a tool developers operate (CLI, plugin, build tool) | command/task surface, config discovery, developer workflow |
| `end-user-app` | a product real users operate | information architecture, core user flows, key screens, tiering rules |
| `data-ai` | a data or AI/model product | data flow and lineage, model/tool boundaries, evaluation and guardrails, cost/latency envelope |

## Axis 2 — Interaction surface (how it is reached)

| Surface | Adds |
|---|---|
| `cli` | command/flag grammar, exit-code and output contract |
| `gui` | information architecture, key screens, accessibility notes |
| `api` | endpoint/contract surface, request/response shapes, error model |
| `event` | event/message catalog, delivery and ordering guarantees |
| `headless` | no user-facing surface; invoked by other systems only |

## Axis 3 — Implementation profile (how it is built)

| Implementation | Adds |
|---|---|
| `stateful-service` | domain state machines, consistency/transaction boundaries, operational surface |
| `event-driven` | consumer lifecycles, idempotency, ordering/redelivery |
| `infrastructure` | resource/topology model, failure domains, SLOs, upgrade/rollback |
| `plugin-agent` | host-relationship boundary, invocation/routing contract, capability/permission model |
| `stateless` | organized by data flow; **no** central-entity state machine invented (see Stateless degradation) |

## Axis 4 — Concern triggers

Conditional sections fire from evidence, not from a slot. Scanned from
@nfr-checklist.md: transactions, concurrency, async delivery, multitenancy,
public APIs, local files, **AI/model/tool boundary**, **accessibility &
localization**, deployment, SLOs. A concern with no firing trigger emits nothing.

## Core sections (every document)

Purpose and users · scope and non-goals · the use-case spine (stable UC-IDs,
authored by mu-scope, referenced everywhere downstream) · open questions ·
History/Changelog. The domain model (terms, invariants, state machines) is a
member of the architecture set (@domain-model.md), not a per-document section —
documents cite it and never restate it.

## Stateless degradation

A `stateless` implementation, or any project whose lifecycle spine does not
survive verification (@state-modeling.md, @domain-model.md), organizes by data
flow and does **not** invent a central entity, a state machine, or a transaction
section to fill a slot — the domain-model rule, lifted to document composition
(UC-D7).

## Worked examples

Consult the packaged examples (@../examples/README.md): `reference-booking.md` is
a broad `end-user-app` + `stateful-service` + `api` case exercising state,
transactions, concurrency, async delivery, multitenancy, a public API, and SLOs;
`reference-ai-plugin.md` is a multi-axis `developer-tool` + `plugin-agent` +
`data-ai` case exercising the AI/tool boundary, host capability model, and
event surface. The maintained DevMuse dogfood domain model is the repository's
own `CONTEXT.md`. These are illustrative knowledge, never this repository's own
product truth (UC-DR3).
