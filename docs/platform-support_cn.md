# 平台支持

DevMuse 采用一份工作流源文件和多个轻量宿主适配层，不强求所有 Agent 都像 Claude Code 一样工作。

## 支持矩阵

| 宿主 | 分发格式 | 调用策略 | 保留为权威的宿主原生能力 |
|---|---|---|---|
| Claude Code | `plugin/` 中的 Claude marketplace bundle | bootstrap 按直接/有界/架构路径路由；六个产品与元技能保持显式调用 | Claude agents 与 `PreToolUse` hook |
| Codex CLI / ChatGPT Work | `adapters/codex/` 中的 Codex plugin | `mu-scope`、`mu-arch`、`mu-debug` 可按 description 匹配隐式触发；`mu-code` 还必须同时满足执行请求与已识别 DevMuse contract，其余通过 `$mu-*` 显式调用 | 原生 `/plan`、`/review`、任务追踪、子 Agent、sandbox 与审批 |
| OpenClaw | 以兼容 bundle 安装 Claude 或 Codex 目录 | 采用技能元数据；Claude bundle 中的手动技能仍保持手动 | OpenClaw 审批、sandbox、agents 与 skill allowlist |
| Hermes Agent CLI / Desktop | 仓库根目录的 Hermes plugin | 默认以 `devmuse:mu-*` 命名空间显式加载 | Hermes `plan` skill、学习循环、记忆、工具权限与插件生命周期 |
| Gemini CLI | `plugin/` 中的 Gemini extension 元数据 | 轻量 `GEMINI.md` 允许 scope、architecture、debug 按描述匹配，并允许 contract-gated code execution | 原生 Plan Mode、任务追踪、验证、hooks 与审批 |
| Cursor、GitHub Copilot CLI、OpenCode、Cline、Windsurf、Goose 等 Agent Skills 宿主 | `adapters/codex/skills/` 中生成的可移植技能包 | 由宿主决定触发；非 Codex 宿主会忽略 OpenAI 策略元数据 | 各宿主自己的规划、审查、agents 与权限系统 |

