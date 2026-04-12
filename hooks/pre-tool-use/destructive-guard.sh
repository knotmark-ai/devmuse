#!/usr/bin/env bash
# PreToolUse hook: warn before destructive bash commands
# Fail-open: any error → exit 0

trap 'exit 0' ERR
set -uo pipefail

INPUT=$(cat)

# Extract command from JSON.
# Replace escaped quotes (\") with a placeholder so that grep's [^"]* pattern
# does not stop at them, then restore after extraction.
COMMAND=$(echo "$INPUT" \
    | sed 's/\\"/\x01/g' \
    | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -1 \
    | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//;s/"$//;s/\x01/"/g')

if [ -z "$COMMAND" ]; then
    exit 0
fi

# Safe patterns: allow without asking
case "$COMMAND" in
    "rm -rf node_modules"*|"rm -rf dist"*|"rm -rf .next"*|"rm -rf build"*|"rm -rf __pycache__"*)
        exit 0
        ;;
esac

# Dangerous patterns: ask before proceeding
DANGEROUS=""
case "$COMMAND" in
    *"rm -rf"*)           DANGEROUS="rm -rf" ;;
    *"git push -f"*)      DANGEROUS="git push -f" ;;
    *"git push --force"*) DANGEROUS="git push --force" ;;
    *"DROP TABLE"*)       DANGEROUS="DROP TABLE" ;;
    *"git reset --hard"*) DANGEROUS="git reset --hard" ;;
    *"git clean -fd"*)    DANGEROUS="git clean -fd" ;;
esac

if [ -n "$DANGEROUS" ]; then
    printf '{"permissionDecision":"ask","message":"Destructive command detected: %s. Proceed?"}\n' "$DANGEROUS"
    exit 0
fi

exit 0
