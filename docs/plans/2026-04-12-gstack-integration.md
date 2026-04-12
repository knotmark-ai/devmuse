# gstack Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use devmuse:mu-code (recommended) or devmuse:mu-code to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Absorb valuable engineering and methodology patterns from gstack into devmuse — PreToolUse hooks, security review, design audit rubrics, thinking principles, and two new pipeline-external skills.

**Architecture:** 4 workflows touching hooks (bash scripts), knowledge (markdown), agents (markdown), skills (markdown), and docs (markdown). No build step, no external dependencies. Hook scripts are pure bash; everything else is Claude Code plugin markdown.

**Tech Stack:** Bash (hooks), Markdown (everything else), Claude Code plugin system

---

## P0: Core Value

### Task 1: Create knowledge directory structure + update architecture.md

**Covers:** UC-9

**Files:**
- Create: `knowledge/principles/` (directory)
- Create: `knowledge/reviews/` (directory)
- Modify: `docs/architecture.md:110-126`

- [ ] **Step 1: Create directories**

```bash
mkdir -p knowledge/principles knowledge/reviews
```

- [ ] **Step 2: Add .gitkeep files so empty dirs are tracked**

```bash
touch knowledge/principles/.gitkeep knowledge/reviews/.gitkeep
```

- [ ] **Step 3: Update architecture.md knowledge section**

In `docs/architecture.md`, replace the existing `knowledge/` code block (around lines 113-124) with:

```markdown
knowledge/
├── languages/
│   ├── typescript.md   # Type safety, async patterns, common pitfalls
│   ├── python.md       # Type hints, pythonic patterns, security
│   ├── go.md           # Error handling, concurrency, interface design
│   └── java.md         # Null handling, concurrency, resource management
├── templates/
│   └── scope.md        # Use Case Set template for mu-scope
├── principles/         # Thinking rubrics loaded at decision points
│   ├── inversion.md    # Inversion reflex for approach comparison
│   └── premise-check.md # Premise validation forcing questions
├── reviews/            # Review checklists for specific concerns
│   ├── security-checklist.md  # 5-phase security audit
│   └── design-audit-rubric.md # Architecture audit rubric
└── frameworks/         # (reserved) spring-boot.md, react.md, flutter.md
```

Update the classification table by adding two rows after "Language/framework specific patterns":

```markdown
| Thinking rubrics for decision points | knowledge/principles/ | Cross-skill reuse at design/scope time |
| Review checklists for specific concerns | knowledge/reviews/ | Cross-mode reuse within mu-reviewer |
```

- [ ] **Step 4: Update architecture.md content table**

In the `### knowledge/` heading's description area (around line 110), add below the existing table:

```markdown
| Category | Purpose | Referenced by |
|---|---|---|
| languages/ | Language-specific review criteria | mu-reviewer (review-code) |
| templates/ | Artifact templates | mu-scope |
| principles/ | Thinking rubrics for decision points | mu-design, mu-scope, mu-premise |
| reviews/ | Review checklists for specific concerns | mu-reviewer (review-security, review-design) |
```

- [ ] **Step 5: Verify and commit**

Run: `ls knowledge/principles knowledge/reviews`
Expected: `.gitkeep` in each

```bash
git add knowledge/principles/.gitkeep knowledge/reviews/.gitkeep docs/architecture.md
git commit -m "feat: add knowledge/principles and knowledge/reviews directories"
```

---

### Task 2: Write pipeline-gate.sh with tests

**Covers:** UC-1, UC-2, UC-3, UC-12, UC-13, UC-16, UC-24, UC-27

**Files:**
- Create: `tests/hooks/test-pipeline-gate.sh`
- Create: `hooks/pre-tool-use/pipeline-gate.sh`

- [ ] **Step 1: Write the failing test**

