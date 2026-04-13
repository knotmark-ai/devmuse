# Design: Reviewer Anchor Validation & Batched Execution

> **Date:** 2026-04-01
> **Issue:** https://github.com/knotmark-ai/devmuse/issues/1

## Requirements Reference
- Scope: docs/scope/2026-04-01-reviewer-anchor-validation.md
- Covers: UC-1 through UC-16
- NFRs: Reliability (zero fabrication tolerance), Transparency (coverage reporting)

## Problem

mu-reviewer hallucinates when dispatched without proper anchor inputs. All four review modes share this vulnerability. When the review scope exceeds what the agent can process in a single pass, it fills gaps with fabricated content.

## Approach

**Chosen: Approach A — Minimal change with validation gate + discipline rules + re-dispatch.**

Defense in two layers following the architecture's separation of concerns:
- **Agent layer** (mu-reviewer): validation gate + execution discipline + coverage tracking
- **Skill layer** (mu-review, mu-code, mu-design): dispatcher-side validation + re-dispatch for incomplete coverage

## Design

### 1. Agent Layer: `agents/mu-reviewer.md`

#### 1.1 Anchor Validation Gate

New section added **before** all review mode definitions. Acts as a hard gate for every mode.

```markdown
## Anchor Validation (BEFORE any review)

Before starting any review mode, validate all required inputs:

| Mode | Required Inputs | Validation |
|------|----------------|------------|
| review-code | BASE_SHA, HEAD_SHA | Run `git rev-parse` to verify SHAs exist |
| review-design | SPEC_FILE_PATH | Verify file exists via Read |
| review-compliance | REQUIREMENTS (text), IMPLEMENTER_REPORT (text) | Both must be non-empty |
| review-coverage | SCOPE_FILE_PATH, BASE_SHA, HEAD_SHA | Verify file exists + SHAs valid |

IF any required input is missing or invalid:
  STOP. Return exactly:
  "Cannot start review: missing {input_name}. Required for {mode} mode."
  DO NOT proceed. DO NOT fabricate content.
```

**Covers:** UC-11, UC-12, UC-13

#### 1.2 Execution Discipline

New rules added to the existing **General Principles** section.

```markdown
## Execution Discipline

- NEVER produce a finding for a file you haven't read with the Read tool
- NEVER fabricate file paths, line numbers, or code snippets
- If a file path doesn't exist: report "file not found: {path}", skip it
- If a file is unreadable (binary, too large): report "unable to analyze: {path}", skip it
- If a file was deleted in the diff range: report "file deleted in this range: {path}", skip it
- Every finding MUST include a file:line reference to content you actually read
```

**Covers:** UC-1, UC-2, UC-3, UC-4, UC-6, UC-9, UC-10, UC-14

#### 1.3 Coverage Tracking

Required at the end of every review output.

```markdown
### Coverage Tracking

At the end of every review output, include:

## Coverage
- Files in scope: [N]
- Files reviewed: [list]
- Files NOT reviewed: [list with reason]

If any files were not reviewed, state the reason (not found, unreadable, context limit).
```

**Covers:** UC-5, UC-7, UC-8

#### 1.4 Empty Diff Handling

Added to the review-code process flow, after `git diff --stat`:

```markdown
IF diff is empty (no files changed):
  STOP. Return: "No changes in range {BASE_SHA}..{HEAD_SHA}."
```

**Covers:** UC-7

### 2. Skill Layer

#### 2.1 `skills/mu-review/SKILL.md`

**Location:** Step 1 (Dispatch Review) → "How to Request" section

**Add input validation (after getting SHAs, before dispatch):**

```markdown
**3. Validate inputs before dispatch:**

BEFORE dispatching mu-reviewer:
  - review-code: verify BASE_SHA and HEAD_SHA are valid (`git rev-parse`)
  - review-design: verify spec file path exists
  - review-coverage: verify scope file exists + SHAs valid
  IF invalid: warn user, do NOT dispatch.
```

**Add re-dispatch logic (after acting on feedback):**

```markdown
**4. Handle incomplete coverage:**

IF reviewer output contains files in "NOT reviewed" list:
  Re-dispatch a new reviewer instance for the remaining files.
  Repeat until all files are covered.
  Merge findings from all rounds.
```

**Covers:** UC-15, UC-16

#### 2.2 `skills/mu-code/SKILL.md`

**Location:** Review Gates section → Stage 1 and Stage 2

**Add to both stages:**

```markdown
**Before dispatching:** verify BASE_SHA and HEAD_SHA are set.
If reviewer returns files NOT reviewed, re-dispatch for remaining files.
```

**Covers:** UC-15, UC-16 (in mu-code context)

#### 2.3 `skills/mu-design/SKILL.md`

**Location:** Spec Review Loop section

**Add before dispatch step:**

```markdown
**Before dispatching:** verify spec file path exists and is readable.
```

**Covers:** UC-15 (in mu-design context)

## UC Coverage Matrix

| UC | Agent Validation | Agent Discipline | Agent Coverage | Skill Validation | Skill Re-dispatch |
|----|:---:|:---:|:---:|:---:|:---:|
| UC-1 (review-code happy path) | | x | | | |
| UC-2 (review-design happy path) | | x | | | |
| UC-3 (review-compliance happy path) | | x | | | |
| UC-4 (review-coverage happy path) | | x | | | |
| UC-5 (large scope batching) | | | x | | |
| UC-6 (non-code files) | | x | | | |
| UC-7 (empty diff) | x | | x | | |
| UC-8 (very large scope) | | | x | | x |
| UC-9 (unreadable content) | | x | | | |
| UC-10 (compliance discrepancy) | | x | | | |
| UC-11 (missing SHA) | x | | | x | |
| UC-12 (missing spec path) | x | | | x | |
| UC-13 (missing scope path) | x | | | x | |
| UC-14 (deleted file) | | x | | | |
| UC-15 (dispatcher validation) | | | | x | |
| UC-16 (re-dispatch for coverage) | | | x | | x |

## Files Changed

| File | Change Type | Lines Added (est.) |
|------|------------|-------------------|
| `agents/mu-reviewer.md` | Modified | ~30 |
| `skills/mu-review/SKILL.md` | Modified | ~10 |
| `skills/mu-code/SKILL.md` | Modified | ~5 |
| `skills/mu-design/SKILL.md` | Modified | ~2 |

## Out of Scope

- Full-codebase audit as a dedicated new skill
- Automated testing of prompt-based agents
- Changes to mu-reviewer's checklist content (security, code quality criteria)
