---
name: bootstrap
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<SKILL-ROUTING>
If a skill might apply — even if you're unsure — invoke it before any response, clarifying questions included. The costs are asymmetric: a spurious invocation wastes one tool call; skipping silently loses the workflow the skill encodes. When in doubt, invoke.
</SKILL-ROUTING>

## Instruction Priority

DevMuse skills override default system prompt behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (CLAUDE.md, AGENTS.md, direct requests) — highest priority
2. **DevMuse skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

If CLAUDE.md or AGENTS.md says "don't use TDD" and a skill says "always use TDD," follow the user's instructions. The user is in control.

## Project Domain Language

If the repo root has a `CONTEXT.md`, it is the project's shared vocabulary: use its terms in code names, artifacts, and replies, and respect its `_Avoid_` lists. Consult it before naming anything new.

## How to Access Skills

Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** But not every message is a task — DevMuse only activates for software engineering and product analysis work.

### Domain Filter (before routing)

DevMuse handles two categories of work:
1. **Software engineering** — coding, architecture, debugging, refactoring, testing, code review, deployment
2. **Product/market analysis** — premise validation, product requirements, competitive and market analysis

**Not in scope:** general questions, open-ended discussion, brainstorming without a concrete goal, non-software topics. For these, respond normally without invoking any skill.

### Routing

For any **unprefixed** in-domain message — at task start or on a task
transition — classify and route directly from this section. `/mu-*`
bypasses routing.

**Signals are git/fs facts, not inference** — on a failed command, ask
the user for the opening move: intent verbs (table below); artifact
existence means a file on disk under `docs/scope|specs|plans|prd|mrd/*.md`
(legacy `docs/biz`),
not text in the conversation; recent-author familiarity (`git log
--author --since="30 days ago" -- <area>`) when reshape fires; plausible
match against installed non-DevMuse skills.

**Intent → opening move** (first match wins; multi-verb priority:
fix > review > reshape > create-feature > implement > understand):

| Signal | Opening move |
|---|---|
| understand / figure out / take over / evaluate / what does this do | **Explore** (mu-explore) |
| fix / broken / error / bug / test failing / crash | **Reproduce** (mu-scope 1-UC repro) |
| review / 检查 / look at this diff or PR / 审一下 | **Review** (mu-review) |
| reshape (refactor / clean up / restructure) — unfamiliar area | **Explore** (pre-change) → Scope |
| reshape or create-feature — familiar, no scope on disk | **Scope** (mu-scope; its terminal chains into mu-arch) |
| implement / build this — no scope on disk | **Scope** (mu-scope) |
| implement / build this — design spec exists, no plan | **Plan** (mu-plan) |
| implement / build this — plan exists (docs/plans) | **Implement** (mu-code) |
| plausibly matches an installed non-DevMuse skill | propose delegating to it |
| no verb match / pathological repo state (empty, shallow) | **Explore** safe default / ask the user |

**Confidence sets friction:** single unambiguous verb → invoke silently;
two candidate moves, one dominant → one-line check ("→ **<Skill>**, ok?");
vaguer → full proposal with one-word overrides (explore / design-tech /
reproduce / review / implement). An unparseable reply to a proposal →
ask the user to restate with one word from the override list (non-blocking).

**Four categories:**

- **Core pipeline** (auto-routed): mu-scope → mu-arch → mu-plan → mu-code → mu-review
- **Orthogonal** (auto-routed): mu-explore, mu-debug
- **On-demand** (slash only, never auto-routed — matching intents get a
  pointer, not an invocation: is this idea worth building / competitor or
  market analysis → `/mu-mrd`; product requirements / user flows →
  `/mu-prd`; wiki / architecture docs → `/mu-wiki`; retro / look back →
  `/mu-retro`; grill me / stress-test this plan → `/mu-grill`): mu-mrd,
  mu-prd, mu-wiki, mu-retro, mu-grill
- **Meta**: mu-write-skill (skill authoring)

### Pipeline Graph

Cross-skill handoffs live here, not in skills: a skill finishes by announcing
its artifact, and this graph names the next move.

| From | Consumes | Next |
|---|---|---|
| mu-mrd (full) | approved MRD | prompt `/mu-prd create` |
| mu-prd | approved PRD | mu-scope, first MVP feature |
| mu-scope | approved scope | mu-arch |
| mu-scope (fix route) | approved 1-UC repro | mu-debug |
| mu-scope (micro exit) | verified in-session change | end |
| mu-arch | approved design spec | mu-plan |
| mu-plan | reviewed plan | mu-code |
| mu-code | all tasks complete | mu-review |
| mu-review / mu-debug | verified result | end |

**Edges consume evidence, not file paths.** The named artifact is the default
form; an equivalent that already answers the same questions satisfies the
edge — record the substitution in the consuming artifact's header. The common
case: a detailed PRD feature section + object model stands in for a scope
artifact — mu-scope then runs its evidence fast path (probe, conflict
cross-check, reverse UCs; no re-interview). An inline plan handed over in
conversation stands in for `docs/plans` at mu-code. Missing evidence →
recommend the producer skill, offer the alternatives, the user decides —
the recommendation itself is the agent's obligation; only the user can
decline it, and a declined recommendation is flagged in the consuming
artifact or final report.
Control gates (user approval of an artifact) and safety gates (TDD,
verification-before-completion, git safety) are never substitutable.

### Continuation vs Transition

During an active skill, same-type follow-ups are continuations — just respond, no re-routing: "查下这个日志" mid-debug, clarifying questions, providing requested info. When the user's intent **shifts category** — debug→fix, explore→implement, anything→review, fix→redesign — re-route using the Routing section above.

**The test:** with all prior conversation context removed, would this message route to a **different** skill than the one currently active? Yes → transition → re-route.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "Let me gather context / explore the codebase / check files first" | Skill check comes BEFORE clarifying questions. Skills tell you HOW to explore and gather. |
| "This doesn't need a formal skill" / "the skill is overkill" | If a skill exists, use it. Simple things become complex. |
| "I remember this skill" | Skills evolve. Read the current version. |
| "Just a quick fix" / "too simple to need scoping" | Simple tasks are where omissions hurt most. Scope can be 1 use case; Quick Probe takes 30 seconds. |
| "This is a continuation of the current task" | Apply the transition test above. If the intent shifted, re-route. |

**Not a red flag:** "This isn't a dev or product task" — open-ended discussion, general questions, and non-software topics get a normal response, no routing.

## Skill Types

**Rigid** (code with TDD, review with verification): follow exactly — don't adapt away discipline. **Flexible** (design, debug): adapt principles to context. The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
