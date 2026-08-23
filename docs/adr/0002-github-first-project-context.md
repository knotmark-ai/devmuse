# ADR-0002: Coordinate work in GitHub and resolve project context from two storage tiers

> **Status:** Accepted
> **Date:** 2026-08-22
> **Deciders:** Jeff Yu

## Context

DevMuse currently writes dated scope, design, and plan files even when a project
already collaborates through GitHub. That duplicates delivery state, hides
human or platform work outside the repository, and treats separate worktree
paths as separate projects. A replacement must keep stable repository facts
available to every clone, share recoverable hints among worktrees, preserve
GitHub as the coordination authority, and continue to work when GitHub is
unavailable or declined.

No single storage location meets those constraints. Tracked files are durable
but conflict when volatile session state changes. Git-common files are private
and shared by worktrees but disappear in a fresh clone. GitHub records team
coordination but cannot supply repository-local canonical document paths when
offline.

The requirements and design-section approvals are recorded in
[issue #62](https://github.com/knotmark-ai/devmuse/issues/62), including the
[Option A decision](https://github.com/knotmark-ai/devmuse/issues/62#issuecomment-5371879091)
and [complete design approval](https://github.com/knotmark-ai/devmuse/issues/62#issuecomment-5372475995).

## Decision

DevMuse uses three authorities with non-overlapping responsibilities:

- a tracked `.devmuse/project.yaml` stores stable project identity,
  collaboration preference, and canonical PRD and architecture paths;
- a private cache under the repository's Git common directory stores only
  recoverable capability, worktree, Issue, PR, and interruption hints; and
- GitHub Issues and Draft PRs are the canonical collaboration surfaces when
  live capability exists and the user authorizes the write.

The resolver treats repository identity rather than a checkout path as the
project key. A GitHub repository node ID is preferred; a tracked UUID supports
non-GitHub projects. Cached permissions never authorize a write, and cached
coordination pointers must be revalidated against live GitHub state.

## Alternatives rejected

| Option | Why not |
|---|---|
| Store stable and volatile state together in tracked `.devmuse/project.yaml` | Issue, PR, session, authentication, and worktree churn would create branch conflicts, stale permissions, and possible disclosure of local state. |
| Keep all project context only in the Git common directory | Fresh and separate clones would lose project identity and canonical document paths; non-Git hosts and teammates could not discover the shared facts. |
| Use GitHub as the only store | Offline and non-GitHub projects would fail, while canonical repository document locations would depend on a remote service rather than the repository itself. |

## Consequences

Worktrees in one clone share recoverable state without using their filesystem
paths as project identity, while a fresh clone reconstructs stable facts from
the tracked manifest and GitHub. GitHub-first delivery can keep scope, plans,
external work, and completion evidence visible without duplicating them into
local dated files.

The trade-off is a reconciliation protocol across three sources. The resolver
must validate schemas, merge cache entries under a lock, distinguish authority
from hints, verify manifest identity against the live immutable repository ID,
and expose conflicts instead of silently selecting a winner. Remote object
updates require conditional-write protection; indeterminate creates require
work-ID recovery rather than blind retries. Projects also retain an explicit
local fallback because GitHub availability and authorization cannot be assumed.
