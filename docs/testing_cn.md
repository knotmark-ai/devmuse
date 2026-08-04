# DevMuse 测试

DevMuse 将确定性的契约检查与真实模型行为测试分开。修改路由或 Skill
时先跑低成本层；修改 description、触发边界或默认模型时再跑 Claude
真实场景。

## 测试结构

```
tests/
├── routing-policy/          路由、去重与制品归属的静态契约
├── hooks/                   确定性的 Hook 测试
├── skill-triggering/        自动调用的真实模型探针
├── explicit-skill-requests/ 当前 Skill 的显式调用探针
├── claude-code/             mu-code 行为/文档检查
├── prd-state-modeling/      状态化产品与 bootstrap 压力场景
├── subagent-driven-dev/     架构型 mu-code 手动端到端项目
└── brainstorm-server/       可视化伴侣服务测试
```

## 快速确定性检查

```bash
bash tests/routing-policy/test-routing-policy.sh
bash tests/hooks/test-destructive-guard.sh
git diff --check
```

`routing-policy` 是 Direct、有界、架构三种流程，只读检查、review 模式、
已退休制品以及 `docs/wiki/` 单一归属的回归契约。

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
- 触发测试同时覆盖正例和最接近的混淆负例，例如“理解代码”与“审 diff”。
- 解析 stream-json 的工具调用，不能只看自然语言。
- 保存失败的真实运行 transcript。
- 验证最终制品和命令，不信任 Agent 的完成摘要。
