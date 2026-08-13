# DevMuse

[中文文档](README_CN.md)

DevMuse is a risk-proportional software development workflow for Claude Code, Codex, OpenClaw, Hermes Agent, Gemini CLI, and other Agent Skills hosts. It uses a four-layer architecture of rules, skills, agents, and knowledge without forcing every host through the same ceremony.

Based on [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

## How it works

It starts by classifying the work, not by forcing every request through the same ceremony. Read-only code understanding is answered through proportional source inspection. Exact, reversible execution goes straight to the change and verification. Behavior-changing work enters a quick impact probe.

The probe keeps a clear change to an existing flow **bounded**: 1–3 inline use cases, TDD where behavior changes, and one combined review. The original request is not re-approved unless the probe exposes a real decision.

Cross-system, public-contract, security, migration, or genuinely unresolved work takes the **architectural** path: approved scope, technical design, implementation plan, TDD, and one final independent review.

If a bounded task grows, DevMuse upgrades it before the risky surface changes. The process can get heavier when evidence justifies it; task size or a trigger verb alone never does.

## Installation

### Claude Code

```bash
# Register marketplace
/plugin marketplace add knotmark-ai/devmuse

# Install plugin
/plugin install devmuse@devmuse
```

### Other hosts

Codex, OpenClaw, Hermes Agent, Gemini CLI, Cursor, GitHub Copilot CLI, OpenCode, and other Agent Skills hosts use native or generated adapters. See the [platform support and installation guide](docs/platform-support.md) for exact commands and capability differences.

### Verify installation

Start a new session and ask for something that should trigger a skill (for example, "scope this behavior change" or "let's debug this issue"). Automatic activation is intentionally host-specific: Codex and Gemini auto-activate scope, architecture, and debug when they match; code execution can take over only after the user asks to execute a recognized DevMuse contract or approved plan. Planning and review normally stay with native host capabilities.

## Pipeline

DevMuse is a software engineering workflow tool. It routes development work by risk and uncertainty, and provides on-demand product/business analysis tools.

### Proportional paths (auto-routed)

```
direct → bounded → architectural

direct        → verify → end
bounded       → scope → code → combined review → end
architectural → scope → arch → plan → code → review → end
```

1. **Direct** — Read-only inspection with no durable artifact, or exact mechanical/reversible execution. No workflow skill; inspect or execute, verify proportionally, and report.

2. **mu-scope** — Probes behavior-changing work and selects a bounded or architectural path. Bounded produces an inline contract; architectural produces an approved Use Case Set.

3. **mu-arch** — Turns architectural scope into technical architecture (components, interfaces, data flow, error handling). Proposes 2-3 approaches and presents real decisions for validation.

4. **mu-plan** — Breaks approved architecture into implementation tasks with file paths, verification steps, and UC-ID traceability.

5. **mu-code** — Executes bounded contracts inline with one combined review, or architectural plans with inline/subagent implementation and one final review. Enforces RED-GREEN-REFACTOR for behavior changes.

6. **mu-review** — Full code-quality and requirements-coverage review for the architectural path. Standalone review requests are report-only; fixes and repository integration require the corresponding authority.

### Orthogonal skill (auto-routed)

- **mu-debug** — Systematic root cause analysis (red loop first, 4-phase process with architecture escalation).

### On-demand skills (direct `/slash` invocation only)

- **mu-mrd** — Market requirements: should we build it (premise, quick mode) or full market analysis (competitors, target market, revenue opportunity, MVP scope). Invoke with `/mu-mrd`.
- **mu-model** 🧪 — Domain model: concepts, archetypes, the spine, who produces and maintains what. Runs before PRD and design, writes repo-root `CONTEXT.md`. Invoke with `/mu-model`. **Its `create` path has not been validated on a from-zero project — see [Validation status](#validation-status).**
- **mu-prd** — Product requirements: user flows, object lifecycle models, wireframes, per-feature specs, tiering rules. Invoke with `/mu-prd`.
- **mu-wiki** — The single durable home for current architecture documentation, generated from source with citations. Invoke with `/mu-wiki generate` or `/mu-wiki update`.
- **mu-retro** — Periodic retrospective: git metrics, review patterns, and durable learnings. Invoke with `/mu-retro`.
- **mu-grill** — Relentless plan/design interview until every rework-forcing fork is resolved. Invoke with `/mu-grill`.

These are NOT auto-routed. The user explicitly invokes them when needed.

### Routing

Routing lives in the always-on bootstrap rule. It first excludes out-of-domain messages, then admits read-only inspection and exact low-risk work to Direct; remaining development work routes by intent and repo state. mu-scope uses codebase evidence to choose bounded or architectural ceremony. Persistent architecture documentation is explicit `/mu-wiki`, not a side effect of understanding code.

### Typical Paths

- **Exact mechanical change**: `Direct → verify → end`
- **Bounded feature on an existing flow**: `mu-scope (inline contract) → mu-code (one combined review)`
- **Architectural feature**: `mu-scope → mu-arch → mu-plan → mu-code → mu-review`
- **Greenfield product**: `/mu-mrd` → `/mu-prd` → then feature loop above
- **Bug fix**: `mu-scope (1 UC) → mu-debug` (mu-debug investigates, implements, and verifies the fix)

**Sign-off gate**: when `CODEOWNERS` or multi-author git history indicates team-touching work, creative skills (mu-mrd / mu-prd / mu-arch) prompt for stakeholder sign-off at artifact exit. Non-blocking — user can always override.

## Architecture

```
devmuse/
├── plugin/           Claude/OpenClaw/Gemini runtime
│   ├── rules/            Claude always-on routing (SessionStart)
│   ├── skills/           Canonical workflow source
│   ├── agents/           Claude independent roles
│   └── knowledge/        Shared domain knowledge
├── adapters/codex/   Generated Codex plugin and self-contained Agent Skills
├── plugin.yaml       Hermes plugin manifest
├── __init__.py       Hermes namespaced skill registration
├── docs/             Repository documentation; excluded by subtree installs
└── tests/            Development and compatibility tests
```

### Skills

| Category | Skill | Role |
|----------|-------|------|
| Pipeline | **mu-scope** | Impact probe, bounded/architectural classification, use cases and conflict detection |
| Pipeline | **mu-arch** | Approved scope → technical architecture spec through collaborative dialogue |
| Pipeline | **mu-plan** | Architecture → detailed implementation plan with UC-ID traceability |
| Pipeline | **mu-code** | Bounded contract or plan → proportional implementation, TDD, self-check, and one path-level review |
| Pipeline | **mu-review** | Report-only standalone review, or authorized review-and-fix with verification |
| Orthogonal | **mu-debug** | Systematic root cause analysis |
| On-demand | **mu-mrd** | Market requirements — worth building? (quick) or full market analysis (competitors, target market, revenue opportunity, MVP scope) |
| On-demand | **mu-model** 🧪 | Domain model — concepts, archetypes, the spine, ownership; written to `CONTEXT.md` before PRD or design. **`create` path unproven — see Validation** |
| On-demand | **mu-prd** | Product requirements — user flows, object lifecycle models, wireframes, feature specs, tiering rules |
| On-demand | **mu-wiki** | Architecture wiki — generates and maintains project-level architecture documentation |
| On-demand | **mu-retro** | Periodic retrospective with git metrics and durable learning capture |
| On-demand | **mu-grill** | Relentless plan/design interview — resolves every rework-forcing fork before work begins |
| Meta | **mu-write-skill** | Create/edit skills using TDD methodology |

### Agents

| Agent | Role |
|-------|------|
| **mu-reviewer** | Five-mode reviewer: design doc (review-design), implementation plans (review-plan), code quality (review-code), requirements coverage (review-coverage), security (review-security) |
| **mu-coder** | Implementation specialist: builds features from task specs |

### Rules

| Rule | Role |
|------|------|
| **bootstrap** | Skill discovery and invocation rules, priority ordering, decision flow |

### Hooks

| Hook | Trigger | Role |
|------|---------|------|
| **destructive-guard** | Bash (Claude Code only) | Warns before destructive commands (rm -rf, git push -f, DROP TABLE, git reset --hard). Other hosts keep their native safety policy authoritative. |

### Knowledge

| Category | Purpose |
|----------|---------|
| **languages/** | Language-specific review criteria (Java, Go, Python, TypeScript) |
| **templates/** | Artifact templates (scope Use Case Set) |
| **principles/** | Thinking rubrics loaded at decision points — inversion, premise check, stance detection, sign-off gate, grilling, domain glossary, skill quality, and more (see the directory for the current set) |
| **reviews/** | Review checklists: security audit (5-phase OWASP), design audit rubric (architecture scoring) |

## Philosophy

- **Test-Driven Development** — Write tests first, always
- **Systematic over ad-hoc** — Process over guessing
- **Complexity reduction** — Simplicity as primary goal
- **Evidence over claims** — Verify before declaring success

## Validation status

Skills marked 🧪 carry a path that has not been exercised on real projects yet. They ship anyway — holding them back until perfect is how the validation never happens.

| Skill | Proven | Not proven | Report to |
|---|---|---|---|
| **mu-model** | `update` and `sync`, derived from two real runs (aflaj restructure, devmuse rebuild) | **`create`** — never run on a project starting from zero. Its step sequence is reasoned from Event Modeling and Four-Color archetypes, not extracted from practice | [#47](https://github.com/knotmark-ai/devmuse/issues/47) — carries a report template |

**Exit criterion:** a path drops its 🧪 after running on **two independent projects without a process fix**. One clean run is luck.

## Local Development

Rebuild and validate the generated host adapter first:

```bash
npm run build:adapters
npm run test:platforms
```

Load the Claude plugin directly from a local directory without installation:

```bash
claude --plugin-dir /path/to/devmuse/plugin
```

After making changes, reload without restarting:

```
/reload-plugins
```

Optionally add a shell alias for convenience:

```bash
alias claude-dev='claude --plugin-dir /path/to/devmuse/plugin'
```

For Codex, OpenClaw, Hermes, Gemini, and generic Agent Skills local loading, see [Platform support](docs/platform-support.md#install).

## Updating

Skills update automatically when you update the plugin:

```bash
/plugin update devmuse
```

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

- Based on [Superpowers](https://github.com/obra/superpowers) by [Jesse Vincent](https://blog.fsck.com) and [Prime Radiant](https://primeradiant.com)
- Inspired by [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)
- Security review, design audit, premise validation, and hook patterns inspired by [gstack](https://github.com/garry/gstack) by [Garry Tan](https://twitter.com/garrytan)
