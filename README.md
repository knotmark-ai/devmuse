# DevMuse

[中文文档](README_CN.md)

DevMuse is a complete software development workflow for Claude Code, built on a four-layer architecture of rules, skills, agents, and knowledge.

Based on [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

## How it works

It starts from the moment you fire up Claude Code. As soon as it sees that you're building something, it *doesn't* just jump into trying to write code. Instead, it steps back and *scopes* the work first — enumerating use cases, detecting conflicts, and assessing impact on existing code. Only then does it move to design.

Once it's teased a spec out of the conversation, it shows it to you in chunks short enough to actually read and digest.

After you've signed off on the design, your agent puts together an implementation plan that's clear enough for an enthusiastic junior engineer with poor taste, no judgement, no project context, and an aversion to testing to follow. It emphasizes true red/green TDD, YAGNI (You Aren't Gonna Need It), and DRY.

Next up, once you say "go", it launches a *subagent-driven development* process, having agents work through each engineering task, inspecting and reviewing their work, and continuing forward. It's not uncommon for Claude to be able to work autonomously for a couple hours at a time without deviating from the plan you put together.

## Installation

```bash
# Register marketplace
/plugin marketplace add knotmark-ai/devmuse

# Install plugin
/plugin install devmuse@devmuse
```

### Verify Installation

Start a new session and ask for something that should trigger a skill (for example, "help me plan this feature" or "let's debug this issue"). The agent should automatically invoke the relevant skill.

## Pipeline

DevMuse is a software engineering workflow tool. It auto-routes dev tasks through a structured pipeline, and provides on-demand product/business analysis tools.

### Core pipeline (auto-routed)

```
scope → arch → plan → code → review
```

1. **mu-scope** — Scans the codebase for impact (Quick Probe), enumerates use cases (happy paths, edge cases, error cases, reverse cases), detects conflicts, and produces a Use Case Set.

2. **mu-arch** — Turns approved scope into technical architecture (components, interfaces, data flow, error handling). Proposes 2-3 approaches, presents design in sections for validation.

3. **mu-plan** — Breaks architecture into bite-sized tasks (2-5 minutes each). Every task has exact file paths, complete code, verification steps, and UC-ID traceability.

4. **mu-code** — Executes plan via subagent-driven development or inline mode. Enforces TDD discipline (RED-GREEN-REFACTOR). Dispatches mu-coder and mu-reviewer for two-stage review.

5. **mu-review** — Code quality review, requirements coverage check, feedback handling, verification gates, then finishes (merge/PR/keep/discard).

### Orthogonal skills (auto-routed)

- **mu-explore** — Systematic code comprehension for unfamiliar code. Produces a living mental-model artifact.
- **mu-debug** — Systematic root cause analysis (red loop first, 4-phase process with architecture escalation).

### On-demand skills (direct `/slash` invocation only)

- **mu-biz** — Business analysis: validate premise (quick mode) or full analysis (competitive, BMC, VPC, personas, MVP scope). Invoke with `/mu-biz`.
- **mu-prd** — Product requirements: user flows, wireframes, per-feature specs, tiering rules. Invoke with `/mu-prd`.
- **mu-wiki** — Architecture wiki: generates and maintains project-level architecture documentation with Mermaid diagrams and source citations. Invoke with `/mu-wiki generate` or `/mu-wiki update`.
- **mu-retro** — Periodic retrospective: git metrics, review patterns, learnings captured to memory. Invoke with `/mu-retro`.
- **mu-grill** — Relentless plan/design interview until every rework-forcing fork is resolved. Invoke with `/mu-grill`.

These are NOT auto-routed. The user explicitly invokes them when needed.

### Routing

Routing lives in the always-on bootstrap rule: unprefixed messages are classified by intent and repo state — clear intent routes silently, ambiguous intent gets a proposal. Non-dev/product messages are not routed.

### Typical Paths

- **Feature on existing project**: `mu-scope → mu-arch → mu-plan → mu-code → mu-review`
- **Greenfield product**: `/mu-biz` → `/mu-prd` → then feature loop above
- **Bug fix**: `mu-scope (1 UC) → mu-debug → mu-code`

**Sign-off gate**: when `CODEOWNERS` or multi-author git history indicates team-touching work, creative skills (mu-biz / mu-prd / mu-arch) prompt for stakeholder sign-off at artifact exit. Non-blocking — user can always override.

## Architecture

```
devmuse/
├── rules/        Always-on principles (loaded via SessionStart hook)
├── skills/       User-triggered workflows (/mu-xxx)
├── agents/       Independent roles (dispatched by skills)
└── knowledge/    Domain knowledge (injected on demand)
```

### Skills

| Category | Skill | Role |
|----------|-------|------|
| Pipeline | **mu-scope** | Use case elicitation, conflict detection, codebase impact analysis |
| Pipeline | **mu-arch** | Approved scope → technical architecture spec through collaborative dialogue |
| Pipeline | **mu-plan** | Architecture → detailed implementation plan with UC-ID traceability |
| Pipeline | **mu-code** | Plan → implementation (subagent or inline, with TDD and worktree) |
| Pipeline | **mu-review** | Review + verify + integrate (feedback handling, verification gates, coverage check, merge/PR) |
| Orthogonal | **mu-explore** | Code comprehension for unfamiliar code — produces a living mental-model artifact |
| Orthogonal | **mu-debug** | Systematic root cause analysis |
| On-demand | **mu-biz** | Business analysis — premise validation (quick) or full analysis (market, BMC, personas, MVP scope) |
| On-demand | **mu-prd** | Product requirements — user flows, wireframes, feature specs, tiering rules |
| On-demand | **mu-wiki** | Architecture wiki — generates and maintains project-level architecture documentation |
| On-demand | **mu-retro** | Periodic retrospective with git metrics and memory capture |
| On-demand | **mu-grill** | Relentless plan/design interview — resolves every rework-forcing fork before work begins |
| Meta | **mu-write-skill** | Create/edit skills using TDD methodology |

### Agents

| Agent | Role |
|-------|------|
| **mu-reviewer** | Six-mode reviewer: design doc (review-design), implementation plans (review-plan), code quality (review-code), spec compliance (review-compliance), requirements coverage (review-coverage), security (review-security) |
| **mu-coder** | Implementation specialist: builds features from task specs |

### Rules

| Rule | Role |
|------|------|
| **bootstrap** | Skill discovery and invocation rules, priority ordering, decision flow |

### Hooks

| Hook | Trigger | Role |
|------|---------|------|
| **pipeline-gate** | Edit/Write | Enforces scope + design artifact existence before code changes. Exempts plugin self-editing. Fail-open. |
| **destructive-guard** | Bash | Warns before destructive commands (rm -rf, git push -f, DROP TABLE, git reset --hard). Allows known-safe patterns. |

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

## Local Development

Load the plugin directly from a local directory without installation:

```bash
claude --plugin-dir /path/to/devmuse
```

After making changes, reload without restarting:

```
/reload-plugins
```

Optionally add a shell alias for convenience:

```bash
alias claude-dev='claude --plugin-dir /path/to/devmuse'
```

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
