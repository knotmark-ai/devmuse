#!/usr/bin/env bash
# Tests for hooks/pre-tool-use/destructive-guard.sh
# Covers: UC-4, UC-15, UC-24

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_ROOT/hooks/pre-tool-use/destructive-guard.sh"

PASS=0
FAIL=0

pass() {
    echo "PASS: $1"
    PASS=$((PASS + 1))
}

fail() {
    echo "FAIL: $1"
    echo "      $2"
    FAIL=$((FAIL + 1))
}

# Run the hook, pipe in JSON, capture output
run_hook() {
    local json="$1"
    bash "$HOOK" <<< "$json" 2>/dev/null
}

assert_contains() {
    local test_name="$1"
    local output="$2"
    local expected="$3"

    if echo "$output" | grep -q "$expected"; then
        pass "$test_name"
    else
        fail "$test_name" "expected output to contain '$expected', got: $output"
    fi
}

assert_empty() {
    local test_name="$1"
    local output="$2"

    if [ -z "$output" ]; then
        pass "$test_name"
    else
        fail "$test_name" "expected empty output, got: $output"
    fi
}

# ---------------------------------------------------------------------------
# Covers: UC-4 — Destructive commands → ask with permissionDecision
# ---------------------------------------------------------------------------

test_uc4_rm_rf() {
    local json='{"tool_name":"Bash","tool_input":{"command":"rm -rf /some/path"}}'
    local output
    output=$(run_hook "$json")

    assert_contains "UC-4: rm -rf /some/path → output contains 'ask'" "$output" '"ask"'
    assert_contains "UC-4: rm -rf /some/path → output contains permissionDecision" "$output" "permissionDecision"
}

test_uc4_git_push_force_short() {
    local json='{"tool_name":"Bash","tool_input":{"command":"git push -f origin main"}}'
    local output
    output=$(run_hook "$json")

    assert_contains "UC-4: git push -f origin main → output contains 'ask'" "$output" '"ask"'
}

test_uc4_git_push_force_long() {
    local json='{"tool_name":"Bash","tool_input":{"command":"git push --force origin main"}}'
    local output
    output=$(run_hook "$json")

    assert_contains "UC-4: git push --force origin main → output contains 'ask'" "$output" '"ask"'
}

test_uc4_psql_drop_table() {
    local json='{"tool_name":"Bash","tool_input":{"command":"psql -c \"DROP TABLE users\""}}'
    local output
    output=$(run_hook "$json")

    assert_contains "UC-4: psql DROP TABLE → output contains 'ask'" "$output" '"ask"'
}

test_uc4_git_reset_hard() {
    local json='{"tool_name":"Bash","tool_input":{"command":"git reset --hard HEAD~3"}}'
    local output
    output=$(run_hook "$json")

    assert_contains "UC-4: git reset --hard HEAD~3 → output contains 'ask'" "$output" '"ask"'
}

# ---------------------------------------------------------------------------
# Covers: UC-15 — Safe rm -rf patterns → allow (empty output)
# ---------------------------------------------------------------------------

test_uc15_rm_rf_node_modules() {
    local json='{"tool_name":"Bash","tool_input":{"command":"rm -rf node_modules"}}'
    local output
    output=$(run_hook "$json")

    assert_empty "UC-15: rm -rf node_modules → empty output (safe pattern)" "$output"
}

test_uc15_rm_rf_dist() {
    local json='{"tool_name":"Bash","tool_input":{"command":"rm -rf dist"}}'
    local output
    output=$(run_hook "$json")

    assert_empty "UC-15: rm -rf dist → empty output (safe pattern)" "$output"
}

test_uc15_rm_rf_next() {
    local json='{"tool_name":"Bash","tool_input":{"command":"rm -rf .next"}}'
    local output
    output=$(run_hook "$json")

    assert_empty "UC-15: rm -rf .next → empty output (safe pattern)" "$output"
}

# ---------------------------------------------------------------------------
# Safe (non-destructive) command → allow (empty output)
# ---------------------------------------------------------------------------

test_safe_command() {
    local json='{"tool_name":"Bash","tool_input":{"command":"npm test"}}'
    local output
    output=$(run_hook "$json")

    assert_empty "safe command: npm test → empty output" "$output"
}

# ---------------------------------------------------------------------------
# Covers: UC-24 — Malformed JSON → fail-open (empty output)
# ---------------------------------------------------------------------------

test_uc24_malformed_json() {
    local json='not-valid-json-at-all'
    local output
    output=$(run_hook "$json")

    assert_empty "UC-24: malformed JSON → empty output (fail-open)" "$output"
}

# ---------------------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------------------
test_uc4_rm_rf
test_uc4_git_push_force_short
test_uc4_git_push_force_long
test_uc4_psql_drop_table
test_uc4_git_reset_hard
test_uc15_rm_rf_node_modules
test_uc15_rm_rf_dist
test_uc15_rm_rf_next
test_safe_command
test_uc24_malformed_json

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
