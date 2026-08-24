---
name: mu-review
description: Use when reviewing a diff, pull request, branch, patch, or completed architectural implementation
---

# Review

## Overview

Review the requested change against its actual diff and requirements, report
findings by severity, and verify any fixes before claiming completion.

**Core principle:** report first; mutate only in a mode that owns fixes.

## Invocation Modes

Choose the mode from how this skill was reached:

| Mode | Trigger | Mutation authority | Exit |
|---|---|---|---|
| **Standalone review** | User asks to review/check/audit a diff, PR, patch, branch, or current changes | **report-only** | Findings and coverage |
| **Review and fix** | User explicitly asks to review and fix/address findings | Fix findings inside the named scope | Verified patch and findings disposition |
| **Pipeline final** | mu-code completes an architectural plan | Fix findings inside the already approved implementation scope | Verified final assessment |

An ambiguous “check this” is Standalone review. Asking to review does not imply
permission to edit, commit, merge, push, open a PR, reply to review threads, or
discard work. Those actions require an explicit request.

Announce the selected mode before inspection.

## Project Context Binding

Read `@../../knowledge/principles/project-context.md`. For Pipeline final, run
`resolve`, then publish sanitized review evidence with `render-managed` only
after `authorize` succeeds for the exact Issue/PR operation. Apply the packaged
`project-context/cli.mjs`, or the same contract through host-native tools with
the binding recorded when executable support is absent.

When the project has a case registry (`/mu-setup`), the review-coverage pass
traces each affected case ID to a test and result and marks coverage **stale**,
not merely covered, when a bound revision moved, per
`@../../knowledge/principles/case-registry.md`.

Run `project-delivery` with the required PR set, acceptance evidence, and every
external work item. Consume its canonical `current_state`, `issue_action`, and
`reason`: merge evidence with pending human/platform work keeps the Issue open.
Close it only when `issue_action` is `close` and the exact `issue.update`
operation has fresh capability plus an active grant.

## Process

### 1. Resolve review scope

Inspect git status before choosing a range. Resolve exactly one scope:

- explicit commit range supplied by the user;
- PR/base branch merge-base through `HEAD`;
- current branch changes relative to its base;
- staged and unstaged working-tree changes when the user says “current changes.”

List every file in scope and identify generated, binary, deleted, or unreadable
files. A committed range must have valid base and head SHAs. Working-tree
review includes both `git diff --cached` and `git diff`; it must not silently
review only committed changes.

The step is complete when the range/source and every in-scope file are stated.

### 2. Select review passes

Run code-quality review for every code or configuration change. Add passes only
when evidence triggers them:

| Pass | Trigger |
|---|---|
| Requirements coverage | Scope/spec/plan evidence exists |
| Security | Diff touches auth, credentials, sessions, untrusted input, execution, dependencies, cryptography, or security configuration |
| Design conformance | The change implements an approved design |
| Documentation-only | No runtime code changed; review factual accuracy, links, consistency, and generated/manual boundaries |

When the diff changes an external-system boundary, load
`@../../knowledge/principles/defensive-boundary.md` for the code-quality pass.

For every code-quality pass, load
`@../../knowledge/principles/code-quality.md`. Apply all categories in the
primary language's idioms and keep each violated principle as a distinct
finding category; consolidate repeated occurrences only within that category.

For committed ranges, dispatch `@../../agents/mu-reviewer.md` in the applicable
`review-code`, `review-coverage`, and `review-security` modes. Validate required
inputs before dispatch. For uncommitted-only content, review the complete patch
in the main thread unless the available reviewer can receive that patch
directly; never invent a SHA range that omits it.

If a reviewer reports files not reviewed, continue with a fresh pass over only
those files until every file is reviewed or its limitation is explicit.

#### Host-aware reciprocal cross-review

Cross-review means an independent **different-model-family** review, not "always
run Codex." The reviewer is chosen relative to this host — reviewer direction:
`Claude Code -> Codex`. Codex delegates to Claude Code; another host uses an
explicitly configured different-family reviewer or has no capability. The current
host is never its own reviewer, and a reviewer subprocess never starts a second
cross-review (depth 1).

It runs **only** when the user explicitly requests it, or after a high-risk
signal is presented and the user accepts the extra cost. Tool absence, expired
auth, timeout, or malformed output is silent and never blocks the primary
review; do not turn a missing CLI into an installation flow.

