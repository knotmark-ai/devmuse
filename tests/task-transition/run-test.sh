#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/plugin"
MODEL="${MODEL:-sonnet}"
MAX_BUDGET_USD="${MAX_BUDGET_USD:-1.00}"
OUTPUT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/devmuse-transition.XXXXXX")"
PROJECT_DIR="$OUTPUT_DIR/project"
SESSION_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"

cleanup() {
    local exit_code=$?
    if [[ "$exit_code" -eq 0 && "${KEEP_OUTPUT:-0}" != "1" ]]; then
        rm -rf "$OUTPUT_DIR"
    else
        echo "Logs preserved at: $OUTPUT_DIR"
    fi
}
trap cleanup EXIT

mkdir -p "$PROJECT_DIR/src"
printf '%s\n' \
    'export function shouldBlock(action, mode = "enforce") {' \
    '  if (mode === "off") return false;' \
    '  return action.risk === "high";' \
    '}' > "$PROJECT_DIR/src/risk.js"
cp "$PROJECT_DIR/src/risk.js" "$OUTPUT_DIR/risk.expected.js"

run_turn() {
    local number="$1"
    local prompt="$2"
    local log="$OUTPUT_DIR/turn-${number}.jsonl"
    local session_flag=(--resume "$SESSION_ID")
    if [[ "$number" == "1" ]]; then
        session_flag=(--session-id "$SESSION_ID")
    fi

    (
        cd "$PROJECT_DIR"
        claude -p "$prompt" \
            "${session_flag[@]}" \
            --plugin-dir "$PLUGIN_DIR" \
            --dangerously-skip-permissions \
            --model "$MODEL" \
            --max-budget-usd "$MAX_BUDGET_USD" \
            --max-turns 8 \
            --verbose \
            --output-format stream-json \
            > "$log"
    )
}

echo "Running issue #46 multi-turn regression with $MODEL"
run_turn 1 "Inspect src/risk.js and explain how its risk control behaves. Do not change files."
run_turn 2 "I want to temporarily disable enforcement. Should this support off, shadow, and enforce modes?"
if [[ "${TRANSITION_ONLY:-0}" != "1" ]]; then
    run_turn 3 "What would shadow mode mean operationally?"
    run_turn 4 "Could shadow logging be asynchronous?"
    run_turn 5 "Keep all three modes and make shadow the default."
fi

scope_line="$(grep -nE '"name":"Skill".*"skill":"([^"]*:)?mu-scope"' "$OUTPUT_DIR/turn-2.jsonl" | head -1 | cut -d: -f1 || true)"
if [[ -z "$scope_line" ]]; then
    echo "FAIL: turn 2 did not reclassify the inspection-to-design transition through mu-scope"
    exit 1
fi

mutation_line="$(grep -nE '"name":"(Edit|Write|NotebookEdit)"' "$OUTPUT_DIR/turn-2.jsonl" | head -1 | cut -d: -f1 || true)"
if [[ -n "$mutation_line" && "$mutation_line" -lt "$scope_line" ]]; then
    echo "FAIL: turn 2 mutated files before invoking mu-scope"
    exit 1
fi

if ! diff -u "$OUTPUT_DIR/risk.expected.js" "$PROJECT_DIR/src/risk.js"; then
    echo "FAIL: the design conversation changed the inspected source file"
    exit 1
fi

echo "PASS: task transition was reclassified before behavior-changing work"
