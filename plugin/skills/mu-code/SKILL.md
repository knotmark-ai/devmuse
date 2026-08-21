---
name: mu-code
description: Use when the user asks to implement a mu-scope bounded execution contract or an approved DevMuse implementation plan
---

# Code

## Overview

Execute the evidence already selected by mu-scope:

- **Bounded:** an inline contract with affected files, 1–3 use cases, and a
  verification command.
- **Architectural:** an approved implementation plan, normally under
  `docs/plans/`, with task and UC traceability.

The implementation loop owns coding, tests, and task-level self-checks.
Independent review has one owner: bounded work gets one combined main-thread
review; architectural work gets one final mu-review after all tasks integrate.

**Core principle:** tight implementation loop, one review boundary.

Announce the selected path at the start.

## Entry Gate

Automatic invocation requires both conditions:

1. The user has asked to implement, execute, or continue the change.
2. The conversation contains either a mu-scope inline contract explicitly
   labeled `bounded execution`, or an approved DevMuse implementation plan.

A code-editing request, design document, unapproved plan, or generic specification is not enough. When the gate is absent, leave execution to the host's normal
agent loop; do not synthesize a DevMuse contract merely to activate this skill.
An explicit request to work directly or use a lighter process overrides automatic
invocation even when qualifying evidence exists.

## Quick Reference

| Evidence | Execution | Review | Exit |
|---|---|---|---|
| Inline bounded contract | Main thread, no task fan-out | One combined review | Verified result |
| Approved plan, small/tightly coupled | Inline task loop | One final mu-review | Reviewed implementation |
| Approved plan, 3+ independent tasks | Fresh mu-coder per task | One final mu-review | Reviewed implementation |

## Bounded Execution

Use this path only when mu-scope labels the inline contract `bounded
execution`.

1. Restate the affected files, 1–3 UCs, and verification command.
2. Apply @../../knowledge/principles/git-safety.md before branch operations.
   Work on the current non-protected branch; this path creates no worktree.
3. For each behavior change, run the red-green-refactor loop below. Keep one
   task in progress; there is **no subagent fan-out**.
4. Run the affected tests and inspect the complete diff against every UC.
5. Run **one combined review** in the main thread: anchor every UC to the diff,
   then inspect correctness, scope, readability, tests, and error handling. Fix
   material findings and rerun affected tests.
6. Report the contract, diff scope, commands, and results. End without invoking
   mu-review solely because it exists.

Upgrade through mu-scope before widening the change when hidden dependents,
cross-subsystem effects, a public contract, security/migration concerns, or a
material design decision appears.

## Architectural Execution

### 1. Validate the plan

Read the plan once and extract every task, its full instructions, dependencies,
UC IDs, files, verification commands, any plan-level `Global Constraints`, and
each task's `Interfaces` into task tracking.

A design spec alone is not an implementation plan. Recommend mu-plan. If the
user explicitly waives that step, derive a task list from the approved evidence,
present it once, execute inline, and record the waiver in the final report.

The step is complete when every plan task has one tracking item, every UC is
owned by at least one task, every task carries all Global Constraints, and each
producer/consumer pair carries the same interface definition. Plans without a
Cross-Task Contract add no contract context.

### 2. Select isolation

Apply @../../knowledge/principles/git-safety.md and run the relevant baseline
tests before implementation.

- Use the current non-protected feature branch for a small or tightly coupled
  plan.
- Use an existing project worktree convention when multiple independent agents
  could collide, the plan will churn many files, or the user requests
  isolation. Verify a project-local worktree directory is ignored before use.
- If only a protected branch is available, obtain explicit user consent before
  implementing there.

Isolation is complete when the target branch/worktree is named, the starting
status is understood, and baseline failures are reported rather than silently
attributed to the change.

### 3. Select execution mode

Use **Inline Mode** for one or two tasks, tightly coupled tasks, or environments
without subagents. Use **Subagent Mode** when at least three tasks are genuinely
independent and fresh context materially reduces interference. User preference
overrides the default.

Parallel dispatch is reserved for tasks with disjoint write sets and no shared
intermediate state. Before parallel dispatch, read
`skills/mu-code/parallel-dispatch.md`. All other tasks run sequentially.

