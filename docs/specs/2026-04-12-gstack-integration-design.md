# Design: gstack Integration

> **Date:** 2026-04-12
> **Author:** Jeff + Claude

## Requirements Reference

- Scope: docs/scope/2026-04-12-gstack-integration.md
- Covers: UC-1, UC-2, UC-3, UC-4, UC-5, UC-6, UC-7, UC-9, UC-10, UC-11, UC-12, UC-13, UC-15, UC-16, UC-17, UC-18, UC-19, UC-20, UC-21, UC-22, UC-23, UC-24, UC-25, UC-26, UC-27
- Dropped: UC-14 (mu-debug exemption — unnecessary, bootstrap already requires scope for bug fixes)
- NFRs: Reliability (<500ms hook execution), Safety (fail-open), Compatibility (Claude Code plugin hooks), Maintainability (self-contained markdown), Portability (no external dependencies)

## Overview

Absorb valuable patterns from gstack into devmuse across 4 workflows:

| Workflow | What changes | Key files |
|---|---|---|
| A: PreToolUse Hooks | Pipeline enforcement + destructive command safety | `hooks/pre-tool-use/pipeline-gate.sh`, `destructive-guard.sh` |
| B: Knowledge + Reviewer | Security review mode, design audit rubric, inversion reflex, premise check | `knowledge/{reviews,principles}/*.md`, `agents/mu-reviewer.md`, `skills/mu-{design,scope,review}/SKILL.md` |
| C: Knowledge Organization | Semantic classification of knowledge files | `knowledge/{principles,reviews}/` dirs, `docs/architecture.md` |
| D: Pipeline-External Skills | mu-premise (premise interrogation) + mu-retro (retrospective) | `skills/mu-{premise,retro}/SKILL.md` |

## Workflow A: PreToolUse Hooks

### Architecture

Two independent bash scripts, each registered as a separate PreToolUse hook in hooks.json. Scripts are stateless — they read stdin (JSON with tool name + parameters), check conditions, and write stdout (JSON permission decision or empty).

```
hooks/
├── hooks.json                          # SessionStart + 2x PreToolUse
├── session-start                       # existing
└── pre-tool-use/
    ├── pipeline-gate.sh                # UC-1,2,3,12,13,16,24,27
    └── destructive-guard.sh            # UC-4,15,24
```

### hooks.json Changes

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/session-start\"",
            "async": false
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use/pipeline-gate.sh\"",
            "async": false
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"${CLAUDE_PLUGIN_ROOT}/hooks/pre-tool-use/destructive-guard.sh\"",
            "async": false
          }
        ]
      }
    ]
  }
}
```

### pipeline-gate.sh

**Input:** JSON on stdin with `tool_name` and `tool_input` (containing `file_path` for Edit/Write).

**Logic:**

```
Read JSON stdin → extract file_path from tool_input
  ↓
Is file_path inside devmuse plugin directory? (skills/, agents/, knowledge/, rules/, hooks/)
  → YES: exit 0 (empty output = allow, UC-13)
  → NO: continue
  ↓
