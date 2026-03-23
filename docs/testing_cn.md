# 技能测试

测试涉及子 Agent、工作流和复杂交互的技能，需要在无头模式下运行 Claude Code 会话，并通过会话日志验证行为。

## 测试结构

```
tests/
├── claude-code/
│   ├── test-helpers.sh                    # 共享测试工具
│   ├── test-subagent-driven-development-integration.sh  # craft-code 集成测试
│   └── run-skill-tests.sh                 # 测试运行器
├── brainstorm-server/                     # 视觉伴侣服务器测试
├── explicit-skill-requests/               # 技能调用测试
├── skill-triggering/                      # 自动触发测试
└── subagent-driven-dev/                   # 端到端测试项目
```

## 运行测试

### 集成测试

```bash
cd tests/claude-code
./test-subagent-driven-development-integration.sh
```

**注意：** 集成测试需要 10-30 分钟（真实实现，多个子 Agent）。

### 前提条件

- 从 **craft-claude 插件目录**运行（不是临时目录）
- `claude` 命令可用
- 本地开发市场已启用：`~/.claude/settings.json` 中 `"craft-claude@craft-claude-dev": true`

## 集成测试：craft-code（子 Agent 驱动模式）

### 测试内容

验证 `craft-code` 技能（子 Agent 驱动模式）：

1. **计划加载** — 开始时读取一次计划
2. **完整任务文本** — 向子 Agent 提供完整描述
3. **自审** — 子 Agent 报告前自审
4. **审查顺序** — 先规格符合性，再代码质量
5. **审查循环** — 发现问题时重新审查
6. **独立验证** — 审查者独立阅读代码

### 工作方式

1. **Setup**：创建临时项目和最小实施计划
2. **Execution**：在无头模式下运行 Claude Code
3. **Verification**：解析会话日志（`.jsonl`）验证：
   - Skill tool 被调用
   - 子 Agent 被派遣（Task tool）
   - TodoWrite 用于跟踪
   - 实现文件已创建
   - 测试通过
   - Git 提交显示正确工作流
4. **Token Analysis**：按子 Agent 展示 token 用量

## Token 分析工具

```bash
python3 tests/claude-code/analyze-token-usage.py ~/.claude/projects/<project-dir>/<session-id>.jsonl
```

### 查找会话文件

```bash
find ~/.claude/projects -name "*.jsonl" -mmin -60
```

## 编写新测试

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

TEST_PROJECT=$(create_test_project)
trap "cleanup_test_project $TEST_PROJECT" EXIT

cd "$TEST_PROJECT"
# 设置测试文件...

PROMPT="你的测试提示"
cd "$SCRIPT_DIR/../.." && timeout 1800 claude -p "$PROMPT" \
  --allowed-tools=all \
  --add-dir "$TEST_PROJECT" \
  --permission-mode bypassPermissions \
  2>&1 | tee output.txt

# 解析会话日志验证行为
SESSION_FILE=$(find "$HOME/.claude/projects" -name "*.jsonl" -mmin -60 | sort -r | head -1)
grep -q '"name":"Skill".*"skill":"craft-code"' "$SESSION_FILE" && echo "[PASS]"
```

### 最佳实践

- 始终清理临时目录（使用 `trap`）
- 解析 `.jsonl` 日志，而非面向用户的输出
- 使用 `--permission-mode bypassPermissions` 和 `--add-dir`
- 从插件目录运行（技能只从那里加载）
- 包含 token 分析以了解成本
- 验证实际产物：文件创建、测试通过、提交生成
