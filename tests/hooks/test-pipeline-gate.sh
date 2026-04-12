#!/usr/bin/env bash
# Tests for hooks/pre-tool-use/pipeline-gate.sh
# Covers: UC-1, UC-2, UC-3, UC-12, UC-13, UC-16, UC-24

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_ROOT/hooks/pre-tool-use/pipeline-gate.sh"

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

# Run the hook from a given project dir, pipe in JSON, capture output
run_hook() {
    local project_dir="$1"
    local json="$2"
    # cd into project dir so the hook's relative path checks (docs/scope/, docs/specs/) work
    (cd "$project_dir" && CLAUDE_PLUGIN_ROOT="$REPO_ROOT" bash "$HOOK" <<< "$json" 2>/dev/null)
}

# ---------------------------------------------------------------------------
# Covers: UC-1 — No scope dir → denied, output mentions scope
# ---------------------------------------------------------------------------
test_uc1_no_scope() {
    local tmpdir
    tmpdir=$(mktemp -d)
    # No docs/scope/ directory at all
    local json='{"tool_name":"Edit","tool_input":{"file_path":"/some/project/main.py","old_string":"a","new_string":"b"}}'
    local output
    output=$(run_hook "$tmpdir" "$json")
    rm -rf "$tmpdir"

    if echo "$output" | grep -q "permissionDecision" && echo "$output" | grep -q "scope"; then
        pass "UC-1: no scope dir → deny with scope message"
    else
        fail "UC-1: no scope dir → deny with scope message" "output was: $output"
    fi
}

# ---------------------------------------------------------------------------
# Covers: UC-2 — Scope exists, no design → denied, output mentions design
# ---------------------------------------------------------------------------
test_uc2_scope_no_design() {
    local tmpdir
    tmpdir=$(mktemp -d)
    mkdir -p "$tmpdir/docs/scope"
    echo "# Scope" > "$tmpdir/docs/scope/scope.md"
    # No docs/specs/ directory

    local json='{"tool_name":"Edit","tool_input":{"file_path":"/some/project/main.py","old_string":"a","new_string":"b"}}'
    local output
    output=$(run_hook "$tmpdir" "$json")
    rm -rf "$tmpdir"

    if echo "$output" | grep -q "permissionDecision" && echo "$output" | grep -q "design"; then
        pass "UC-2: scope exists, no design → deny with design message"
    else
        fail "UC-2: scope exists, no design → deny with design message" "output was: $output"
    fi
}

# ---------------------------------------------------------------------------
# Covers: UC-3 — Both scope and design exist → allow (empty output)
# ---------------------------------------------------------------------------
test_uc3_both_exist() {
    local tmpdir
    tmpdir=$(mktemp -d)
    mkdir -p "$tmpdir/docs/scope" "$tmpdir/docs/specs"
    echo "# Scope" > "$tmpdir/docs/scope/scope.md"
    echo "# Design" > "$tmpdir/docs/specs/feature-design-v1.md"

    local json='{"tool_name":"Edit","tool_input":{"file_path":"/some/project/main.py","old_string":"a","new_string":"b"}}'
    local output
    output=$(run_hook "$tmpdir" "$json")
    rm -rf "$tmpdir"

    if [ -z "$output" ]; then
        pass "UC-3: both exist → empty output (allow)"
    else
        fail "UC-3: both exist → empty output (allow)" "output was: $output"
    fi
}

# ---------------------------------------------------------------------------
# Covers: UC-13 — file_path inside plugin dir → allow regardless of scope
# ---------------------------------------------------------------------------
test_uc13_plugin_dir_exempt() {
    local tmpdir
    tmpdir=$(mktemp -d)
    # No scope, no design — but the file is inside the plugin root

    local json="{\"tool_name\":\"Edit\",\"tool_input\":{\"file_path\":\"$REPO_ROOT/hooks/some-hook.sh\",\"old_string\":\"a\",\"new_string\":\"b\"}}"
    local output
    output=$(run_hook "$tmpdir" "$json")
    rm -rf "$tmpdir"

    if [ -z "$output" ]; then
        pass "UC-13: file in plugin dir → empty output (allow)"
    else
        fail "UC-13: file in plugin dir → empty output (allow)" "output was: $output"
    fi
}

# ---------------------------------------------------------------------------
# Covers: UC-12 — Empty scope file → still allows (existence check only)
# ---------------------------------------------------------------------------
test_uc12_empty_scope_file() {
    local tmpdir
    tmpdir=$(mktemp -d)
    mkdir -p "$tmpdir/docs/scope" "$tmpdir/docs/specs"
    # Empty scope file — existence is sufficient
    touch "$tmpdir/docs/scope/empty-scope.md"
    echo "# Design" > "$tmpdir/docs/specs/feature-design-v1.md"

    local json='{"tool_name":"Edit","tool_input":{"file_path":"/some/project/main.py","old_string":"a","new_string":"b"}}'
    local output
    output=$(run_hook "$tmpdir" "$json")
    rm -rf "$tmpdir"

    if [ -z "$output" ]; then
        pass "UC-12: empty scope file → empty output (allow)"
    else
        fail "UC-12: empty scope file → empty output (allow)" "output was: $output"
    fi
}

# ---------------------------------------------------------------------------
# Covers: UC-16 — Multiple scope files → any satisfies
# ---------------------------------------------------------------------------
test_uc16_multiple_scope_files() {
    local tmpdir
    tmpdir=$(mktemp -d)
    mkdir -p "$tmpdir/docs/scope" "$tmpdir/docs/specs"
    echo "# Scope A" > "$tmpdir/docs/scope/scope-a.md"
    echo "# Scope B" > "$tmpdir/docs/scope/scope-b.md"
    echo "# Design" > "$tmpdir/docs/specs/feature-design-v1.md"

    local json='{"tool_name":"Edit","tool_input":{"file_path":"/some/project/main.py","old_string":"a","new_string":"b"}}'
    local output
    output=$(run_hook "$tmpdir" "$json")
    rm -rf "$tmpdir"

    if [ -z "$output" ]; then
        pass "UC-16: multiple scope files → empty output (allow)"
    else
        fail "UC-16: multiple scope files → empty output (allow)" "output was: $output"
    fi
}

# ---------------------------------------------------------------------------
# Covers: UC-24 — Malformed JSON input → fail-open (empty output)
# ---------------------------------------------------------------------------
test_uc24_malformed_json() {
    local tmpdir
    tmpdir=$(mktemp -d)
    # No docs setup — but malformed JSON should cause fail-open before checking

    local json='not-valid-json-at-all'
    local output
    output=$(run_hook "$tmpdir" "$json")
    rm -rf "$tmpdir"

    if [ -z "$output" ]; then
        pass "UC-24: malformed JSON → empty output (fail-open)"
    else
        fail "UC-24: malformed JSON → empty output (fail-open)" "output was: $output"
    fi
}

# ---------------------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------------------
test_uc1_no_scope
test_uc2_scope_no_design
test_uc3_both_exist
test_uc13_plugin_dir_exempt
test_uc12_empty_scope_file
test_uc16_multiple_scope_files
test_uc24_malformed_json

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