Does any file matching docs/scope/*.md exist in CWD?
  → NO: output {"permissionDecision":"deny","message":"No scope artifact found. Run mu-scope first."} (UC-1)
  → YES: continue
  ↓
Does any file matching docs/specs/*-design*.md exist in CWD?
  → NO: output {"permissionDecision":"deny","message":"No design spec found. Run mu-design first."} (UC-2)
  → YES: exit 0 (allow, UC-3)
```

**Fail-open:** Wrap entire logic in `trap 'exit 0' ERR`. Any bash error → exit 0 → no decision → Claude Code proceeds normally (UC-24).

**File path detection for plugin directory exemption (UC-13):** The hook resolves `CLAUDE_PLUGIN_ROOT` and checks if the target file_path starts with that prefix. This covers mu-write-skill editing skills, mu-debug editing plugin code, etc.

**Performance:** Only `ls` / glob checks on `docs/scope/` and `docs/specs/`. No git commands, no parsing file contents. Expected <50ms (UC-NFR: <500ms).

### destructive-guard.sh

**Input:** JSON on stdin with `tool_input` (containing `command` for Bash).

**Logic:**

```
Read JSON stdin → extract command string
  ↓
Does command match safe patterns? (rm -rf node_modules, rm -rf dist, rm -rf .next, rm -rf build, rm -rf __pycache__)
  → YES: exit 0 (allow, UC-15)
  → NO: continue
  ↓
Does command match dangerous patterns? (rm -rf, git push -f, git push --force, DROP TABLE, git reset --hard, git clean -fd)
  → YES: output {"permissionDecision":"ask","message":"⚠️ Destructive command detected: <pattern>. Proceed?"} (UC-4)
  → NO: exit 0 (allow)
```

**Fail-open:** Same trap pattern as pipeline-gate.sh (UC-24).

**Pattern matching:** Simple bash `case` or `grep -qE` on the command string. No complex parsing needed — false positives (matching in comments/strings) are acceptable since the action is "ask" not "deny".

### UC Coverage for Workflow A

| UC | Covered by | How |
|---|---|---|
| UC-1 | pipeline-gate.sh | deny when no scope |
| UC-2 | pipeline-gate.sh | deny when no design |
| UC-3 | pipeline-gate.sh | allow when both exist |
| UC-4 | destructive-guard.sh | ask on dangerous patterns |
| UC-12 | pipeline-gate.sh | checks existence only, not content |
| UC-13 | pipeline-gate.sh | plugin dir prefix check → allow |
| UC-15 | destructive-guard.sh | safe patterns early-exit |
| UC-16 | pipeline-gate.sh | glob `docs/scope/*.md` matches any file |
| UC-24 | both scripts | trap ERR → exit 0 |
| UC-27 | Claude Code framework | hook says deny, user can override in prompt |

---

## Workflow B: Knowledge Files + mu-reviewer Enhancement

### New Knowledge Files

#### knowledge/reviews/security-checklist.md

Content adapted from gstack's `/cso` 5-phase methodology. Structure:

```markdown
# Security Review Checklist

## Phase 1: Architecture Mental Model
- Identify tech stack (framework, DB, auth provider, hosting)
- Map data flow: user input → processing → storage → output
- Identify trust boundaries (authenticated vs unauthenticated, internal vs external)

## Phase 2: Attack Surface Census
- List all unauthenticated endpoints
- List file upload handlers
- List webhook/callback receivers
- List background jobs that process external data
- List admin/management interfaces

## Phase 3: Secrets Archaeology
- Scan diff for hardcoded credentials (API keys, passwords, tokens)
- Check .env file patterns (committed? in .gitignore?)
- Check CI config for inline secrets vs secret manager references

## Phase 4: Dependency Supply Chain
- Check for known vulnerabilities (npm audit / pip audit / go vuln)
- Check for abandoned packages (last publish > 2 years)
- Check install scripts for suspicious behavior

## Phase 5: CI/CD Pipeline
- Check for unpinned GitHub Actions (uses: org/action@main vs @sha)
- Check for script injection via ${{ github.event.* }}
- Check for pull_request_target with checkout of PR code

## Severity Guide
- CRITICAL: Exploitable now, data loss/breach possible
- HIGH: Exploitable with effort, significant impact
- MEDIUM: Requires specific conditions, moderate impact
- LOW: Theoretical risk, minimal impact
```

#### knowledge/reviews/design-audit-rubric.md

Content adapted from gstack's `/plan-eng-review`. Structure:

```markdown
# Design Audit Rubric

## Architecture
- Data flow diagram (ASCII) for non-trivial flows — if missing, flag
- Component boundaries: can each be understood and tested independently?
- Failure mode mapping: for each component, what happens when it fails?
- Max 8 issues per section — prioritize, don't enumerate exhaustively

## Error Handling
- Are error paths explicitly designed (named exceptions, not catch-all)?
- Does the design specify retry/timeout/circuit-breaker behavior?

## Performance
- Are there N+1 query patterns? Unbounded list fetches?
- Is caching strategy specified where needed?

## Testability
- Can each component be tested in isolation?
- Are external dependencies injectable?

## Scoring
Rate each dimension 0-10. For any score <7, state what would make it a 10.
```

#### knowledge/principles/inversion.md

```markdown
# Inversion Reflex

For every proposed approach, ask the inverse:

- "How do we succeed?" → "What would make us fail?"
- "What does this feature do?" → "How could this feature be misused?"
- "Will this timeline work?" → "What event would derail this timeline?"
- "Is this approach sound?" → "Under what conditions does this approach break?"

## Application in mu-design
When proposing 2-3 approaches, document the failure modes alongside the trade-offs:

| Approach | Strengths | Failure modes |
|---|---|---|
| A | ... | Fails when ... |
| B | ... | Breaks if ... |

This helps the user see where each approach could break, not just where it shines.
```

#### knowledge/principles/premise-check.md

```markdown
# Premise Check

Validate the premise before investing in scoping/design.

## Forcing Questions

### Q1: Problem Specificity
"Who exactly has this problem? What do they do today to work around it?"
- Red flag: vague answer ("users want..."), no specific person or workaround described

### Q2: Temporal Durability
"If the world changes in 3 years, is this more or less essential?"
- Red flag: depends on a trend that could reverse

### Q3: Narrowest Wedge
"What's the smallest thing we could build to test whether this matters?"
- Red flag: "we need the full platform first"

### Q4: Observation Test (full version only)
"Have you watched someone use a similar solution without helping them?"
- Red flag: "demos are theater" / "nothing surprising happened"

## Modes
- **Lightweight (3 questions):** Used by mu-scope inline in Quick Probe. Skip Q4.
- **Full (4 questions):** Used by standalone /mu-premise skill. All questions.

## Output
Produce a premise artifact at docs/premise/YYYY-MM-DD-<name>.md:
- Problem owner, status quo, temporal test, narrowest wedge, validation status
```

### mu-reviewer.md Changes

Add `review-security` as 5th mode after `review-coverage`:

```markdown
## review-security: Security Review

Review code changes for security vulnerabilities. Triggered conditionally when diff contains security-sensitive patterns.

**Checklist:** @../knowledge/reviews/security-checklist.md

**Process:**
1. Build architecture mental model from diff context
2. Census attack surface touched by this change
3. Scan for secrets in diff
4. Check new/changed dependencies
5. Review CI/CD changes if present

**Severity categories:**
- CRITICAL: Must fix before merge
- HIGH: Must fix before merge
- MEDIUM: Advisory, track for follow-up
- LOW: Advisory

**Output:**

\```
## Security Review

**Status:** Approved | Issues Found

**Attack Surface:**
- [endpoints/handlers touched by this change]

**Findings:**
- [SEVERITY] file:line — description — remediation

**Assessment:**
- **Safe to merge?** [Yes / No / With fixes]
\```
```

Enhance `review-design` mode — add to the checklist table:

```markdown
| Architecture Rigor | Data flow diagrams for non-trivial flows, failure mode mapping per component. Audit rubric: @../knowledge/reviews/design-audit-rubric.md |
```

### mu-design SKILL.md Changes

In Step 6 (Propose 2-3 approaches), add after "Present options conversationally...":

```markdown
**Inversion test:** Before presenting approaches, apply the inversion reflex
from @../../knowledge/principles/inversion.md. For each approach, document
"what would make this approach fail?" alongside trade-offs. Present failure
modes as a column in the comparison, not as a separate section.
```

### mu-scope SKILL.md Changes

In Phase 1 (Quick Probe), add at the beginning:

```markdown
**Premise check:** Before scanning the codebase, check if a premise artifact
exists at `docs/premise/*.md`. If not found, run a lightweight premise check
(3 questions from @../../knowledge/principles/premise-check.md — skip Q4).
If the user provides strong evidence immediately, pass quickly. If the user
says "just do it" after 3 rounds without substantive answers, flag
"Premise not validated — proceeding at user's request" and continue.
```

### mu-review SKILL.md Changes

In Step 1 (Dispatch Review), add before the existing dispatch instructions:

```markdown
### Security Check (conditional)

Before dispatching review-code, quick-scan the diff for security signals:

\```bash
git diff $BASE_SHA..$HEAD_SHA | grep -ciE '(auth|password|token|cookie|session|sql|exec|eval|secret|credential|api.key|jwt|oauth|csrf|cors|helmet|bcrypt|crypto)'
\```

If count > 0: dispatch mu-reviewer with **review-security** mode in addition
to review-code. Run both reviews (security first, then code quality).

If count = 0: skip review-security, proceed with review-code only.
```

### UC Coverage for Workflow B

| UC | Covered by | How |
|---|---|---|
| UC-5 | mu-reviewer review-security + security-checklist.md | 5-phase methodology |
| UC-6 | mu-reviewer review-design + design-audit-rubric.md | architecture rigor row |
| UC-7 | mu-design Step 6 + inversion.md | failure modes column |
| UC-17 | mu-reviewer review-security | "no significant attack surface" when grep finds nothing relevant |
| UC-18 | bootstrap priority rule | user instructions > skill behavior |
| UC-25 | mu-reviewer review-security | falls back to review-code if checklist missing |

---

## Workflow C: Knowledge Organization

No new mechanism. Changes are structural only:

### New Directories

```
knowledge/
├── languages/        # existing, unchanged
│   ├── go.md
│   ├── java.md
│   ├── python.md
│   └── typescript.md
├── templates/        # existing, unchanged
│   └── scope.md
├── principles/       # NEW — thinking rubrics loaded at decision points
│   ├── inversion.md
│   └── premise-check.md
└── reviews/          # NEW — review checklists loaded by mu-reviewer
    ├── security-checklist.md
    └── design-audit-rubric.md
```

### architecture.md Updates

Update the knowledge/ section to reflect new categories:

```markdown
### knowledge/

| Category | Purpose | Referenced by |
|---|---|---|
| languages/ | Language-specific review criteria | mu-reviewer (review-code) |
| templates/ | Artifact templates | mu-scope |
| principles/ | Thinking rubrics for decision points | mu-design, mu-scope, mu-premise |
| reviews/ | Review checklists for specific concerns | mu-reviewer (review-security, review-design) |
```

Update the classification table:

```markdown
### knowledge/ — refined criteria

| Case | Location | Reason |
|------|--------|------|
| Used by only one skill | Stay in skill directory | Locality first |
| Injected into agents across scenarios | knowledge/ | Cross-role reuse |
| Language/framework specific patterns | knowledge/languages/ | Same agent, different tech stacks |
| Thinking rubrics for decision points | knowledge/principles/ | Cross-skill reuse at design/scope time |
| Review checklists for specific concerns | knowledge/reviews/ | Cross-mode reuse within mu-reviewer |
```

### UC Coverage for Workflow C

| UC | Covered by | How |
|---|---|---|
| UC-9 | Semantic directory structure + @ references | No shared fragments mechanism needed |

---

## Workflow D: Pipeline-External Skills

### mu-premise

**File:** `skills/mu-premise/SKILL.md`

**Plugin registration:** Automatic — plugin.json `"skills": ["./skills/"]` discovers all skill directories.

**Frontmatter:**
```yaml
---
name: mu-premise
description: "Validate the premise before scoping — forcing questions to test problem specificity, temporal durability, and narrowest wedge."
---
```

**Relationship to pipeline:**
```
[standalone]  /mu-premise → premise artifact → (user proceeds to scope when ready)
[inline]      mu-scope Quick Probe → no premise artifact? → lightweight 3-question version
```

mu-premise does NOT chain to mu-scope. It's fully standalone. The user invokes mu-scope separately when ready. mu-scope checks for premise artifact existence and either skips (found) or inlines lightweight version (not found).

**Process:**

```
1. Load @../../knowledge/principles/premise-check.md
2. Check context: greenfield vs existing codebase
   - Greenfield: "Should we build this?"
   - Existing: "Is this change worth the disruption?" (UC-21)
3. Ask forcing questions one at a time (Q1 → Q2 → Q3 → Q4)
4. Evaluate answers:
   - Strong evidence on 3+ questions → "Premise validated"
   - Weak/vague on 2+ questions → "Premise weakly validated — consider narrowing scope"
   - No useful answer after 3 rounds → "Premise not validated — proceeding at user's request" (UC-26)
5. Write premise artifact to docs/premise/YYYY-MM-DD-<name>.md
6. Commit artifact
```

**Artifact format:**
```markdown
# Premise: <topic>

> **Date:** YYYY-MM-DD

## Validation

| Question | Answer | Signal |
|---|---|---|
| Problem specificity | <answer> | ✅ strong / ⚠️ weak / ❌ none |
| Temporal durability | <answer> | ✅ / ⚠️ / ❌ |
| Narrowest wedge | <answer> | ✅ / ⚠️ / ❌ |
| Observation test | <answer or skipped> | ✅ / ⚠️ / ❌ / — |

**Status:** Validated / Weakly validated / Not validated (proceeding at user's request)
```

### mu-retro

**File:** `skills/mu-retro/SKILL.md`

**Frontmatter:**
```yaml
---
name: mu-retro
description: "Weekly or periodic retrospective — gather git metrics, review patterns, capture learnings to Claude Code memory."
---
```

**Process:**

```
1. Parse time window argument (default: 7d)
   - Convert to absolute date at midnight (UC-22: handle zero-commit windows)
2. Gather data (parallel bash commands):
   - git log --since=<date> --format="%H|%an|%s|%aI"
   - git shortlog -sn --since=<date>
   - git diff --stat <start-sha>..HEAD
   - find . -name "*test*" -o -name "*spec*" | wc -l
3. If zero commits in window (UC-22):
   - Report "No activity in this period"
   - Skip metrics, proceed to qualitative reflection only
4. Generate metrics table:
   | Metric | Value |
   | Commits | N |
   | Contributors | N |
   | Lines changed | +N / -M |
   | Test files | N |
   | Hottest files | top 3 by change frequency |
   | Per-author | breakdown |
5. Qualitative reflection (dialogue with user):
   - "What went best this period?"
   - "What was most surprising?"
   - "What would you change next period?"
6. Write retro artifact: docs/retro/YYYY-MM-DD-retro.md
7. Commit artifact
8. Write to Claude Code memory (project type):
   - Non-obvious findings only (e.g., "module X is a hotspot",
     "test coverage thin in Y area")
   - Check existing memory first — update if similar exists,
     create new if not (UC-23)
```

**Artifact format:**
```markdown
# Retrospective: <date-range>

> **Date:** YYYY-MM-DD
> **Window:** <start> to <end>

## Metrics

| Metric | Value |
|---|---|
| Commits | N |
| Contributors | N |
| Lines | +N / -M |
| Test files | N |
| Hottest files | file1, file2, file3 |

## Per-Author Breakdown

| Author | Commits | Lines | Top area |
|---|---|---|---|
| ... | ... | ... | ... |

## Reflections
- **Best:** <user's answer>
- **Surprising:** <user's answer>
- **Improve:** <user's answer>

## Learnings Captured
- <what was written to memory>
```

### UC Coverage for Workflow D

| UC | Covered by | How |
|---|---|---|
| UC-10 | mu-premise process + mu-scope inline check | standalone + lightweight inline |
| UC-11 | mu-retro full process | metrics + reflection + memory write |
| UC-19 | mu-premise step 4 | strong evidence → pass quickly |
| UC-21 | mu-premise step 2 | context-adaptive questions |
| UC-22 | mu-retro step 3 | zero-commit early branch |
| UC-23 | mu-retro step 8 | check existing memory before writing |
| UC-26 | mu-premise step 4 | "not validated — proceeding at user's request" |

---

## Inversion Test (Failure Mode Analysis)

| Component | Failure mode | Severity | Mitigation |
|---|---|---|---|
| pipeline-gate.sh | Bug in script blocks all Edit/Write | HIGH | `trap 'exit 0' ERR` fail-open + skill-level HARD-GATE as secondary defense |
| pipeline-gate.sh | User not using devmuse pipeline (raw `claude`) | LOW | Hook only active when devmuse plugin installed — if plugin active, hook active |
| pipeline-gate.sh | Plugin dir detection fails (CLAUDE_PLUGIN_ROOT unset) | MEDIUM | Fallback: if CLAUDE_PLUGIN_ROOT empty, skip exemption check, proceed to scope check |
| destructive-guard.sh | False positive on "rm -rf" in a string/comment | LOW | Action is "ask" not "deny" — user can approve |
| security grep trigger | Matches "password" in a comment → unnecessary security review | LOW | Cost of extra review < cost of missing a real vulnerability |
| inversion.md @ref | Agent skips loading | MEDIUM | mu-design SKILL.md has explicit instruction "you MUST load" at that step |
| mu-premise inline | 3-question version diverges from premise-check.md | MEDIUM | Both reference same knowledge file, lightweight mode documented as "skip Q4" |
| mu-retro git commands | Shallow clone / monorepo | LOW | Check `git rev-parse --is-shallow-repository`, warn if true |
| mu-retro memory write | Duplicate memory created | LOW | Explicit "check existing first" instruction in skill + Claude Code memory system handles dedup |

---

## Files Changed Summary

### New Files (10)

| File | Workflow |
|---|---|
| `hooks/pre-tool-use/pipeline-gate.sh` | A |
| `hooks/pre-tool-use/destructive-guard.sh` | A |
| `knowledge/principles/inversion.md` | B |
| `knowledge/principles/premise-check.md` | B |
| `knowledge/reviews/security-checklist.md` | B |
| `knowledge/reviews/design-audit-rubric.md` | B |
| `skills/mu-premise/SKILL.md` | D |
| `skills/mu-retro/SKILL.md` | D |
| `docs/premise/` | D (directory, created on first use) |
| `docs/retro/` | D (directory, created on first use) |

### Modified Files (5)

| File | Workflow | Change |
|---|---|---|
| `hooks/hooks.json` | A | Add 2 PreToolUse entries |
| `agents/mu-reviewer.md` | B | Add review-security mode + enhance review-design |
| `skills/mu-design/SKILL.md` | B | Add inversion test in Step 6 |
| `skills/mu-scope/SKILL.md` | B | Add premise check in Phase 1 |
| `skills/mu-review/SKILL.md` | B | Add security check conditional trigger in Step 1 |
| `docs/architecture.md` | C | Update knowledge/ section with new categories |

### Updated Docs (1)

| File | Change |
|---|---|
| `docs/architecture.md` | New knowledge categories, updated classification table |

---

## Implementation Phasing

### P0 (core value, do first)

- Workflow A: Both hook scripts + hooks.json update
- Workflow B (partial): security-checklist.md + review-security mode + mu-review trigger
- Workflow B (partial): design-audit-rubric.md + review-design enhancement
- Workflow C: Directory creation + architecture.md update

### P1 (thinking rubrics + new skills)

- Workflow B (partial): inversion.md + mu-design change
- Workflow B (partial): premise-check.md + mu-scope change
- Workflow D: mu-premise skill
- Workflow D: mu-retro skill
