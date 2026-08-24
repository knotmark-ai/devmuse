# Worked examples (packaged knowledge)

> **These are illustrative examples, not this repository's own product truth.**
> They exist so an agent or a user can see the intended shape of profile- and
> concern-composed output. Never treat a file here as DevMuse's canonical PRD,
> domain model, or architecture, and never cite it as evidence for real work
> (UC-DR3).

Two examples:

- **`reference-booking.md`** — a broad reference case: a meeting-room booking
  service that exercises state (a reservation lifecycle), transactions
  (double-booking prevention), concurrency (a boundary-instant race),
  asynchronous delivery (a confirmation email), multitenancy (per-org rooms), a
  public API, and operations (SLOs). It shows how a `stateful-service` profile
  composes with the transaction, concurrency, async-delivery, multitenancy,
  public-API, and SLO concern triggers.
- The maintained DevMuse dogfood domain model is the repository's own
  [`CONTEXT.md`](../../../CONTEXT.md) — a real, living `stateful`/`plugin-agent`
  model kept in sync with the code, referenced here rather than copied so it
  cannot drift.
