# 四层架构设计

## 状态：草案

## 问题

当前 craft-claude 所有内容都放在 `skills/` 下，但实际混合了四种不同性质的东西：

- 始终生效的纪律约束（如 TDD 铁律、验证规则）
- 用户触发的工作流编排（如 brainstorm、plan）
- 独立角色的执行者（如 reviewer、implementer）
- 原子化的参考知识（如 root-cause-tracing、condition-based-waiting）

导致的问题：

1. 纪律类内容需要用户手动 `/craft-tdd` 才能加载，但它应该始终生效
2. agent prompt 藏在 skill 子目录里，身份和职责不明确，跨 skill 复用靠路径硬引用
3. 方法论参考和工作流指令耦合在同一个 SKILL.md 中
4. skill 同时承担入口、编排、知识三种角色，职责过重

## 四层架构

```
craft-claude/
├── rules/           # "必须遵守什么" — 始终生效的原则
├── skills/          # "做什么" — 用户 /xxx 触发的工作流
├── agents/          # "谁来做" — 独立角色，被 skill 派遣
└── knowledge/       # "怎么做/参考什么" — 可注入的领域知识
```

### 判断标准

| 问题 | 答案 | 放哪层 |
|------|------|--------|
| 每个会话都要生效，不需要用户触发？ | 是 | rules/ |
| 用户会主动 `/xxx` 启动？ | 是 | skills/ |
| 它是一个"角色"，需要上下文隔离执行？ | 是 | agents/ |
| 它是参考资料，被 agent/skill 按需读取？ | 是 | knowledge/ |

### knowledge 的细化判断

不是所有参考资料都放 knowledge/：

| 情况 | 放哪里 | 理由 |
|------|--------|------|
| 只被一个 skill 用的参考 | 留在 skill 目录内 | 局部性优先 |
| 被多个 agent 在不同场景注入 | knowledge/ | 需要跨角色复用 |
| 语言/框架特定的模式和规范 | knowledge/ | 同一 agent 不同技术栈 |

---

## 加载机制

这是四层架构能否通过插件（`claude plugin add`）自动生效的关键。

### 插件原生支持

| 目录/文件 | 插件自动发现 | 机制 |
|-----------|-------------|------|
| skills/ | ✅ | plugin.json 声明，Claude Code 自动发现 SKILL.md |
| agents/ | ✅ | plugin.json 显式列出每个 agent 文件 |
| hooks/hooks.json | ✅ | 约定自动加载（不需要在 plugin.json 声明） |
| knowledge/ | ❌ | 不自动发现，被 skill/agent 通过 `@` 相对路径引用 |
| rules/ | ❌ | 插件不支持自动加载 rules |

### 各层加载方案

```
┌─────────┐  SessionStart hook 注入    ┌──────────────────────────┐
│ rules/  │ ──────────────────────────→ │ 每个会话上下文（始终生效） │
└─────────┘                             └──────────────────────────┘

┌─────────┐  plugin.json 声明           ┌──────────────────────────┐
│ skills/ │ ──────────────────────────→ │ /craft-xxx 命令注册       │
└─────────┘                             └──────────────────────────┘

┌─────────┐  plugin.json 声明           ┌──────────────────────────┐
│ agents/ │ ──────────────────────────→ │ 可被 Agent tool 派遣      │
└─────────┘                             └──────────────────────────┘

┌───────────┐  @ 相对路径引用            ┌──────────────────────────┐
│knowledge/ │ ──────────────────────────→ │ 按需加载到 skill/agent   │
└───────────┘                            └──────────────────────────┘
```

### rules 加载机制详解

rules 不被插件原生支持，但通过**已有的 SessionStart hook 机制**解决：

**现有机制：**
```
hooks/
├── hooks.json       # 声明 SessionStart hook
└── session-start    # 脚本：读取内容 → JSON 输出 → 注入会话上下文
```

当前 `session-start` 脚本读取 `hooks/bootstrap.md` 并通过 `hookSpecificOutput.additionalContext` 注入到会话。`bootstrap.md` 本质就是第一条 rule。

**扩展方案：** 将 `session-start` 脚本改为读取 `rules/` 目录下所有 `.md` 文件，拼接后注入：

```bash
# hooks/session-start（改造后）
for rule_file in "${PLUGIN_ROOT}/rules/"*.md; do
    rules_content+="$(cat "$rule_file")\n\n"
done
# 拼接后通过 hookSpecificOutput 注入上下文
```

`bootstrap.md` 从 `hooks/` 迁移到 `rules/bootstrap.md`，成为 rules 之一。

