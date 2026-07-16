# Wiki: DevMuse

> **Generated:** 2026-07-13
> **Baseline commit:** `3797d810af6600b5bbde09001b086be6cd18e720`
> **Generator:** mu-wiki v1

## Pages

| Page | Status | Relevant Files |
|------|--------|---------------|
| [DevMuse 四层架构](four-layer-architecture.md) | ✅ | docs/architecture.md, README.md, .claude-plugin/plugin.json, rules/bootstrap.md, hooks/hooks.json, hooks/session-start |
| [工作流与 mu-route 路由系统](workflow-and-routing.md) | ✅ | skills/mu-route/SKILL.md, rules/bootstrap.md, docs/specs/2026-04-17-mu-route-system-design.md, docs/plans/2026-04-17-mu-route-system.md, README.md, CONTEXT.md |
| [核心管线：Scope → Arch → Plan → Code → Review](core-pipeline.md) | ✅ | skills/mu-scope/SKILL.md, skills/mu-arch/SKILL.md, skills/mu-plan/SKILL.md, skills/mu-code/SKILL.md, skills/mu-review/SKILL.md, README.md, CONTEXT.md |
| [实现与审查：TDD、worktree 与两阶段评审](implementation-and-review.md) | ✅ | skills/mu-code/SKILL.md, skills/mu-review/SKILL.md, agents/mu-coder.md, agents/mu-reviewer.md, skills/mu-code/testing-anti-patterns.md, knowledge/schemas/codex-review-output.json |
| [正交技能：mu-explore 与 mu-debug](explore-and-debug.md) | ✅ | skills/mu-explore/SKILL.md, skills/mu-debug/SKILL.md, knowledge/templates/explore.md, skills/mu-debug/root-cause-tracing.md, skills/mu-debug/defense-in-depth.md, skills/mu-debug/condition-based-waiting.md |
| [按需技能：mu-biz / mu-prd / mu-wiki / mu-retro / mu-grill](on-demand-skills.md) | ✅ | skills/mu-biz/SKILL.md, skills/mu-prd/SKILL.md, skills/mu-wiki/SKILL.md, skills/mu-retro/SKILL.md, skills/mu-grill/SKILL.md, knowledge/principles/grilling.md, knowledge/principles/premise-check.md |
| [代理系统：mu-reviewer 与 mu-coder](agent-system.md) | ✅ | agents/mu-reviewer.md, agents/mu-coder.md, docs/architecture.md, knowledge/languages/typescript.md, knowledge/languages/go.md, knowledge/reviews/security-checklist.md, knowledge/reviews/design-audit-rubric.md |
| [域语言与技能质量机制](domain-language-and-quality.md) | ✅ | CONTEXT.md, knowledge/principles/domain-glossary.md, knowledge/templates/context-md.md, knowledge/principles/skill-quality.md, knowledge/principles/skill-cso.md, knowledge/principles/stance-detection.md |
| [钩子与门控](hooks-and-gates.md) | ✅ | hooks/hooks.json, hooks/pre-tool-use/pipeline-gate.sh, hooks/pre-tool-use/destructive-guard.sh, hooks/session-start, knowledge/principles/sign-off-gate.md, knowledge/principles/git-safety.md, CONTEXT.md |
| [设计原则与思维框架](thinking-principles.md) | ✅ | knowledge/principles/inversion.md, knowledge/principles/premise-check.md, knowledge/principles/chestertons-fence.md, knowledge/principles/architecture-assessment.md, knowledge/principles/nfr-checklist.md, knowledge/principles/graphviz-conventions.md, knowledge/principles/defensive-boundary.md |
| [测试基础设施](testing-infrastructure.md) | ✅ | docs/testing.md, tests/claude-code/README.md, tests/claude-code/run-skill-tests.sh, tests/skill-triggering/run-all.sh, tests/explicit-skill-requests/run-all.sh, tests/hooks/test-pipeline-gate.sh, knowledge/principles/skill-testing.md |
| [文档维护契约与单一事实源](docs-maintenance-contract.md) | ✅ | CLAUDE.md, README.md, README_CN.md, docs/architecture.md, docs/architecture_cn.md, CONTEXT.md, knowledge/templates/wiki-index.md |

## Sections

- **总体架构**: four-layer-architecture, workflow-and-routing
- **核心工作流**: core-pipeline, implementation-and-review
- **正交与按需技能**: explore-and-debug, on-demand-skills
- **代理与分发**: agent-system
- **知识与机制**: domain-language-and-quality, hooks-and-gates, thinking-principles
- **测试与维护**: testing-infrastructure, docs-maintenance-contract

## History

| Date | Commit | Action | Pages affected |
|------|--------|--------|---------------|
| 2026-07-13 | `3797d81` | generate (full rebuild) | all — new 12-page structure; supersedes the 14-page 2026-04-30 layout |
| 2026-04-30 | `5d16bba` | generate | all (initial) |
