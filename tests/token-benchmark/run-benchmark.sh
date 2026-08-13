#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/plugin"
MANIFEST="$SCRIPT_DIR/scenarios.json"
MODEL="${MODEL:-sonnet}"
REPEATS="${REPEATS:-1}"
MAX_BUDGET_USD="${MAX_BUDGET_USD:-3.00}"
SCENARIOS="${SCENARIOS:-}"
OUTPUT_DIR="${OUTPUT_DIR:-${TMPDIR:-/tmp}/devmuse-token-benchmark-$(date +%Y%m%d-%H%M%S)}"

command -v claude >/dev/null || { echo "claude CLI is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
[[ "$REPEATS" =~ ^[1-9][0-9]*$ ]] || { echo "REPEATS must be a positive integer" >&2; exit 1; }
[[ ! -e "$OUTPUT_DIR/manifest.json" ]] || { echo "OUTPUT_DIR already contains a benchmark: $OUTPUT_DIR" >&2; exit 1; }

mkdir -p "$OUTPUT_DIR"
cp "$MANIFEST" "$OUTPUT_DIR/manifest.json"

selected() {
    local id="$1"
    [[ -z "$SCENARIOS" || ",$SCENARIOS," == *",$id,"* ]]
}

for ((repeat = 1; repeat <= REPEATS; repeat += 1)); do
    while IFS= read -r id; do
        selected "$id" || continue
        scenario_dir="$OUTPUT_DIR/run-$repeat/$id"
        project_dir="$scenario_dir/project"
        mkdir -p "$project_dir"
        cp -R "$SCRIPT_DIR/fixture-project/." "$project_dir/"
        git -C "$project_dir" init -q
        git -C "$project_dir" config user.name "DevMuse Benchmark"
        git -C "$project_dir" config user.email "benchmark@devmuse.invalid"
        git -C "$project_dir" add .
        git -C "$project_dir" commit -qm "benchmark fixture"

        session_id="$(uuidgen | tr '[:upper:]' '[:lower:]')"
        plugin="$(jq -r --arg id "$id" '.scenarios[] | select(.id == $id) | .plugin' "$MANIFEST")"
        turn=0
        while IFS= read -r prompt_json; do
            turn=$((turn + 1))
            prompt="$(printf '%s' "$prompt_json" | jq -r .)"
            session_flag=(--resume "$session_id")
            if [[ "$turn" -eq 1 ]]; then session_flag=(--session-id "$session_id"); fi
            mode_flags=(--safe-mode)
            if [[ "$plugin" == "true" ]]; then mode_flags=(--plugin-dir "$PLUGIN_DIR"); fi

            echo "[$repeat/$REPEATS] $id turn $turn"
            (
                cd "$project_dir"
                claude -p "$prompt" \
                    "${session_flag[@]}" \
                    "${mode_flags[@]}" \
                    --setting-sources project \
                    --strict-mcp-config \
                    --dangerously-skip-permissions \
                    --model "$MODEL" \
                    --max-budget-usd "$MAX_BUDGET_USD" \
                    --max-turns 40 \
                    --verbose \
                    --output-format stream-json \
                    > "$scenario_dir/turn-$turn.jsonl"
            )
        done < <(jq -c --arg id "$id" '.scenarios[] | select(.id == $id) | .turns[]' "$MANIFEST")
    done < <(jq -r '.scenarios[].id' "$MANIFEST")
done

node "$ROOT_DIR/scripts/summarize-token-benchmark.mjs" "$OUTPUT_DIR"
echo "Raw logs and summaries: $OUTPUT_DIR"
