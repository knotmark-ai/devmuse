# Case Registry traceability

**When to use:** the pipeline skills (`mu-prd`, `mu-scope`, `mu-arch`, `mu-plan`,
`mu-code`, `mu-review`) when a project has a case registry (a v2 manifest with a
`cases:` block, set up by `/mu-setup`). It defines how each stage references
registry assets by **stable ID** so a use case is traceable from requirement
through test result. Where no registry exists, stages behave as before — this is
additive, never a gate.

## The five assets and their stable IDs

The registry holds five asset kinds with distinct lifecycles, related
many-to-many (never one generic record moving through stages):

```text
Product Use Case  →  Rule  →  Acceptance Example  ↔  Test Case  →  Test Result
```

Every asset has a stable DevMuse ID (`duc:`, `rule:`, `ex:`, `tc:`, `tr:`) that
survives provider changes, repo moves, and Scope closure. Downstream stages
**reference the ID**, never copy the asset's prose.

## The traceability spine

- **`mu-prd`** creates/updates Product Use Cases and Rules in their canonical
  provider (repository files or a requirements tool), each with a stable ID.
- **`mu-scope`** references the affected product cases by ID and owns the
  delivery-specific delta — acceptance examples, edge/error/reverse coverage, the
  regression boundary. Closing a Scope never deletes the long-lived cases it
  referenced (UC-CR1).
- **`mu-arch`** maps the selected cases to domain invariants, contracts, and
  technical realization, citing case IDs — it does not restate requirement prose.
- **`mu-plan` / `mu-code`** carry the case IDs through tasks and tests, so a test
  records which case IDs it exercises.
- **`mu-review`** (review-coverage) traces each case ID to a test and result, and
  marks coverage **stale** rather than merely "covered" when a bound revision
  moved (below).

## Runtime and staleness

Claude skills invoke `references/devmuse/runtime/project-registry/cli.mjs`;
portable skills invoke their vendored
`references/devmuse/runtime/project-registry/cli.mjs`. It performs no tracked
write.

Coverage is **result-anchored**: a Test Result records the revisions of the
requirement/example, the test case, and the code it ran against. Run the CLI's
`staleness` command with the result's bound revisions and the assets' current
revisions; any bound axis whose current revision differs is **stale**, so a
requirement or test that moved after its last run never reads as "covered"
(UC-C10). An asset revision is the content hash the runtime computes — no manual
hashing.
