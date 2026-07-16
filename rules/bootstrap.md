---
name: bootstrap
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

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
2. **Product/business analysis** — premise validation, product requirements, competitive analysis, business modeling

**Not in scope:** general questions, open-ended discussion, brainstorming without a concrete goal, non-software topics. For these, respond normally without invoking any skill.

### Routing

For any **unprefixed** user message within DevMuse's domain, invoke `mu-route`. It pattern-matches intent + repo state, assesses confidence, and either silently invokes the target skill or proposes for user confirmation. See `skills/mu-route/SKILL.md` for the decision table and trigger signals.

**Slash bypasses routing** — `/mu-arch`, `/mu-biz`, etc. invoke the named skill directly.

**Four categories:**

- **Core pipeline** (auto-routed): mu-scope → mu-arch → mu-plan → mu-code → mu-review
- **Orthogonal** (auto-routed): mu-explore, mu-debug
- **On-demand** (slash only, never auto-routed — mu-route answers matching intents with a pointer): mu-biz, mu-prd, mu-wiki, mu-retro, mu-grill
- **Meta**: mu-route (router), mu-write-skill (skill authoring)

### Continuation vs Transition

During an active skill, same-type follow-ups are continuations — just respond, no re-routing: "查下这个日志" mid-debug, clarifying questions, providing requested info. When the user's intent **shifts category** — debug→fix, explore→implement, anything→review, fix→redesign — re-invoke mu-route.

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
