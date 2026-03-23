# Architecture / 架构

## Four-Layer Architecture / 四层架构

```
craft-claude/
├── rules/        "What must be followed" — always-on principles
│                 "必须遵守什么" — 始终生效的原则
├── skills/       "What to do" — user-triggered workflows (/craft-xxx)
│                 "做什么" — 用户触发的工作流
├── agents/       "Who does it" — independent roles dispatched by skills
│                 "谁来做" — 独立角色，被 skill 派遣
└── knowledge/    "How to do it" — domain knowledge injected on demand
                  "怎么做/参考什么" — 按需注入的领域知识
```

## Layer Classification / 分层判断标准

| Question / 问题 | Answer / 答案 | Layer / 层 |
|------|------|--------|
| Always active, no user trigger needed? / 每个会话都要生效？ | Yes | rules/ |
| User invokes with `/xxx`? / 用户主动触发？ | Yes | skills/ |
| Independent role, needs context isolation? / 独立角色，需要上下文隔离？ | Yes | agents/ |
| Reference material, loaded on demand? / 参考资料，按需读取？ | Yes | knowledge/ |

### knowledge/ — refined criteria / 细化判断

| Case / 情况 | Location / 放哪里 | Reason / 理由 |
|------|--------|------|
| Used by only one skill / 只被一个 skill 用 | Stay in skill directory / 留在 skill 目录内 | Locality first / 局部性优先 |
| Injected into agents across scenarios / 被多个 agent 跨场景注入 | knowledge/ | Cross-role reuse / 跨角色复用 |
| Language/framework specific patterns / 语言/框架特定模式 | knowledge/ | Same agent, different tech stacks / 同一 agent 不同技术栈 |

---

## Loading Mechanism / 加载机制

All four layers work through plugin installation (`claude plugin add`), no manual setup required.

四层全部通过插件安装生效，无需手动配置。

| Directory / 目录 | Plugin auto-discovery / 插件自动发现 | Mechanism / 机制 |
|-----------|-------------|------|
| skills/ | ✅ | plugin.json declares, Claude Code discovers SKILL.md |
| agents/ | ✅ | plugin.json lists each agent file explicitly |
| hooks/hooks.json | ✅ | Convention-based auto-load (not declared in plugin.json) |
| knowledge/ | ❌ | Not auto-discovered; referenced via `@` relative paths |
| rules/ | ❌ | Not natively supported; loaded via SessionStart hook |

### rules/ loading / rules 加载机制

```
hooks/
├── hooks.json       # Declares SessionStart hook / 声明 SessionStart hook
└── session-start    # Script: reads rules/ → JSON output → injects into session context
                     # 脚本：读取 rules/ → JSON 输出 → 注入会话上下文
```

The `session-start` script reads `rules/bootstrap.md` and injects it via `hookSpecificOutput.additionalContext` into every session.

### knowledge/ referencing / knowledge 引用机制

Skills and agents reference knowledge via `@` relative paths within the plugin:

```markdown
# In a skill SKILL.md:
@../../knowledge/languages/java.md
```

`@` relative paths work across directories within the plugin (the entire plugin is copied to cache on install).

---

## Content / 内容清单

### rules/ (1 file)

| Name / 名称 | Role / 角色 |
|------|------|
| bootstrap.md | Global decision guide: skill usage rules, priority ordering, decision flow / 全局决策引导：skill 使用规则、优先级、决策流程 |

**Principle / 原则:** Rules consume tokens via hook injection. Only put content that must be unconditionally always-on. Anything that can be loaded on-demand via skills should stay in skills.

### skills/ (6)

Core pipeline / 核心管线: `design → plan → code → review`

| Name / 名称 | Role / 角色 | Dispatches / 派遣 Agent |
|------|------|------|
| craft-design | Ideas → design spec via collaborative dialogue / 想法→设计方案 | craft-reviewer (Mode A) |
| craft-plan | Design → implementation plan / 设计→实施计划 | — |
| craft-code | Plan → implementation (subagent or inline, TDD, worktree) / 计划→实现 | craft-coder, craft-reviewer (Mode B+C) |
| craft-review | Review + verify + integrate / 审查+验证+集成 | craft-reviewer (Mode B) |

Independent / 独立流程:

| Name / 名称 | Role / 角色 | Dispatches / 派遣 Agent |
|------|------|------|
| craft-debug | Systematic root cause analysis / 系统化根因分析 | — |

Meta / 元技能:

| Name / 名称 | Role / 角色 | Dispatches / 派遣 Agent |
|------|------|------|
| craft-write-skill | Create/edit skills using TDD methodology / 使用 TDD 方法论创建技能 | — |

### agents/ (2)

| Name / 名称 | Role / 角色 | Dispatched by / 被谁派遣 |
|------|------|---------|
| craft-reviewer | Three-mode reviewer: design doc (A), code quality (B), spec compliance (C) / 三模式审查者 | craft-design, craft-code, craft-review |
| craft-coder | Implementation specialist / 实现者 | craft-code |

**Design decision / 设计决策:** 2 generic agents + knowledge injection, not N language-specific agents (like ECC). Review logic is 80% universal; change once, effective globally. Adding a new language only requires a knowledge file.

### knowledge/ (empty, reserved)

Created on demand when craft-reviewer needs language/framework-specific review criteria.

当 craft-reviewer 需要语言/框架特定审查标准时按需创建。

```
knowledge/
├── languages/        # java.md, go.md, python.md, typescript.md
└── frameworks/       # spring-boot.md, react.md, flutter.md
```

---

## Inter-Layer Relations / 层间关系

### Call Direction Matrix / 调用方向矩阵

| Caller → Callee | rules | skills | agents | knowledge |
|-------------------|-------|--------|--------|-----------|
| **rules** | — | guides invocation / 引导触发 | ✗ | @ref |
| **skills** | constrained / 受约束 | chain calls / 链式调用 | dispatch / 派遣 | @ref |
| **agents** | constrained / 受约束 | **✗ forbidden / 禁止** | nested dispatch / 可嵌套 | @ref |
| **knowledge** | — | — | — | — |

### Key Constraints / 关键约束

- **skills → agents: one-way dispatch.** Skills orchestrate, agents execute. / skill 是编排者，agent 是执行者。
- **agents → skills: forbidden.** Agents don't trigger user-level workflows. / agent 不反向触发用户级工作流。
- **skills → skills: chain calls allowed.** e.g. craft-design → craft-plan → craft-code → craft-review. / 链式调用。
- **rules guide but don't call.** bootstrap.md tells Claude when to invoke which skill. / rules 引导但不直接调用。
- **knowledge is passive.** Only referenced, never calls anything. / 只被引用，不调用任何层。

### Dependency Direction / 依赖方向

**Strictly downward, no upward callbacks. / 依赖严格向下，不允许向上回调。**

```
rules ──constrain──→ all layers
  │
  └──guide──→ skills ──dispatch──→ agents
               │                     │
               │                     └──@──→ knowledge
               └──@──→ knowledge
```

---

## plugin.json

```json
{
  "version": "0.2.0",
  "agents": [
    "./agents/craft-reviewer.md",
    "./agents/craft-coder.md"
  ],
  "skills": ["./skills/"]
}
```

`hooks/hooks.json` is auto-loaded by convention (Claude Code v2.1+), not declared in plugin.json.
