# Product-Level State Modeling

**When to use:** Referenced by the modeling pass and by mu-prd (Product Object Model tool) when a product has business objects with lifecycles, and by mu-arch (State Machine Diagrams) when inheriting state names. Distilled from a team PRD standard (the 对象—状态—迁移—不变量 loop) and the aflaj PRD retrospective.

**Where the output goes:** the machine belongs to the domain model — `CONTEXT.md`, not the artifact of whichever skill happened to run it. See Layer Boundaries.

## The Lifecycle Sentence

One sentence exhausts an object's behavior. For each business object, walk it until every blank is filled:

> **Who**, under **what preconditions**, performs **what action** on **the object**; the object moves from **which state** to **which state**; and what does the user observe on **failure, duplicate submission, concurrent action, and timeout**.

Any blank you cannot fill is a fork (grilling.md) — put it to the user with a recommendation. This sentence is the fork *detector*; grilling is the fork *converger*.

## Business State or Not?

Only business states enter the state model. Classify before modeling:

| Type | Definition | Example | Home |
|---|---|---|---|
| **Business state** | Gates allowed actions; changes via business events | pending-approval, confirmed, cancelled | State model |
| Attribute | Describes the object, never gates its lifecycle | room type, channel, priority | Feature spec fields |
| Computed | Derived from other fields at read time | is-overdue, time-remaining | Note the formula where used; never a stored state |
| Page state | Affects only what the screen shows | loading, empty, network error | Wireframes section |
| Sub-object state | A different object's lifecycle | payment status inside an order; a revision inside an article | Its own state model — one machine per object |
| Mapping | A relation between objects resolved at read/query time | anonymous→identified identity merge | Its own mapping design — never a state field |

The absence of an object is not a state: creation is the entry event, not a transition out of a phantom "not-exists" state.

The most common modeling bug: several objects' lifecycles compressed into one state field. A group-buy has the group's machine AND each participant order's machine — model them separately, then note how they couple (which transitions in one trigger transitions in the other).

## The Model (per object)

1. **States** — a closed list, every state with a precise entry condition. An "etc." or "等" in a state list means the model isn't done.
2. **Transitions** — table: current state × event (user action / clock / external callback) × actor → next state. Deadlines and windows carry explicit boundary semantics: inclusive or exclusive, measured by which clock.
3. **Invariants** — rules true in every state ("one live booking per room-slot"). Each names what a violating attempt gets: rejected, queued, overridden.
4. **Terminal states** — marked explicitly. Terminal means no exits: reviving a cancelled booking is a new booking, unless the model adds an explicit revival transition.
5. **Guarantees** — user-visible promises that survive retries and races: "double-clicking 开团 never creates two groups", "the loser of a last-slot race is refunded and told so". Guarantees are product rules; *how* they are kept (idempotency keys, locks) is mu-arch's job.

## Negative Space

Classification rulings are output, not scratch work — a reader of the model cannot distinguish "considered and rejected" from "never considered" unless both are persisted:

6. **Excluded candidates** — one table for the whole model: every candidate classified out (computed / attribute / page state / mapping / object-absence), its category, a one-line reason, and where it lives instead. This is the defense against the architecture layer materializing a computed value as a stored state (an `is_hot` flag flipped by a cron). If implementation later genuinely needs a stored state for one — say an async merge needs a pending step — extend this model; states are never added ad hoc in the implementation layer.
7. **Non-transitions** — per machine, note the events easily misread as state changes (a value-layer correction, a derived credibility shift, an edit allowed within a state): what they actually touch, and that the state stays put.

## Self-Check

Run before the model is approved; ask any unanswered item as an A/B question with a recommendation:

1. Any state with no way in — or no way out that isn't marked terminal?
2. Any terminal state the product secretly expects to modify later?
3. Any event that can fire in more than one state — is the outcome defined per state?
4. Any transition without an actor (who or what clock moves it)?
5. Any deadline or window without inclusive/exclusive semantics?
6. Any async external operation (refund, payout, notification, webhook) without a user-visible failure state — or an explicit exclusion?

## Steady State First

Design the steady-state machine before designing onboarding: onboarding is the machine's t=0 traversal, not a separate flow. Symptom of getting it backwards: an "onboarding wizard" whose steps duplicate features that already exist elsewhere in the IA.

## Layer Boundaries

The model's **facts** and the model's **presentation** live in different places. Whichever skill runs the model, the machine itself lands in one home:

| Output | Home | Why |
|---|---|---|
| States · transitions · invariants · terminal states · guarantees | **`CONTEXT.md` §6** | Domain facts. Stale here is a bug; every downstream layer cites them |
| Excluded candidates · non-transitions | **`CONTEXT.md` §6**, with the machine | Normative, not commentary — they are the guardrail against the implementation layer materializing a computed value as a stored state |
| Why the model changed (promotion, retirement, correction rounds) | **`CONTEXT.md` §7 History** | Decision record; a retirement without its reasoning gets re-litigated |
| How states are displayed (labels, badges, empty states) | Feature specs | Product decision |
| How the machine is realized (idempotency keys, transactions, timers) | Design spec | Implementation |

- **mu-prd** runs this model when a product feature reveals an object with a lifecycle — and writes the machine **into `CONTEXT.md`**, not into a PRD companion file. The PRD cites state names by reference and never restates the machine.
- **mu-scope** enumerates concrete use-case paths through these transitions — every transition earns at least one UC.
- **mu-arch** implements the machine, inheriting state names verbatim **from `CONTEXT.md`**. Implementation-only states the product layer never sees still extend the domain model — add them to `CONTEXT.md` rather than renaming domain states or keeping a private list.

The single home is what makes the names hold: a machine that exists in two files drifts on the first correction that only lands in one of them.