Do not hand-build the reviewer command. The runtime constructs a read-only,
ephemeral, project-scoped invocation with quoted argument arrays (no `eval`, no
shell, no aliases) and prefers an existing local subscription/session login over
an API key. Claude skills invoke
`${CLAUDE_PLUGIN_ROOT}/runtime/cross-review/cli.mjs`; portable skills invoke
their vendored `references/devmuse/runtime/cross-review/cli.mjs`:

- `plan` with `{"current_host":"claude", "project_dir":"…", "refs":["<base>...HEAD"], "output_path":"…"}` returns the reviewer argv/env, or a typed denial (`unavailable`, `same-family`, `recursion-blocked`).
- `run` executes it under a bounded timeout and returns normalized findings or a typed `fallback`.
- `normalize`/`merge` map reviewer output into DevMuse severities and surface contradictions side by side, preserving reviewer provenance. Validate structured output rather than trusting exit code 0; never print, copy, or commit OAuth caches, API keys, or tokens.

Present contradictory conclusions side by side; do not silently choose one.

### 3. Produce anchored findings

Every finding includes severity, `file:line`, observed behavior, impact, and the
smallest defensible correction. Read the referenced code before claiming a
problem. Consolidate one root cause appearing at multiple sites.

Severity means:

- **Critical:** exploitable security issue, data loss, or broadly broken core behavior.
- **Important:** incorrect behavior, missing requirement, material regression,
  unsafe edge case, or test gap that can hide one.
- **Minor:** bounded maintainability issue with a concrete future cost.

Report findings first, ordered by severity. If none exist, say so and state
residual risks or untested areas. Include a coverage footer listing every file
reviewed and every file not reviewed with the reason.

### 4. Handle findings by mode

**Standalone review:** stop after the report. Do not modify files. Offer to fix
the findings only as a separate next action.

**Review and fix / Pipeline final:** verify each finding against current code,
push back with evidence when it is wrong, and fix Critical and Important
findings inside the authorized scope. Minor findings are fixed only when they
are local and do not widen scope; otherwise report them. Add or update tests for
behavioral fixes, then rerun the affected review pass.

If a proposed fix crosses a public contract, security boundary, schema,
dependency topology, subsystem boundary, or approved design, return the new
evidence to mu-scope instead of silently expanding review into redesign.

The step is complete when every finding is marked fixed, rejected with evidence,
accepted by the user, or deferred with owner/reason.

### 5. Verify final state

Fresh evidence precedes every completion claim:

1. Identify the command that proves each material claim.
2. Run the complete relevant test, lint, type-check, or build command.
3. Read the full output and exit status.
4. Reinspect the final diff after fixes.
5. Report exact commands and results, including pre-existing or unresolved
   failures.

For Pipeline final, record the final review disposition and sanitized command
evidence in the managed PR revision. Keep Issue-owned external work linked,
without duplicating its state into the PR.

Standalone review may run safe diagnostic tests when useful, but its primary
completion criterion is exhaustive diff coverage rather than a passing build.
Review and fix / Pipeline final requires verification of the changed behavior.

## Quick Reference

| Situation | Action |
|---|---|
| User says “review this branch” | Standalone, report-only |
| User says “review and fix this branch” | Review and fix |
| mu-code architectural handoff | Pipeline final |
| Dirty working tree | Include staged and unstaged patches |
| Security signal | Add review-security |
| Scope artifact exists | Add review-coverage |
| Finding requires redesign | Return to mu-scope |
| User asks to merge/push/open PR | Verify, then perform only that requested integration action |

## Common Mistakes

| Mistake | Correction |
|---|---|
| Editing during an ordinary review request | Standalone means report-only |
| Reviewing `HEAD~1..HEAD` by habit | Resolve the user's real range first |
| Trusting a reviewer success report | Inspect its anchors, coverage, and final diff |
| Treating all findings as equally severe | Classify by concrete impact |
| Fixing a false positive to be agreeable | Verify, then reject it with evidence |
| Claiming success from an earlier test run | Run fresh verification on the final state |
| Offering merge/PR/discard after every review | Integration appears only on explicit request |

## Integration

- Called once by **mu-code** after architectural integration.
- Independently triggered by explicit review requests.
- Uses `@../../agents/mu-reviewer.md` for committed-range review passes.
- Refactoring/removal review applies
  `@../../knowledge/principles/chestertons-fence.md`.
- Terminal state is a report or verified fixes plus the Delivery projection;
  repository integration remains a separate explicit action.
