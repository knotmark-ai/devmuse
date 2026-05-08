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

# Safe rm targets: only allow if ALL targets in the command are safe and
# no command chaining (&&, ||, ;) is present.
SAFE_RM_TARGETS="node_modules dist .next build __pycache__"

if echo "$COMMAND" | grep -qE '^rm -rf '; then
    # Reject any command chaining that could smuggle in dangerous commands
    if echo "$COMMAND" | grep -qE '&&|\|\||;|`|\$\('; then
        :  # fall through to dangerous-pattern check below
    else
        # Extract all targets after "rm -rf"
        RM_TARGETS=$(echo "$COMMAND" | sed 's/^rm -rf //')
        ALL_SAFE=true
        for target in $RM_TARGETS; do
            TARGET_BASE=$(basename "$target")
            MATCHED=false
            for safe in $SAFE_RM_TARGETS; do
                if [ "$TARGET_BASE" = "$safe" ]; then
                    MATCHED=true
                    break
                fi
            done
            if [ "$MATCHED" = false ]; then
                ALL_SAFE=false
                break
            fi
        done
        if [ "$ALL_SAFE" = true ]; then
            exit 0
        fi
    fi
fi

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
