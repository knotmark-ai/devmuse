# 架构

## 四层架构

```
devmuse/
├── plugin/           Claude/OpenClaw/Gemini 权威运行时
│   ├── rules/            "必须遵守什么" — 始终生效的原则
│   ├── skills/           "做什么" — 权威工作流（/mu-xxx）
│   ├── agents/           "谁来做" — 独立角色，被 skill 派遣
│   └── knowledge/        "怎么做/参考什么" — 按需注入的领域知识
├── adapters/codex/   生成的 Codex + 可移植 Agent Skills bundle
├── plugin.yaml       Hermes manifest
└── __init__.py       Hermes 命名空间技能注册
```

下文的分层路径均相对于 `plugin/`。`plugin/skills/` 是工作流唯一源文件。
Codex 适配器会把每个技能依赖的 knowledge 与 agent 文件复制进技能目录，
确保单独复制 Agent Skill 后引用仍然有效。各平台安装边界以及是否会拉取仓库
文档，见[平台支持](platform-support_cn.md)。

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
| 决策点使用的思维原则 | knowledge/principles/ | 设计/scope 阶段跨 skill 复用 |
| 特定关注点的审查清单 | knowledge/reviews/ | mu-reviewer 跨模式复用 |

---

## Claude 加载机制

四层全部通过 Claude marketplace 安装生效，无需手动配置。

| 目录 | 插件自动发现 | 机制 |
|-----------|-------------|------|
| skills/ | ✅ | 插件根目录标准路径，Claude Code 自动发现 SKILL.md |
| agents/ | ✅ | 插件根目录标准路径，Claude Code 自动发现 agent 文件 |
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

## 其他宿主适配器

| 宿主 | 适配行为 |
|---|---|
| Codex / ChatGPT Work | `scripts/build-platform-adapters.mjs` 生成严格的 `.codex-plugin` 包、自包含引用以及逐技能 `agents/openai.yaml`；scope、architecture、debug 按描述触发，code 还必须同时具备执行请求与已识别 DevMuse contract。 |
| OpenClaw | 把 Claude 或 Codex 目录作为 compatible content bundle 安装。skills 可运行；Claude agents 与 `hooks/hooks.json` 仅检测不执行。 |
| Hermes Agent | 根目录 `plugin.yaml` + `__init__.py` 把源技能注册到显式 `devmuse:` 命名空间。 |
| Gemini CLI | `plugin/gemini-extension.json` 发现源技能；小型 `GEMINI.md` 负责与原生 Plan Mode 和验证能力协调。 |
| 通用 Agent Skills 宿主 | 从 `adapters/codex/skills/` 安装生成技能；每个技能都自带所需支持文件。 |

适配层边界是刻意的：共享工作流内容，而调用、子 Agent、hook、记忆和安全语义
仍以宿主原生能力为准。

---

## 内容清单

### rules/

| 名称 | 角色 |
|------|------|
| bootstrap.md | 全局决策引导：skill 使用规则、优先级排序、决策流程 |

**原则：** rules 通过 hook 注入消耗 token。只放无条件始终生效的内容，能通过 skill 按需加载的留在 skill 中。

### skills/

**权威技能清单**（分类与角色）在 [README_CN 的技能表](../README_CN.md#技能)——本文件不重复它，只记录架构层面独有的信息：哪些 skill 派遣 DevMuse agent 文件。

| 技能 | 派遣 |
|------|-----|
| mu-arch | mu-reviewer（review-design） |
| mu-plan | mu-reviewer（review-plan） |
| mu-code | mu-coder |
| mu-review | mu-reviewer（review-code + review-coverage + review-security） |

其余技能不派遣 DevMuse agent 文件。`mu-wiki` 可以使用平台自带的只读/通用子 Agent 对 Wiki 生成做分工；它们是执行机制，不是新增的 DevMuse 角色。

### agents/

| 名称 | 角色 | 被谁派遣 |
|------|------|---------|
| mu-reviewer | 五模式审查者：设计文档（review-design）、实施计划（review-plan）、代码质量（review-code）、需求覆盖（review-coverage）、安全审计（review-security） | mu-arch, mu-plan, mu-review |
| mu-coder | 实现者 | mu-code |

**设计决策：** 2 个通用 agent + knowledge 注入，而非 N 个语言专用 agent。审查逻辑 80% 通用，改一处全局生效。扩展新语言只需加 knowledge 文件。

### knowledge/

| 类别 | 用途 | 被谁引用 |
|---|---|---|
| languages/ | 语言特定审查标准 | mu-reviewer（review-code） |
| templates/ | 产物模板 | mu-scope, mu-arch, mu-wiki |
| principles/ | 决策点加载的思维原则 | mu-arch, mu-scope, mu-mrd, mu-prd 等（如 stance-detection.md 被每个 creative skill 的 Phase 0 消费） |
| reviews/ | 特定关注点的审查清单 | mu-reviewer（review-security, review-design） |

每个文件以 **"When to use"** 开头注明消费它的 skill——目录本身即当前清单（本文不重复文件级列表；列表会漂移）。

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
- **skills → skills：交接由 bootstrap 的 Pipeline Graph 声明。** 技能宣告完成，图指名后继（如 mu-mrd → mu-prd → mu-scope → mu-arch → mu-plan → mu-code → mu-review）。
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
  "name": "devmuse"
}
```

（此处省略版本号字段——当前版本见 `plugin/.claude-plugin/plugin.json`。）

Skills、agents 与 `hooks/hooks.json` 都从插件根目录的标准路径自动加载，
因此 manifest 只保存元数据，不再维护一份容易漂移的组件清单。