Create `tests/hooks/test-pipeline-gate.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_ROOT/hooks/pre-tool-use/pipeline-gate.sh"

PASS=0
FAIL=0
TOTAL=0

assert_output() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"
    TOTAL=$((TOTAL + 1))
    if [ "$expected" = "$actual" ]; then
        echo "  [PASS] $test_name"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $test_name"
        echo "    expected: $expected"
        echo "    actual:   $actual"
        FAIL=$((FAIL + 1))
    fi
}

assert_contains() {
    local test_name="$1"
    local pattern="$2"
    local actual="$3"
    TOTAL=$((TOTAL + 1))
    if echo "$actual" | grep -q "$pattern"; then
        echo "  [PASS] $test_name"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $test_name"
        echo "    expected to contain: $pattern"
        echo "    actual: $actual"
        FAIL=$((FAIL + 1))
    fi
}

assert_empty() {
    local test_name="$1"
    local actual="$2"
    TOTAL=$((TOTAL + 1))
    if [ -z "$actual" ]; then
        echo "  [PASS] $test_name"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $test_name"
        echo "    expected empty, got: $actual"
        FAIL=$((FAIL + 1))
    fi
}

# Setup temp project dir
setup_project() {
    local tmpdir=$(mktemp -d)
    echo "$tmpdir"
}

cleanup() {
    rm -rf "$1"
}

echo "=== pipeline-gate.sh tests ==="

# UC-1: No scope artifact → deny
echo ""
echo "--- UC-1: No scope, no design → deny ---"
PROJECT=$(setup_project)
output=$(echo '{"tool_name":"Edit","tool_input":{"file_path":"'"$PROJECT"'/src/main.py","old_string":"a","new_string":"b"}}' | \
    CLAUDE_PLUGIN_ROOT="$REPO_ROOT" bash "$HOOK" 2>/dev/null || true)
assert_contains "UC-1: deny message" "permissionDecision" "$output"
assert_contains "UC-1: mentions scope" "scope" "$output"
cleanup "$PROJECT"

# UC-2: Scope exists, no design → deny
echo ""
echo "--- UC-2: Scope exists, no design → deny ---"
PROJECT=$(setup_project)
mkdir -p "$PROJECT/docs/scope"
echo "# Scope" > "$PROJECT/docs/scope/2026-01-01-test.md"
output=$(echo '{"tool_name":"Edit","tool_input":{"file_path":"'"$PROJECT"'/src/main.py","old_string":"a","new_string":"b"}}' | \
    CLAUDE_PLUGIN_ROOT="$REPO_ROOT" PWD="$PROJECT" bash -c "cd '$PROJECT' && bash '$HOOK'" 2>/dev/null || true)
assert_contains "UC-2: deny message" "permissionDecision" "$output"
assert_contains "UC-2: mentions design" "design" "$output"
cleanup "$PROJECT"

# UC-3: Both exist → allow (empty output)
echo ""
echo "--- UC-3: Scope + design exist → allow ---"
PROJECT=$(setup_project)
mkdir -p "$PROJECT/docs/scope" "$PROJECT/docs/specs"
echo "# Scope" > "$PROJECT/docs/scope/2026-01-01-test.md"
echo "# Design" > "$PROJECT/docs/specs/2026-01-01-test-design.md"
output=$(echo '{"tool_name":"Edit","tool_input":{"file_path":"'"$PROJECT"'/src/main.py","old_string":"a","new_string":"b"}}' | \
    CLAUDE_PLUGIN_ROOT="$REPO_ROOT" bash -c "cd '$PROJECT' && bash '$HOOK'" 2>/dev/null || true)
assert_empty "UC-3: allow (empty output)" "$output"
cleanup "$PROJECT"

# UC-13: Plugin directory edit → allow regardless of scope
echo ""
echo "--- UC-13: Plugin dir edit → allow ---"
PROJECT=$(setup_project)
output=$(echo '{"tool_name":"Edit","tool_input":{"file_path":"'"$REPO_ROOT"'/skills/mu-scope/SKILL.md","old_string":"a","new_string":"b"}}' | \
    CLAUDE_PLUGIN_ROOT="$REPO_ROOT" bash -c "cd '$PROJECT' && bash '$HOOK'" 2>/dev/null || true)
assert_empty "UC-13: plugin dir allow" "$output"
cleanup "$PROJECT"

# UC-12: Scope exists but empty → allow (existence check only)
echo ""
echo "--- UC-12: Empty scope file → allow ---"
PROJECT=$(setup_project)
mkdir -p "$PROJECT/docs/scope" "$PROJECT/docs/specs"
touch "$PROJECT/docs/scope/2026-01-01-empty.md"
echo "# Design" > "$PROJECT/docs/specs/2026-01-01-test-design.md"
output=$(echo '{"tool_name":"Edit","tool_input":{"file_path":"'"$PROJECT"'/src/main.py","old_string":"a","new_string":"b"}}' | \
    CLAUDE_PLUGIN_ROOT="$REPO_ROOT" bash -c "cd '$PROJECT' && bash '$HOOK'" 2>/dev/null || true)
assert_empty "UC-12: empty scope still allows" "$output"
cleanup "$PROJECT"

# UC-16: Multiple scope files → any satisfies
echo ""
echo "--- UC-16: Multiple scope files → allow ---"
PROJECT=$(setup_project)
mkdir -p "$PROJECT/docs/scope" "$PROJECT/docs/specs"
echo "# Scope 1" > "$PROJECT/docs/scope/2026-01-01-feature-a.md"
echo "# Scope 2" > "$PROJECT/docs/scope/2026-01-02-feature-b.md"
echo "# Design" > "$PROJECT/docs/specs/2026-01-01-test-design.md"
output=$(echo '{"tool_name":"Edit","tool_input":{"file_path":"'"$PROJECT"'/src/main.py","old_string":"a","new_string":"b"}}' | \
    CLAUDE_PLUGIN_ROOT="$REPO_ROOT" bash -c "cd '$PROJECT' && bash '$HOOK'" 2>/dev/null || true)
assert_empty "UC-16: multiple scopes allow" "$output"
cleanup "$PROJECT"

# UC-24: Script error → fail-open (empty output)
echo ""
echo "--- UC-24: Malformed JSON → fail-open ---"
output=$(echo 'NOT JSON' | CLAUDE_PLUGIN_ROOT="$REPO_ROOT" bash "$HOOK" 2>/dev/null || true)
assert_empty "UC-24: fail-open on bad input" "$output"

echo ""
echo "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
chmod +x tests/hooks/test-pipeline-gate.sh
bash tests/hooks/test-pipeline-gate.sh
```