### knowledge 引用机制

knowledge 不自动加载，由 skill/agent 按需通过 `@` 相对路径引用：

```markdown
# skills/craft-debug/SKILL.md 中
根因追踪方法论见 @../../knowledge/root-cause-tracing.md
```

```markdown
# skills/craft-review/SKILL.md 中（派遣 agent 时注入）
检查项目技术栈，读取对应的 knowledge 文件：
@../../knowledge/languages/java.md
```

`@` 相对路径在插件内部跨目录引用有效（安装后插件整体复制到缓存）。

### agents 引用机制

agents 通过 plugin.json 声明后，skill 在 SKILL.md 中引用 agent prompt：

```markdown
# skills/craft-review/SKILL.md 中
派遣审查者，prompt 见 @../../agents/craft-reviewer.md
```

---

## 各层内容清单

### rules/

| 名称 | 角色 | 引用 | 被谁引用 | 内容来源 |
|------|------|------|---------|---------|
| bootstrap.md | 全局决策引导：定义 skill 使用规则、优先级、决策流程 | — | 所有会话（SessionStart hook 自动注入） | ← hooks/bootstrap.md 迁移，内容不变 |

**原则：** rules 通过 hook 注入消耗 token，只放"无条件始终生效"的内容。TDD、verify 等纪律在特定工作流中才需要，留在对应 skill 内按需加载。

---

### skills/

核心管线：

| 名称 | 角色 | 引用 | 被谁引用 | 内容来源 |
|------|------|------|---------|---------|
| craft-design | 想法→设计方案：多轮对话细化需求，输出设计文档 | agent: craft-reviewer（设计文档审查模式）; 就近: visual-companion.md, scripts/ | bootstrap.md 引导触发；链式调用 craft-plan | ← craft-brainstorm 重命名，内容基本不变 |
| craft-plan | 设计→实施计划：将设计拆分为可执行的任务列表 | — | craft-design 链式调用；用户直接触发 | ← craft-plan 不变 |
| craft-code | 计划→实现：按计划执行所有任务，支持子 agent 并发或当前会话顺序两种模式 | agent: craft-coder, craft-reviewer（符合性审查+代码审查模式）; 就近: TDD 方法论（原 craft-tdd 内容）, worktree 操作（原 craft-worktree 内容） | craft-plan 链式调用；用户直接触发 | ← 合并 craft-sdd + craft-execute + craft-tdd + craft-worktree + craft-parallel；TDD 方法论和 worktree 操作作为 craft-code 的内部阶段 |
| craft-review | 代码审查+验证+合并：审查变更、验证通过、选择集成方式 | agent: craft-reviewer（最终审查模式） | craft-code 链式调用；用户直接触发（也可独立审查非管线代码） | ← 合并 craft-review + craft-review-response + craft-verify + craft-finish |

独立流程：

| 名称 | 角色 | 引用 | 被谁引用 | 内容来源 |
|------|------|------|---------|---------|
| craft-debug | 系统化调试：根因调查→假设→验证→修复 | 就近: root-cause-tracing.md, defense-in-depth.md, condition-based-waiting.md, find-polluter.sh | bootstrap.md 引导触发；用户直接触发 | ← craft-debug 不变 |

元技能：

| 名称 | 角色 | 引用 | 被谁引用 | 内容来源 |
|------|------|------|---------|---------|
| craft-write-skill | 创建/编辑技能：TDD 方法论应用于流程文档 | 就近: testing-skills-with-subagents.md, anthropic-best-practices.md, persuasion-principles.md, graphviz-conventions.dot, render-graphs.js | 用户直接触发 | ← craft-write-skill 不变 |

**被合并/吸收的原 skill：**

| 原 Skill | 去向 | 说明 |
|----------|------|------|
| craft-brainstorm | → craft-design | 重命名 |
| craft-sdd | → craft-code | 子 agent 并发模式 |
| craft-execute | → craft-code | 当前会话顺序模式 |
| craft-tdd | → craft-code 内部 | 编码时遵循的方法论，作为 craft-code 的 TDD 阶段 |
| craft-worktree | → craft-code 内部 | 开始实现前自动创建隔离工作区 |
| craft-parallel | → craft-code 内部 | 子 agent 并发调度策略 |
| craft-review-response | → craft-review | 接收反馈是审查流程的一部分 |
| craft-verify | → craft-review | 验证是审查流程的收尾阶段 |
| craft-finish | → craft-review | 合并/PR 是审查通过后的操作 |

---

### agents/

