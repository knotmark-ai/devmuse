#!/usr/bin/env bash
# Run all skill triggering tests
# Usage: ./run-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

SKILLS=(
    "mu-debug"
    "mu-code"
    "mu-plan"
    "mu-review"
)

# Additional prompt variants that should also trigger mu-code
EXTRA_PROMPTS=(
    "mu-code:mu-code-execute"
    "mu-code:mu-code-subagent"
)

echo "=== Running Skill Triggering Tests ==="
echo ""

PASSED=0
FAILED=0
RESULTS=()

for skill in "${SKILLS[@]}"; do
    prompt_file="$PROMPTS_DIR/${skill}.txt"

    if [ ! -f "$prompt_file" ]; then
        echo "⚠️  SKIP: No prompt file for $skill"
        continue
    fi

    echo "Testing: $skill"

    if "$SCRIPT_DIR/run-test.sh" "$skill" "$prompt_file" 3 2>&1 | tee /tmp/skill-test-$skill.log; then
        PASSED=$((PASSED + 1))
        RESULTS+=("✅ $skill")
    else
        FAILED=$((FAILED + 1))
        RESULTS+=("❌ $skill")
    fi

    echo ""
    echo "---"
    echo ""
done

# Run extra prompt variants (different prompts that should trigger the same skill)
for entry in "${EXTRA_PROMPTS[@]}"; do
    skill="${entry%%:*}"
    prompt_name="${entry##*:}"
    prompt_file="$PROMPTS_DIR/${prompt_name}.txt"

    if [ ! -f "$prompt_file" ]; then
        echo "⚠️  SKIP: No prompt file for $prompt_name"
        continue
    fi

    echo "Testing: $prompt_name (expects $skill)"

    if "$SCRIPT_DIR/run-test.sh" "$skill" "$prompt_file" 3 2>&1 | tee /tmp/skill-test-$prompt_name.log; then
        PASSED=$((PASSED + 1))
        RESULTS+=("✅ $prompt_name → $skill")
    else
        FAILED=$((FAILED + 1))
        RESULTS+=("❌ $prompt_name → $skill")
    fi

    echo ""
    echo "---"
    echo ""
done

echo ""
echo "=== Summary ==="
for result in "${RESULTS[@]}"; do
    echo "  $result"
done
echo ""
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
