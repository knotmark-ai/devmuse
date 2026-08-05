# Codex host policy

DevMuse augments Codex; it does not replace the host's normal agent loop.

- Use native `/plan` for ordinary multi-step planning. Invoke `$mu-plan` only when an approved architecture needs a durable, UC-traceable plan artifact.
- Use native `/review` for routine working-tree or branch review. Invoke `$mu-review` for requirements coverage, security, or an explicitly authorized review-and-fix loop.
- Let Codex implement and verify direct or bounded work normally. Invoke `$mu-code` only after a DevMuse scope, architecture, or plan establishes a contract worth preserving.
- Only mu-scope, mu-arch, and mu-debug allow implicit invocation. All other DevMuse skills require explicit `$mu-*` invocation.
- Never force a direct or bounded task through the full scope → architecture → plan → code → review pipeline. Upgrade ceremony only when evidence exposes architectural risk or unresolved decisions.
