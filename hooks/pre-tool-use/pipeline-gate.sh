#!/usr/bin/env bash
# PreToolUse hook: enforce scope + design existence before Edit/Write
# Fail-open: any error → exit 0 (no decision) → Claude Code proceeds

trap 'exit 0' ERR
set -uo pipefail

INPUT=$(cat)

# Extract file_path from JSON using grep+sed (no jq dependency)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')

if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Exempt edits to the devmuse plugin directory itself
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -n "$PLUGIN_ROOT" ]; then
    case "$FILE_PATH" in
        "$PLUGIN_ROOT"/*)
            exit 0
            ;;
    esac
fi

# Check for scope artifact
# Use find + || true to avoid triggering ERR trap via pipefail on missing dirs
SCOPE_FILES=$(find docs/scope -name "*.md" -maxdepth 1 2>/dev/null | head -1) || true
if [ -z "$SCOPE_FILES" ]; then
    printf '{"permissionDecision":"deny","message":"No scope artifact found under docs/scope/. Run mu-scope first."}\n'
    exit 0
fi

# Check for design spec
DESIGN_FILES=$(find docs/specs -name "*-design*.md" -maxdepth 1 2>/dev/null | head -1) || true
if [ -z "$DESIGN_FILES" ]; then
    printf '{"permissionDecision":"deny","message":"No design spec found under docs/specs/. Run mu-design first."}\n'
    exit 0
fi

# Both exist — allow
exit 0
