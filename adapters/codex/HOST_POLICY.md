# Codex host policy

DevMuse augments Codex; it does not replace the host's normal agent loop.

- Use native `/plan` for ordinary multi-step planning. Invoke `$mu-plan` only when an approved architecture needs a durable, UC-traceable plan artifact.
- Use native `/review` for routine working-tree or branch review. Invoke `$mu-review` for requirements coverage, security, or an explicitly authorized review-and-fix loop.
- Let Codex implement and verify ordinary work normally. Allow `$mu-code` to take over automatically only when the user asks to execute a mu-scope `bounded execution` contract or an approved DevMuse implementation plan.
- mu-scope, mu-arch, and mu-debug may invoke when their descriptions match. mu-code additionally requires its execution-request and contract gate. All other DevMuse skills require explicit `$mu-*` invocation.
- Never force a direct or bounded task through the full scope → architecture → plan → code → review pipeline. Upgrade ceremony only when evidence exposes architectural risk or unresolved decisions.
- Keep exact operational bindings Direct under the canonical bootstrap criteria: a public hostname or provider boundary alone does not justify the full pipeline. Destructive DNS changes and policy changes still upgrade through mu-scope.
- GitHub-first coordination uses Issues and Draft PRs only after a fresh host-native capability and approval check for the exact operation. Read each skill's vendored project-context contract and runtime; cached discovery is never authority to mutate GitHub.
- Codex has no Claude SessionStart hook dependency. Resolve context when the workflow needs it and keep native GitHub tools, sandbox, approval, and administrator policy authoritative. Do not emulate the Claude destructive-command `ask` hook: Codex `PreToolUse` can deny, but it cannot currently request approval.

## Optional: concurrent subagent dispatch (opt-in)

This section is opt-in and suggestion-only. Its dispatch decision logic (eligible / ineligible / user-declined) is behaviorally tested via a model reasoning proxy (`test:codex-dispatch`); full execution on the Codex host itself is not guaranteed and it claims no parity with the Claude adapter's fan-out. It only points out where DevMuse work decomposes and never overrides the host's manager — the manager and the user decide whether to spawn workers.

- Codex subagents (GA) run a small fixed number concurrently under a manager/worker model with git-worktree isolation and explorer/worker roles; `agents.max_concurrent_threads_per_session` in `config.toml` bounds them. (`agents.max_threads` is legacy, and there is no current official `max_depth` or `spawn_agents_on_csv` — do not rely on them.)
- When a DevMuse skill yields independent units of work, you may run them as parallel workers instead of serially. Each eligible skill also carries this pointer in its own body (generated from this same source), so the guidance travels with the skill even when this file is not loaded:
  - `$mu-code` executing an approved plan: architectural tasks with no shared-file contention and no producer/consumer interface between them are worker candidates; keep tasks that touch the same files or exchange a named output on one thread, in dependency order.
  - `$mu-review` requirements-coverage, security, and code-quality passes are independent lenses over the same diff — dispatch them as parallel workers, then merge findings on the manager.
  - `$mu-scope` independent probes of separate subsystems may fan out; synthesis stays on the manager.
- Prefer worktree isolation whenever workers mutate files; never let workers share one working tree for write work.
- This is a suggestion layer only. A conservative host manager is authoritative — do not force concurrency, and do not treat this guidance as a tested default.
