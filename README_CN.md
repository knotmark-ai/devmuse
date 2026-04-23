# DevMuse

[English](README.md)

DevMuse 是一套专为 Claude Code 设计的完整软件开发工作流，基于规则（rules）、技能（skills）、代理（agents）、知识（knowledge）四层架构构建。

基于 [Superpowers](https://github.com/obra/superpowers)（Jesse Vincent）。

## 工作原理

从你启动 Claude Code 的那一刻起就开始了。当它发现你正在构建某个东西时，它**不会**直接跳进去写代码，而是先*界定范围*——枚举用例、检测冲突、评估对现有代码的影响。只有在这之后，才进入设计阶段。

在通过对话梳理出需求规格后，它会将内容分成足够短的片段展示给你，便于你实际阅读和消化。

在你确认设计方案后，你的 Agent 会制定一份实施计划——清晰到即使是一个热情但品味欠佳、缺乏判断力、没有项目背景、且不爱写测试的初级工程师也能遵循。计划强调真正的红/绿 TDD、YAGNI（你不会需要它）和 DRY 原则。

接下来，当你说"开始"后，它会启动一个*子 Agent 驱动开发*流程，让多个 Agent 逐一完成每个工程任务，检查和审查它们的工作，然后继续推进。Claude 连续自主工作几个小时而不偏离你制定的计划是很常见的。

## 安装

```bash
# 注册市场
/plugin marketplace add knotmark-ai/devmuse

# 安装插件
/plugin install devmuse@devmuse
```

### 验证安装

启动新会话，请求一些应该触发技能的操作（例如，"帮我规划这个功能"或"让我们调试这个问题"）。Agent 应该会自动调用相关技能。

## 管线

DevMuse 是一个软件工程工作流工具。自动将开发任务路由到结构化管线，并提供按需调用的产品/商业分析工具。

### 核心管线（自动路由）

```
scope → arch → plan → code → review
```

1. **mu-scope** — 扫描代码库评估影响（Quick Probe），枚举用例（正常路径、边界、错误、反向用例），检测冲突，产出用例集。

2. **mu-arch** — 将确认的范围转化为技术架构（组件、接口、数据流、错误处理）。提出 2-3 种方案，分段展示设计供验证。

3. **mu-plan** — 将架构拆分为小型任务（每个 2-5 分钟）。每个任务都有精确的文件路径、完整的代码、验证步骤和 UC-ID 追溯。

4. **mu-code** — 通过子 Agent 驱动开发或内联模式执行计划。强制 TDD 纪律（RED-GREEN-REFACTOR）。派遣 mu-coder 和 mu-reviewer 进行两阶段审查。

5. **mu-review** — 代码质量审查、需求覆盖度检查、反馈处理、验证门禁，然后完成集成（合并/PR/保留/丢弃）。

### 正交技能（自动路由）

- **mu-explore** — 系统化代码理解，产出活文档形式的心智模型。
- **mu-debug** — 系统化根因分析（4 阶段流程，含架构升级路径）。
- **mu-retro** — 定期回顾，收集 git 指标并将发现写入记忆。

### 按需技能（仅通过 `/slash` 直接调用）

- **mu-biz** — 商业分析：验证前提（quick 模式）或完整分析（竞品、BMC、VPC、用户画像、MVP 范围）。使用 `/mu-biz` 调用。
- **mu-prd** — 产品需求：用户流程、线框图、特性规格、分级规则。使用 `/mu-prd` 调用。

这些技能**不会被自动路由**，需要用户显式调用。

### 路由

mu-route 对未加前缀的用户消息进行意图分类并路由到对应技能。基于置信度：明确意图静默路由，模糊意图提案让用户确认。非开发/产品消息不路由。

### 典型路径

- **已有项目加特性**：`mu-scope → mu-arch → mu-plan → mu-code → mu-review`
- **全新产品**：`/mu-biz` → `/mu-prd` → 然后走上述特性循环
- **修 Bug**：`mu-scope (1 UC) → mu-debug → mu-code`

**Sign-off gate**：当 `CODEOWNERS` 文件或多作者 git 历史表明涉及团队协作时，creative skill（mu-biz / mu-prd / mu-arch）会在制品输出时提示获取利益相关者签字。非阻塞 — 用户可随时跳过。

## 架构

```
devmuse/
├── rules/        始终生效的原则（通过 SessionStart hook 加载）
├── skills/       用户触发的工作流（/mu-xxx）
├── agents/       独立角色（被 skill 派遣）
└── knowledge/    领域知识（按需注入）
```

### 技能（12 个）

| 类别 | 技能 | 角色 |
|------|------|------|
| 管线 | **mu-scope** | 用例枚举、冲突检测、代码库影响分析 |
| 管线 | **mu-arch** | 确认范围 → 通过协作对话进行技术架构设计 |
| 管线 | **mu-plan** | 将架构转化为带 UC-ID 追溯的详细实施计划 |
| 管线 | **mu-code** | 按计划实现（子 Agent 或内联模式，含 TDD 和工作区隔离） |
| 管线 | **mu-review** | 审查 + 验证 + 集成（反馈处理、验证门禁、覆盖度检查、合并/PR） |
| 正交 | **mu-explore** | 不熟悉代码的系统化理解 — 产出活文档形式的心智模型 |
| 正交 | **mu-debug** | 系统化根因分析 |
| 正交 | **mu-retro** | 定期回顾，收集 git 指标并写入记忆 |
| 按需 | **mu-biz** | 商业分析 — 前提验证（quick）或完整分析（市场、BMC、画像、MVP 范围） |
| 按需 | **mu-prd** | 产品需求 — 用户流程、线框图、特性规格、分级规则 |
| 路由 | **mu-route** | 置信度路由器 — 明确意图静默调用，模糊意图提案确认；`/mu-<skill>` 斜杠调用可绕过 |
| 元 | **mu-write-skill** | 使用 TDD 方法论创建/编辑技能 |

### 代理（2 个）

| 代理 | 角色 |
|------|------|
| **mu-reviewer** | 六模式审查者：设计文档（review-design）、实施计划（review-plan）、代码质量（review-code）、规格符合性（review-compliance）、需求覆盖（review-coverage）、安全审计（review-security） |
| **mu-coder** | 实现专家：根据任务规格构建功能 |

### 规则（1 个）

| 规则 | 角色 |
|------|------|
| **bootstrap** | 技能发现和调用规则、优先级排序、决策流程 |

### 钩子

| 钩子 | 触发时机 | 角色 |
|------|----------|------|
| **pipeline-gate** | Edit/Write | 在代码变更前强制要求 scope + design 产物存在。豁免插件自身编辑。失败时放行。 |
| **destructive-guard** | Bash | 在执行破坏性命令（rm -rf、git push -f、DROP TABLE、git reset --hard）前发出警告。允许已知安全模式。 |

### 知识

| 类别 | 用途 |
|------|------|
| **languages/** | 语言特定审查标准（Java、Go、Python、TypeScript） |
| **templates/** | 产物模板（scope 用例集模板） |
| **principles/** | 思维模式（10 个文件）：反转思维、前提检查、Chesterton's Fence、git 安全协议、stance 检测、sign-off 门禁、架构评估、graphviz 规范、skill CSO、skill 测试 |
| **reviews/** | 审查清单：安全审计（5 阶段 OWASP）、设计审计量表（架构评分） |

## 理念

- **测试驱动开发** — 始终先写测试
- **系统化优于临时方案** — 流程优于猜测
- **降低复杂性** — 简洁是首要目标
- **证据优于声明** — 在宣告成功前先验证

## 本地开发

无需安装，直接从本地目录加载插件：

```bash
claude --plugin-dir /path/to/devmuse
```

修改代码后无需重启，在会话中刷新：

```
/reload-plugins
```

可选：添加 shell alias 方便日常使用：

```bash
alias claude-dev='claude --plugin-dir /path/to/devmuse'
```

## 更新

更新插件时技能会自动更新：

```bash
/plugin update devmuse
```

## 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 致谢

- 基于 [Superpowers](https://github.com/obra/superpowers)，作者 [Jesse Vincent](https://blog.fsck.com) 和 [Prime Radiant](https://primeradiant.com)
- 灵感来自 [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)
- 安全审查、设计审计、前提验证和 hook 模式受 [gstack](https://github.com/garry/gstack)（[Garry Tan](https://twitter.com/garrytan)）启发
