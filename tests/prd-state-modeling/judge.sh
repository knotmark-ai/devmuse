#!/usr/bin/env bash
# Auto-judge a prd-state-modeling transcript against its README pass criteria.
# Usage: ./judge.sh <scenario> [transcript.json]
#   - <scenario> is a prompt basename, e.g. stateless-cli-no-trigger
#   - transcript.json defaults to the newest run under /tmp/devmuse-tests/*/prd-state-modeling/<scenario>/
# Exit 0 = pass, 1 = fail (regression), 2 = usage/setup/judge fault. Uses headless claude.
set -e
set -o pipefail   # a mid-pipe crash (extract-result) must not be masked by the tail

SCENARIO="$1"
TRANSCRIPT="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "$SCENARIO" ]; then
    echo "Usage: $0 <scenario> [transcript.json]" >&2
    exit 2
fi

if [ -z "$TRANSCRIPT" ]; then
    TRANSCRIPT=$(ls -dt /tmp/devmuse-tests/*/prd-state-modeling/"$SCENARIO"/claude-output.json 2>/dev/null | head -1 || true)
fi
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
    echo "No transcript found for '$SCENARIO'. Run ./run-test.sh prompts/$SCENARIO.txt first, or pass a path." >&2
    exit 2
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Extract the assistant's final result text from the run JSON (handles both the
# single-object and stream-array shapes of `claude -p --output-format json`).
node "$SCRIPT_DIR/extract-result.mjs" "$TRANSCRIPT" > "$WORK/transcript.txt"

node "$SCRIPT_DIR/judge.mjs" "$SCENARIO" "$WORK/transcript.txt" > "$WORK/prompt.txt"

echo "=== Judging '$SCENARIO' against README criteria ===" >&2
JUDGE_JSON=$(claude -p "$(cat "$WORK/prompt.txt")" --output-format json 2>/dev/null || true)
if [ -z "$JUDGE_JSON" ]; then
    echo "Judge model produced no output." >&2
    exit 2
fi

# Pull the judge model's response text, then parse the verdict deterministically,
# requiring the judge to have graded exactly the scenario's criteria count.
EXPECTED=$(node "$SCRIPT_DIR/judge.mjs" --count "$SCENARIO" 2>/dev/null || echo "")
printf '%s' "$JUDGE_JSON" | node "$SCRIPT_DIR/extract-result.mjs" | node "$SCRIPT_DIR/judge.mjs" --parse "$EXPECTED"
