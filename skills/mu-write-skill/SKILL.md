---
name: mu-write-skill
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

You write test cases (pressure scenarios with subagents), watch them fail (baseline behavior), write the skill (documentation), watch tests pass (agents comply), and refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

**REQUIRED BACKGROUND:** You MUST understand devmuse:mu-code — it defines the RED-GREEN-REFACTOR cycle this skill adapts to documentation.

**Official guidance:** For Anthropic's official skill authoring best practices, see anthropic-best-practices.md.

## What is a Skill?

A **skill** is a reference guide for proven techniques, patterns, or tools — reusable across projects, not a narrative about how you solved a problem once.

**Create when:** the technique wasn't intuitively obvious to you, you'd reference it again, and it applies beyond one project.

**Don't create for:** one-off solutions, standard practices well-documented elsewhere, project-specific conventions (put those in CLAUDE.md), or mechanical constraints (if regex/validation can enforce it, automate it — save documentation for judgment calls).

Skill type determines test strategy (see Testing below): **technique** (concrete steps), **pattern** (way of thinking), **reference** (API docs, syntax guides).

## Structure

DevMuse skills live under `skills/<name>/` in this repo; personal (non-plugin) skills go in `~/.claude/skills`. Each skill is one folder: `SKILL.md` plus supporting files only for reusable tools (scripts, templates) or reference disclosed per the branch test (see Skill Quality Review).

**Frontmatter (YAML), max 1024 characters:**
- Fields: `name`, `description`, and optionally `disable-model-invocation: true` (user-invoked skills — see the invocation-match test in Skill Quality Review)
- `name`: letters, numbers, hyphens only; verb-first, active voice
- `description`: third person, triggering conditions ONLY — see CSO below

**Body sections** (adapt to skill type; techniques/patterns lead with a before/after Core Pattern):

```markdown
# Skill Name
## Overview        — what is this? Core principle in 1-2 sentences
## When to Use     — symptoms and use cases; when NOT to use
## Core Pattern    — before/after comparison (techniques/patterns)
## Quick Reference — table for scanning common operations
## Implementation  — inline code, or pointer to a disclosed file
## Common Mistakes — what goes wrong + fixes
```

## Claude Search Optimization (CSO)

**Critical for discovery:** Future Claude needs to FIND your skill. Description + keywords + naming determine whether the skill surfaces when needed.

For detailed guidance on writing discoverable descriptions, keyword coverage, naming conventions, token efficiency, and cross-referencing:

**@../../knowledge/principles/skill-cso.md**

Key takeaways to keep in mind while writing:

- Description answers "should I read this skill right now?" — triggering conditions only, NOT workflow summary
- Frequently-loaded skills target <200 words total; other skills <500 words
- Name by what you DO (active voice, verb-first)
- Reference other skills by name (e.g., `devmuse:mu-code`), never with `@skills/...` (force-loads context)

## Skill Quality Review

**Critical for steering:** CSO gets the skill found; this lexicon makes it steer reliably and cheaply once loaded. Run its review checklist over every draft — new skills and edits alike — during GREEN and REFACTOR.

For the full lexicon (invocation economics, leading words, completion criteria, failure modes, progressive disclosure) and the 8-step review checklist:

**@../../knowledge/principles/skill-quality.md**

Key tests to keep in mind while writing:

- **Invocation match:** manual-only skill with a rich trigger description = wasted context load; set `disable-model-invocation: true` and shrink the description to one human-facing line
- **No-op test:** does the line change behaviour versus the model's default? "Be thorough/careful/diligent" is paid noise — delete the sentence
- **Negation test:** "don't/never" steering names the banned behaviour and makes it more available; state the positive target instead (keep prohibitions only as hard guardrails, paired with the positive)
- **Completion criteria:** every step ends on a checkable, demanding bound — "every X accounted for", not "until you understand"
- **Leading word:** collapse restated qualities into one pretrained concept (*tight*, *red*, *seam*, *tracer bullet*)
- **Branch test:** inline what every run needs; disclose behind a pointer what only some branches reach — regardless of line count

## Flowchart Usage

For full graphviz conventions (when to use, node shapes, label rules, rendering tool):

**@../../knowledge/principles/graphviz-conventions.md**

Summary: use flowcharts ONLY for non-obvious decisions, process loops with early-stop risk, or "A vs B" choices. For reference material use tables; for linear instructions use numbered lists. Flowchart labels carry semantic meaning ("Check existing artifact", not "step3"), and code stays out of flowcharts — put it in fenced blocks where it can be copied.

## Code Examples

