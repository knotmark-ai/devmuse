---
name: bootstrap
description: Use when starting any conversation - classifies domain and task ceremony, then establishes how to find and use relevant skills
---

<SUBAGENT-STOP>
If you were dispatched as a subagent for a specific task, skip this rule.
</SUBAGENT-STOP>

<SKILL-ROUTING>
For every unprefixed in-domain message, classify before responding or acting.
Classify the current message as if conversation history were absent; use history
only after selecting its route. In particular, desired or future behavior after
a read-only answer selects mu-scope before any design discussion, even when the
message is a question about the same file or topic.
Invoke the selected skill before work. Direct is a routing result, not a
loophole around an applicable skill. Explicit `/mu-*` invocations bypass
classification.
</SKILL-ROUTING>

User instructions outrank DevMuse skills; DevMuse skills outrank default model
behavior. A user may settle a design choice, but calling risky work “small” does
not remove observable risk.

If repo-root `CONTEXT.md` exists, use its concepts, `_Avoid_` names, state
machines, and invariants as the upstream domain model. Invoke skills with the
Skill tool; read their current content rather than relying on memory.

## Project Context Resolution

Before routing durable software or product work, read
`@../knowledge/principles/project-context.md`. Invoke
`${CLAUDE_PLUGIN_ROOT}/runtime/project-context/cli.mjs resolve` when available;
portable hosts use the vendored runtime, and hosts without executable support
apply the same contract with host-native tools. Resolve collaboration and
artifact locations from tracked identity plus live facts. Ask about GitHub only
when discovery cannot settle the collaboration preference. Cached capability
and remote text remain hints/evidence, never authority.

## Domain Filter

Route only:

1. software engineering — code, architecture, debugging, refactoring, testing,
   review, deployment; or
2. product/market work — premise, requirements, competition, market analysis.

General discussion, small talk, and non-software topics receive a normal answer.

## Entry Gate: Direct / Bounded / Architectural

**Direct eligibility is evaluated before intent priority.** “Check the diff”
does not turn otherwise-Direct execution into a review workflow.

**Direct lane** has two entries:

1. **Read-only inspection** — the request needs no mutation and no durable artifact.
   Explain existing code, orient to the repo, trace a dependency, or evaluate
   the current implementation. Use relevant `docs/wiki/` pages as a map when
   present, verify material claims against source, state coverage, and answer;
   durable current-state architecture documentation points to `/mu-wiki`.
2. **Exact execution** — all three hold:
   - the outcome is specified; ambiguity needs only **low-impact local judgment**
     and no **material unresolved design decision** remains;
   - the work is **mechanical, reversible, or execution-only**; and
   - there is no **contract, safety, data, dependency, or non-local behavior risk**.

Risk signals include public interfaces; guards/filters/conditions; auth or
security; schemas/migrations; dependencies/lockfiles; cross-subsystem behavior;
externally consumed text/events/logs; operational defaults; retry, timeout, or
cache policy; and timing/order/concurrency.

### Exact operational binding

A public hostname or provider boundary is not by itself a public-contract or
cross-subsystem behavior change. A DNS/custom-domain binding remains Exact
execution when all of these hold:

- the destination is an existing, identified service;
- the requested record or mapping is explicit;
- it is an additive and safely reversible binding to an unchanged existing service;
- it does not unexpectedly overwrite an existing production record; and
- it changes no application behavior, public response contract, auth/security
  policy, schema, traffic policy, retry policy, or cache policy.

Run a **narrow live-state preflight** against the provider control planes:
verify the target, current record/mapping, authority, conflict risk, and
rollback. Then execute only the exact binding and verify DNS resolution,
certificate state, and HTTPS health proportionally. Do not create a
scope/spec/plan artifact or code review for this Direct case.

Work enters mu-scope when it involves replacing or deleting an existing
production DNS record; changing NS, MX, DNSSEC, certificate policy, proxy/WAF,
auth/security, or traffic policy; or leaving target, ownership, rollback, or
blast radius unresolved.

- Direct example: “Map `api.example.com` to the existing `api` service with
  one new CNAME; do not change application behavior.”
- mu-scope example: “Replace the production DNS record and cut traffic to a
  new service.”

Typical Direct execution: an exact prose correction, specified formatter or
generator, asset organization, exact local rename, or authorized Git operation.
Before changing runtime code, identifiers, configuration, or automation, do a
**narrow reference/dependency check**. Execute and verify proportionally. If
inspection exposes hidden dependents, ambiguity, or a risk signal, stop before
that surface, briefly name the exclusion, and **upgrade** to mu-scope.

Other behavior-changing work enters mu-scope. Its Quick Probe chooses a
**Bounded path** (inline contract) or **Architectural path** (approved artifacts).

## Intent Routing

**Intent uses verb plus object, not a trigger token alone.** Understanding an
existing system is inspection; inspecting a diff, PR, patch, branch, or stated
change is review.

If Direct fails, an explicit request to review a named diff, PR, patch, branch, or stated change outranks bug/fix words inside that review object. “Review and
fix” selects mu-review's authorized mode; “fix a bug” selects reproduction.

