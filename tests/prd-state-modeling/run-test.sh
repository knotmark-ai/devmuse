#!/usr/bin/env bash
# Run a prd-state-modeling regression scenario in headless Claude Code.
# Usage: ./run-test.sh <prompt-file> [max-turns]
# Judge the resulting transcript against the criteria table in README.md.

set -e

PROMPT_FILE="$1"
MAX_TURNS="${2:-6}"

if [ -z "$PROMPT_FILE" ]; then
    echo "Usage: $0 <prompt-file> [max-turns]"
    echo "Example: $0 prompts/full-stateful-booking.txt"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

TIMESTAMP=$(date +%s)
SCENARIO="$(basename "$PROMPT_FILE" .txt)"
OUTPUT_DIR="/tmp/devmuse-tests/${TIMESTAMP}/prd-state-modeling/${SCENARIO}"
mkdir -p "$OUTPUT_DIR"

PROMPT=$(cat "$SCRIPT_DIR/$PROMPT_FILE" 2>/dev/null || cat "$PROMPT_FILE")
cp "$SCRIPT_DIR/$PROMPT_FILE" "$OUTPUT_DIR/prompt.txt" 2>/dev/null || cp "$PROMPT_FILE" "$OUTPUT_DIR/prompt.txt"

echo "=== PRD State-Modeling Scenario: ${SCENARIO} ==="
echo "Output dir: $OUTPUT_DIR"

# Run from the plugin root so relative skill paths in prompts resolve.
cd "$PLUGIN_DIR"

# macOS ships no GNU timeout; degrade gracefully (coreutils installs gtimeout)
if command -v timeout >/dev/null 2>&1; then TO="timeout 600";
elif command -v gtimeout >/dev/null 2>&1; then TO="gtimeout 600";
else TO=""; fi

$TO claude -p "$PROMPT" \
    --plugin-dir "$PLUGIN_DIR" \
    --dangerously-skip-permissions \
    --max-turns "$MAX_TURNS" \
    --output-format json \
    > "$OUTPUT_DIR/claude-output.json" || echo "WARN: claude run exited non-zero"

echo "Transcript: $OUTPUT_DIR/claude-output.json"
echo "Judge against the criteria table in tests/prd-state-modeling/README.md"
