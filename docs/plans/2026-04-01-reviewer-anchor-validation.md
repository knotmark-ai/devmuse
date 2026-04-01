# Reviewer Anchor Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use devmuse:mu-code to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent mu-reviewer hallucination by adding anchor validation gates, execution discipline rules, and coverage tracking to the agent, plus dispatcher-side validation and re-dispatch logic to all calling skills.

**Architecture:** Two-layer defense — agent layer validates inputs and enforces discipline, skill layer validates before dispatch and re-dispatches for incomplete coverage. No code changes; all modifications are to markdown prompt files.

**Tech Stack:** Markdown (prompt engineering)

**Spec:** docs/specs/2026-04-01-reviewer-anchor-validation-design.md

---

### Task 1: Add Anchor Validation Gate to mu-reviewer

**Covers:** UC-7, UC-11, UC-12, UC-13

**Files:**
- Modify: `agents/mu-reviewer.md` (insert new section before existing review modes)

- [ ] **Step 1: Read current file**

Read `agents/mu-reviewer.md` to understand current structure.

- [ ] **Step 2: Add Anchor Validation section**

Insert the following section immediately after the frontmatter and `# Reviewer` heading, before `## review-design`:

```markdown
## Anchor Validation

Before starting any review mode, validate all required inputs.

| Mode | Required Inputs | Validation |
|------|----------------|------------|
| review-code | BASE_SHA, HEAD_SHA | Run `git rev-parse {SHA}` to verify each SHA exists |
| review-design | SPEC_FILE_PATH | Verify file exists via Read tool |
| review-compliance | REQUIREMENTS (text), IMPLEMENTER_REPORT (text) | Both must be non-empty |
| review-coverage | SCOPE_FILE_PATH, BASE_SHA, HEAD_SHA | Verify file exists via Read + verify SHAs via `git rev-parse` |

IF any required input is missing or invalid:
  STOP. Return exactly:
  "Cannot start review: missing {input_name}. Required for {mode} mode."
  DO NOT proceed. DO NOT fabricate content.
```

- [ ] **Step 3: Verify the edit**

Read `agents/mu-reviewer.md` and confirm the new section is correctly placed between the heading and `## review-design`.

- [ ] **Step 4: Commit**

```bash
git add agents/mu-reviewer.md
git commit -m "feat(mu-reviewer): add anchor validation gate for all review modes (#1)"
```

---

### Task 2: Add Execution Discipline and Coverage Tracking to mu-reviewer

**Covers:** UC-1, UC-2, UC-3, UC-4, UC-5, UC-6, UC-8, UC-9, UC-10, UC-14

**Files:**
- Modify: `agents/mu-reviewer.md` (add to General Principles section)

- [ ] **Step 1: Read General Principles section**

Read the end of `agents/mu-reviewer.md` to locate the `## General Principles` section.

- [ ] **Step 2: Add Execution Discipline rules**

Insert the following before the existing General Principles bullet list:

```markdown
## Execution Discipline

- NEVER produce a finding for a file you haven't read with the Read tool
- NEVER fabricate file paths, line numbers, or code snippets
- If a file path doesn't exist: report "file not found: {path}", skip it
- If a file is unreadable (binary, too large): report "unable to analyze: {path}", skip it
- If a file was deleted in the diff range: report "file deleted in this range: {path}", skip it
- Every finding MUST include a file:line reference to content you actually read

### Coverage Tracking

At the end of every review output, include a coverage section:

```
## Coverage
- Files in scope: [N]
- Files reviewed: [list]
- Files NOT reviewed: [list with reason]
```

If any files were not reviewed, state the reason (not found, unreadable, context limit).
```

- [ ] **Step 3: Add empty diff handling to review-code**

In the `## review-code` section, after the `git diff --stat BASE..HEAD` step in the process flow, add:

```markdown
IF diff is empty (no files changed):
  STOP. Return: "No changes in range {BASE_SHA}..{HEAD_SHA}."
```

- [ ] **Step 4: Verify edits**

