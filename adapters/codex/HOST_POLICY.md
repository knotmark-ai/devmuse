# Codex host policy

DevMuse augments Codex; it does not replace the host's normal agent loop.

- Use native `/plan` for ordinary multi-step planning. Invoke `$mu-plan` only when an approved architecture needs a durable, UC-traceable plan artifact.
- Use native `/review` for routine working-tree or branch review. Invoke `$mu-review` for requirements coverage, security, or an explicitly authorized review-and-fix loop.
- Let Codex implement and verify ordinary work normally. Allow `$mu-code` to take over automatically only when the user asks to execute a mu-scope `bounded execution` contract or an approved DevMuse implementation plan.
- mu-scope, mu-arch, and mu-debug may invoke when their descriptions match. mu-code additionally requires its execution-request and contract gate. All other DevMuse skills require explicit `$mu-*` invocation.
- Never force a direct or bounded task through the full scope → architecture → plan → code → review pipeline. Upgrade ceremony only when evidence exposes architectural risk or unresolved decisions.
- Keep exact operational bindings Direct under the canonical bootstrap criteria: a public hostname or provider boundary alone does not justify the full pipeline. Destructive DNS changes and policy changes still upgrade through mu-scope.
- Keep Codex sandbox, approval, and administrator policy authoritative. Do not emulate the Claude destructive-command `ask` hook: Codex `PreToolUse` can deny, but it cannot currently request approval.
