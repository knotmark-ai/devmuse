# Requirements Engineering Integration — Design Spec

> **Date:** 2026-03-25
> **Issue:** [#2 feat: integrate requirements engineering into devmuse workflow](https://github.com/knotmark-ai/devmuse/issues/2)
> **Branch:** feature/requirements-engineering

## Motivation

Two concrete pain points in the current pipeline:

1. **Use case omissions on existing codebases** — `mu-design` explores user intent conversationally but does not scan the codebase to discover downstream dependencies and edge cases. Result: omissions discovered only during review or after merge.

2. **Tests verify code behavior, not requirements** — TDD in `mu-code` writes tests based on code structure, not use cases. Tests answer "does this function work?" rather than "does this feature satisfy the requirement?"

Root cause: **no dedicated requirements phase that produces use cases as a first-class artifact, traceable through design → code → tests → review.**

## Pipeline Change

```
Current:   idea → mu-design → mu-plan → mu-code → mu-review
Proposed:  idea → mu-scope → mu-design → mu-plan → mu-code → mu-review
```

**mu-scope is mandatory.** It is never skipped — simple tasks get a lightweight scope (1-2 use cases, < 1 min), complex tasks get full enumeration with conflict detection. Depth is probed, not preset.

## Design Decisions

### 1. mu-design is not renamed

"Design" is retained — its responsibility narrows from "what + how" to purely "how" (technical design). Zero migration cost.

### 2. No new agents

Agent count stays at 2 (mu-reviewer + mu-coder). Impact analysis (Quick Probe) is executed inline by `mu-scope`. Requirements coverage is a new mode on mu-reviewer.

### 3. mu-reviewer uses descriptive mode names

Modes renamed from letters to descriptive names for clarity:

| Old | New | Dispatched by |
|-----|-----|---------------|
| Mode A | review-design | mu-design |
| Mode B | review-code | mu-code |
| Mode C | review-compliance | mu-code |
| — | review-coverage (NEW) | mu-review |

### 4. Scope is always mandatory

Even bug fixes go through scope — the reproduction steps are the use case. Depth varies, the phase does not.

---

## Component Design

### Component 1: `mu-scope` skill (NEW)

**Goal:** Exhaust use cases, detect conflicts, assess impact on existing code.

**Frontmatter:**
```yaml
name: mu-scope
description: "Use before mu-design to scope work — enumerate use cases, detect conflicts, assess impact on existing code."
```

**Process:**

```
Phase 1: Quick Probe (automatic, no user interaction)
  ├─ Inline execution (no agent dispatch)
  ├─ Locate code → fan-out analysis → test coverage → historical signals
  ├─ Skip if new project (empty codebase)
  └─ Output: impact assessment + depth recommendation

Phase 2: Depth Decision (confirm with user)
  ├─ "Small impact, I'll list a few use cases to confirm?"
  └─ "Larger than expected, recommend full enumeration. Agree?"

Phase 3: Use Case Elicitation
  ├─ Enumerate: happy paths → edge cases → error cases
  ├─ Confirm each category with user
  └─ User supplements / corrects

Phase 4: Conflict Detection
  ├─ Cross-check all use cases
  ├─ Mark conflicts and pending items
  └─ User resolves each conflict

Phase 5: Output Use Case Set
  ├─ Write to docs/scope/YYYY-MM-DD-<name>.md
  └─ User confirms

Terminal state: invoke mu-design (pass scope file path)
```

**Quick Probe checks (inline, Phase 1):**

| Check | Method |
|-------|--------|
| Locate code | grep/glob for keywords from user intent |
| Fan-out | How many callers? How many dependents? |
| Test coverage | Existing tests for affected code? |
| Historical signals | Recent commits? Recent bug fixes? (git log) |
| Interface risk | Would change break public API/contracts? |

**Use case format:**
```
- UC-<N>: [Given <precondition>] When <action> Then <expected result>
```

**Conflict format:**
```
- ⚠️ CONFLICT: UC-X vs UC-Y — <description>
  - Resolution: <user decision> | PENDING
```

**Artifact: Use Case Set** — saved to `docs/scope/YYYY-MM-DD-<name>.md`

```markdown
# Scope: <feature-name>

> **Date:** YYYY-MM-DD
> **Source:** <link to issue or user request>

## Context
- Background and motivation
- Scope of impact

## Quick Probe Results
- Files involved: [list]
- Fan-out: [N callers / M dependents]
- Test coverage: [summary]
- Risk signal: [low / medium / high]

## Use Cases

### Happy Paths
- UC-1: When <action>, Then <result>
- UC-2: ...

### Edge Cases
- UC-3: Given <condition>, When <action>, Then <result>

### Error Cases
- UC-5: When <failure>, Then <handling>

## Conflicts
- ⚠️ UC-X vs UC-Y: <description>
  - Resolution: <decision>

## Non-Functional Constraints
- [Performance] ...
- [Security] ...

## Constraints & Assumptions
- ...

## Out of Scope
- ...

## Impact Analysis
- Affected modules: [list]
- Existing tests that may break: [list]
- Migration needs: [yes/no]
```

---

### Component 2: mu-reviewer `review-coverage` mode (NEW)

**Goal:** Verify every use case has corresponding implementation and tests. Produces the coverage report that closes the traceability loop.

**Dispatched by:** mu-review (after review-code)

**Input:**
```
- {SCOPE_FILE_PATH} — path to Use Case Set
- {BASE_SHA} / {HEAD_SHA} — git range to analyze
```

**Process:**
1. Read Use Case Set, extract all UC-IDs
2. Scan test files for UC-ID references (`// Covers: UC-xxx` comments)
3. For each test with a UC-ID, identify the production code it exercises (follow imports, function calls from test to source)
4. Cross-reference, generate coverage matrix

**Production code mapping heuristic:** Production code does not carry UC-ID annotations. Instead, trace from test → the functions/classes the test calls → mark those source locations as the "Code" column. If a UC-ID has a test but the test only exercises mocks (no real production code path), flag as `⚠️ Test only`.

**Output:**
```markdown
## Requirements Coverage

| Use Case | Test | Code | Status |
|----------|------|------|--------|
| UC-1 | auth.test.ts:15 | auth.ts:42 | ✅ Covered |
| UC-2 | auth.test.ts:28 | auth.ts:42 | ✅ Covered |
| UC-3 | — | — | ❌ Missing |
| UC-5↔UC-4 | auth.test.ts:55 | auth.ts:78 | ✅ Resolved |
| NFR-1 | perf.test.ts:8 | — | ⚠️ Test only |

**Status:** All Covered | Gaps Found

**Gaps:**
- UC-3 (expired password): No implementation or test found
- NFR-2 (rate limiting): No test coverage
```

**Calibration:** Only report findings with >80% confidence. If a UC-ID is not explicitly referenced in tests but the functionality is clearly covered, mark as `⚠️ Likely covered (no explicit UC-ID reference)` rather than `❌ Missing`.

---

### Component 3: `mu-design` modifications

**Goal:** Narrow mu-design to purely technical design. It always receives a scope artifact as input.

**Hard gate:**
```
mu-design requires a scope artifact (docs/scope/*.md) as input.
If no scope artifact exists, invoke mu-scope first.
Do NOT proceed with design without a scope artifact.
```

**Checklist changes:**

| Step | Before | After |
|------|--------|-------|
| 1 | Explore project context | **Read scope artifact** |
| 2 | Find architecture doc | Explore project context |
| 3 | Offer visual companion | Find architecture doc |
| 4 | Ask clarifying questions (purpose + technical) | Offer visual companion |
| 5 | Propose 2-3 approaches | Ask clarifying questions (**technical only**, no "what to build") |
| 6 | Present design | Propose 2-3 approaches (**must state UC coverage per approach**) |
| 7 | Write design doc | Present design |
| 8 | Spec review loop | Write design doc (**with Requirements Reference field**) |
| 9 | User reviews | Spec review loop (**review-design checks UC coverage**) |
| 10 | Invoke mu-plan | User reviews |
| 11 | — | Invoke mu-plan |

**Design Spec artifact — new required field:**

```markdown
## Requirements Reference
- Scope: docs/scope/2026-03-25-<name>.md
- Covers: UC-1, UC-2, UC-3, UC-4, UC-5, UC-6
- NFRs: NFR-1, NFR-2
```

**review-design — additional check:**

| Category | What to Look For |
|----------|------------------|
| (existing) Completeness | TODOs, placeholders, incomplete sections |
| (existing) Consistency | Internal contradictions |
| (existing) Clarity | Ambiguous requirements |
| (existing) Scope | Focused enough for single plan |
| (existing) YAGNI | Unrequested features |
| **(NEW) UC Coverage** | Does the design address ALL use cases from scope? Any UC without a corresponding design section? |

---

### Component 4: `mu-plan` modifications

**Goal:** Each task in the plan must reference the use cases it covers.

**Task structure change:**

````markdown
### Task N: [Component Name]

**Covers:** UC-1, UC-3

**Files:**
- Create: `src/auth/login.ts`
- Test: `tests/auth/login.test.ts`

- [ ] **Step 1: Write failing test**
...
````

This enables mu-coder to annotate tests with UC-IDs.

---

### Component 5: `mu-code` modifications

**Goal:** Tests must carry UC-ID traceability.

**mu-coder agent — new guideline:**

```markdown
## Test Traceability

When the task includes `Covers: UC-xxx`, annotate your tests:
- Add `// Covers: UC-xxx` comment before the describe/test block
- Include the use case description in test names where natural
```

**Example:**

```typescript
// Covers: UC-1
describe('login', () => {
  // UC-1: valid credentials → JWT + redirect
  it('should return JWT for valid credentials', () => {
    // ...
  });
});

// Covers: UC-5, UC-5↔UC-4 resolution
describe('account lockout', () => {
  // UC-5: 3x invalid → locked 15min
  it('should lock account after 3 failed attempts', () => {
    // ...
  });
  // UC-5 vs UC-4: lock takes priority over 2FA
  it('should not trigger 2FA when account is locked', () => {
    // ...
  });
});
```

No other changes to mu-code (TDD, worktrees, review gates all unchanged).

---

### Component 6: `mu-review` modifications

**Goal:** Add requirements coverage check after code quality review.

**Process change:**

```
Before:
  Step 1: Dispatch review (review-code)
  Step 2: Handle feedback
  Step 3: Verification
  Step 4: Finish

After:
  Step 1: Dispatch review (review-code)
  Step 2: Handle feedback
  Step 3: Dispatch review-coverage         ← NEW
  Step 4: Handle coverage gaps             ← NEW
  Step 5: Verification
  Step 6: Finish
```

**Step 3: Dispatch review-coverage**
1. Read Design Spec → find Requirements Reference → get scope file path
2. If no Requirements Reference found (legacy design spec without scope): skip review-coverage, log warning, continue to Verification
3. Dispatch mu-reviewer review-coverage mode
4. Receive Coverage Report

**Step 4: Handle coverage gaps**
```
All Covered → continue to Verification
Gaps Found →
  ├─ Missing implementation (❌) → send back to mu-code
  ├─ Missing test (⚠️) → add test
  └─ Missing in scope itself → inform user (not a code problem)
```

review-coverage is always executed (same principle as scope — never skipped, depth varies).

---

### Component 7: `bootstrap.md` modifications

**Goal:** Make mu-scope the highest-priority process skill.

**Skill priority change:**

```
Before:
  1. Process skills (design, debugging)
  2. Implementation skills (code, review)

After:
  1. Scoping skill (scope) — determines WHAT
  2. Process skills (design, debugging) — determines HOW
  3. Implementation skills (plan, code, review) — executes
```

**Decision flow:**
```
"Let's build X" → scope → design → plan → code → review
"Fix this bug"  → scope (1 use case: repro steps) → debug → code → review
"Add a button"  → scope (quick) → design → plan → code → review
```

**New red flags:**

| Thought | Reality |
|---------|---------|
| "This is too simple to need scoping" | Simple tasks are where omissions hurt most. Scope can be 1 use case. |
| "I already know what to build" | You know what YOU want. Scope finds what you missed. |
| "Just a quick fix" | Quick Probe takes 30 seconds. Just do it. |

---

## Artifact Flow (complete traceability chain)

```
Use Case Set ────────────────────────────────────────────────────┐
  │ UC-IDs defined here                                           │
  ↓                                                               │
Design Spec (Requirements Reference → scope file)                 │
  │ UC coverage per approach                                      │
  ↓                                                               │
Implementation Plan (Covers: UC-xxx per task)                     │
  │ UC-IDs passed to coder                                        │
  ↓                                                               │
Code + Tests (// Covers: UC-xxx in test files)                    │
  │ UC-IDs in test descriptions                                   │
  ↓                                                               │
Coverage Report (UC → test → code matrix) ◄───────────────────────┘
  closes the loop via review-coverage mode
```

Each artifact forward-references the previous one. The reviewer traces the chain back to the original scope to verify nothing is missed.

---

## Knowledge Migration Matrix

Refactoring mu-design must not lose knowledge. Every piece of methodology currently in mu-design is either **migrated** to mu-scope or **retained** in mu-design.

| Knowledge in current mu-design | Destination | Action |
|-----------------------------------|-------------|--------|
| One question at a time, multiple choice preferred | mu-scope | **Migrate** — same methodology applies to use case elicitation |
| Scope assessment (multi-subsystem → decompose into sub-projects) | mu-scope | **Migrate** — scope decides if decomposition is needed, before design |
| Focus on purpose, constraints, success criteria | mu-scope | **Migrate** — this is requirements elicitation, not design |
| 2-3 approaches with trade-offs | mu-design | **Retain** — this is technical design methodology |
| Incremental validation (present sections, get approval) | Both | **Retain in design, replicate in scope** — scope also presents use cases incrementally |
| Visual Companion | mu-design | **Retain** — visual questions are about design (layouts, architecture diagrams), not requirements |
| Design for isolation and clarity | mu-design | **Retain** — architecture principle |
| Working in existing codebases (follow existing patterns) | Both | **Retain in design, reference in scope** — scope's Quick Probe explores existing code; design follows existing patterns |
| YAGNI ruthlessly | Both | **Retain in both** — scope: don't add unnecessary use cases; design: don't over-engineer |
| Spec review loop (dispatch reviewer, max 3 iterations) | Both | **Retain in design, replicate in scope** — scope can optionally review use case quality |
| Write design doc + commit | mu-design | **Retain** |
| Anti-pattern: "too simple to need a design" | mu-scope | **Migrate** — becomes "too simple to need scoping" |

**Implementation constraint:** When modifying mu-design, the implementer must verify every section of the current SKILL.md is accounted for — either retained, migrated to mu-scope, or explicitly marked as removed with justification. No silent deletions.

---

## Architecture Impact

### Files to create
- `skills/mu-scope/SKILL.md`
- `knowledge/templates/scope.md` (Use Case Set template)

### Files to modify
- `agents/mu-reviewer.md` — add review-coverage mode, rename modes A/B/C to descriptive names
- `skills/mu-design/SKILL.md` — add scope artifact gate, remove exploratory elicitation, add Requirements Reference
- `skills/mu-plan/SKILL.md` — add `Covers: UC-xxx` to task structure
- `skills/mu-code/SKILL.md` — add test traceability guideline
- `agents/mu-coder.md` — add test traceability section
- `skills/mu-review/SKILL.md` — add review-coverage dispatch step
- `rules/bootstrap.md` — update skill priority, add scope to decision flow
- `docs/architecture.md` — update pipeline description, add mu-scope to skill table
- `.claude-plugin/plugin.json` — add mu-scope skill path

### Files unchanged
- `skills/mu-debug/SKILL.md`
- `skills/mu-write-skill/SKILL.md`
- `knowledge/languages/*`

---

## Summary of Changes

| Component | Change Type | Effort |
|-----------|------------|--------|
| mu-scope | NEW skill | High |
| review-coverage | NEW reviewer mode | Medium |
| scope template | NEW knowledge file | Low |
| mu-design | Modify (add gate, narrow questions) | Medium |
| mu-plan | Modify (add UC-ID per task) | Low |
| mu-code | Modify (add traceability guideline) | Low |
| mu-coder | Modify (add traceability section) | Low |
| mu-review | Modify (add coverage step) | Medium |
| mu-reviewer | Modify (add mode, rename modes) | Medium |
| bootstrap | Modify (update priority) | Low |
| architecture.md | Modify (update docs) | Low |
| plugin.json | Modify (add skill path) | Low |
