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

### Routing Flow

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "Slash prefix (/mu-*)?" [shape=diamond];
    "Direct skill invocation" [shape=doublecircle];
    "In DevMuse domain?\n(dev or product work)" [shape=diamond];
    "Respond normally\n(no skill)" [shape=doublecircle];
    "Invoke mu-route\n(classify + confidence)" [shape=box];
    "mu-route invokes\ntarget skill" [shape=doublecircle];

    "User message received" -> "Slash prefix (/mu-*)?";
    "Slash prefix (/mu-*)?" -> "Direct skill invocation" [label="yes"];
    "Slash prefix (/mu-*)?" -> "In DevMuse domain?\n(dev or product work)" [label="no"];
    "In DevMuse domain?\n(dev or product work)" -> "Respond normally\n(no skill)" [label="no"];
    "In DevMuse domain?\n(dev or product work)" -> "Invoke mu-route\n(classify + confidence)" [label="yes"];
    "Invoke mu-route\n(classify + confidence)" -> "mu-route invokes\ntarget skill";
}
```

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |
| "This is too simple to need scoping" | Simple tasks are where omissions hurt most. Scope can be 1 use case. |
| "I already know what to build" | You know what YOU want. Scope finds what you missed. |
| "Just a quick fix" | Quick Probe takes 30 seconds. Just do it. |

**Not a red flag:** "This isn't a dev or product task" — if the user is having an open-ended discussion, asking a general question, or talking about non-software topics, it's correct to respond normally without routing.

## Skill Priority & Pipeline Paths

DevMuse organizes skills into four categories:

**Core pipeline** (auto-routed via mu-route): mu-scope → mu-arch → mu-plan → mu-code → mu-review

**Orthogonal** (auto-routed via mu-route): mu-explore, mu-debug, mu-retro

**On-demand** (direct `/slash` invocation only, NOT auto-routed): mu-biz, mu-prd

**Meta**: mu-route (router), mu-write-skill (skill authoring)

### Routing: how tasks get started

**For any unprefixed user message that falls within DevMuse's domain**, invoke `mu-route`. It pattern-matches intent + repo state, assesses confidence, and either silently invokes the target skill or proposes for user confirmation.

**Direct slash invocation bypasses mu-route** — `/mu-arch`, `/mu-biz`, `/mu-explore`, etc. route directly to the named skill (power-user escape hatch, matches industry convention: Aider / Roo / Continue).

**On-demand skills (mu-biz, mu-prd)** are never auto-routed. Users invoke them explicitly with `/mu-biz` or `/mu-prd` when they need business analysis or product requirements.

See `skills/mu-route/SKILL.md` for the full routing decision table, trigger signals, and confidence-based proposal behavior.

### Creative-skill stance

`mu-biz`, `mu-prd`, and `mu-arch` each run a **Phase 0 stance detection** (`create` / `update` / `extract` / `skip`) on entry. The user confirms in one word or overrides via slash hint (e.g., `/mu-arch create`). See `knowledge/principles/stance-detection.md`.

### Sign-off gate

When stakeholder-scope indicates team-touching (CODEOWNERS present + multi-author git history, or user declaration), creative skills run a sign-off gate protocol at terminal. Non-blocking; user can always override with "skip sign-off". See `knowledge/principles/sign-off-gate.md`.

### Examples

| User message | Behavior |
|-------------|----------|
| "Fix this bug" | mu-route → **Reproduce** (silent) |
| "Refactor the auth module" | mu-route → **Design-tech** (one-line check) |
| "Is this worth building?" | mu-route → pointer to `/mu-biz` |
| "我想聊聊这个项目的方向" | Not in domain → respond normally |
| `/mu-biz full` | Direct invocation (bypass mu-route) |

## Skill Types

**Rigid** (code with TDD, review with verification): Follow exactly. Don't adapt away discipline.

**Flexible** (design, debug): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