可移植包遵循 [Agent Skills 规范](https://agentskills.io/specification)。每个技能都内置自己需要的支持文件，因此单独复制技能不会破坏 DevMuse 的知识库或 reviewer 引用。

## 为什么不同平台策略不同

DevMuse 的价值在于产品澄清、风险分类、可追溯架构、系统化调试，以及需求覆盖/安全专项审查；它不应替代宿主已经做得很好的通用能力。

- 普通 Codex 规划使用 `/plan`；只有经确认的架构需要持久化、带 UC-ID 追溯的计划时才用 `mu-plan`。
- 普通 Codex 审查使用 `/review`；需求覆盖、安全审查或明确授权的 review-and-fix 才用 `mu-review`。
- `mu-code` 不介入普通 Codex 实现。只有当用户要求执行 mu-scope 的 `bounded execution` contract 或已批准的 DevMuse plan 时，它才能自动接棒；一般编码请求、设计文档或未批准 spec 都不能通过入口条件。
- Hermes 默认不把插件技能塞进启动索引，保留其渐进加载和学习模型。
- Claude 保留完整 bootstrap，因为目前只有该适配层的路由、子 Agent 和防破坏 hook 在本仓库中经过行为测试。

后续是否调整这些默认值，记录在 [#50](https://github.com/knotmark-ai/devmuse/issues/50)。

## 安装

### Claude Code

```text
/plugin marketplace add knotmark-ai/devmuse
/plugin install devmuse@devmuse
```

marketplace 条目只安装 `plugin/`；仓库中的 `docs/` 与 `tests/` 不属于 Claude 运行时。

### Codex CLI 与 ChatGPT Work

用 sparse checkout 添加仓库 marketplace，再在新的 Codex 会话中通过 `/plugins` 安装：

```bash
codex plugin marketplace add knotmark-ai/devmuse \
  --sparse .agents/plugins \
  --sparse adapters/codex
codex
```

进入 `/plugins`，选择 `devmuse` marketplace 并安装。显式技能使用 `$mu-plan`、`$mu-review` 等形式。`$mu-code` 也可被显式点名，但在满足 DevMuse 执行契约时可以自动接棒。

本地开发：

```bash
codex plugin marketplace add /absolute/path/to/devmuse
```

重新生成适配器后启动新会话。

### OpenClaw

OpenClaw 可以直接安装 Claude-compatible marketplace：

```bash
openclaw plugins install devmuse --marketplace knotmark-ai/devmuse
openclaw plugins inspect devmuse
openclaw gateway restart
```

本地开发可以直接链接运行时目录：

```bash
openclaw plugins install --link /absolute/path/to/devmuse/plugin
```

OpenClaw 会映射 skills，但只检测 Claude `agents/` 和 `hooks/hooks.json`，不会执行它们。因此 DevMuse 依赖 OpenClaw 原生安全与 agent 能力。跨宿主 guard 设计记录在 [#48](https://github.com/knotmark-ai/devmuse/issues/48)。

### Hermes Agent CLI 与 Desktop

```bash
hermes plugins install knotmark-ai/devmuse --enable
```

默认轻量模式将技能注册为显式命名空间，不把全部描述加入启动 prompt。例如：

```text
Load the devmuse:mu-scope skill, then scope this authentication change.
```

如果希望使用普通 `/mu-scope` 命令和自动发现，可在 `~/.hermes/config.yaml` 加入：

```yaml
skills:
  external_dirs:
    - ~/.hermes/plugins/devmuse/plugin/skills
```

如果目录可写，Hermes 的学习循环可以修改 external skills。不希望 DevMuse 被自动改写时，请把插件目录设为只读。

### Gemini CLI

Gemini 从目录或 Git 仓库根目录安装 extension。DevMuse 的 Gemini 根目录是 `plugin/`，因此先 clone，再安装该子目录：

```bash
git clone https://github.com/knotmark-ai/devmuse.git
gemini extensions install ./devmuse/plugin
```

本地实时开发：

```bash
gemini extensions link /absolute/path/to/devmuse/plugin
```

安装后重启 Gemini CLI。`GEMINI.md` 保持很小，完整技能仍按需加载。

### Cursor、GitHub Copilot CLI、OpenCode、Windsurf 及其他 Agent Skills 宿主

使用 GitHub CLI 2.90 或更新版本，clone 仓库并为目标宿主安装生成的可移植包：

```bash
git clone https://github.com/knotmark-ai/devmuse.git
gh skill install ./devmuse/adapters/codex --from-local --agent cursor --scope user
```

然后在交互提示中选择需要的 DevMuse skills。可将 `cursor` 替换为
`github-copilot`、`opencode`、`cline`、`windsurf`、`goose`，或
`gh skill install --help` 列出的其他值。团队规范优先使用 project scope；
user scope 会让选中的 skills 在所有仓库中可见。

## 构建与验证适配器

`plugin/skills/` 是唯一源文件。不要直接修改 `adapters/codex/skills/` 下的生成内容。

```bash
npm run build:adapters
npm run test:platforms
```

构建会移除 Claude-only 调用字段，把跨根目录依赖复制进各技能，并生成 Codex `agents/openai.yaml` 策略。验证覆盖技能清单一致性、引用可移植性、宿主策略、manifest 和 Codex 官方 ingestion contract。

## 已知分发缺口

Claude 与 Codex marketplace 可以只获取运行时子树；Hermes 的 Git 安装和 Gemini 当前的 clone-first 流程仍可能下载仓库文档与测试。平台专用 release 包和 registry 上架记录在 [#49](https://github.com/knotmark-ai/devmuse/issues/49)。

## 官方格式参考

- [Agent Skills 规范](https://agentskills.io/specification)
- [Codex 与 ChatGPT 插件打包](https://developers.openai.com/plugins/build/plugins)
- [OpenClaw compatible bundles](https://docs.openclaw.ai/plugins/bundles)
- [Hermes Agent skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)
- [Hermes Agent plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins/)
- [Gemini CLI extension 格式](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md)
- [GitHub Copilot Agent Skills](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)
