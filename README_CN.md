# DevMuse

[English](README.md)

DevMuse 是一套专为 Claude Code 设计的完整软件开发工作流，基于规则（rules）、技能（skills）、代理（agents）、知识（knowledge）四层架构构建。

基于 [Superpowers](https://github.com/obra/superpowers)（Jesse Vincent）。

## 工作原理

从分类任务开始，而不是把每个请求都塞进同一套流程。只读代码理解通过相称的源码检查直接回答；精确、可逆的执行型工作直接修改并验证；改变行为的工作才进入快速影响探测。

探测会把已有流程上的明确改动保持为**有界变更**：内联 1–3 个用例，行为变化时做 TDD，最后只做一次综合审查。除非探测发现了真正需要选择的分叉，否则不会让你重复批准原请求。

跨系统、公共契约、安全、迁移或确有未决设计的问题进入**架构变更**路径：确认范围、技术设计、实施计划、TDD 和一次最终独立审查。

如果有界任务在执行中变大，DevMuse 会在触碰高风险表面之前升级路径。证据可以让流程变重，任务字数或触发词本身不可以。

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

DevMuse 是一个软件工程工作流工具。它按风险与未知程度路由开发任务，并提供按需调用的产品/商业分析工具。

### 相称路径（自动路由）

```
直接执行 → 有界变更 → 架构变更

直接执行 → 验证 → 结束
有界变更 → scope → code → 综合审查 → 结束
架构变更 → scope → arch → plan → code → review → 结束
```

1. **直接执行** — 不产出持久制品的只读检查，或精确、机械、可逆的执行型工作。不加载工作流 skill；直接检查或执行、相称验证并报告。

2. **mu-scope** — 探测行为变更并选择有界或架构路径。有界路径产出内联契约；架构路径产出经确认的用例集。

3. **mu-arch** — 将架构范围转化为技术架构（组件、接口、数据流、错误处理），提出 2–3 种方案并只把真实决策交给用户验证。

4. **mu-plan** — 将确认的架构拆分为带文件路径、验证步骤和 UC-ID 追溯的实施任务。

5. **mu-code** — 有界契约以内联模式执行并做一次综合审查；架构计划以内联或子 Agent 模式实现，集成后只做一次最终审查。行为变化强制 RED-GREEN-REFACTOR。

6. **mu-review** — 为架构路径做完整代码质量和需求覆盖审查。单独提出的 review 默认只报告；修复和仓库集成需要相应授权。

### 正交技能（自动路由）

- **mu-debug** — 系统化根因分析（先建红色回路，4 阶段流程，含架构升级路径）。

### 按需技能（仅通过 `/slash` 直接调用）

- **mu-mrd** — 市场需求：该不该做（前提验证，quick 模式）或完整市场分析（竞品、目标市场、收入机会、MVP 范围）。使用 `/mu-mrd` 调用。
- **mu-model** 🧪 — 领域模型：概念、原型分类、模型主轴、谁产生谁维护。在 PRD 与设计之前跑，产出仓库根目录的 `CONTEXT.md`。使用 `/mu-model` 调用。**其 `create` 路径尚未在从零开始的项目上验证过**——见 README 的 Validation status。
- **mu-prd** — 产品需求：用户流程、对象生命周期模型、线框图、特性规格、分级规则。使用 `/mu-prd` 调用。
- **mu-wiki** — 当前架构文档的唯一持久化归属，从源码生成并带引用。使用 `/mu-wiki generate` 或 `/mu-wiki update` 调用。
- **mu-retro** — 定期回顾：git 指标、审查模式分析、发现写入记忆。使用 `/mu-retro` 调用。
- **mu-grill** — 对方案/设计的穷追式访谈，收敛每一个"猜错即返工"的分叉后才开工。使用 `/mu-grill` 调用。

这些技能**不会被自动路由**，需要用户显式调用。

### 路由

路由内置于常驻 bootstrap 规则：先排除非开发/产品消息，再让只读检查和精确的低风险工作进入直接执行；其余开发任务按意图和仓库状态路由。mu-scope 再根据代码库证据选择有界或架构流程。持久架构文档只由显式 `/mu-wiki` 产生，不再作为理解代码的副作用。

### 典型路径

- **精确机械改动**：`直接执行 → 验证 → 结束`
- **已有流程上的有界特性**：`mu-scope（内联契约）→ mu-code（一次综合审查）`
- **架构特性**：`mu-scope → mu-arch → mu-plan → mu-code → mu-review`
- **全新产品**：`/mu-mrd` → `/mu-prd` → 然后走上述特性循环
- **修 Bug**：`mu-scope (1 UC) → mu-debug`（mu-debug 负责调查、实现和验证修复）

**Sign-off gate**：当 `CODEOWNERS` 文件或多作者 git 历史表明涉及团队协作时，creative skill（mu-mrd / mu-prd / mu-arch）会在制品输出时提示获取利益相关者签字。非阻塞 — 用户可随时跳过。

## 架构

```
devmuse/
├── rules/        始终生效的原则（通过 SessionStart hook 加载）
├── skills/       用户触发的工作流（/mu-xxx）
├── agents/       独立角色（被 skill 派遣）
└── knowledge/    领域知识（按需注入）
```

### 技能

| 类别 | 技能 | 角色 |
|------|------|------|
| 管线 | **mu-scope** | 影响探测、有界/架构分类、用例和冲突检测 |
| 管线 | **mu-arch** | 确认范围 → 通过协作对话进行技术架构设计 |
| 管线 | **mu-plan** | 将架构转化为带 UC-ID 追溯的详细实施计划 |
| 管线 | **mu-code** | 按有界契约或计划做相称实现、TDD、自检与一次路径级审查 |
| 管线 | **mu-review** | 只报告的独立审查，或经授权的审查修复与验证 |
| 正交 | **mu-debug** | 系统化根因分析 |
| 按需 | **mu-mrd** | 市场需求 — 该不该做（quick）或完整市场分析（竞品、目标市场、收入机会、MVP 范围） |
| 按需 | **mu-model** 🧪 | 领域模型 — 概念、原型分类、模型主轴、谁产生谁维护；写入 `CONTEXT.md`，在 PRD 与设计之前 |
| 按需 | **mu-prd** | 产品需求 — 用户流程、对象生命周期模型、线框图、特性规格、分级规则 |
| 按需 | **mu-wiki** | 架构 Wiki — 生成和维护项目级架构文档 |
| 按需 | **mu-retro** | 定期回顾，收集 git 指标并写入记忆 |
| 按需 | **mu-grill** | 对方案/设计的穷追式访谈 — 开工前收敛每一个"猜错即返工"的分叉 |
| 元 | **mu-write-skill** | 使用 TDD 方法论创建/编辑技能 |

### 代理

| 代理 | 角色 |
|------|------|
| **mu-reviewer** | 五模式审查者：设计文档（review-design）、实施计划（review-plan）、代码质量（review-code）、需求覆盖（review-coverage）、安全审计（review-security） |
| **mu-coder** | 实现专家：根据任务规格构建功能 |

### 规则

| 规则 | 角色 |
|------|------|
| **bootstrap** | 技能发现和调用规则、优先级排序、决策流程 |

### 钩子

| 钩子 | 触发时机 | 角色 |
|------|----------|------|
| **destructive-guard** | Bash | 在执行破坏性命令（rm -rf、git push -f、DROP TABLE、git reset --hard）前发出警告。允许已知安全模式。 |

### 知识

| 类别 | 用途 |
|------|------|
| **languages/** | 语言特定审查标准（Java、Go、Python、TypeScript） |
| **templates/** | 产物模板（scope 用例集模板） |
| **principles/** | 决策点加载的思维模式 — 反转思维、前提检查、stance 检测、sign-off 门禁、grilling 访谈、领域词汇表、skill 质量等（当前完整清单见目录） |
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
