#!/usr/bin/env bash
# Behavioral documentation test for the current mu-code contract.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"
MODEL_TIMEOUT="${DEVMUSE_MODEL_TEST_TIMEOUT:-120}"

echo "=== Test: mu-code proportional execution ==="
echo ""

echo "Test 1: Skill loading and inputs..."
output=$(run_claude "Answer briefly in English. What evidence can the devmuse:mu-code skill execute? Describe the two paths." "$MODEL_TIMEOUT")
assert_contains "$output" "bounded\|inline contract" "Mentions bounded contract"
assert_contains "$output" "architectural\|approved.*plan\|implementation plan" "Mentions architectural plan"
echo ""

echo "Test 2: Review budget..."
output=$(run_claude "Answer briefly in English. According to devmuse:mu-code, compare review timing for bounded execution and architectural execution. Does it review after every task?" "$MODEL_TIMEOUT")
assert_contains "$output" "combined review\|one.*review" "Bounded has one combined review"
assert_contains "$output" "final.*mu-review\|mu-review.*final" "Architectural has one final review"
echo ""

echo "Test 3: Implementation self-check..."
output=$(run_claude "Answer briefly in English. What does devmuse:mu-code require at the end of each implementation task before marking it complete?" "$MODEL_TIMEOUT")
assert_contains "$output" "self-check\|self check" "Mentions self-check"
assert_contains "$output" "requirement\|UC\|task text" "Checks contract completeness"
assert_contains "$output" "verification\|test" "Runs task verification"
echo ""

echo "Test 4: Plan reading efficiency..."
output=$(run_claude "Answer briefly in English. How often should the mu-code controller read an implementation plan, and what does it give a mu-coder subagent?" "$MODEL_TIMEOUT")
assert_contains "$output" "once\|one time\|single" "Reads plan once"
assert_contains "$output" "full.*task text\|task.*full" "Provides full task text"
echo ""

echo "Test 5: Subagent threshold..."
output=$(run_claude "Answer briefly in English. When should devmuse:mu-code use inline mode versus subagent mode?" "$MODEL_TIMEOUT")
assert_contains "$output" "one or two\|1-2\|tightly coupled" "Small or coupled work stays inline"
assert_contains "$output" "three\|3+\|independent" "Independent multi-task work may use subagents"
echo ""

echo "Test 6: Isolation is proportional..."
output=$(run_claude "Answer briefly in English. Does devmuse:mu-code create a worktree for every plan? Explain the branch and worktree boundary." "$MODEL_TIMEOUT")
assert_contains "$output" "not.*every\|proportion\|small\|tightly coupled" "Worktree is not mandatory"
assert_contains "$output" "protected\|main\|master\|consent" "Protected branch requires consent"

echo ""
echo "=== All mu-code behavior tests passed ==="
