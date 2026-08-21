# 平台支持

DevMuse 采用一份工作流源文件和多个轻量宿主适配层，不强求所有 Agent 都像 Claude Code 一样工作。

## 支持矩阵

| 宿主 | 分发格式 | 调用策略 | 保留为权威的宿主原生能力 |
|---|---|---|---|
| Claude Code | Claude 发布归档或 marketplace bundle | bootstrap 按直接/有界/架构路径路由；产品与元技能保持显式调用 | Claude agents 与 `PreToolUse` hook |
| Codex CLI / ChatGPT Work | Codex 发布归档 | `mu-scope`、`mu-arch`、`mu-debug` 可按 description 匹配隐式触发；`mu-code` 还必须同时满足执行请求与已识别 DevMuse contract，其余通过 `$mu-*` 显式调用 | 原生 `/plan`、`/review`、任务追踪、子 Agent、sandbox 与审批 |
| OpenClaw | 以兼容 bundle 使用 Claude 发布归档 | 采用技能元数据；Claude bundle 中的手动技能仍保持手动 | OpenClaw 审批、sandbox、agents 与 skill allowlist |
| Hermes Agent CLI / Desktop | Hermes 发布归档 | 默认以 `devmuse:mu-*` 命名空间显式加载 | Hermes `plan` skill、学习循环、记忆、工具权限与插件生命周期 |
| Gemini CLI | Gemini 发布归档 | 轻量 `GEMINI.md` 允许 scope、architecture、debug 按描述匹配，并允许 contract-gated code execution | 原生 Plan Mode、任务追踪、验证、hooks 与审批 |
| Cursor、GitHub Copilot CLI、OpenCode、Cline、Windsurf、Goose 等 Agent Skills 宿主 | Codex 发布归档中的可移植技能包 | 由宿主决定触发；非 Codex 宿主会忽略 OpenAI 策略元数据 | 各宿主自己的规划、审查、agents 与权限系统 |

