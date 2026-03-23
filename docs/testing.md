# Testing Craft Claude Skills / 技能测试

Testing skills that involve subagents, workflows, and complex interactions requires running actual Claude Code sessions in headless mode and verifying behavior through session transcripts.

测试涉及子 Agent、工作流和复杂交互的技能，需要在无头模式下运行 Claude Code 会话，并通过会话日志验证行为。

## Test Structure / 测试结构

```
tests/
├── claude-code/
│   ├── test-helpers.sh                    # Shared test utilities
│   ├── test-subagent-driven-development-integration.sh  # craft-code integration
│   └── run-skill-tests.sh                 # Test runner
├── brainstorm-server/                     # Visual companion server tests
├── explicit-skill-requests/               # Skill invocation tests
├── skill-triggering/                      # Auto-trigger tests
└── subagent-driven-dev/                   # E2E test projects
```

## Running Tests / 运行测试

### Integration Tests / 集成测试

```bash
cd tests/claude-code
./test-subagent-driven-development-integration.sh
```

**Note:** Integration tests take 10-30 minutes (real implementation with multiple subagents).

### Requirements / 前提条件

- Run from the **craft-claude plugin directory** (not temp directories)
- `claude` command available
- Local dev marketplace enabled: `"craft-claude@craft-claude-dev": true` in `~/.claude/settings.json`

## Integration Test: craft-code (subagent-driven mode)

### What It Tests / 测试内容

Verifies `craft-code` skill (subagent-driven mode) correctly:

1. **Plan Loading** — Reads plan once at beginning
2. **Full Task Text** — Provides complete descriptions to subagents
3. **Self-Review** — Subagents self-review before reporting
4. **Review Order** — Spec compliance before code quality
5. **Review Loops** — Re-reviews when issues found
6. **Independent Verification** — Reviewer reads code independently

### How It Works / 工作方式

1. **Setup**: Creates temporary project with minimal implementation plan
2. **Execution**: Runs Claude Code in headless mode with skill
3. **Verification**: Parses session transcript (`.jsonl`) to verify:
   - Skill tool invoked
   - Subagents dispatched (Task tool)
   - TodoWrite used for tracking
   - Implementation files created
   - Tests pass
   - Git commits show proper workflow
4. **Token Analysis**: Shows per-subagent token breakdown

## Token Analysis Tool / Token 分析工具

```bash
python3 tests/claude-code/analyze-token-usage.py ~/.claude/projects/<project-dir>/<session-id>.jsonl
```

### Finding Session Files / 查找会话文件

```bash
find ~/.claude/projects -name "*.jsonl" -mmin -60
```

## Writing New Tests / 编写新测试

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

TEST_PROJECT=$(create_test_project)
trap "cleanup_test_project $TEST_PROJECT" EXIT

cd "$TEST_PROJECT"
# Set up test files...

PROMPT="Your test prompt here"
cd "$SCRIPT_DIR/../.." && timeout 1800 claude -p "$PROMPT" \
  --allowed-tools=all \
  --add-dir "$TEST_PROJECT" \
  --permission-mode bypassPermissions \
  2>&1 | tee output.txt

# Parse session transcript to verify behavior
SESSION_FILE=$(find "$HOME/.claude/projects" -name "*.jsonl" -mmin -60 | sort -r | head -1)
grep -q '"name":"Skill".*"skill":"craft-code"' "$SESSION_FILE" && echo "[PASS]"
```

### Best Practices / 最佳实践

- Always cleanup temp directories (use `trap`)
- Parse `.jsonl` transcripts, not user-facing output
- Use `--permission-mode bypassPermissions` and `--add-dir`
- Run from plugin directory (skills only load from there)
- Include token analysis for cost visibility
- Verify actual artifacts: files created, tests passing, commits made
