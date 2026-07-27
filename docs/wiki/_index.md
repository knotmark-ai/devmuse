# Wiki: DevMuse

> **Generated:** 2026-07-27
> **Baseline commit:** `05a547ad2c261cd271bc844daf6d9a281d0fca4c`
> **Generator:** mu-wiki v1

## Pages

| Page | Status | Relevant Files |
|------|--------|---------------|
| [四层架构：规则、技能、代理、知识](four-layer-arch.md) | ✅ | docs/architecture.md, rules/bootstrap.md, README.md, hooks/hooks.json, hooks/session-start, hooks/pre-tool-use/destructive-guard.sh, knowledge/principles/git-safety.md |
| [管线图：跨技能交接、门禁与证据机制](pipeline-graph.md) | ✅ | rules/bootstrap.md, CONTEXT.md, README.md, knowledge/principles/sign-off-gate.md, knowledge/principles/stance-detection.md |
| [核心管线：Scope 与 Arch](core-pipeline.md) | ✅ | skills/mu-scope/SKILL.md, skills/mu-arch/SKILL.md, knowledge/principles/stance-detection.md, knowledge/principles/sign-off-gate.md, knowledge/templates/scope.md, knowledge/templates/architecture.md, CONTEXT.md |
| [Plan 与 Code：测试即合同的计划与 TDD 实现](plan-implement.md) | ✅ | skills/mu-plan/SKILL.md, skills/mu-code/SKILL.md, skills/mu-code/parallel-dispatch.md, skills/mu-code/testing-anti-patterns.md, agents/mu-coder.md |
| [Review：六模式评审、验证与集成](review-verify.md) | ✅ | skills/mu-review/SKILL.md, agents/mu-reviewer.md, knowledge/reviews/design-audit-rubric.md, knowledge/reviews/security-checklist.md, knowledge/schemas/codex-review-output.json |
| [mu-mrd 与 mu-prd：市场需求与产品需求](market-product-analysis.md) | ✅ | skills/mu-mrd/SKILL.md, skills/mu-prd/SKILL.md, knowledge/principles/premise-check.md, knowledge/principles/state-modeling.md, knowledge/principles/business-canvases.md |
| [产品对象模型与状态生命周期](product-object-model.md) | ✅ | knowledge/principles/state-modeling.md, skills/mu-prd/SKILL.md, skills/mu-scope/SKILL.md, skills/mu-arch/SKILL.md, CONTEXT.md |
| [正交技能：mu-explore 与 mu-debug](explore-debug-skills.md) | ✅ | skills/mu-explore/SKILL.md, skills/mu-debug/SKILL.md, skills/mu-debug/root-cause-tracing.md, skills/mu-debug/defense-in-depth.md, skills/mu-debug/condition-based-waiting.md, knowledge/templates/explore.md |
| [代理系统：mu-reviewer 与 mu-coder](agents-dispatch.md) | ✅ | agents/mu-reviewer.md, agents/mu-coder.md, docs/architecture.md, knowledge/languages/typescript.md, knowledge/languages/go.md, knowledge/languages/python.md, knowledge/languages/java.md |
| [域语言与立场机制](domain-language.md) | ✅ | CONTEXT.md, knowledge/principles/domain-glossary.md, knowledge/principles/stance-detection.md, knowledge/templates/context-md.md, skills/mu-prd/SKILL.md |
| [设计原则与思维框架库](thinking-principles.md) | ✅ | knowledge/principles/inversion.md, knowledge/principles/premise-check.md, knowledge/principles/chestertons-fence.md, knowledge/principles/architecture-assessment.md, knowledge/principles/nfr-checklist.md, knowledge/principles/grilling.md, knowledge/principles/graphviz-conventions.md, knowledge/principles/defensive-boundary.md |
| [测试基础设施与回归套件](testing-regression.md) | ✅ | docs/testing.md, tests/claude-code/README.md, tests/claude-code/run-skill-tests.sh, tests/prd-state-modeling/README.md, tests/prd-state-modeling/run-test.sh, knowledge/principles/skill-testing.md, tests/skill-triggering/run-all.sh |
| [文档维护契约与单一事实源](docs-contract.md) | ✅ | CLAUDE.md, README.md, README_CN.md, docs/architecture.md, docs/architecture_cn.md, CONTEXT.md, knowledge/templates/wiki-index.md |

## Sections

- **总体架构与核心概念**: four-layer-arch, pipeline-graph
- **核心管线与工作流**: core-pipeline, plan-implement, review-verify
- **产品级技能**: market-product-analysis, product-object-model
- **辅助技能与代理**: explore-debug-skills, agents-dispatch
- **知识库与原则**: domain-language, thinking-principles
- **测试与维护**: testing-regression, docs-contract

## History

| Date | Commit | Action | Pages affected |
|------|--------|--------|---------------|
| 2026-07-27 | `05a547a` | generate (full rebuild) | all — new 13-page structure for the v2.0 guidance-over-enforcement milestone; supersedes the 12-page 2026-07-13 layout. Triggered by UC-ERR2 (deleted relevant files: mu-biz rename, pipeline-gate removal) + >60% staleness. Structure agent's stale hook/gate descriptions corrected before generation; CONTEXT.md's retired "Pipeline gate" term cleaned in the same pass. |
| 2026-07-26 | `2ee5b19` | update | 6 pages regenerated after the v1.3.0 state-modeling release (PR #38). |
| 2026-07-19 | `134d4fb` | update | 8 pages regenerated after the routing fold (mu-route retired → bootstrap). |
| 2026-07-13 | `3797d81` | generate (full rebuild) | all — 12-page structure; superseded the 14-page 2026-04-30 layout |
| 2026-04-30 | `5d16bba` | generate | all (initial) |