可移植包遵循 [Agent Skills 规范](https://agentskills.io/specification)。每个技能都内置自己需要的支持文件，因此单独复制技能不会破坏 DevMuse 的知识库或 reviewer 引用。

## 为什么不同平台策略不同

DevMuse 的价值在于产品澄清、风险分类、可追溯架构、系统化调试，以及需求覆盖/安全专项审查；它不应替代宿主已经做得很好的通用能力。

- 普通 Codex 规划使用 `/plan`；只有经确认的架构需要持久化、带 UC-ID 追溯的计划时才用 `mu-plan`。
- 普通 Codex 审查使用 `/review`；需求覆盖、安全审查或明确授权的 review-and-fix 才用 `mu-review`。
- `mu-code` 不介入普通 Codex 实现。只有当用户要求执行 mu-scope 的 `bounded execution` contract 或已批准的 DevMuse plan 时，它才能自动接棒；一般编码请求、设计文档或未批准 spec 都不能通过入口条件。
- Hermes 默认不把插件技能塞进启动索引，保留其渐进加载和学习模型。
- Claude 保留完整 bootstrap，因为目前只有该适配层的路由、子 Agent 和防破坏 hook 在本仓库中经过行为测试。

这些默认值刻意保持保守。`mu-code` 的自动接棒受 contract 门控；需要恢复流程或主动覆盖路由时，用户仍可显式调用。

## 安全边界

DevMuse 不承诺让 Claude 的防破坏命令 guard 在所有宿主上行为一致。Tool hook
只是辅助护栏；真正的强制边界仍是宿主的 sandbox、审批策略、工具权限和管理员策略。

| 宿主 | DevMuse 默认行为 | 原因 |
|---|---|---|
| Claude Code | 随包提供经过测试的 `PreToolUse` 警告 guard | Claude 可把 guard 的 `ask` 决策转换为用户确认；确认后仍受原生权限约束 |
| Codex | 不附加重复 guard | 原生 sandbox 与审批保持权威；`PreToolUse` 可以拒绝调用，但目前不能请求审批，直接复制 Claude 返回值会失败后继续执行 |
| Gemini CLI | 不覆盖原生策略 | 原生 policy engine 已支持 `allow`、`deny`、`ask_user`；extension 不应静默安装用户或管理员策略 |
| OpenClaw | 不附加原生 hook pack | `before_tool_call` 可以请求审批，但现有 sandbox、执行审批、owner 与 channel 策略仍会继续生效 |
| Hermes Agent | 不附加 guard hook | `pre_tool_call` 可以阻止工具，但不能复现“警告后确认”的交互 |

未来若提供安全包，必须由用户独立选择安装、采用宿主原生策略格式、绝不越过宿主策略授权，并覆盖安全命令、警告、拒绝、畸形输入和非交互模式的行为测试。文档还必须准确说明覆盖范围，不能暗示所有工具路径都能被拦截。

## 安装

已发布版本见 [GitHub Releases](https://github.com/knotmark-ai/devmuse/releases)。下载所选归档时一并下载 `SHA256SUMS`，用宿主系统的 SHA-256 工具比对后再解压。同一 Release 中的 `marketplace-submission.md` 会记录制品、校验值、验证门禁与人工市场提交步骤。源码 checkout 只用于开发；日常安装应选择体积最小的宿主归档。

### Claude Code

下载 `devmuse-<version>-claude.tar.gz`，解压后把其中的 `devmuse/` 注册为本地 marketplace：

```bash
VERSION=2.2.0
tar -xzf "devmuse-${VERSION}-claude.tar.gz"
```

```text
/plugin marketplace add /absolute/path/to/devmuse
/plugin install devmuse@devmuse
```

该归档只包含 marketplace 元数据与 Claude 运行时，不含仓库文档、测试和历史制品。需要托管更新时仍可使用远端 marketplace：

```text
/plugin marketplace add knotmark-ai/devmuse
/plugin install devmuse@devmuse
```

### Codex CLI 与 ChatGPT Work

下载并解压 `devmuse-<version>-codex.tar.gz`，再把解压目录作为本地 marketplace：

```bash
VERSION=2.2.0
tar -xzf "devmuse-${VERSION}-codex.tar.gz"
codex plugin marketplace add /absolute/path/to/devmuse
codex
```

进入 `/plugins`，选择 `devmuse` marketplace 并安装。显式技能使用 `$mu-plan`、`$mu-review` 等形式。`$mu-code` 也可被显式点名，但在满足 DevMuse 执行契约时可以自动接棒。

源码开发时可直接添加仓库 checkout；重新生成适配器后再启动新会话：

```bash
codex plugin marketplace add /absolute/path/to/devmuse
```

重新生成适配器后启动新会话。

### OpenClaw

OpenClaw 使用 Claude 归档 `devmuse-<version>-claude.tar.gz`，不生成单独的 OpenClaw 归档。解压后链接其运行时：

```bash
VERSION=2.2.0
tar -xzf "devmuse-${VERSION}-claude.tar.gz"
openclaw plugins install --link /absolute/path/to/devmuse/plugin
openclaw plugins inspect devmuse
openclaw gateway restart
```

也可以继续使用托管的 Claude-compatible marketplace：

```bash
openclaw plugins install devmuse --marketplace knotmark-ai/devmuse
```

OpenClaw 会映射 skills，但只检测 Claude `agents/` 和 `hooks/hooks.json`，不会执行它们。因此 DevMuse 依赖上文安全边界中定义的 OpenClaw 原生安全与 agent 能力。

### Hermes Agent CLI 与 Desktop

下载并解压 `devmuse-<version>-hermes.tar.gz`，再安装解压后的插件根目录：

```bash
VERSION=2.2.0
tar -xzf "devmuse-${VERSION}-hermes.tar.gz"
hermes plugins install /absolute/path/to/devmuse --enable
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

下载并解压 `devmuse-<version>-gemini.tar.gz`，再安装其中的运行时子目录：

```bash
VERSION=2.2.0
tar -xzf "devmuse-${VERSION}-gemini.tar.gz"
gemini extensions install /absolute/path/to/devmuse/plugin
```

源码实时开发可链接 checkout 中的运行时子目录：

```bash
gemini extensions link /absolute/path/to/devmuse/plugin
```

安装后重启 Gemini CLI。`GEMINI.md` 保持很小，完整技能仍按需加载。

### Cursor、GitHub Copilot CLI、OpenCode、Windsurf 及其他 Agent Skills 宿主

这些宿主使用 `devmuse-<version>-codex.tar.gz` 中的可移植包。使用 GitHub CLI 2.90 或更新版本：

```bash
VERSION=2.2.0
tar -xzf "devmuse-${VERSION}-codex.tar.gz"
gh skill install /absolute/path/to/devmuse/adapters/codex --from-local --agent cursor --scope user
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

## Release 与 registry 生命周期

Pull request 和普通 `main` push 只验证发布行为，绝不发布。手动 workflow dispatch 会执行跨平台打包、摘要比对、安装生命周期 smoke 与最终化，但保持 dry run。只有匹配 `v<package-version>` 的远端 tag 才能在 checksum attestation 之后发布已验证且不可变的制品。

npm 发布是可选项，仅在仓库启用受保护的 OIDC 环境时运行。其他 marketplace 在提供兼容的认证 API 前仍采用人工提交，请使用 Release 中的 `marketplace-submission.md`。

## 官方格式参考

- [Agent Skills 规范](https://agentskills.io/specification)
- [Codex 与 ChatGPT 插件打包](https://developers.openai.com/plugins/build/plugins)
- [Codex hooks](https://developers.openai.com/codex/config-advanced/#hooks)
- [OpenClaw compatible bundles](https://docs.openclaw.ai/plugins/bundles)
- [OpenClaw plugin hooks](https://docs.openclaw.ai/plugins/hooks)
- [Hermes Agent skills](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills/)
- [Hermes Agent plugins](https://hermes-agent.nousresearch.com/docs/user-guide/features/plugins/)
- [Hermes Agent event hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks/)
- [Gemini CLI extension 格式](https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md)
- [Gemini CLI policy engine](https://geminicli.com/docs/reference/policy-engine/)
- [GitHub Copilot Agent Skills](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)
