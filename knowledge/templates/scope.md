# Scope: <feature-name>

> **Date:** YYYY-MM-DD
> **Source:** <link to issue or user request>

## Context
- Background and motivation (why this work is needed)
- Scope of impact (which modules, users, or systems are affected)

## Quick Probe Results
- Files involved: [list of files directly related to this change]
- Fan-out: [N callers / M dependents]
- Test coverage: [existing test coverage for affected code]
- Risk signal: [low / medium / high]

## Guard Analysis (if replacing existing conditions)
- **Old condition:** `<original guard/filter>`
- **New condition:** `<proposed replacement>`
- **Regression gap:**
  - <scenario> — disposition: [intentionally allowed / must still block]

## Use Cases

### Happy Paths
- UC-1: When <action>, Then <expected result>

### Edge Cases
- UC-N: Given <precondition>, When <action>, Then <expected result>

### Error Cases
- UC-N: When <failure condition>, Then <error handling>

### Reverse Cases (must NOT happen)
- UC-R1: When <scenario that worked before>, Then <must still behave the same>

## Conflicts
- ⚠️ CONFLICT: UC-X vs UC-Y — <description of contradiction>
  - Resolution: <user decision> | PENDING

## Non-Functional Constraints
- [Performance] <constraint>
- [Security] <constraint>
- [Accessibility] <constraint>

## Constraints & Assumptions
- <technical or business constraint>
- <assumption that must hold>

## Out of Scope
- <explicitly excluded item> — <reason>

## Impact Analysis
- Affected modules: [list]
- Existing tests that may break: [list]
- Migration needs: [yes/no, details]
