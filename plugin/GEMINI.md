# DevMuse on Gemini CLI

DevMuse augments Gemini CLI; it does not replace the host's normal agent loop.

- Use native Plan Mode for ordinary multi-step planning. Use `mu-plan` only when an approved architecture needs a durable, UC-traceable plan artifact.
- Use the host's normal validation and review loop for routine changes. Use `mu-review` for requirements coverage, security, or an explicitly authorized review-and-fix loop.
- Automatically activate `mu-scope`, `mu-arch`, or `mu-debug` when their descriptions clearly match. `mu-code` may also activate when the user asks to execute a mu-scope `bounded execution` contract or an approved DevMuse plan. The remaining `mu-*` skills are explicit, on-demand tools.
- Direct and bounded work stays direct or bounded. Do not force every task through scope, architecture, plan, code, and review.
- Treat DevMuse references as relative to the extension root. If a host-specific mechanism named by a skill is unavailable, use the closest native Gemini capability and preserve the skill's intended outcome.
- Keep Gemini's policy engine and approval mode authoritative. Do not reinterpret the Claude destructive-command hook or install approval policy on the user's behalf.