Read `agents/mu-reviewer.md` and confirm both additions are correctly placed.

- [ ] **Step 5: Commit**

```bash
git add agents/mu-reviewer.md
git commit -m "feat(mu-reviewer): add execution discipline and coverage tracking (#1)"
```

---

### Task 3: Add Dispatcher Validation and Re-dispatch to mu-review skill

**Covers:** UC-15, UC-16

**Files:**
- Modify: `skills/mu-review/SKILL.md` (Step 1: Dispatch Review section)

- [ ] **Step 1: Read current dispatch section**

Read `skills/mu-review/SKILL.md` lines 50-110 to understand the "How to Request" section.

- [ ] **Step 2: Add input validation step**

After the existing step "2. Dispatch mu-reviewer subagent", add:

```markdown
**3. Validate inputs before dispatch:**

BEFORE dispatching mu-reviewer:
  - review-code: verify BASE_SHA and HEAD_SHA are valid (`git rev-parse {SHA}`)
  - review-design: verify spec file path exists (`Read` the file)
  - review-coverage: verify scope file exists + SHAs valid
  IF any input invalid: warn user, do NOT dispatch.
```

- [ ] **Step 3: Add re-dispatch logic**

After the existing step "3. Act on feedback by severity", add:

```markdown
**4. Handle incomplete coverage:**

IF reviewer output contains files in "NOT reviewed" list:
  Re-dispatch a new reviewer instance for the remaining files only.
  Repeat until all files are covered.
  Merge findings from all rounds into a single report.
```

- [ ] **Step 4: Verify edits**

Read `skills/mu-review/SKILL.md` and confirm both additions are in the correct location.

- [ ] **Step 5: Commit**

```bash
git add skills/mu-review/SKILL.md
git commit -m "feat(mu-review): add dispatcher validation and re-dispatch logic (#1)"
```

---

### Task 4: Add Review Gate Validation to mu-code skill

**Covers:** UC-15, UC-16 (in mu-code context)

**Files:**
- Modify: `skills/mu-code/SKILL.md` (Review Gates section)

- [ ] **Step 1: Read Review Gates section**

Read `skills/mu-code/SKILL.md` lines 960-985 to locate the Review Gates section.

- [ ] **Step 2: Add validation to Stage 1 (Spec Compliance)**

Before the existing "Dispatch reviewer using..." line in Stage 1, add:

```markdown
**Before dispatching:** verify BASE_SHA and HEAD_SHA are set (`git rev-parse`).
If reviewer returns files in "NOT reviewed" list, re-dispatch for remaining files.
```

- [ ] **Step 3: Add validation to Stage 2 (Code Quality)**

Before the existing "Dispatch reviewer using..." line in Stage 2, add the same validation text as Stage 1.

- [ ] **Step 4: Verify edits**

Read `skills/mu-code/SKILL.md` lines 960-990 and confirm both additions are correctly placed.

- [ ] **Step 5: Commit**

```bash
git add skills/mu-code/SKILL.md
git commit -m "feat(mu-code): add review gate validation for reviewer dispatch (#1)"
```

---

### Task 5: Add Spec Path Validation to mu-design skill

**Covers:** UC-15 (in mu-design context)

**Files:**
- Modify: `skills/mu-design/SKILL.md` (Spec Review Loop section)

- [ ] **Step 1: Read Spec Review Loop section**

Read `skills/mu-design/SKILL.md` lines 150-160 to locate the Spec Review Loop.

- [ ] **Step 2: Add validation**

Before step 1 ("Dispatch mu-reviewer subagent with review-design mode"), add:

```markdown
0. **Before dispatching:** verify the spec file path exists and is readable (Read the file). If not found, fix the path before dispatching.
```

- [ ] **Step 3: Verify edit**

Read `skills/mu-design/SKILL.md` lines 150-165 and confirm the addition.

- [ ] **Step 4: Commit**

```bash
git add skills/mu-design/SKILL.md
git commit -m "feat(mu-design): add spec path validation before reviewer dispatch (#1)"
```
