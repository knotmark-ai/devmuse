# Explore: <area-name>

> **Variant:** onboarding | takeover | dependency-eval | pre-change | pre-debug
> **Target:** <whole-repo | component-name | subsystem-name>
> **Baseline commit:** `<full SHA from git rev-parse HEAD>`
> **First explored:** YYYY-MM-DD
> **Last updated:** YYYY-MM-DD

## Purpose

One sentence: why this artifact exists (e.g., "support contribution onboarding for devmuse", "assess blast radius before refactoring auth-session creation").

## Core Idea

One paragraph. What does this code do, at the highest possible level? If the reader only reads this section, what's the minimum they need to know?

## Component Map

List the top-level components and their responsibilities. Depth capped at 2 levels for onboarding/takeover/dep-eval variants.

- **`<component>`** — <responsibility>
  - `<subcomponent>` — <responsibility>
- **`<component>`** — <responsibility>

For pre-change variant, include call-chain info up to 50 files:

| From | To | Via |
|------|----|----|
| `<caller>` | `<callee>` | `<mechanism>` |

## Entry Points

How does execution start?

- `<path/to/entrypoint>` — <when it runs>
- `<path/to/other>` — <when it runs>

## Key Flows

Narrative of the 2-4 most important flows. Each flow: trigger → steps → outcome.

### Flow: <name>
1. ...
2. ...

## Domain Terms

Glossary of project-specific vocabulary. Every term the agent had to learn to understand this code.

| Term | Meaning |
|------|---------|
| `<term>` | <definition> |

## Unknowns

**Required section.** Every gap, uncertainty, or "I didn't look into this" goes here. This is the most-reused section for future sessions.

- `<area>` — <what is unknown and why>
- `<area>` — <what is unknown and why>

## Doc vs Code Conflicts

Record any place where README/docs disagree with the code. Do not silently pick one.

- `<location>` — doc says X, code does Y. <implication>

## Depth & Coverage Notes

What was scanned vs what was skipped. Any cap hit (50-file, depth-2) is noted here so future re-explores know where to resume.

- Scanned: <what>
- Capped at: <limit>, deferred branches: <list>
- Explicitly out of scope: <what and why>

## Exit Criterion Check

Answer this before requesting approval: "For the chosen target, can this artifact be used to answer 'what does changing X affect?'"

- [ ] Yes — for `<representative-X>`, affected files/callers are traceable from this artifact.
- [ ] No — gaps: <list>

## Handoff

If this Explore precedes other work, which skill comes next and what inputs it needs.

- Next skill: `<mu-scope | mu-arch | mu-debug | mu-code | none>`
- Inputs it will read: <sections of this artifact>

## History

Append one entry per re-exploration. Newest at top.

| Date | Commit | Variant | Change summary |
|------|--------|---------|----------------|
| YYYY-MM-DD | `<SHA>` | <variant> | Initial creation |
