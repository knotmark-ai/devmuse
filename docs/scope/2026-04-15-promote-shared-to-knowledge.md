# Scope: Promote Shared Reference Content to knowledge/

> **Date:** 2026-04-15
> **Triggered by:** Issue #6 — consistency audit flagged mu-code (1041 lines) and mu-write-skill (653 lines) as oversized. Initial proposal was local-appendix split. Further analysis showed mu-code's bulk is TDD enforcement (must stay inline per PR #3 lesson), so this work narrows to extracting truly-reference content from mu-write-skill only.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | mu-code refactor | **Skip** — bulk is TDD enforcement, splitting would violate PR #3 lesson (HARD-GATE / behavior-shaping text stays inline) |
| 2 | mu-write-skill extraction mechanism | Extract reference sections to `knowledge/principles/` (follows existing pattern) rather than local appendix files |
| 3 | What moves | CSO guidance, graphviz conventions, skill-type testing methodology — all pure reference material |
| 4 | What stays | Iron Law, HARD-GATE, TDD mapping, rationalization tables, anti-patterns with examples, bulletproofing — all enforcement or pedagogical |

## Use Cases

### Happy Paths

- UC-1: When a user authors a new skill and needs guidance on writing a discoverable description, Then they load `knowledge/principles/skill-cso.md` directly or via mu-write-skill's reference
- UC-2: When mu-write-skill runs, Then it references @../../knowledge/principles/skill-cso.md for CSO detail instead of inlining 148 lines
- UC-3: When a user wants graphviz conventions (for any skill, not just mu-write-skill), Then they can load `knowledge/principles/graphviz-conventions.md` without going through mu-write-skill
- UC-4: When mu-write-skill's testing phase runs, Then it references @../../knowledge/principles/skill-testing.md for per-type test approaches

### Edge Cases

- UC-5: Given the extracted knowledge files are referenced via @path, When the agent skips loading them, Then the core skill workflow in mu-write-skill SKILL.md still contains enough to complete basic skill creation (the extracted content is reference, not enforcement)
- UC-6: Given historical docs reference specific line numbers in mu-write-skill, When the extraction happens, Then those references become stale — accepted, history is immutable

### Error Cases

- UC-7: When the extracted content file is missing/unreadable, Then mu-write-skill degrades gracefully — the extracted sections are advisory, not blocking

## Out of Scope

- **mu-code refactor** — deferred indefinitely (splitting it would hurt more than help)
- **TDD rationalization consolidation** across mu-code and mu-write-skill — not actually duplicated (they cover different domains: writing code vs. writing skills)
- **Full split of mu-write-skill** as originally proposed in Issue #6 — narrowed scope
- **Updating skill-triggering tests** — they don't reference the extracted content

## Impact Analysis

### Files affected

**New files (3):**
- `knowledge/principles/skill-cso.md`
- `knowledge/principles/graphviz-conventions.md`
- `knowledge/principles/skill-testing.md`

**Modified files (1):**
- `skills/mu-write-skill/SKILL.md` — remove extracted sections, add @path references

**Expected line count change:**
- mu-write-skill: 653 → ~400 lines
- Three new knowledge files total ~230 lines

### Existing tests
- No hook tests affected
- skill-triggering tests don't reference the extracted sections

### Migration needs
- None — purely additive for knowledge/; mu-write-skill loses verbose sections but retains references