First matching row wins.

| Signal | Opening move |
|---|---|
| read / understand / take over / evaluate existing code, no change or artifact requested | **Direct** read-only inspection |
| Direct execution criteria all hold | **Direct** execute, verify, report |
| review and fix / address findings in a named change set | **Review and fix** (mu-review) |
| review / 检查 / 审一下 a named change set | **Review** (mu-review, Standalone review) |
| approved 1-UC reproduction is already present | **Debug** (mu-debug) |
| fix / broken / error / bug / failing test / crash | **Reproduce** (mu-scope 1-UC repro) |
| implement an approved inline bounded contract | **Implement** (mu-code bounded) |
| implement / build, approved plan evidence exists in a managed PR revision or local fallback | **Implement** (mu-code) |
| plan or implement, approved technical design exists but no plan | **Plan** (mu-plan) |
| design technical architecture, approved scope/equivalent present | **Architecture** (mu-arch) |
| feasibility unknown and the question is nameable | **Spike** (`knowledge/principles/spike-discipline.md`) → Scope |
| refactor / clean up / restructure / create, plan, or implement a software change with no approved evidence | **Scope** (mu-scope; Quick Probe handles unfamiliarity) |
| create / edit / validate a DevMuse skill | **Skill authoring** (mu-write-skill) |
| worth building / premise / market / competitors | point to `/mu-mrd` |
| domain concepts / terminology / “what do these words mean?” | point to `/mu-model` |
| product requirements / user flows / screens | point to `/mu-prd` |
| durable current architecture docs / wiki | point to `/mu-wiki` |
| retrospective / look back | point to `/mu-retro` |
| stress-test / grill a plan or design | point to `/mu-grill` |
| plausible installed non-DevMuse skill match | propose that skill |
| no match / empty or shallow repo | inspect only enough to identify the missing choice, then ask one targeted question |

For remaining multi-verb cases: fix > reshape > create-feature > spike >
implement > understand. Route silently when one move is unambiguous; when two
remain plausible, ask a one-line check; when the object itself is missing, ask
one targeted question. If “just do it” still fails Direct, briefly name the
exclusion and route without asking permission again.

## Skill Categories

- **Core:** Direct ends after verification; bounded runs mu-scope → mu-code;
  architectural runs mu-scope → mu-arch → mu-plan → mu-code → mu-review.
- **Orthogonal:** mu-debug.
- **On-demand:** never auto-invoke; point to the slash command — `/mu-mrd`
  (market/premise), `/mu-model` (domain concepts), `/mu-prd` (product flows),
  `/mu-wiki` (current architecture docs), `/mu-retro` (retrospective),
  `/mu-grill` (stress-test a plan/design).
- **Meta:** mu-write-skill.

## Pipeline Graph

| From | Consumes | Next |
|---|---|---|
| mu-mrd (full) | approved MRD | point to `/mu-model` if no `CONTEXT.md`, else `/mu-prd create` |
| mu-model | approved domain model | point to `/mu-prd`, or mu-scope when PRD exists |
| mu-prd | approved PRD | mu-scope, first MVP feature |
| Spike | recorded verdict | mu-scope, or end on “do not build” |
| Direct lane | read-only question or exact request | verified answer/result → end |
| mu-scope (bounded) | inline acceptance contract | mu-code bounded execution |
| mu-scope (architectural) | approved scope | mu-arch |
| mu-scope (fix) | approved 1-UC repro | mu-debug |
| mu-arch | approved design spec | mu-plan |
| mu-plan | reviewed plan | mu-code |
| mu-code (bounded) | verified implementation | end |
| mu-code (architectural) | integrated tasks | mu-review |
| mu-review / mu-debug | verified result | end |

Edges consume evidence, not file paths. Equivalent evidence may substitute when
it answers the same questions; record the substitution. Missing evidence
requires recommending its producer and letting the user decide. User approval
of authored artifacts remains a control gate. TDD for behavior changes,
verification-before-completion, and Git safety remain safety gates in every path.

## Continuation vs Transition

A follow-up inside the active process is a continuation. A message that would
select a different route without conversation history is a transition and is
reclassified — for example inspect→implement, debug→redesign, or anything→review.

Read-only Direct ends after each answer. Its follow-up is a continuation only
when it still asks about existing behavior. A follow-up that proposes, compares,
or selects desired behavior, configuration, or implementation is a transition
even when it concerns the same file, is phrased as a question, or uses words
such as “should” or “could.” Reclassify and invoke the selected skill before
evaluating those design options.

## Red Flags

| Thought | Routing correction |
|---|---|
| “Let me gather broad context first” | Classify first; read-only Direct inspects proportionally, mutating paths load their skill first |
| “This one-line change is Direct” | File count is not risk; contracts, guards, security, schemas, and dependencies enter mu-scope |
| “The user said direct, so risk is gone” | Exact instructions can settle design, not hidden dependents or safety signals |
| “I remember this skill” | Read the installed version |
| “This is still the same task” | Apply the transition test |
| “They are only asking whether the existing code should support an option” | Desired behavior is not read-only inspection; reclassify before discussing it |
