# Craft Claude

Craft Claude is a complete software development workflow for Claude Code, built on top of a set of composable "skills" and a bootstrap that makes sure your agent uses them.

Based on [Superpowers](https://github.com/obra/superpowers) by Jesse Vincent.

## How it works

It starts from the moment you fire up Claude Code. As soon as it sees that you're building something, it *doesn't* just jump into trying to write code. Instead, it steps back and asks you what you're really trying to do.

Once it's teased a spec out of the conversation, it shows it to you in chunks short enough to actually read and digest.

After you've signed off on the design, your agent puts together an implementation plan that's clear enough for an enthusiastic junior engineer with poor taste, no judgement, no project context, and an aversion to testing to follow. It emphasizes true red/green TDD, YAGNI (You Aren't Gonna Need It), and DRY.

Next up, once you say "go", it launches a *subagent-driven-development* process, having agents work through each engineering task, inspecting and reviewing their work, and continuing forward. It's not uncommon for Claude to be able to work autonomously for a couple hours at a time without deviating from the plan you put together.

## Installation

### Claude Code (via Plugin Marketplace)

Register the marketplace first:

```bash
/plugin marketplace add huiyu/craft-claude-marketplace
```

Then install the plugin:

```bash
/plugin install craft-claude@craft-claude-marketplace
```

### Verify Installation

Start a new session and ask for something that should trigger a skill (for example, "help me plan this feature" or "let's debug this issue"). The agent should automatically invoke the relevant skill.

## The Basic Workflow

1. **craft-brainstorm** - Activates before writing code. Refines rough ideas through questions, explores alternatives, presents design in sections for validation.

2. **craft-worktree** - Activates after design approval. Creates isolated workspace on new branch, runs project setup, verifies clean test baseline.

3. **craft-plan** - Activates with approved design. Breaks work into bite-sized tasks (2-5 minutes each). Every task has exact file paths, complete code, verification steps.

4. **craft-sdd** or **craft-execute** - Activates with plan. Dispatches fresh subagent per task with two-stage review (spec compliance, then code quality), or executes in batches with human checkpoints.

5. **craft-tdd** - Activates during implementation. Enforces RED-GREEN-REFACTOR: write failing test, watch it fail, write minimal code, watch it pass, commit.

6. **craft-review** - Activates between tasks. Reviews against plan, reports issues by severity. Critical issues block progress.

7. **craft-finish** - Activates when tasks complete. Verifies tests, presents options (merge/PR/keep/discard), cleans up worktree.

**The agent checks for relevant skills before any task.** Mandatory workflows, not suggestions.

## What's Inside

### Skills Library

**Testing**
- **craft-tdd** - RED-GREEN-REFACTOR cycle (includes testing anti-patterns reference)

**Debugging**
- **craft-debug** - 4-phase root cause process (includes root-cause-tracing, defense-in-depth, condition-based-waiting techniques)
- **craft-verify** - Ensure it's actually fixed

**Collaboration**
- **craft-brainstorm** - Socratic design refinement
- **craft-plan** - Detailed implementation plans
- **craft-execute** - Batch execution with checkpoints
- **craft-parallel** - Concurrent subagent workflows
- **craft-review** - Pre-review checklist
- **craft-review-response** - Responding to feedback
- **craft-worktree** - Parallel development branches
- **craft-finish** - Merge/PR decision workflow
- **craft-sdd** - Fast iteration with two-stage review (spec compliance, then code quality)

**Meta**
- **craft-write-skill** - Create new skills following best practices (includes testing methodology)

## Philosophy

- **Test-Driven Development** - Write tests first, always
- **Systematic over ad-hoc** - Process over guessing
- **Complexity reduction** - Simplicity as primary goal
- **Evidence over claims** - Verify before declaring success

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
