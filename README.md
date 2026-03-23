# Craft Claude

Craft Claude is a complete software development workflow for Claude Code, built on a four-layer architecture of rules, skills, agents, and knowledge.

Based on [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

## How it works

It starts from the moment you fire up Claude Code. As soon as it sees that you're building something, it *doesn't* just jump into trying to write code. Instead, it steps back and asks you what you're really trying to do.

Once it's teased a spec out of the conversation, it shows it to you in chunks short enough to actually read and digest.

After you've signed off on the design, your agent puts together an implementation plan that's clear enough for an enthusiastic junior engineer with poor taste, no judgement, no project context, and an aversion to testing to follow. It emphasizes true red/green TDD, YAGNI (You Aren't Gonna Need It), and DRY.

Next up, once you say "go", it launches a *subagent-driven development* process, having agents work through each engineering task, inspecting and reviewing their work, and continuing forward. It's not uncommon for Claude to be able to work autonomously for a couple hours at a time without deviating from the plan you put together.

## Installation

```bash
/plugin add huiyu/craft-claude
```

### Verify Installation

Start a new session and ask for something that should trigger a skill (for example, "help me plan this feature" or "let's debug this issue"). The agent should automatically invoke the relevant skill.

## The Core Pipeline

```
design → plan → code → review
```

1. **craft-design** — Activates before writing code. Refines rough ideas through questions, explores alternatives, presents design in sections for validation. Dispatches craft-reviewer (Mode A) for spec review.

2. **craft-plan** — Activates with approved design. Breaks work into bite-sized tasks (2-5 minutes each). Every task has exact file paths, complete code, verification steps.

3. **craft-code** — Activates with plan. Sets up isolated worktree, then executes tasks via subagent-driven development (recommended) or inline mode. Enforces TDD discipline (RED-GREEN-REFACTOR). Dispatches craft-coder for implementation and craft-reviewer for two-stage review (spec compliance, then code quality).

4. **craft-review** — Activates when implementation completes. Dispatches craft-reviewer for final review, handles feedback with technical rigor, verifies with fresh evidence, then finishes (merge/PR/keep/discard).

**The agent checks for relevant skills before any task.** Mandatory workflows, not suggestions.

## Architecture

```
craft-claude/
├── rules/        Always-on principles (loaded via SessionStart hook)
├── skills/       User-triggered workflows (/craft-xxx)
├── agents/       Independent roles (dispatched by skills)
└── knowledge/    Domain knowledge (injected on demand)
```

### Skills (6)

| Skill | Role |
|-------|------|
| **craft-design** | Ideas → design spec through collaborative dialogue |
| **craft-plan** | Design → detailed implementation plan |
| **craft-code** | Plan → implementation (subagent or inline, with TDD and worktree) |
| **craft-review** | Review + verify + integrate (feedback handling, verification gates, merge/PR) |
| **craft-debug** | Systematic root cause analysis (independent of pipeline) |
| **craft-write-skill** | Create/edit skills using TDD methodology |

### Agents (2)

| Agent | Role |
|-------|------|
| **craft-reviewer** | Three-mode reviewer: design doc (A), code quality (B), spec compliance (C) |
| **craft-coder** | Implementation specialist: builds features from task specs |

### Rules (1)

| Rule | Role |
|------|------|
| **bootstrap** | Skill discovery and invocation rules, priority ordering, decision flow |

### Knowledge

Reserved for language/framework-specific patterns (Java, Go, Python, TypeScript, React, Flutter, etc.). Created on demand when craft-reviewer needs domain-specific review criteria.

## Philosophy

- **Test-Driven Development** — Write tests first, always
- **Systematic over ad-hoc** — Process over guessing
- **Complexity reduction** — Simplicity as primary goal
- **Evidence over claims** — Verify before declaring success

## Local Development

Load the plugin directly from a local directory without installation:

```bash
claude --plugin-dir /path/to/craft-claude
```

After making changes, reload without restarting:

```
/reload-plugins
```

Optionally add a shell alias for convenience:

```bash
alias claude-dev='claude --plugin-dir /path/to/craft-claude'
```

## Updating

Skills update automatically when you update the plugin:

```bash
/plugin update craft-claude
```

## License

MIT License - see LICENSE file for details

## Credits

- Based on [Superpowers](https://github.com/obra/superpowers) by [Jesse Vincent](https://blog.fsck.com) and [Prime Radiant](https://primeradiant.com)
- Inspired by [Everything Claude Code](https://github.com/affaan-m/everything-claude-code)
