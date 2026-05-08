# Scope: Codex Cross-Review

> **Date:** 2026-05-07
> **Source:** User request — add Codex CLI as an external reviewer in mu-review workflow

## Context
- DevMuse's review pipeline is currently Claude-only (mu-reviewer subagent with 6 modes)
- ECC project demonstrates cross-harness review via shell-invoked `codex exec` with file-based IPC
- Goal: add Codex as an optional external reviewer mode within the existing mu-review skill, providing a "second opinion" from a different model family

## Quick Probe Results
- Files involved: `skills/mu-review/SKILL.md`, `agents/mu-reviewer.md` (existing review infrastructure)
- Fan-out: mu-review called by mu-code; mu-reviewer is standalone agent
- Test coverage: no automated tests for skill files (instruction-based system)
- Risk signal: medium — new external dependency (codex CLI), but additive (does not alter existing flows)

## Use Cases

### Happy Paths
- UC-1: When user explicitly requests Codex review (e.g., "let codex review this"), Then check codex CLI availability → invoke codex review on current diff → return structured feedback (Summary / Issues / Risk Assessment)
- UC-2: When mu-review detects a high-risk scenario (security-sensitive changes, large diff >300 lines, changes spanning 2+ distinct module boundaries, or Claude reviewer reports low confidence), Then suggest Codex cross-review to user; proceed only on user confirmation
- UC-3: When codex review completes successfully, Then produce structured report aligned with mu-reviewer output format → feed into mu-review Step 2 (feedback handling) using the existing "External Reviewers" path

### Edge Cases
- UC-5: Given codex CLI installed but not authenticated (API key missing, OAuth expired), When codex review is triggered, Then detect auth error from codex output → surface error with fix instructions ("Run `codex login` or set `OPENAI_API_KEY`") → fall back to Claude-only review
- UC-6: Given codex review times out or fails (network issue, model overload), When awaiting codex response, Then report failure → fall back to Claude-only review → do not block the workflow
- UC-7: Given Claude reviewer and Codex reviewer produce contradictory conclusions, When presenting results, Then show both opinions side-by-side with source labels → let user decide (no automatic merge)

### Error Cases
- UC-8: When codex output is malformed (non-structured, truncated, empty), Then best-effort parse + surface raw output to user as fallback
- UC-9: When user declines codex review suggestion (from UC-2), Then continue with Claude-only review → do not re-suggest codex in the same session

### Reverse Cases (must NOT happen)
- UC-R1: When codex is not installed (`command -v codex` fails), Then codex review capability must be completely invisible — no suggestion, no prompt, no mention in any output
- UC-R2: When codex review fails for any reason, Then existing mu-review flow must not be blocked or degraded — always fall back gracefully

## Conflicts
- None found. UC-1 (explicit trigger) and UC-2 (system suggestion) are complementary paths. UC-6 (failure fallback) and UC-9 (user refusal) are distinct: failure does not suppress future suggestions, refusal does (within session).

## Non-Functional Constraints
- [Performance] Codex detection (`command -v codex`) must be <1s; cached after first check per session
- [UX] First-time codex invocation requires explicit user consent; subsequent invocations in same session do not re-ask
- [Reliability] Codex review failure must never block the review pipeline

## Constraints & Assumptions
- Codex CLI binary name is `codex`; detection via `command -v codex` only
- If codex is not installed, the capability is entirely invisible — no installation guidance, no mention
- Codex supports `codex exec` for non-interactive programmatic invocation
- Auth detection is runtime-only (attempt invocation, handle failure) — `codex login status` is unreliable for API key auth
- Output format from `codex exec` can be captured via `-o` flag to a file

## Out of Scope
- Codex installation guidance or onboarding — if not installed, capability is invisible
- Replacing mu-reviewer with Codex — this is additive, not a replacement
- Multi-harness orchestration (dmux/tmux pane management) — only single-process codex invocation
- GAN-style adversarial loops between Claude and Codex — simple one-shot review only

## Impact Analysis
- Affected modules: `skills/mu-review/SKILL.md` (add codex review step), potentially new script for codex invocation
- Existing tests that may break: none (additive change)
- Migration needs: no — existing review flows unchanged