### 4. Execute the task loop

For each task:

1. Mark it in progress and load the full task, every Global Constraint, and
   only the Interfaces entries that task consumes or produces.
2. Run red-green-refactor for behavior changes.
3. Run the task's verification command.
4. Self-check the actual diff against the full task text: every requirement and
   UC is present, no unrequested behavior was added, and changed files stay
   inside the stated write set.
5. Record files, commands, results, and concerns; then mark the task complete.

When a task receives input from or sends output to an external system, apply
`@../../knowledge/principles/defensive-boundary.md` before implementing that
boundary.

In Subagent Mode, dispatch a fresh `@../../agents/mu-coder.md` with the full task
text, architectural context, write set, UC IDs, verification commands, every
Global Constraint, and that task's exact Interfaces entries. The subagent
receives that content directly rather than being told to read the plan.
Handle its status as follows:

| Status | Controller action |
|---|---|
| `DONE` | Verify the report and diff, then continue |
| `DONE_WITH_CONCERNS` | Resolve correctness or scope concerns before continuing |
| `NEEDS_CONTEXT` | Supply the missing evidence and redispatch |
| `BLOCKED` | Change context, capability, decomposition, or plan; surface a plan defect to the user |

Implementation-time self-check is not independent review. It keeps the loop
tight and prevents obvious omissions from accumulating; it does not dispatch a
reviewer after every task.

### 5. Integrate and review once

After all tasks complete:

1. Run the plan-level verification commands and inspect the integrated diff.
2. Confirm every task and UC has implementation and test evidence. When the
   plan has a Cross-Task Contract, confirm the integrated code preserves every
   global constraint and both sides of every interface definition.
3. Invoke **one final mu-review** over the complete architectural change.
4. Resolve its findings under mu-review's invocation mode and rerun the relevant
   verification.

Architectural execution is complete when the integrated diff is reviewed, all
material findings are resolved or explicitly accepted by the user, and the
reported commands reflect the final state.

## Red-Green-Refactor

Behavior changes use a red test before production code.

```
RED:      write one test for the desired behavior and run it to the expected failure
GREEN:    write the minimum implementation and run it to green
REFACTOR: improve structure while the same tests stay green
```

During REFACTOR, read `@../../knowledge/principles/code-quality.md` and sweep
the actual diff through every category. Translate mechanisms and examples into
the repository's language. REFACTOR is complete when every changed element has
either the prescribed correction or concrete evidence that its current shape
is earned.

Configuration-only, generated-code, or throwaway-prototype exceptions require
the user's explicit approval. A test that passes before implementation is not a
red test; correct it until it fails for the missing behavior.

When the plan carries `Covers: UC-xxx`, annotate the corresponding tests with
the UC ID so final coverage review can trace the contract.

When a task adds mocks, test utilities, or production hooks solely for tests,
read `skills/mu-code/testing-anti-patterns.md` before writing that test branch.

## Stop Conditions

Pause the task loop when:

- required context or a dependency is unavailable;
- a plan instruction is contradictory or no longer matches the code;
- verification repeatedly fails without a supported hypothesis;
- the write set or architectural boundary must expand;
- the current branch is protected and consent is absent.

Report the exact evidence and the smallest decision needed. Resume only when
the blocker is resolved or the user chooses an explicit alternative.

## Common Mistakes

| Mistake | Correction |
|---|---|
| Reading the plan again in every task | Extract it once; pass each task's full text directly |
| Passing task text without its cross-task contract | Add every Global Constraint and only that task's Interfaces entries |
| Dispatching reviewers after each task and again at the end | Keep task self-checks; use one final mu-review |
| Treating self-review as independent review | Self-check during implementation; review once at the path boundary |
| Choosing subagents because they are available | Use them when task independence justifies fresh context |
| Adding a worktree for every plan | Scale isolation to collision and churn risk |
| Continuing after the change crosses its contract | Return evidence to mu-scope and upgrade first |

## Integration

- **mu-scope** supplies the bounded contract.
- **mu-plan** supplies the architectural plan.
- Bounded execution ends after its combined review.
- Architectural execution chains to **mu-review** once, after integration.
- Agent reference: `@../../agents/mu-coder.md`.
