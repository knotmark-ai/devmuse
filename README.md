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

## The Core Pipeline

```
scope → design → plan → code → review
```

1. **mu-scope** — Activates before design. Scans the codebase for impact (Quick Probe), enumerates use cases (happy paths, edge cases, error cases), detects conflicts between use cases, and produces a Use Case Set. Depth adapts to complexity — a bug fix gets 1 use case, a new feature gets full enumeration.

2. **mu-design** — Activates with approved scope. Focuses on technical design only (not "what to build" — that's in the scope). Proposes 2-3 approaches, presents design in sections for validation. Dispatches mu-reviewer (review-design) for spec review.

3. **mu-plan** — Activates with approved design. Breaks work into bite-sized tasks (2-5 minutes each). Every task has exact file paths, complete code, verification steps, and UC-ID traceability.

4. **mu-code** — Activates with plan. Sets up isolated worktree, then executes tasks via subagent-driven development (recommended) or inline mode. Enforces TDD discipline (RED-GREEN-REFACTOR). Tests carry UC-ID annotations for traceability. Dispatches mu-coder for implementation and mu-reviewer for two-stage review (review-compliance, then review-code).

5. **mu-review** — Activates when implementation completes. Dispatches mu-reviewer for code quality review and requirements coverage check (review-coverage), handles feedback with technical rigor, verifies with fresh evidence, then finishes (merge/PR/keep/discard).

**Pipeline-external skills** (independent of the main pipeline, like mu-debug):

- **mu-premise** — Validates the premise before scoping. Invoked standalone or inlined by mu-scope.
- **mu-retro** — Periodic retrospective gathering git metrics and capturing learnings to memory.

**The agent checks for relevant skills before any task.** Mandatory workflows, not suggestions.

## Architecture

```
devmuse/
├── rules/        Always-on principles (loaded via SessionStart hook)
├── skills/       User-triggered workflows (/mu-xxx)
├── agents/       Independent roles (dispatched by skills)
└── knowledge/    Domain knowledge (injected on demand)
```

### Skills (9)

| Skill | Role |
|-------|------|
| **mu-scope** | Use case elicitation, conflict detection, codebase impact analysis |
| **mu-design** | Approved scope → technical design spec through collaborative dialogue |
| **mu-plan** | Design → detailed implementation plan with UC-ID traceability |
| **mu-code** | Plan → implementation (subagent or inline, with TDD and worktree) |
| **mu-review** | Review + verify + integrate (feedback handling, verification gates, coverage check, merge/PR) |
| **mu-debug** | Systematic root cause analysis (independent of pipeline) |
| **mu-premise** | Premise validation — forcing questions before scoping |
| **mu-retro** | Periodic retrospective with git metrics and memory capture |
| **mu-write-skill** | Create/edit skills using TDD methodology |

### Agents (2)

| Agent | Role |
|-------|------|
| **mu-reviewer** | Five-mode reviewer: design doc (review-design), code quality (review-code), spec compliance (review-compliance), requirements coverage (review-coverage), security (review-security) |
| **mu-coder** | Implementation specialist: builds features from task specs |

### Rules (1)

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
| **principles/** | Thinking rubrics: inversion reflex (failure mode analysis), premise check (forcing questions) |
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