Expected: FAIL (hook script doesn't exist yet)

- [ ] **Step 3: Write pipeline-gate.sh**

Create `hooks/pre-tool-use/pipeline-gate.sh`:

```bash
#!/usr/bin/env bash
# PreToolUse hook: enforce scope + design existence before Edit/Write
# Fail-open: any error → exit 0 (no decision) → Claude Code proceeds

trap 'exit 0' ERR

set -uo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
    exit 0
fi

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -n "$PLUGIN_ROOT" ]; then
    case "$FILE_PATH" in
        "$PLUGIN_ROOT"/*)
            exit 0
            ;;
    esac
fi

SCOPE_FILES=$(ls docs/scope/*.md 2>/dev/null | head -1)
if [ -z "$SCOPE_FILES" ]; then
    printf '{"permissionDecision":"deny","message":"No scope artifact found under docs/scope/. Run mu-scope first."}\n'
    exit 0
fi

DESIGN_FILES=$(ls docs/specs/*-design*.md 2>/dev/null | head -1)
if [ -z "$DESIGN_FILES" ]; then
    printf '{"permissionDecision":"deny","message":"No design spec found under docs/specs/. Run mu-design first."}\n'
    exit 0
fi

exit 0
```

- [ ] **Step 4: Make executable and run tests**

```bash
chmod +x hooks/pre-tool-use/pipeline-gate.sh
bash tests/hooks/test-pipeline-gate.sh
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/pre-tool-use/pipeline-gate.sh tests/hooks/test-pipeline-gate.sh
git commit -m "feat: add pipeline-gate PreToolUse hook with tests

Enforces scope + design artifact existence before Edit/Write.
Exempts devmuse plugin directory edits. Fail-open on errors.

Covers: UC-1, UC-2, UC-3, UC-12, UC-13, UC-16, UC-24"
```

---

### Task 3: Write destructive-guard.sh with tests

**Covers:** UC-4, UC-15, UC-24

**Files:**
- Create: `tests/hooks/test-destructive-guard.sh`
- Create: `hooks/pre-tool-use/destructive-guard.sh`

- [ ] **Step 1: Write the failing test**

Create `tests/hooks/test-destructive-guard.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_ROOT/hooks/pre-tool-use/destructive-guard.sh"

PASS=0
FAIL=0
TOTAL=0

assert_contains() {
    local test_name="$1"
    local pattern="$2"
    local actual="$3"
    TOTAL=$((TOTAL + 1))
    if echo "$actual" | grep -q "$pattern"; then
        echo "  [PASS] $test_name"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $test_name"
        echo "    expected to contain: $pattern"
        echo "    actual: $actual"
        FAIL=$((FAIL + 1))
    fi
}

assert_empty() {
    local test_name="$1"
    local actual="$2"
    TOTAL=$((TOTAL + 1))
    if [ -z "$actual" ]; then
        echo "  [PASS] $test_name"
        PASS=$((PASS + 1))
    else
        echo "  [FAIL] $test_name"
        echo "    expected empty, got: $actual"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== destructive-guard.sh tests ==="

# UC-4: rm -rf → ask
echo ""
echo "--- UC-4: rm -rf → ask ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /some/path"}}' | bash "$HOOK" 2>/dev/null || true)
assert_contains "UC-4: ask on rm -rf" "permissionDecision" "$output"
assert_contains "UC-4: action is ask" "ask" "$output"

# UC-4: git push -f → ask
echo ""
echo "--- UC-4: git push -f → ask ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"git push -f origin main"}}' | bash "$HOOK" 2>/dev/null || true)
assert_contains "UC-4: ask on git push -f" "ask" "$output"

# UC-4: git push --force → ask
echo ""
echo "--- UC-4: git push --force → ask ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}' | bash "$HOOK" 2>/dev/null || true)
assert_contains "UC-4: ask on git push --force" "ask" "$output"

# UC-4: DROP TABLE → ask
echo ""
echo "--- UC-4: DROP TABLE → ask ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"psql -c \"DROP TABLE users\""}}' | bash "$HOOK" 2>/dev/null || true)
assert_contains "UC-4: ask on DROP TABLE" "ask" "$output"

# UC-4: git reset --hard → ask
echo ""
echo "--- UC-4: git reset --hard → ask ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"git reset --hard HEAD~3"}}' | bash "$HOOK" 2>/dev/null || true)
assert_contains "UC-4: ask on git reset --hard" "ask" "$output"

# UC-15: rm -rf node_modules → allow (safe pattern)
echo ""
echo "--- UC-15: rm -rf node_modules → allow ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf node_modules"}}' | bash "$HOOK" 2>/dev/null || true)
assert_empty "UC-15: safe pattern node_modules" "$output"

# UC-15: rm -rf dist → allow
echo ""
echo "--- UC-15: rm -rf dist → allow ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf dist"}}' | bash "$HOOK" 2>/dev/null || true)
assert_empty "UC-15: safe pattern dist" "$output"

# UC-15: rm -rf .next → allow
echo ""
echo "--- UC-15: rm -rf .next → allow ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf .next"}}' | bash "$HOOK" 2>/dev/null || true)
assert_empty "UC-15: safe pattern .next" "$output"

# Safe command → allow
echo ""
echo "--- Safe: normal command → allow ---"
output=$(echo '{"tool_name":"Bash","tool_input":{"command":"npm test"}}' | bash "$HOOK" 2>/dev/null || true)
assert_empty "safe command" "$output"

# UC-24: Malformed JSON → fail-open
echo ""
echo "--- UC-24: Malformed JSON → fail-open ---"
output=$(echo 'GARBAGE' | bash "$HOOK" 2>/dev/null || true)
assert_empty "UC-24: fail-open" "$output"

echo ""
echo "=== Results: $PASS/$TOTAL passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] || exit 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
chmod +x tests/hooks/test-destructive-guard.sh
bash tests/hooks/test-destructive-guard.sh
```

Expected: FAIL (hook script doesn't exist yet)

- [ ] **Step 3: Write destructive-guard.sh**

Create `hooks/pre-tool-use/destructive-guard.sh`:

```bash
#!/usr/bin/env bash
# PreToolUse hook: warn before destructive bash commands
# Fail-open: any error → exit 0

trap 'exit 0' ERR

set -uo pipefail

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//')

if [ -z "$COMMAND" ]; then
    exit 0
fi

# Safe patterns: allow without asking
case "$COMMAND" in
    "rm -rf node_modules"*|"rm -rf dist"*|"rm -rf .next"*|"rm -rf build"*|"rm -rf __pycache__"*)
        exit 0
        ;;
esac

# Dangerous patterns: ask before proceeding
DANGEROUS=""
case "$COMMAND" in
    *"rm -rf"*)           DANGEROUS="rm -rf" ;;
    *"git push -f"*)      DANGEROUS="git push -f" ;;
    *"git push --force"*) DANGEROUS="git push --force" ;;
    *"DROP TABLE"*)       DANGEROUS="DROP TABLE" ;;
    *"git reset --hard"*) DANGEROUS="git reset --hard" ;;
    *"git clean -fd"*)    DANGEROUS="git clean -fd" ;;
esac

if [ -n "$DANGEROUS" ]; then
    printf '{"permissionDecision":"ask","message":"⚠️ Destructive command detected: %s. Proceed?"}\n' "$DANGEROUS"
    exit 0
fi

exit 0
```

- [ ] **Step 4: Make executable and run tests**

```bash
chmod +x hooks/pre-tool-use/destructive-guard.sh
bash tests/hooks/test-destructive-guard.sh
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add hooks/pre-tool-use/destructive-guard.sh tests/hooks/test-destructive-guard.sh
git commit -m "feat: add destructive-guard PreToolUse hook with tests

Warns before rm -rf, git push -f, DROP TABLE, git reset --hard.
Allows known-safe patterns (node_modules, dist, .next). Fail-open.

Covers: UC-4, UC-15, UC-24"
```

---

### Task 4: Update hooks.json

**Covers:** UC-1, UC-2, UC-3, UC-4 (registration)

**Files:**
- Modify: `hooks/hooks.json`

- [ ] **Step 1: Verify current hooks.json content**

Run: `cat hooks/hooks.json`
Expected: Only SessionStart entry

- [ ] **Step 2: Update hooks.json**

Replace the entire content of `hooks/hooks.json` with:

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

- [ ] **Step 3: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('hooks/hooks.json')); print('Valid JSON')"`
Expected: "Valid JSON"

- [ ] **Step 4: Commit**

```bash
git add hooks/hooks.json
git commit -m "feat: register PreToolUse hooks in hooks.json

Adds pipeline-gate (Edit|Write) and destructive-guard (Bash)."
```

---

### Task 5: Write security-checklist.md

**Covers:** UC-5, UC-17, UC-25

**Files:**
- Create: `knowledge/reviews/security-checklist.md`

- [ ] **Step 1: Write the file**

Create `knowledge/reviews/security-checklist.md` with content exactly as specified in the design spec (lines 157-192). Remove the `.gitkeep` file if present.

- [ ] **Step 2: Verify @ reference will resolve**

Run: `ls -la knowledge/reviews/security-checklist.md`
Expected: File exists, non-empty

- [ ] **Step 3: Commit**

```bash
rm -f knowledge/reviews/.gitkeep
git add knowledge/reviews/security-checklist.md
git commit -m "feat: add security review checklist (knowledge)

5-phase methodology: architecture mental model, attack surface census,
secrets archaeology, dependency supply chain, CI/CD pipeline.

Covers: UC-5, UC-17, UC-25"
```

---

### Task 6: Write design-audit-rubric.md

**Covers:** UC-6

**Files:**
- Create: `knowledge/reviews/design-audit-rubric.md`

- [ ] **Step 1: Write the file**

Create `knowledge/reviews/design-audit-rubric.md` with content exactly as specified in the design spec (lines 198-221).

- [ ] **Step 2: Verify file exists**

Run: `ls -la knowledge/reviews/design-audit-rubric.md`
Expected: File exists, non-empty

- [ ] **Step 3: Commit**

```bash
git add knowledge/reviews/design-audit-rubric.md
git commit -m "feat: add design audit rubric (knowledge)

Architecture, error handling, performance, testability dimensions
with 0-10 scoring. Adapted from gstack plan-eng-review.

Covers: UC-6"
```

---

### Task 7: Add review-security mode to mu-reviewer.md

**Covers:** UC-5, UC-17, UC-25

**Files:**
- Modify: `agents/mu-reviewer.md`

- [ ] **Step 1: Add review-security section**

In `agents/mu-reviewer.md`, add the `review-security` section (from design spec lines 284-319) after the `review-coverage` section (after line 203).

- [ ] **Step 2: Verify section is properly placed**

Run: `grep "review-security" agents/mu-reviewer.md`
Expected: Match found

- [ ] **Step 3: Commit**

```bash
git add agents/mu-reviewer.md
git commit -m "feat: add review-security mode to mu-reviewer

5th review mode: security audit triggered conditionally.
References knowledge/reviews/security-checklist.md via @path.

Covers: UC-5, UC-17, UC-25"
```

---

### Task 8: Enhance review-design mode in mu-reviewer.md

**Covers:** UC-6

**Files:**
- Modify: `agents/mu-reviewer.md`

- [ ] **Step 1: Add Architecture Rigor row to review-design checklist**

In `agents/mu-reviewer.md`, find the review-design checklist table (around line 22-28) and add a new row:

```markdown
| Architecture Rigor | Data flow diagrams for non-trivial flows, failure mode mapping per component. Audit rubric: @../knowledge/reviews/design-audit-rubric.md |
```

- [ ] **Step 2: Verify**

Run: `grep "Architecture Rigor" agents/mu-reviewer.md`
Expected: Match found

- [ ] **Step 3: Commit**

```bash
git add agents/mu-reviewer.md
git commit -m "feat: enhance review-design with architecture audit rubric

Adds Architecture Rigor checklist item referencing design-audit-rubric.md.

Covers: UC-6"
```

---

### Task 9: Add security check trigger in mu-review SKILL.md

**Covers:** UC-5 (trigger mechanism)

**Files:**
- Modify: `skills/mu-review/SKILL.md`

- [ ] **Step 1: Add conditional security check section**

In `skills/mu-review/SKILL.md`, find Step 1 (Dispatch Review) around line 35. Add the following before the "### When to Request Review" heading:

```markdown
### Security Check (conditional)

Before dispatching review-code, quick-scan the diff for security signals:

```bash
git diff $BASE_SHA..$HEAD_SHA | grep -ciE '(auth|password|token|cookie|session|sql|exec|eval|secret|credential|api.key|jwt|oauth|csrf|cors|helmet|bcrypt|crypto)'
```

If count > 0: dispatch mu-reviewer with **review-security** mode in addition to review-code. Run both reviews (security first, then code quality).

If count = 0: skip review-security, proceed with review-code only.
```

- [ ] **Step 2: Verify**

Run: `grep "Security Check" skills/mu-review/SKILL.md`
Expected: Match found

- [ ] **Step 3: Commit**

```bash
git add skills/mu-review/SKILL.md
git commit -m "feat: add conditional security review trigger to mu-review

Quick-scans diff for security-sensitive patterns before dispatching review.
Triggers review-security mode when auth/crypto/secrets keywords found.

Covers: UC-5"
```

---

## P1: Thinking Rubrics + New Skills

### Task 10: Write inversion.md

**Covers:** UC-7

**Files:**
- Create: `knowledge/principles/inversion.md`

- [ ] **Step 1: Write the file**

Create `knowledge/principles/inversion.md` with content exactly as specified in the design spec (lines 225-243). Remove `.gitkeep` if present.

- [ ] **Step 2: Verify**

Run: `ls -la knowledge/principles/inversion.md`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
rm -f knowledge/principles/.gitkeep
git add knowledge/principles/inversion.md
git commit -m "feat: add inversion reflex principle (knowledge)

Thinking rubric for approach comparison: ask 'what would make this fail?'
Adapted from gstack plan-ceo-review.

Covers: UC-7"
```

---

### Task 11: Add inversion test to mu-design SKILL.md

**Covers:** UC-7, UC-18

**Files:**
- Modify: `skills/mu-design/SKILL.md`

- [ ] **Step 1: Add inversion test instruction**

In `skills/mu-design/SKILL.md`, find the "Exploring approaches" section (around line 103). After "Lead with your recommended option and explain why", add:

```markdown

**Inversion test:** Before presenting approaches, apply the inversion reflex from @../../knowledge/principles/inversion.md. For each approach, document "what would make this approach fail?" alongside trade-offs. Present failure modes as a column in the comparison, not as a separate section.
```

- [ ] **Step 2: Verify**

Run: `grep "Inversion test" skills/mu-design/SKILL.md`
Expected: Match found

- [ ] **Step 3: Commit**

```bash
git add skills/mu-design/SKILL.md
git commit -m "feat: add inversion test to mu-design approach proposal

Requires failure mode analysis for each proposed approach.
References knowledge/principles/inversion.md.

Covers: UC-7, UC-18"
```

---

### Task 12: Write premise-check.md

**Covers:** UC-10, UC-19, UC-26

**Files:**
- Create: `knowledge/principles/premise-check.md`

- [ ] **Step 1: Write the file**

Create `knowledge/principles/premise-check.md` with content exactly as specified in the design spec (lines 248-278).

- [ ] **Step 2: Verify**

Run: `ls -la knowledge/principles/premise-check.md`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add knowledge/principles/premise-check.md
git commit -m "feat: add premise check principle (knowledge)

4 forcing questions (lightweight mode: 3). Adapted from gstack office-hours.

Covers: UC-10, UC-19, UC-26"
```

---

### Task 13: Add premise check to mu-scope SKILL.md

**Covers:** UC-10, UC-19, UC-26

**Files:**
- Modify: `skills/mu-scope/SKILL.md`

- [ ] **Step 1: Add premise check at start of Phase 1**

In `skills/mu-scope/SKILL.md`, find "## Phase 1: Quick Probe" (around line 74). After "Before asking the user anything, scan the codebase to understand what this change touches.", add:

```markdown

**Premise check:** Before scanning the codebase, check if a premise artifact exists at `docs/premise/*.md`. If not found, run a lightweight premise check (3 questions from @../../knowledge/principles/premise-check.md — skip Q4). If the user provides strong evidence immediately, pass quickly. If the user says "just do it" after 3 rounds without substantive answers, flag "Premise not validated — proceeding at user's request" and continue.
```

- [ ] **Step 2: Verify**

Run: `grep "Premise check" skills/mu-scope/SKILL.md`
Expected: Match found

- [ ] **Step 3: Commit**

```bash
git add skills/mu-scope/SKILL.md
git commit -m "feat: add inline premise check to mu-scope Quick Probe

Lightweight 3-question premise validation before codebase scan.
References knowledge/principles/premise-check.md.

Covers: UC-10, UC-19, UC-26"
```

---

### Task 14: Create mu-premise skill

**Covers:** UC-10, UC-19, UC-21, UC-26

**Files:**
- Create: `skills/mu-premise/SKILL.md`

- [ ] **Step 1: Write the skill file**

Create `skills/mu-premise/SKILL.md`:

```markdown
---
name: mu-premise
description: "Validate the premise before scoping — forcing questions to test problem specificity, temporal durability, and narrowest wedge."
---

# Premise Validation

Validate the premise before investing in scoping and design. Uses forcing questions to test whether this work is worth doing.

Independent of the main pipeline. Can be invoked standalone via `/mu-premise`, or mu-scope will inline a lightweight version during Quick Probe if no premise artifact exists.

## Process

1. **Load knowledge:** Read @../../knowledge/principles/premise-check.md
2. **Detect context:**
   - Is this a greenfield project? → Frame questions as "Should we build this?"
   - Is this a change to an existing codebase? → Frame as "Is this change worth the disruption?"
3. **Ask forcing questions one at a time** (Q1 → Q2 → Q3 → Q4):
   - Q1: Problem Specificity — "Who exactly has this problem? What do they do today?"
   - Q2: Temporal Durability — "If the world changes in 3 years, is this more or less essential?"
   - Q3: Narrowest Wedge — "What's the smallest thing we could build to test whether this matters?"
   - Q4: Observation Test — "Have you watched someone use a similar solution without helping them?"
4. **Evaluate answers:**
   - Strong evidence on 3+ questions → "Premise validated"
   - Weak/vague on 2+ questions → "Premise weakly validated — consider narrowing scope"
   - No useful answer after 3 rounds → "Premise not validated — proceeding at user's request"
5. **Write premise artifact** to `docs/premise/YYYY-MM-DD-<name>.md`
6. **Commit artifact**

## Artifact Format

```
# Premise: <topic>

> **Date:** YYYY-MM-DD

## Validation

| Question | Answer | Signal |
|---|---|---|
| Problem specificity | <answer> | ✅ strong / ⚠️ weak / ❌ none |
| Temporal durability | <answer> | ✅ / ⚠️ / ❌ |
| Narrowest wedge | <answer> | ✅ / ⚠️ / ❌ |
| Observation test | <answer> | ✅ / ⚠️ / ❌ |

**Status:** Validated / Weakly validated / Not validated (proceeding at user's request)
```

## Key Principles

- **One question at a time** — don't overwhelm
- **Accept strong evidence quickly** — if user has data, don't interrogate further
- **Respect user override** — if they say "just do it", flag and proceed
- **Context-adaptive framing** — greenfield vs existing codebase changes the question tone
- **Standalone, no chaining** — does NOT invoke mu-scope. User proceeds when ready.
```

- [ ] **Step 2: Verify plugin auto-discovery**

Run: `ls skills/mu-premise/SKILL.md`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add skills/mu-premise/SKILL.md
git commit -m "feat: add mu-premise skill (pipeline-external)

Standalone premise validation with 4 forcing questions.
Adapted from gstack office-hours. Independent of main pipeline.

Covers: UC-10, UC-19, UC-21, UC-26"
```

---

### Task 15: Create mu-retro skill

**Covers:** UC-11, UC-22, UC-23

**Files:**
- Create: `skills/mu-retro/SKILL.md`

- [ ] **Step 1: Write the skill file**

Create `skills/mu-retro/SKILL.md`:

```markdown
---
name: mu-retro
description: "Weekly or periodic retrospective — gather git metrics, review patterns, capture learnings to Claude Code memory."
---

# Retrospective

Gather quantitative git metrics and qualitative reflections for a time period. Capture non-obvious learnings to Claude Code memory for future sessions.

Independent of the main pipeline. Invoke with `/mu-retro` or `/mu-retro 14d`.

## Process

1. **Parse time window** from argument (default: 7d)
   - Convert to absolute start date at midnight
   - Example: `7d` on 2026-04-12 → start 2026-04-05T00:00:00
2. **Gather data** (run in parallel):

```bash
# Commits in window
git log --since="<date>" --format="%H|%an|%s|%aI"

# Author summary
git shortlog -sn --since="<date>"

# File change stats
git log --since="<date>" --name-only --format="" | sort | uniq -c | sort -rn | head -10

# Test file count
find . -name "*test*" -o -name "*spec*" | grep -v node_modules | wc -l
```

3. **Check for zero commits:**
   - If no commits in window → report "No activity in this period"
   - Skip metrics table, proceed directly to qualitative reflection
4. **Generate metrics table:**

| Metric | Value |
|---|---|
| Commits | N |
| Contributors | N |
| Lines changed | +N / -M |
| Test files | N |
| Hottest files | top 3 by change frequency |

5. **Per-author breakdown:**

| Author | Commits | Top area |
|---|---|---|
| ... | ... | ... |

6. **Qualitative reflection** (dialogue with user, one at a time):
   - "What went best this period?"
   - "What was most surprising?"
   - "What would you change next period?"
7. **Write retro artifact** to `docs/retro/YYYY-MM-DD-retro.md`
8. **Commit artifact**
9. **Write to Claude Code memory** (project type):
   - Only non-obvious findings worth remembering across sessions
   - Examples: "module X is a change hotspot", "test coverage thin in Y area"
   - **Check existing memory first** — update if similar memory exists, create new if not

## Key Principles

- **Data first, then reflection** — show the numbers before asking opinion
- **One reflection question at a time** — don't overwhelm
- **Memory is selective** — only write non-obvious, durable findings. Don't dump metrics.
- **Handle edge cases gracefully** — zero commits, shallow clones, monorepos
- **Standalone, no chaining** — does NOT invoke other skills
```

- [ ] **Step 2: Verify plugin auto-discovery**

Run: `ls skills/mu-retro/SKILL.md`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add skills/mu-retro/SKILL.md
git commit -m "feat: add mu-retro skill (pipeline-external)

Periodic retrospective with git metrics, per-author breakdown,
qualitative reflection, and Claude Code memory integration.

Covers: UC-11, UC-22, UC-23"
```

---

## Post-Implementation

### Task 16: Update README.md and run all hook tests

**Covers:** Documentation accuracy

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run all hook tests**

```bash
bash tests/hooks/test-pipeline-gate.sh && bash tests/hooks/test-destructive-guard.sh
```

Expected: All PASS for both suites

- [ ] **Step 2: Update README.md skills table**

In `README.md`, update the Skills table (around line 62-71) to add mu-premise and mu-retro:

```markdown
| **mu-premise** | Premise validation — forcing questions before scoping |
| **mu-retro** | Periodic retrospective with git metrics and memory capture |
```

Update the skills count from (7) to (9).

Update the agents table to note mu-reviewer now has 5 modes:

```markdown
| **mu-reviewer** | Five-mode reviewer: design doc (review-design), code quality (review-code), spec compliance (review-compliance), requirements coverage (review-coverage), security (review-security) |
```

- [ ] **Step 3: Update README pipeline section**

Add after the core pipeline description (around line 49):

```markdown
**Pipeline-external skills** (independent of the main pipeline, like mu-debug):

- **mu-premise** — Validates the premise before scoping. Invoked standalone or inlined by mu-scope.
- **mu-retro** — Periodic retrospective gathering git metrics and capturing learnings to memory.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README for gstack integration

Add mu-premise, mu-retro skills. Update mu-reviewer to 5 modes.
Document pipeline-external skills section."
```
