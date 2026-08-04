#!/usr/bin/env bash
# Verify that naming a current DevMuse skill invokes that skill before action.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPTS_DIR="$SCRIPT_DIR/prompts"

skills=(mu-code mu-debug mu-prd mu-wiki)
passed=0
failed=0

for skill in "${skills[@]}"; do
    echo ">>> Explicit invocation: $skill"
    if "$SCRIPT_DIR/run-test.sh" "$skill" "$PROMPTS_DIR/$skill.txt"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
    echo ""
done

echo "Passed: $passed"
echo "Failed: $failed"

if [[ "$failed" -gt 0 ]]; then
    exit 1
fi
