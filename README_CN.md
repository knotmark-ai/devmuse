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

## 三层管线

DevMuse 将技能组织为三层：

**产品层**（每个产品一次；已有项目可选）：
- **mu-biz** — 商业分析：验证前提（quick 模式，4 个质询问题）或完整分析（竞品、BMC、VPC、用户画像、MVP 范围、成本模型）。入口自动跑 Phase 0 stance 检测（create / update / extract / skip）。
- **mu-prd** — 产品需求：用户画像、用户流程、线框图、特性规格、分级规则、NFR、指标。入口自动跑 Phase 0 stance 检测。

**特性层**（每个特性一次）：

```
scope → arch → plan → code → review
```

1. **mu-scope** — 在架构之前激活。扫描代码库评估影响（Quick Probe），枚举用例（正常路径、边界情况、错误情况），检测用例之间的冲突，产出用例集。深度根据复杂度自适应——修 bug 只需 1 个用例，新功能需要完整枚举。

2. **mu-arch** — 在范围确认后激活。入口自动跑 Phase 0 stance 检测（create / update / extract / skip），然后专注于技术架构（组件、接口、数据流、错误处理）。提出 2-3 种方案并附架构图，分段展示设计供验证。派遣 mu-reviewer（review-design）审查设计文档。**产品需求用 mu-prd；商业策略用 mu-biz。**

3. **mu-plan** — 在架构获批后激活。将工作拆分为小型任务（每个 2-5 分钟）。每个任务都有精确的文件路径、完整的代码、验证步骤和 UC-ID 追溯。

4. **mu-code** — 有计划后激活。创建隔离工作区，然后通过子 Agent 驱动开发（推荐）或内联模式执行任务。强制 TDD 纪律（RED-GREEN-REFACTOR）。测试标注 UC-ID 实现追溯。派遣 mu-coder 实现、mu-reviewer 进行两阶段审查（review-compliance 规格符合性，再 review-code 代码质量）。

5. **mu-review** — 实现完成后激活。派遣 mu-reviewer 进行代码质量审查和需求覆盖度检查（review-coverage），以技术严谨性处理反馈，用新鲜证据验证，然后完成集成（合并/PR/保留/丢弃）。

**正交层**（独立于管线，按需触发）：

- **mu-explore** — 系统化代码理解，适用于不熟悉的代码（onboarding、接手项目、依赖评估、改动前、debug 前）。在 `docs/explore/` 下产出活文档形式的心智模型。
- **mu-debug** — 系统化根因分析（4 阶段流程，含架构升级路径）。
- **mu-retro** — 定期回顾，收集 git 指标并将发现写入记忆。

### 典型管线路径

- **全新产品**：`mu-biz full → mu-prd → [mu-scope → mu-arch → mu-plan → mu-code → mu-review]`（逐特性循环）
- **已有项目加特性**：`mu-scope → mu-arch → mu-plan → mu-code → mu-review`
- **快速原型**：`mu-biz quick → mu-scope → mu-arch → mu-plan → mu-code → mu-review`

**Agent 在执行任何任务前都会检查相关技能。** 这是强制工作流，不是建议。

## 架构

```
devmuse/
├── rules/        始终生效的原则（通过 SessionStart hook 加载）
├── skills/       用户触发的工作流（/mu-xxx）
├── agents/       独立角色（被 skill 派遣）
└── knowledge/    领域知识（按需注入）
```

### 技能（11 个）

| 层级 | 技能 | 角色 |
|------|------|------|
| 产品层 | **mu-biz** | 商业分析 — 前提验证（quick）或完整分析（市场、BMC、画像、MVP 范围） |
| 产品层 | **mu-prd** | 产品需求 — 用户流程、线框图、特性规格、分级规则 |
| 特性层 | **mu-scope** | 用例枚举、冲突检测、代码库影响分析 |
| 特性层 | **mu-arch** | 确认范围 → 通过协作对话进行技术架构设计 |
| 特性层 | **mu-plan** | 将架构转化为带 UC-ID 追溯的详细实施计划 |
| 特性层 | **mu-code** | 按计划实现（子 Agent 或内联模式，含 TDD 和工作区隔离） |
| 特性层 | **mu-review** | 审查 + 验证 + 集成（反馈处理、验证门禁、覆盖度检查、合并/PR） |
| 正交层 | **mu-explore** | 不熟悉代码的系统化理解 — 产出活文档形式的心智模型 |
| 正交层 | **mu-debug** | 系统化根因分析 |
| 正交层 | **mu-retro** | 定期回顾，收集 git 指标并写入记忆 |
| 元层 | **mu-write-skill** | 使用 TDD 方法论创建/编辑技能 |

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
| **principles/** | 思维模式：反转思维（失败模式分析）、前提检查（质询问题） |
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