| 名称 | 角色 | 引用 | 被谁引用 | 内容来源 |
|------|------|------|---------|---------|
| craft-reviewer | 审查者：根据 skill 派遣指令切换模式——设计文档审查、代码质量审查、规格符合性审查。输出分级问题和判定。 | knowledge: languages/*.md, frameworks/*.md（按项目技术栈注入） | craft-design（设计文档审查）; craft-code（逐任务符合性+代码审查）; craft-review（最终审查） | ← 合并 craft-reviewer.md + code-quality-reviewer-prompt.md + spec-document-reviewer-prompt.md + spec-reviewer-prompt.md |
| craft-coder | 实现者：根据任务规格实现功能，遵循 TDD，自审后报告状态 | — | craft-code（派遣执行每个任务） | ← 改写自 skills/craft-sdd/implementer-prompt.md |

**设计决策：** 2 个通用 agent + knowledge 注入，而非 ECC 的 N 个语言专用 agent。审查能力统一在一个 agent 中，由 skill 的派遣指令区分审查对象和标准。

---

### knowledge/

**当前为空（YAGNI）。** 现有参考文件均只被一个 skill 使用，保留就近。

**未来按需创建：**

| 名称 | 角色 | 引用 | 被谁引用 | 内容来源 |
|------|------|------|---------|---------|
| languages/java.md | Java 惯用模式、常见坑、审查要点 | — | craft-reviewer（按项目技术栈注入） | 待编写 |
| languages/go.md | Go 惯用模式 | — | craft-reviewer | 待编写 |
| languages/python.md | Python 惯用模式 | — | craft-reviewer | 待编写 |
| languages/typescript.md | TypeScript 惯用模式 | — | craft-reviewer | 待编写 |
| frameworks/spring-boot.md | Spring Boot 模式和最佳实践 | — | craft-reviewer | 待编写 |
| frameworks/react.md | React 模式 | — | craft-reviewer | 待编写 |
| frameworks/flutter.md | Flutter/Dart 模式 | — | craft-reviewer | 待编写 |

**触发创建条件：** 当 craft-reviewer 在审查特定语言/框架代码时反复遗漏语言特有的问题。

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
- **agents → skills：禁止。** agent 是被派遣的工人，不应反向触发用户级工作流。如果 agent 需要更多能力，由派遣它的 skill 来编排。
- **skills → skills：允许链式调用。** 如 craft-design 结束后调用 craft-plan，craft-code 结束后调用 craft-review。
- **agents → agents：允许嵌套，需谨慎。** 上下文层级太深会失控。
- **rules 引导但不调用。** rules 告诉 Claude"遇到什么情况触发哪个 skill"（bootstrap.md 的角色），但不直接调用任何层。
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

## 目录结构（目标状态）

```
craft-claude/
├── .claude-plugin/
│   └── plugin.json
│
├── rules/
│   └── bootstrap.md                   # ← hooks/bootstrap.md 迁移
│
├── skills/
│   ├── craft-design/                  # ← craft-brainstorm 重命名
│   │   ├── SKILL.md
│   │   ├── visual-companion.md
│   │   └── scripts/
│   ├── craft-plan/
│   │   └── SKILL.md
│   ├── craft-code/                    # ← 合并 sdd + execute + tdd + worktree + parallel
│   │   ├── SKILL.md
│   │   └── testing-anti-patterns.md
│   ├── craft-review/                  # ← 合并 review + review-response + verify + finish
│   │   └── SKILL.md
│   ├── craft-debug/
│   │   ├── SKILL.md
│   │   ├── root-cause-tracing.md
│   │   ├── defense-in-depth.md
│   │   ├── condition-based-waiting.md
│   │   └── find-polluter.sh
│   └── craft-write-skill/
│       ├── SKILL.md
│       ├── testing-skills-with-subagents.md
│       ├── anthropic-best-practices.md
│       ├── persuasion-principles.md
│       ├── graphviz-conventions.dot
│       └── render-graphs.js
│
├── agents/
│   ├── craft-reviewer.md
│   └── craft-coder.md
│
├── knowledge/
│   └── (暂空，按需添加 languages/ 和 frameworks/)
│
├── hooks/
│   ├── hooks.json
│   └── session-start                  # 改为读取 rules/bootstrap.md
│
└── docs/
```

---

## plugin.json（目标状态）

```json
{
  "version": "1.0.0",
  "agents": [
    "./agents/craft-reviewer.md",
    "./agents/craft-coder.md"
  ],
  "skills": ["./skills/"]
}
```

hooks/hooks.json 不需要声明（Claude Code v2.1+ 约定自动加载）。

---

## 各层具体文件设计

### rules/ — 具体文件

**只有一个文件：** `rules/bootstrap.md`，从 `hooks/bootstrap.md` 迁移，内容不变。

定义 skill 使用规则、优先级、决策流程图。TDD 和 verify 的纪律保留在各自 skill 中（按需加载，非始终生效）。

---

### agents/ — 具体文件

#### agents/craft-reviewer.md（合并全部审查角色）

```markdown
---
name: craft-reviewer
description: Review specialist for design docs, code quality, and spec compliance
tools: ["Read", "Grep", "Glob", "Bash"]
model: sonnet
---

# 审查者

你负责审查设计文档、代码变更和规格符合性。根据派遣指令选择审查模式。

## 模式 A：设计文档审查

审查设计文档是否完整、一致、可用于实施规划。

**检查项：** 完整性（TODO/TBD）、一致性（内部矛盾）、清晰度（可能导致实现偏差的模糊需求）、范围（能否用一个计划覆盖）、YAGNI（未被要求的功能）。

**校准：** 只标记影响实施规划的缺陷。措辞改进不算问题。

**输出：** 状态（Approved / Issues Found）+ 问题列表 + 建议

## 模式 B：代码审查

审查代码变更的生产就绪性。

**流程：** 获取变更（git diff）→ 读完整文件理解上下文 → 按清单检查 → 分级报告

**审查清单：**
- 安全（CRITICAL）：硬编码凭证、注入、XSS、路径遍历
- 代码质量（HIGH）：关注点分离、错误处理、类型安全、职责清晰
- 测试（HIGH）：测试真实逻辑、边界覆盖、全部通过
- 需求符合（HIGH）：需求全部实现、匹配规格、无范围蔓延

**输出：** 优点 + 问题（Critical/Important/Minor，含文件:行号）+ 判定（Yes/No/With fixes）

## 模式 C：规格符合性审查

审查实现是否匹配规格（不多不少）。

**关键原则：不信任实现者的报告。** 独立阅读代码验证。

**检查项：** 缺失需求、多余工作、理解偏差。

**输出：** ✅ 符合规格 / ❌ 问题列表（附文件:行号）

## 通用原则

- 按实际严重程度分类
- 具体到文件和行号
- 只报告 >80% 确信的问题
- 合并同类问题
- 未变更的代码不评论（除非 CRITICAL 安全问题）
```

#### agents/craft-coder.md（改写自 implementer-prompt.md）

```markdown
---
name: craft-coder
description: Implementation specialist that builds features from task specifications
tools: ["Read", "Edit", "Write", "Bash", "Grep", "Glob"]
model: sonnet
---

# 实现者

你负责根据任务规格实现功能。

## 工作流程

1. 阅读任务描述，有疑问立即提问
2. 按规格实现（遵循 TDD 如果任务要求）
3. 验证实现可工作
4. 自审代码
5. 提交并报告

## 代码组织

- 遵循计划中定义的文件结构
- 每个文件一个清晰职责
- 文件超出计划预期时，停下报告 DONE_WITH_CONCERNS
- 在现有代码库中，遵循已有模式

## 何时求助

以下情况立即停止并上报：

- 任务需要多种有效方案的架构决策
- 需要理解超出提供范围的代码
- 对方法的正确性不确定
- 需要计划未预期的重构

报告状态 BLOCKED 或 NEEDS_CONTEXT。

## 完成前自审

- **完整性：** 规格中所有内容都实现了？
- **质量：** 命名清晰？代码可维护？
- **纪律：** 避免过度构建（YAGNI）？只做被要求的？
- **测试：** 测试验证行为（不是 mock 行为）？

## 报告格式

- **状态：** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- 实现了什么 + 测试结果 + 变更文件 + 问题或顾虑
```

---


---

## 待设计的细节

1. **session-start 脚本改造** — 当前硬编码读取 `hooks/bootstrap.md`，需改为读取 `rules/bootstrap.md`。
2. **craft-code SKILL.md 编写** — 合并 sdd + execute + tdd + worktree + parallel 的内容，设计两种执行模式（子 agent 并发 / 当前会话顺序）的选择逻辑。
3. **craft-review SKILL.md 编写** — 合并 review + review-response + verify + finish 的内容，设计完整的审查→验证→合并流程。
4. **craft-design SKILL.md** — 基本等于 craft-brainstorm 重命名，更新 agent 引用路径。
5. **迁移策略** — 建议渐进式：先创建 agents/ 和 rules/ 目录 → 再编写新的 craft-code 和 craft-review → 最后删除旧 skill 目录。
