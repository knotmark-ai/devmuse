#!/usr/bin/env bash
# Auto-judge a prd-state-modeling transcript against its README pass criteria.
# Usage: ./judge.sh <scenario> [transcript.json]
#   - <scenario> is a prompt basename, e.g. stateless-cli-no-trigger
#   - transcript.json defaults to the newest run under /tmp/devmuse-tests/*/prd-state-modeling/<scenario>/
# Exit 0 = pass, 1 = fail, 2 = usage/setup error. Judgment uses headless claude.
set -e

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

# Extract the assistant's final result text from the run JSON (fall back to raw).
node -e '
  const fs = require("fs");
  const raw = fs.readFileSync(process.argv[1], "utf8");
  let text = raw;
  try { const j = JSON.parse(raw); text = j.result ?? j.text ?? raw; } catch {}
  fs.writeFileSync(process.argv[2], String(text));
' "$TRANSCRIPT" "$WORK/transcript.txt"

node "$SCRIPT_DIR/judge.mjs" "$SCENARIO" "$WORK/transcript.txt" > "$WORK/prompt.txt"

echo "=== Judging '$SCENARIO' against README criteria ===" >&2
JUDGE_JSON=$(claude -p "$(cat "$WORK/prompt.txt")" --output-format json 2>/dev/null || true)
if [ -z "$JUDGE_JSON" ]; then
    echo "Judge model produced no output." >&2
    exit 2
fi

# Pull the judge model's response text, then parse the verdict deterministically.
echo "$JUDGE_JSON" | node -e '
  const fs = require("fs");
  const raw = fs.readFileSync(0, "utf8");
  let text = raw;
  try { const j = JSON.parse(raw); text = j.result ?? j.text ?? raw; } catch {}
  process.stdout.write(text);
' | node "$SCRIPT_DIR/judge.mjs" --parse
