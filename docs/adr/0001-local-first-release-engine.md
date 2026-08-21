# ADR-0001: Keep release packaging local-first and workflows thin

> **Status:** Accepted
> **Date:** 2026-08-21
> **Deciders:** Jeff Yu

## Context

DevMuse needs reproducible runtime archives for several hosts, cross-platform
smoke tests, GitHub Releases, build provenance, and isolated registry
publication. The repository already treats canonical plugin content as the
source of truth, but its release behavior exists only as requirements in
GitHub issue #49. Putting packaging logic directly into workflow YAML would
make it difficult to run locally, difficult to test without GitHub, and easy
for host manifests to drift.

## Decision

We implement a dependency-free Node.js release engine that owns host file
selection, version validation, deterministic archive creation, checksums,
release manifests, and distribution-level smoke tests. GitHub Actions remains
a thin orchestrator: it invokes the same commands used locally, compares
cross-OS output, signs provenance, creates the GitHub Release, and dispatches
isolated registry jobs.

## Alternatives rejected

| Option | Why not |
|---|---|
| Workflow-heavy packaging with shell and marketplace actions | Packaging would be coupled to one runner, difficult to test locally, and exposed to differences such as missing `rg` on Linux or Bash 3.2 on macOS. |
| One packaging script per host | Each script would independently rediscover version checks, archive normalization, checksums, and error handling, creating multiple sources of release truth. |

## Consequences

The same builder can run on developer machines and Linux, macOS, or Windows
runners. Archive determinism and host layout are unit-testable without network
access, while provider mutations stay visible in the workflow. The trade-off
is maintaining a small tar writer and smoke installer instead of delegating
archive semantics to platform-specific `tar` implementations. Any future host
must add one declarative bundle definition and its validation contract before
it can enter the release matrix.
