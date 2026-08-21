# DevMuse 测试

DevMuse 将确定性的契约检查与真实模型行为测试分开。修改路由或 Skill
时先跑低成本层；修改 description、触发边界或默认模型时再跑 Claude
真实场景。

## 测试结构

当前 suite 见 `tests/` 目录。确定性检查覆盖路由、hooks、宿主打包、发布行为、
元数据、Mermaid 与 token 统计；真实场景覆盖模型触发和 Agent 端到端行为。
本文按执行成本分组，不复制容易漂移的目录清单。

## 快速确定性检查

```bash
npm run build:adapters
npm run test:generated
npm run test:platforms
npm run test:skills
npm run test:routing
npm run test:hooks
npm run test:mermaid
npm run test:token-benchmark
npm run test:release
git diff --check
```

平台契约会比对规范源与生成结果的 Skill 清单，检查每个随包引用，验证宿主
manifest 和版本一致性，并落实 Codex/Gemini 的原生能力策略。发布验证还会在
系统 Skill 可用时，对 `adapters/codex/` 运行 Codex `plugin-creator` 验证器。

`routing-policy` 是 Direct、有界、架构三种流程，只读检查、review 模式、
已退休制品以及 `docs/wiki/` 单一归属的回归契约。

## 发布验证

`npm run test:release` 会在不访问 GitHub Releases 或 npm 的情况下，验证发布
模型、确定性归档、两次构建对比、安全解压、宿主生命周期 smoke、最终化、
发布重试边界、workflow 权限和文档契约。

使用临时输出目录执行完整本地 dry run：

```bash
release_root="$(mktemp -d)/release"
npm run release:build -- --output "$release_root"
npm run release:verify -- --input "$release_root"
npm run release:smoke -- --input "$release_root" --evidence "$release_root/smoke-evidence.json"
npm run release:finalize -- --input "$release_root" --evidence "$release_root/smoke-evidence.json"
```

Tag workflow 会在 Linux、macOS、Windows 上重复打包和 smoke，比对构建阶段的
checksum contract，再最终化一份已验证输出。手动 dispatch 到此为止；只有匹配
版本的远端 tag 才能进入 attestation、GitHub Release 变更和隔离的可选 npm job。

## 真实触发检查

需要 `claude` CLI 与本地插件目录。

```bash
tests/skill-triggering/run-all.sh
tests/explicit-skill-requests/run-all.sh
tests/claude-code/run-skill-tests.sh
```

- `skill-triggering` 使用自然语言提示，检查应自动触发的 Skill。
- `explicit-skill-requests` 检查当前 Skill 被点名后是否先加载再行动。
- `claude-code` 检查 mu-code 的相称执行契约：有界/架构输入、任务自检、
  单一审查边界、子 Agent 阈值与相称隔离。

真实触发结果受模型影响。应保存 transcript，同时判断“调用了什么”和
“为什么”；碰巧调用正确但边界理由错误，仍然是回归。

## 压力场景

```bash
bash tests/prd-state-modeling/run-test.sh \
  tests/prd-state-modeling/prompts/bootstrap-routing-probes.txt
```

bootstrap 场景覆盖只读理解、精确执行、看似很小的契约改动、持久 Wiki
请求、不熟悉区域的重构、只报告审查以及 review-and-fix。

## 架构执行端到端测试

`tests/subagent-driven-dev/` 下的项目是手动且可能昂贵的端到端场景：

```bash
tests/subagent-driven-dev/run-test.sh go-fractals
tests/subagent-driven-dev/run-test.sh svelte-todo
```

它们产出临时项目与 stream-json transcript。检查计划只读一次、写集隔离、
TDD 证据、任务自检、集成验证和一次最终审查；不再强制已退休的逐任务
reviewer fan-out。

## Token 分析

```bash
python3 tests/claude-code/analyze-token-usage.py \
  ~/.claude/projects/<project-dir>/<session-id>.jsonl
```

固定的启动/上下文成本与任务执行成本应分开记录。路由在没有触发条件时
加载工作流或创建制品，即使最终代码正确，也算回归。

## 测试编写规则

- 确定性 shell 测试不调用模型。
- 修改 `plugin/skills/` 后重新生成适配器，不要直接编辑
  `adapters/codex/skills/`。
- 触发测试同时覆盖正例和最接近的混淆负例，例如“理解代码”与“审 diff”。
- 解析 stream-json 的工具调用，不能只看自然语言。
- 保存失败的真实运行 transcript。
- 验证最终制品和命令，不信任 Agent 的完成摘要。