**One excellent example beats many mediocre ones.** Write it complete and runnable, commented to explain WHY, drawn from a real scenario, in the single most relevant language for the domain — the reader ports it to other languages as needed.

## The Iron Law (Same as TDD)

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

This applies to NEW skills AND EDITS to existing skills.

Write skill before testing? Delete it. Start over.
Edit skill without testing? Same violation.

**No exceptions:**
- Not for "simple additions"
- Not for "just adding a section"
- Not for "documentation updates"
- Don't keep untested changes as "reference"
- Don't "adapt" while running tests
- Delete means delete

## RED-GREEN-REFACTOR

| Phase | You do | Done when |
|-------|--------|-----------|
| **RED** | Run pressure scenarios with a subagent WITHOUT the skill; record its choices and rationalizations verbatim | Every planned scenario has a documented baseline failure |
| **GREEN** | Write the minimal skill addressing those specific failures — nothing for hypothetical cases; run the same scenarios WITH the skill | Every baseline scenario now complies |
| **REFACTOR** | Close each new loophole testing exposes (discipline skills: apply bulletproofing.md); re-test | A full re-run yields zero new rationalizations |

## Testing All Skill Types

For test strategies per skill type and pressure-scenario techniques (pressure types, plugging holes, meta-testing):

**@../../knowledge/principles/skill-testing.md**

Summary of skill types and their test focus:

- **Discipline-enforcing** (TDD, mu-review): pressure scenarios + academic checks; agent must comply under stress
- **Technique** (condition-based-waiting, root-cause-tracing): application + variation scenarios
- **Pattern** (mental models): recognition + counter-example scenarios
- **Reference** (API docs, command refs): retrieval + application + gap testing

## Common Rationalizations for Skipping Testing

| Excuse | Reality |
|--------|---------|
| "Skill is obviously clear" | Clear to you ≠ clear to other agents. Test it. |
| "It's just a reference" | References can have gaps, unclear sections. Test retrieval. |
| "Testing is overkill" | Untested skills have issues. Always. 15 min testing saves hours. |
| "I'll test if problems emerge" | Problems = agents can't use skill. Test BEFORE deploying. |
| "Too tedious to test" | Testing is less tedious than debugging bad skill in production. |
| "I'm confident it's good" | Overconfidence guarantees issues. Test anyway. |
| "Academic review is enough" | Reading ≠ using. Test application scenarios. |
| "No time to test" | Deploying untested skill wastes more time fixing it later. |

**All of these mean: Test before deploying. No exceptions.**

## Bulletproofing Discipline Skills

Discipline skills must resist rationalization under pressure. Before the REFACTOR phase of any discipline skill, read bulletproofing.md — closing loopholes explicitly, spirit-vs-letter, rationalization tables, red-flags lists, violation-symptom descriptions, and the persuasion research behind them.

## Skill Creation Checklist (TDD Adapted)

Create a task for EACH checklist item. Complete the full checklist for each skill before starting the next — deploying untested skills is deploying untested code.

**RED Phase - Write Failing Test:**
- [ ] Create pressure scenarios (3+ combined pressures for discipline skills)
- [ ] Run scenarios WITHOUT skill - document baseline behavior verbatim
- [ ] Identify patterns in rationalizations/failures

**GREEN Phase - Write Minimal Skill:**
- [ ] Name uses only letters, numbers, hyphens (no parentheses/special chars)
- [ ] YAML frontmatter: `name`, `description`, optional `disable-model-invocation` (max 1024 chars)
- [ ] Description starts with "Use when..." and includes specific triggers/symptoms
- [ ] Description written in third person
- [ ] Keywords throughout for search (errors, symptoms, tools)
- [ ] Clear overview with core principle
- [ ] Address specific baseline failures identified in RED
- [ ] Code inline OR link to separate file
- [ ] One excellent example (not multi-language)
- [ ] Run scenarios WITH skill - verify agents now comply

**REFACTOR Phase - Close Loopholes:**
- [ ] Identify NEW rationalizations from testing
- [ ] Add explicit counters per bulletproofing.md (if discipline skill)
- [ ] Build rationalization table from all test iterations
- [ ] Create red flags list
- [ ] Re-test until a full re-run yields zero new rationalizations

**Quality Checks:**
- [ ] Small flowchart only if decision non-obvious
- [ ] Quick reference table
- [ ] Common mistakes section
- [ ] No narrative storytelling
- [ ] Supporting files only for tools or disclosed reference
- [ ] Run the 8-step skill-quality review checklist (invocation match, no-op, negation, duplication, completion criteria, leading words, branch test, sediment/sprawl)

**Deployment:**
- [ ] Commit the skill (DevMuse skills: follow this repo's PR conventions)
