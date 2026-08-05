#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

resolve_path() {
    local file="$1"
    case "$file" in
        rules/*|skills/*|agents/*|knowledge/*|hooks/*)
            printf '%s/plugin/%s\n' "$ROOT_DIR" "$file"
            ;;
        *)
            printf '%s/%s\n' "$ROOT_DIR" "$file"
            ;;
    esac
}

assert_contains() {
    local file="$1"
    local pattern="$2"
    local path
    path="$(resolve_path "$file")"

    if ! grep -Fq "$pattern" "$path"; then
        echo "FAIL: $file is missing: $pattern"
        return 1
    fi
}

assert_absent() {
    local file="$1"
    local pattern="$2"
    local path
    path="$(resolve_path "$file")"

    if grep -Fq "$pattern" "$path"; then
        echo "FAIL: $file still contains: $pattern"
        return 1
    fi
}

assert_file_absent() {
    local file="$1"
    local path
    path="$(resolve_path "$file")"

    if [[ -e "$path" ]]; then
        echo "FAIL: retired file still exists: $file"
        return 1
    fi
}

assert_repo_file_absent() {
    local file="$1"

    if [[ -e "$ROOT_DIR/$file" ]]; then
        echo "FAIL: runtime path escaped plugin boundary: $file"
        return 1
    fi
}

# Distribution boundary: marketplace metadata stays at repository root while
# Claude Code copies only plugin/ into its installed plugin cache.
assert_contains ".claude-plugin/marketplace.json" '"source": "./plugin"'
assert_contains "plugin/.claude-plugin/plugin.json" '"name": "devmuse"'
assert_repo_file_absent "rules"
assert_repo_file_absent "skills"
assert_repo_file_absent "agents"
assert_repo_file_absent "knowledge"
assert_repo_file_absent "hooks"

# Entry eligibility: execution-only work must be able to avoid the skill pipeline.
assert_contains "rules/bootstrap.md" "Direct lane"
assert_contains "rules/bootstrap.md" "mechanical, reversible, or execution-only"
assert_contains "rules/bootstrap.md" "material unresolved design decision"
assert_contains "rules/bootstrap.md" "low-impact local judgment"
assert_contains "rules/bootstrap.md" "contract, safety, data, dependency, or non-local behavior risk"
assert_contains "rules/bootstrap.md" "Direct eligibility is evaluated before intent priority"
assert_contains "rules/bootstrap.md" "For every unprefixed in-domain message, classify before responding or acting"
assert_contains "rules/bootstrap.md" "Classify the current message as if conversation history were absent"
assert_contains "rules/bootstrap.md" "desired or future behavior after"
assert_contains "rules/bootstrap.md" "A follow-up inside the active process is a continuation"
assert_contains "rules/bootstrap.md" "select a different route without conversation history is a transition"
assert_contains "rules/bootstrap.md" "reclassified — for example inspect→implement"
assert_contains "rules/bootstrap.md" "Read-only Direct ends after each answer"
assert_contains "rules/bootstrap.md" "A follow-up that proposes, compares,"
assert_contains "rules/bootstrap.md" "Reclassify and invoke the selected skill before"
assert_contains "rules/bootstrap.md" "Desired behavior is not read-only inspection"
assert_contains "rules/bootstrap.md" "Apply the transition test"
assert_contains "rules/bootstrap.md" "narrow reference/dependency check"
assert_contains "rules/bootstrap.md" "Intent uses verb plus object, not a trigger token alone"
assert_contains "rules/bootstrap.md" "a named diff, PR, patch, branch, or stated change outranks bug/fix words inside that review object"
assert_contains "rules/bootstrap.md" "Review and fix"
assert_contains "rules/bootstrap.md" "briefly name the exclusion"
assert_contains "rules/bootstrap.md" "upgrade"

# Read-only understanding must not manufacture a workflow artifact. Persistent
# architecture knowledge has one home and is generated only on explicit demand.
assert_contains "rules/bootstrap.md" "Read-only inspection"
assert_contains "rules/bootstrap.md" "no mutation and no durable artifact"
assert_contains "rules/bootstrap.md" "durable current-state architecture documentation"
assert_absent "rules/bootstrap.md" "mu-explore"
assert_absent "README.md" "mu-explore"
assert_absent "README_CN.md" "mu-explore"
assert_contains "CONTEXT.md" "Retired **mu-explore** as a persistent workflow"
assert_absent "CONTEXT.md" "(mu-explore), Scope/Reproduce"
assert_file_absent "skills/mu-explore/SKILL.md"
assert_file_absent "knowledge/templates/explore.md"
assert_file_absent "docs/explore/_overview.md"

# Work that does enter scoping must scale its ceremony to the probe result.
assert_contains "skills/mu-scope/SKILL.md" "Bounded path"
assert_contains "skills/mu-scope/SKILL.md" "Architectural path"
assert_contains "skills/mu-scope/SKILL.md" "The original request is approval"
assert_contains "skills/mu-scope/SKILL.md" "Existing wiki pages are a map, not evidence"
assert_absent "skills/mu-scope/SKILL.md" "This applies to EVERY task regardless of perceived simplicity."
assert_absent "skills/mu-scope/SKILL.md" "Every task goes through scoping."
assert_contains "skills/mu-debug/SKILL.md" "Use when an approved reproduction or failing test needs root-cause investigation before a fix"

# Bounded implementation gets one combined review, not per-task review fan-out.
assert_contains "skills/mu-code/SKILL.md" "Bounded Execution"
assert_contains "skills/mu-code/SKILL.md" "one combined review"
assert_contains "skills/mu-code/SKILL.md" "no subagent fan-out"
assert_contains "skills/mu-code/SKILL.md" "one final mu-review"
assert_absent "skills/mu-code/SKILL.md" "two-stage review after each"
assert_absent "skills/mu-code/SKILL.md" "@../../agents/mu-reviewer.md"
assert_contains "skills/mu-code/SKILL.md" "testing-anti-patterns.md"
assert_contains "skills/mu-code/SKILL.md" "defensive-boundary.md"
assert_contains "skills/mu-review/SKILL.md" "defensive-boundary.md"
assert_file_absent "knowledge/schemas/codex-review-output.json"
assert_absent "knowledge/principles/skill-cso.md" "two-stage review"
assert_file_absent "skills/mu-debug/CREATION-LOG.md"
assert_file_absent "skills/mu-debug/test-academic.md"
assert_file_absent "skills/mu-debug/test-pressure-1.md"
assert_file_absent "skills/mu-debug/test-pressure-2.md"
assert_file_absent "skills/mu-debug/test-pressure-3.md"
assert_file_absent "skills/mu-write-skill/testing-skills-with-subagents.md"
assert_file_absent "skills/mu-write-skill/graphviz-conventions.dot"
assert_contains "skills/mu-plan/SKILL.md" "mu-code selects the execution mode"
assert_absent "skills/mu-plan/SKILL.md" "review between tasks"

# Cross-task contracts are explicit only when the plan actually has shared
# constraints or task-to-task interfaces; self-contained plans pay no template cost.
assert_contains "skills/mu-plan/SKILL.md" "Cross-Task Contract (conditional)"
assert_contains "skills/mu-plan/SKILL.md" "affects at least two implementation tasks"
assert_contains "skills/mu-plan/SKILL.md" "other named output that another task consumes"
assert_contains "skills/mu-plan/SKILL.md" "If neither trigger fires, omit"
assert_contains "skills/mu-plan/SKILL.md" "skills/mu-plan/cross-task-contract.md"
assert_contains "skills/mu-plan/cross-task-contract.md" "copied verbatim"
assert_contains "skills/mu-plan/cross-task-contract.md" '**Interfaces:**'
assert_contains "skills/mu-plan/cross-task-contract.md" "Every task-to-task dependency"
assert_contains "skills/mu-code/SKILL.md" "Global Constraints"
assert_contains "skills/mu-code/SKILL.md" "Interfaces"
assert_contains "agents/mu-reviewer.md" "Cross-Task Contract"
assert_contains "agents/mu-coder.md" "Global Constraints"
assert_contains "agents/mu-coder.md" "Interfaces"

# Standalone review is read-only unless the user explicitly asks for fixes;
# pipeline-final review may fix findings within the implementation scope.
assert_contains "skills/mu-review/SKILL.md" "Standalone review"
assert_contains "skills/mu-review/SKILL.md" "report-only"
assert_contains "skills/mu-review/SKILL.md" "Review and fix"

# Wiki generation owns durable current-state architecture, but scales its
# output to the code instead of enforcing arbitrary source/diagram quotas.
assert_contains "skills/mu-wiki/SKILL.md" "single durable home"
assert_contains "skills/mu-wiki/SKILL.md" "unmapped changed files"
assert_contains "skills/mu-wiki/SKILL.md" "Source file listing lives inside the generated block"
assert_contains "skills/mu-wiki/SKILL.md" "preserve existing curated blocks"
assert_absent "skills/mu-wiki/SKILL.md" "minimum 5 distinct files"
assert_absent "skills/mu-wiki/SKILL.md" "at least one diagram per page"

# Existing source is context, not proof that the user asked to reverse-engineer
# an artifact. Model sync is an update subtype, and current architecture has one
# durable owner.
assert_contains "knowledge/principles/stance-detection.md" "Source existence is context, not intent"
assert_absent "knowledge/principles/stance-detection.md" "If 0 candidates AND source dirs non-empty"
assert_contains "skills/mu-model/SKILL.md" '| `update(sync)` |'
assert_absent "skills/mu-model/SKILL.md" '| `sync` |'
assert_contains "skills/mu-arch/SKILL.md" 'Current-state architecture documentation belongs to `/mu-wiki`'

# The user-facing contract must describe the actual three-path behavior in both languages.
assert_contains "README.md" "direct → bounded → architectural"
assert_contains "README_CN.md" "直接执行 → 有界变更 → 架构变更"
assert_contains "docs/architecture.md" "mu-code | mu-coder"
assert_absent "docs/architecture.md" "mu-code | mu-coder; mu-reviewer"
assert_contains "docs/architecture_cn.md" "mu-code | mu-coder"
assert_absent "docs/architecture_cn.md" "mu-code | mu-coder；mu-reviewer"

echo "PASS: routing ceremony scales with task risk and uncertainty"
