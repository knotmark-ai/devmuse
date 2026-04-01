# Scope: Reviewer Anchor Validation & Batched Execution

> **Date:** 2026-04-01
> **Source:** https://github.com/knotmark-ai/devmuse/issues/1

## Context
- mu-reviewer hallucinates when dispatched without proper anchor inputs (~80% false positive rate observed in a full-codebase review)
- Root cause: no validation gate for required inputs, and no batching discipline when scope exceeds agent capacity
- Affects all 4 review modes (review-code, review-design, review-compliance, review-coverage)
- All callers affected: mu-review skill, mu-code skill, mu-design skill

## Quick Probe Results
- Files involved: `agents/mu-reviewer.md`, `skills/mu-review/SKILL.md`, `skills/mu-code/SKILL.md`, `skills/mu-design/SKILL.md`
- Fan-out: 3 callers (mu-review, mu-code, mu-design)
- Test coverage: none (prompt files, not code)
- Risk signal: medium

## Use Cases

### Happy Paths
- UC-1: When mu-reviewer is dispatched in review-code mode with valid BASE_SHA and HEAD_SHA, Then it runs `git diff`, reads only the files in the diff, and produces findings anchored to actual code.
- UC-2: When mu-reviewer is dispatched in review-design mode with a valid spec file path, Then it reads the spec file and produces findings anchored to actual spec content.
- UC-3: When mu-reviewer is dispatched in review-compliance mode with valid requirements and implementation report, Then it reads actual code to verify claims and produces findings anchored to real files.
- UC-4: When mu-reviewer is dispatched in review-coverage mode with a valid scope file path and valid SHA range, Then it reads the scope file and scans test files in the diff range, producing a coverage matrix anchored to actual code.
- UC-5: When the review scope is large (e.g., diff spans 15+ files), Then mu-reviewer enumerates all files first, processes them in batches, tracks reviewed/not-reviewed files, and reports coverage in the final output.

### Edge Cases
- UC-6: When the diff range is valid but contains only non-code files (e.g., only `.md` or `.json` changes), Then mu-reviewer still reviews them using the same discipline (read before claim), applying relevant checklist items.
- UC-7: When the diff range is valid but the diff is empty (BASE_SHA == HEAD_SHA or no changes), Then mu-reviewer reports "no changes in range" and stops without producing findings.
- UC-8: When the review scope is very large (e.g., 50+ files), Then mu-reviewer batches execution and transparently reports which files were reviewed and which were not (if context limits prevent reading all).
- UC-9: When mu-reviewer reads a file and encounters content it doesn't understand (e.g., binary, minified code), Then it reports "unable to analyze" for that file rather than guessing.
- UC-10: When mu-code dispatches review-compliance and the implementer report claims something that doesn't match the actual code, Then mu-reviewer flags the discrepancy based on code it actually read (not trusting the report).
- UC-16: When mu-reviewer reports files as "not reviewed" due to context limits, Then the dispatcher re-dispatches a new reviewer instance for the remaining files, repeating until all files are covered.

### Error Cases
- UC-11: When mu-reviewer is dispatched in review-code mode without BASE_SHA or HEAD_SHA, Then it refuses to execute and returns a clear error: "Cannot review without git SHA range."
- UC-12: When mu-reviewer is dispatched in review-design mode without a spec file path or with a non-existent path, Then it refuses to execute and returns: "Spec file not found: {path}."
- UC-13: When mu-reviewer is dispatched in review-coverage mode without a scope file path, Then it refuses to execute and returns: "Cannot review coverage without scope file."
- UC-14: When mu-reviewer attempts to read a file referenced in the diff but the file doesn't exist (e.g., deleted file), Then it notes "file deleted in this range" rather than fabricating content.
- UC-15: When the dispatcher (mu-review skill / mu-code / mu-design) is about to dispatch mu-reviewer but required inputs are missing, Then the dispatcher itself validates and warns the user before dispatching.

## Conflicts
- UC-8 vs completeness expectation: when reviewer can't read all files, dispatcher re-dispatches for remaining files (UC-16). Resolution: dispatcher handles re-dispatch loop.

## Non-Functional Constraints
- [Reliability] Findings must be anchored to actually-read content; zero tolerance for fabricated file paths, line numbers, or code snippets
- [Transparency] Every review output must report what was reviewed and what was not

## Constraints & Assumptions
- mu-reviewer is a prompt-based agent (`.md` file), not executable code — validation is enforced via prompt instructions, not programmatic gates
- Batching threshold and batch size are heuristic; exact values may need tuning
- Dispatcher re-dispatch loop (UC-16) adds complexity to mu-review/mu-code/mu-design skills

## Out of Scope
- Full-codebase audit as a dedicated new skill — defer unless this scope proves insufficient
- Automated testing of prompt-based agents — no test framework exists for this today
- Changes to mu-reviewer's checklist content (security, code quality criteria) — only changing execution discipline

## Impact Analysis
- Affected modules: `agents/mu-reviewer.md`, `skills/mu-review/SKILL.md`, `skills/mu-code/SKILL.md`, `skills/mu-design/SKILL.md`
- Existing tests that may break: none
- Migration needs: no — changes are additive to existing prompt instructions
