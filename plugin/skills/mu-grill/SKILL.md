---
name: mu-grill
description: "Stress-test a plan, design, or idea by relentless interview — one question at a time until every rework-forcing fork is resolved."
disable-model-invocation: true
---

# Grill

Interview the user relentlessly about the target until shared understanding, per the discipline at `@../../knowledge/principles/grilling.md`.

Standalone usage:

1. **Target** — whatever the user points at: the plan under discussion, a file they name, a diff. If ambiguous, ask which.
2. **Open with the highest fork** — the decision whose wrong guess would invalidate the most downstream work — then walk the tree in dependency order.
3. **At exit, summarize:** decisions made (and by whom), assumptions recorded, forks the user deferred. If a relevant artifact exists (scope, spec, PRD), offer to write the summary into it.
