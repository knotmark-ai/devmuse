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

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already designed?" [shape=diamond];
    "Invoke design skill" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "Creative work?" [shape=diamond];
    "Scope exists?" [shape=diamond];
    "Bug or failure?" [shape=diamond];
    "Invoke mu-scope (1 use case: repro steps)" [shape=box];
    "Invoke mu-scope" [shape=box];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to EnterPlanMode?" -> "Already designed?";
    "Already designed?" -> "Invoke design skill" [label="no"];
    "Already designed?" -> "Might any skill apply?" [label="yes"];
    "Invoke design skill" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Creative work?" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Creative work?" -> "Scope exists?" [label="yes"];
    "Creative work?" -> "Bug or failure?" [label="no"];
    "Scope exists?" -> "Invoke mu-scope" [label="no"];
    "Scope exists?" -> "Invoke Skill tool" [label="yes"];
    "Bug or failure?" -> "Invoke mu-scope (1 use case: repro steps)" [label="yes"];
    "Bug or failure?" -> "Invoke Skill tool" [label="no"];
    "Invoke mu-scope" -> "Invoke Skill tool";
    "Invoke mu-scope (1 use case: repro steps)" -> "Invoke Skill tool";
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |
| "This is too simple to need scoping" | Simple tasks are where omissions hurt most. Scope can be 1 use case. |
| "I already know what to build" | You know what YOU want. Scope finds what you missed. |
| "Just a quick fix" | Quick Probe takes 30 seconds. Just do it. |

## Skill Priority & Pipeline Paths

DevMuse has three tiers: **Product-level** (mu-biz, mu-prd), **Feature-level** (mu-scope → mu-arch → mu-plan → mu-code → mu-review), and **Orthogonal** (mu-explore, mu-debug, mu-retro).

### Choosing a path

1. **Greenfield product** (new product from zero — no code, no decisions): `mu-biz → mu-prd → [feature loop]`. Product-level tier first, then per-feature work.
2. **Quick ideation** (solo, small scope, "is this worth doing?"): `mu-biz quick → mu-scope → mu-arch → mu-plan → mu-code → mu-review`.
3. **Feature addition to existing project**: `mu-scope → mu-arch → mu-plan → mu-code → mu-review`. Skip product-level tier — product already exists.
4. **Bug fix**: `mu-scope (1 UC: repro steps) → mu-debug → mu-code`.

**Creative-skill stance**: `mu-biz`, `mu-prd`, and `mu-arch` auto-detect artifact state on entry via a Phase 0 stance (`create` / `update` / `extract` / `skip`). The user confirms in one word or overrides via slash hint (e.g., `/mu-arch create`). See `knowledge/principles/stance-detection.md`.

### Examples

- "I want to build a new product / startup / Chrome extension" → `mu-biz` (full) first
- "Let's add feature X to this project" → `mu-scope` first
- "Fix this bug" → `mu-scope` (1 use case: repro steps), then mu-debug, then mu-code
- "Add a button" → `mu-scope` (quick), then mu-arch, then mu-plan, then mu-code
- "Is this worth doing?" / "Should I build this?" → `mu-biz quick`
- "How did last week go?" → `mu-retro`
- "Help me understand this repo / take over this project / evaluate this library" → `mu-explore`

## Skill Types

**Rigid** (code with TDD, review with verification): Follow exactly. Don't adapt away discipline.

**Flexible** (design, debug): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
