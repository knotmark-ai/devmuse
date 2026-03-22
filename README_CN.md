# Craft Claude

Craft Claude 是一套专为 Claude Code 设计的完整软件开发工作流，基于一组可组合的"技能（skills）"和一个确保 Agent 使用这些技能的引导机制。

基于 [Superpowers](https://github.com/obra/superpowers)（Jesse Vincent）。

## 工作原理

从你启动 Claude Code 的那一刻起就开始了。当它发现你正在构建某个东西时，它**不会**直接跳进去写代码，而是退一步问你真正想做什么。

在通过对话梳理出需求规格后，它会将内容分成足够短的片段展示给你，便于你实际阅读和消化。

在你确认设计方案后，你的 Agent 会制定一份实施计划——清晰到即使是一个热情但品味欠佳、缺乏判断力、没有项目背景、且不爱写测试的初级工程师也能遵循。计划强调真正的红/绿 TDD、YAGNI（你不会需要它）和 DRY 原则。

接下来，当你说"开始"后，它会启动一个*子 Agent 驱动开发*流程，让多个 Agent 逐一完成每个工程任务，检查和审查它们的工作，然后继续推进。Claude 连续自主工作几个小时而不偏离你制定的计划是很常见的。

## 安装

### Claude Code（通过插件市场）

先注册市场：

```bash
/plugin marketplace add huiyu/craft-claude-marketplace
```

然后安装插件：

```bash
/plugin install craft-claude@craft-claude-marketplace
```

### 验证安装

启动新会话，请求一些应该触发技能的操作（例如，"帮我规划这个功能"或"让我们调试这个问题"）。Agent 应该会自动调用相关技能。

## 基本工作流

1. **craft-brainstorm（头脑风暴）** - 在写代码之前激活。通过提问细化粗略想法，探索替代方案，分段展示设计供验证。

2. **craft-worktree（工作树）** - 在设计获批后激活。在新分支上创建隔离工作区，运行项目设置，验证测试基线正常。

3. **craft-plan（编写计划）** - 在设计获批后激活。将工作拆分为小型任务（每个 2-5 分钟）。每个任务都有精确的文件路径、完整的代码和验证步骤。

4. **craft-sdd（子 Agent 驱动开发）** 或 **craft-execute（执行计划）** - 有计划后激活。为每个任务分派新的子 Agent，进行两阶段审查（先检查规格符合性，再检查代码质量），或分批执行并设置人工检查点。

5. **craft-tdd（测试驱动开发）** - 在实现过程中激活。强制执行 RED-GREEN-REFACTOR：编写失败的测试，观察失败，编写最少代码，观察通过，提交。

6. **craft-review（代码审查）** - 在任务之间激活。根据计划进行审查，按严重程度报告问题。严重问题会阻止进度。

7. **craft-finish（完成分支）** - 在任务完成时激活。验证测试，展示选项（合并/PR/保留/丢弃），清理工作树。

**Agent 在执行任何任务前都会检查相关技能。** 这是强制工作流，不是建议。

## 包含内容

### 技能库

**测试**
- **craft-tdd** - RED-GREEN-REFACTOR 循环（包含测试反模式参考）

**调试**
- **craft-debug** - 4 阶段根因分析流程（包含根因追踪、纵深防御、基于条件的等待技术）
- **craft-verify** - 确保问题确实已修复

**协作**
- **craft-brainstorm** - 苏格拉底式设计细化
- **craft-plan** - 详细的实施计划
- **craft-execute** - 分批执行并设置检查点
- **craft-parallel** - 并发子 Agent 工作流
- **craft-review** - 审查前检查清单
- **craft-review-response** - 回应反馈
- **craft-worktree** - 并行开发分支
- **craft-finish** - 合并/PR 决策工作流
- **craft-sdd** - 快速迭代，两阶段审查（先规格符合性，再代码质量）

**元技能**
- **craft-write-skill** - 按照最佳实践创建新技能（包含测试方法论）

## 理念

- **测试驱动开发** - 始终先写测试
- **系统化优于临时方案** - 流程优于猜测
- **降低复杂性** - 简洁是首要目标
- **证据优于声明** - 在宣告成功前先验证

## 本地开发

无需安装，直接从本地目录加载插件：

```bash
claude --plugin-dir /path/to/craft-claude
```

修改代码后无需重启，在会话中刷新：

```
/reload-plugins
```

可选：添加 shell alias 方便日常使用：

```bash
alias claude-dev='claude --plugin-dir /path/to/craft-claude'
```

## 更新

更新插件时技能会自动更新：

```bash
/plugin update craft-claude
```

## 许可证

MIT 许可证 - 详见 LICENSE 文件

## 致谢

- 基于 [Superpowers](https://github.com/obra/superpowers)，作者 [Jesse Vincent](https://blog.fsck.com) 和 [Prime Radiant](https://primeradiant.com)
- 灵感来自 [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)
