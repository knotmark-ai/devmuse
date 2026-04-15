# 架构

## 四层架构

```
devmuse/
├── rules/        "必须遵守什么" — 始终生效的原则
├── skills/       "做什么" — 用户触发的工作流（/mu-xxx）
├── agents/       "谁来做" — 独立角色，被 skill 派遣
└── knowledge/    "怎么做/参考什么" — 按需注入的领域知识
```

## 分层判断标准

| 问题 | 答案 | 层 |
|------|------|--------|
| 每个会话都要生效，不需要用户触发？ | 是 | rules/ |
| 用户主动 `/xxx` 启动？ | 是 | skills/ |
| 独立角色，需要上下文隔离执行？ | 是 | agents/ |
| 参考资料，被 agent/skill 按需读取？ | 是 | knowledge/ |

### knowledge/ — 细化判断

| 情况 | 放哪里 | 理由 |
|------|--------|------|
| 只被一个 skill 用 | 留在 skill 目录内 | 局部性优先 |
| 被多个 agent 跨场景注入 | knowledge/ | 跨角色复用 |
| 语言/框架特定模式 | knowledge/ | 同一 agent 不同技术栈 |

---

## 加载机制

四层全部通过插件安装（`claude plugin add`）生效，无需手动配置。

| 目录 | 插件自动发现 | 机制 |
|-----------|-------------|------|
| skills/ | ✅ | plugin.json 声明，Claude Code 自动发现 SKILL.md |
| agents/ | ✅ | plugin.json 显式列出每个 agent 文件 |
| hooks/hooks.json | ✅ | 约定自动加载（不需要在 plugin.json 声明） |
| knowledge/ | ❌ | 不自动发现，被 skill/agent 通过 `@` 相对路径引用 |
| rules/ | ❌ | 插件不原生支持，通过 SessionStart hook 加载 |

### rules 加载机制

```
hooks/
├── hooks.json       # 声明 SessionStart hook
└── session-start    # 脚本：读取 rules/ → JSON 输出 → 注入会话上下文
```

`session-start` 脚本读取 `rules/bootstrap.md`，通过 `hookSpecificOutput.additionalContext` 注入到每个会话。

### knowledge 引用机制

skill 和 agent 通过 `@` 相对路径引用插件内的 knowledge 文件：

```markdown
# 在 skill 的 SKILL.md 中：
@../../knowledge/languages/java.md
```

`@` 相对路径在插件内部跨目录有效（安装时整个插件被复制到缓存）。

---

## 内容清单

### rules/（1 个文件）

| 名称 | 角色 |
|------|------|
| bootstrap.md | 全局决策引导：skill 使用规则、优先级排序、决策流程 |

**原则：** rules 通过 hook 注入消耗 token。只放无条件始终生效的内容，能通过 skill 按需加载的留在 skill 中。

### skills/（10 个）

分为三层：

**产品层**（每个产品一次）：

| 名称 | 角色 | 派遣 Agent |
|------|------|------|
| mu-biz | 商业分析 — 前提验证（quick）或完整分析（市场、BMC、画像、MVP 范围） | — |
| mu-prd | 产品需求 — 用户流程、线框图、特性规格、分级规则 | — |

**特性层** — 核心管线 `scope → arch → plan → code → review`：

| 名称 | 角色 | 派遣 Agent |
|------|------|------|
| mu-scope | 用例枚举 + 冲突检测 + 影响分析 | — |
| mu-arch | 将确认的范围通过协作对话转化为技术架构设计 | mu-reviewer（review-design） |
| mu-plan | 将架构转化为详细实施计划 | — |
| mu-code | 按计划实现（子 Agent 或内联模式，含 TDD 和工作区隔离） | mu-coder, mu-reviewer（review-code + review-compliance） |
| mu-review | 审查 + 验证 + 集成 | mu-reviewer（review-code + review-coverage + review-security） |

**正交层**（管线外）：

| 名称 | 角色 | 派遣 Agent |
|------|------|------|
| mu-debug | 系统化根因分析 | — |
| mu-retro | 定期回顾，收集 git 指标并写入记忆 | — |

**元技能：**

| 名称 | 角色 | 派遣 Agent |
|------|------|------|
| mu-write-skill | 使用 TDD 方法论创建/编辑技能 | — |

### agents/（2 个）

| 名称 | 角色 | 被谁派遣 |
|------|------|---------|
| mu-reviewer | 六模式审查者：设计文档（review-design）、实施计划（review-plan）、代码质量（review-code）、规格符合性（review-compliance）、需求覆盖（review-coverage）、安全审计（review-security） | mu-scope, mu-arch, mu-plan, mu-code, mu-review |
| mu-coder | 实现者 | mu-code |

**设计决策：** 2 个通用 agent + knowledge 注入，而非 N 个语言专用 agent。审查逻辑 80% 通用，改一处全局生效。扩展新语言只需加 knowledge 文件。

### knowledge/（4 个语言文件 + 模板）

当 mu-reviewer 需要语言/框架特定审查标准时按需创建。

```
knowledge/
├── languages/        # java.md, go.md, python.md, typescript.md
├── templates/        # scope.md（mu-scope 使用的用例集模板）
├── principles/       # 思维原则（inversion, premise-check, chestertons-fence,
│                     #   architecture-assessment, skill-cso, graphviz-conventions,
│                     #   skill-testing）
└── reviews/          # 审查清单（security-checklist, design-audit-rubric）
```

> **未来扩展：** 需要框架特定审查标准时可新增 `knowledge/frameworks/`（如 spring-boot.md、react.md、flutter.md）。目前未创建。

---

## 层间关系

### 调用方向矩阵

| 调用方 → 被调用方 | rules | skills | agents | knowledge |
|-------------------|-------|--------|--------|-----------|
| **rules** | — | 引导触发 | ✗ | @引用 |
| **skills** | 受约束 | 链式调用 | 派遣 | @引用 |
| **agents** | 受约束 | **✗ 禁止** | 可嵌套派遣 | @引用 |
| **knowledge** | — | — | — | — |

### 关键约束

- **skills → agents：单向派遣。** skill 是编排者，agent 是执行者。
- **agents → skills：禁止。** agent 不反向触发用户级工作流。
- **skills → skills：允许链式调用。** 如 mu-biz → mu-prd → mu-scope → mu-arch → mu-plan → mu-code → mu-review。
- **rules 引导但不调用。** bootstrap.md 告诉 Claude 遇到什么情况触发哪个 skill。
- **knowledge 纯被动。** 只被引用，不调用任何层。

### 依赖方向

**依赖严格向下，不允许向上回调。**

```
rules ──约束──→ 所有层
  │
  └──引导──→ skills ──派遣──→ agents
               │                 │
               │                 └──@──→ knowledge
               └──@──→ knowledge
```

---

## plugin.json

```json
{
  "version": "0.2.0",
  "agents": [
    "./agents/mu-reviewer.md",
    "./agents/mu-coder.md"
  ],
  "skills": ["./skills/"]
}
```

`hooks/hooks.json` 由 Claude Code v2.1+ 约定自动加载，不需要在 plugin.json 中声明。
