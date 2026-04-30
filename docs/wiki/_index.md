# Wiki: DevMuse

> **Generated:** 2026-04-30
> **Baseline commit:** `5d16bbad0210444a9c87718d427fa4d759ebe64d`
> **Generator:** mu-wiki v1

## Pages

| Page | Status | Relevant Files |
|------|--------|---------------|
| [项目概述](project-overview.md) | ✅ | README.md, README_CN.md, docs/architecture.md, package.json, .claude-plugin/plugin.json |
| [四层架构设计](architecture-layers.md) | ✅ | docs/architecture.md, docs/architecture_cn.md, rules/bootstrap.md, hooks/hooks.json, hooks/session-start, .claude-plugin/plugin.json |
| [开发工作流与路由](workflow-pipeline.md) | ✅ | README.md, rules/bootstrap.md, skills/mu-route/SKILL.md, docs/architecture.md |
| [核心管道技能](pipeline-skills.md) | ✅ | skills/mu-scope/SKILL.md, skills/mu-arch/SKILL.md, skills/mu-arch/visual-companion.md, skills/mu-plan/SKILL.md, skills/mu-code/SKILL.md, skills/mu-review/SKILL.md |
| [正交技能](orthogonal-skills.md) | ✅ | skills/mu-explore/SKILL.md, skills/mu-debug/SKILL.md, skills/mu-debug/root-cause-tracing.md, skills/mu-debug/condition-based-waiting.md, skills/mu-debug/defense-in-depth.md, skills/mu-debug/find-polluter.sh, skills/mu-retro/SKILL.md |
| [按需技能](on-demand-skills.md) | ✅ | skills/mu-biz/SKILL.md, skills/mu-prd/SKILL.md, skills/mu-wiki/SKILL.md |
| [元技能与基础设施技能](meta-skills.md) | ✅ | skills/mu-write-skill/SKILL.md, skills/mu-write-skill/anthropic-best-practices.md, skills/mu-write-skill/persuasion-principles.md, skills/mu-write-skill/testing-skills-with-subagents.md, skills/mu-route/SKILL.md |
| [代理系统](agent-system.md) | ✅ | agents/mu-reviewer.md, agents/mu-coder.md, docs/architecture.md, knowledge/languages/typescript.md, knowledge/languages/python.md |
| [审查机制与质量控制](review-mechanisms.md) | ✅ | agents/mu-reviewer.md, skills/mu-review/SKILL.md, knowledge/reviews/design-audit-rubric.md, knowledge/reviews/security-checklist.md |
| [知识库组织与内容结构](knowledge-organization.md) | ✅ | docs/architecture.md, knowledge/languages/typescript.md, knowledge/languages/python.md, knowledge/languages/go.md, knowledge/languages/java.md, knowledge/templates/scope.md, knowledge/templates/explore.md, knowledge/templates/architecture.md, knowledge/templates/wiki-index.md |
| [设计原则与思维框架](design-principles.md) | ✅ | knowledge/principles/chestertons-fence.md, knowledge/principles/inversion.md, knowledge/principles/premise-check.md, knowledge/principles/architecture-assessment.md, knowledge/principles/stance-detection.md, knowledge/principles/sign-off-gate.md, knowledge/principles/git-safety.md, knowledge/principles/defensive-boundary.md, knowledge/principles/skill-cso.md, knowledge/principles/skill-testing.md, knowledge/principles/graphviz-conventions.md |
| [插件安装与本地开发](plugin-installation.md) | ✅ | README.md, README_CN.md, .claude-plugin/plugin.json, .claude-plugin/marketplace.json, package.json |
| [配置、钩子与安全门控](configuration-hooks-gates.md) | ✅ | hooks/hooks.json, hooks/session-start, hooks/pre-tool-use/pipeline-gate.sh, hooks/pre-tool-use/destructive-guard.sh, .claude-plugin/plugin.json, knowledge/principles/defensive-boundary.md, knowledge/principles/git-safety.md |
| [测试基础设施](testing-infrastructure.md) | ✅ | docs/testing.md, knowledge/principles/skill-testing.md, skills/mu-code/testing-anti-patterns.md, skills/mu-write-skill/testing-skills-with-subagents.md |

## Sections

- **概述**: project-overview, architecture-layers, workflow-pipeline
- **技能系统**: pipeline-skills, orthogonal-skills, on-demand-skills, meta-skills
- **代理与审查**: agent-system, review-mechanisms
- **知识库与原则**: knowledge-organization, design-principles
- **集成与部署**: plugin-installation, configuration-hooks-gates, testing-infrastructure

## History

| Date | Commit | Action | Pages affected |
|------|--------|--------|---------------|
| 2026-04-30 | `5d16bba` | generate | all (initial) |
