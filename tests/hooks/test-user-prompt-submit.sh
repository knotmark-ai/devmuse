#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$ROOT_DIR/plugin/hooks/user-prompt-submit"
HOOKS_JSON="$ROOT_DIR/plugin/hooks/hooks.json"

output="$(printf '%s' '{"hook_event_name":"UserPromptSubmit","prompt":"same topic, new intent"}' | bash "$HOOK")"

[[ "$(printf '%s' "$output" | jq -r '.hookSpecificOutput.hookEventName')" == "UserPromptSubmit" ]]
printf '%s' "$output" | jq -e '.hookSpecificOutput.additionalContext | contains("without conversation history")' >/dev/null
printf '%s' "$output" | jq -e '.hookSpecificOutput.additionalContext | contains("desired or future behavior")' >/dev/null
[[ "$(printf '%s' "$output" | wc -c | tr -d ' ')" -lt 500 ]]
jq -e '.hooks.UserPromptSubmit[0].hooks[0].command | contains("user-prompt-submit")' "$HOOKS_JSON" >/dev/null

echo "PASS: per-turn routing checkpoint is valid and stays below 500 bytes"
