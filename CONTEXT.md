# DevMuse Domain Language

Shared vocabulary for this repo. Humans and agents use these terms — in code, docs, commits, and conversation. Synonyms under _Avoid_ are deliberately not used. Maintained by `mu-explore` (harvest) and `mu-arch` (coin); see `knowledge/principles/domain-glossary.md` for the qualification test.

## Language

**Opening move**
The first skill the routing rules (bootstrap) select for an unprefixed task — one of Explore (mu-explore), Design-tech (mu-arch), Reproduce (mu-scope 1-UC repro, then mu-debug), or Implement (mu-code).
_Avoid_: entry skill, first step, initial route

**Core pipeline**
The ordered, auto-routed skill chain mu-scope → mu-arch → mu-plan → mu-code → mu-review, where each stage's artifact is the next stage's input.
_Avoid_: main flow, workflow chain

**Orthogonal skill**
An auto-routed skill that runs at any point outside the core pipeline's order (mu-explore, mu-debug).
_Avoid_: side skill, utility skill

**On-demand skill**
A skill that is never auto-routed and runs only via explicit slash invocation (mu-biz, mu-prd, mu-wiki, mu-retro); the routing rules answer matching intents with a pointer, not an invocation.
_Avoid_: slash-only skill, manual skill

**Creative skill**
One of mu-biz, mu-prd, mu-arch — the skills that author a judgment-bearing artifact, run stance detection at Phase 0, and face the sign-off gate at exit.
_Avoid_: authoring skill, artifact skill

**Stance**
The entry mode a creative skill picks at Phase 0 — `create`, `update` (sub-types expand > gap-fill > sync), `extract`, or `skip` — produced by the deterministic detection algorithm in `knowledge/principles/stance-detection.md` and overridable in one word.
_Avoid_: mode, entry state

**HARD-GATE**
A structural, non-negotiable precondition embedded in a skill body (e.g., no design without an approved scope artifact); evaluated before stance detection and never bypassed by a `skip` stance or a sign-off.
_Avoid_: blocker, hard requirement, checkpoint

**Pipeline gate**
The pre-tool-use hook that denies Edit/Write until both a scope artifact and a design spec exist on disk; exempts paths under the plugin root and fails open on script errors.
_Avoid_: write guard, edit hook

**Sign-off gate**
The non-blocking stakeholder-approval protocol a creative skill runs at exit when work is team-touching; always skippable with "skip sign-off" — explicitly not a HARD-GATE.
_Avoid_: approval gate, RFC gate

**Team-touching**
The stakeholder-scope value meaning the artifact affects code others own — detected via CODEOWNERS, ≥3 recent authors on watched dirs, or explicit user declaration — and the sole trigger of the sign-off gate.
_Avoid_: shared-code, multi-owner (as scope labels)

**Use Case Set**
The approved list of use cases (UC-1, UC-2, …) produced by mu-scope; UC-IDs propagate through design, plan tasks, code, and tests, and are what coverage review audits against.
_Avoid_: requirements list, feature list

**Quick Probe**
mu-scope's automatic ~30-second codebase impact scan, run before use-case enumeration to ground the depth recommendation.
_Avoid_: impact scan, pre-scan

**Living artifact**
A document with no date in its filename, updated in place with a History row appended per revision (explore artifacts, wiki, this file) — as opposed to the dated snapshots under `docs/scope|specs|plans`.
_Avoid_: evergreen doc

**Anchor**
A verbatim identifier (UC-ID, task number, file path, component name) that mu-reviewer must extract from the reviewed artifact and cite in every finding; findings without anchors are treated as hallucinations and deleted.
_Avoid_: citation, reference, evidence

**Cross-review**
The optional mu-review step that dispatches the OpenAI Codex CLI for a second opinion from a different model family; entirely invisible when `codex` is not installed.
_Avoid_: second review, external review

**Task transition**
A user message whose intent shifts skill category mid-conversation (debug→fix, explore→implement), requiring re-classification by the routing rules — versus a continuation, which stays inside the active skill.
_Avoid_: context switch

**Guidance over control**
The DevMuse philosophy that detection, routing, and gates produce recommendations the user can override in one word; every path is non-blocking except HARD-GATEs.
_Avoid_: soft enforcement

**Skill CSO**
Claude Search Optimization — writing a skill's `description` frontmatter purely as triggering conditions ("Use when…"), never as a workflow summary, so future Claude finds the skill and reads its body instead of shortcutting from the description.
_Avoid_: skill SEO, discoverability tuning

## Relationships

- The core pipeline is ordered; the pipeline gate enforces it mechanically (hook), HARD-GATEs enforce it textually (skill body).
- UC-IDs from the Use Case Set are the anchors that review-coverage audits across design, plan, code, and tests.
- mu-reviewer runs exactly one of six modes per dispatch: review-design, review-plan, review-code, review-compliance, review-coverage, review-security.
- HARD-GATEs are evaluated before stance detection; a `skip` stance passes through the artifact work and the sign-off gate, but never a HARD-GATE.
- Opening moves map to skills: Explore → mu-explore, Design-tech → mu-arch, Reproduce → mu-scope (1-UC repro) + mu-debug, Implement → mu-code.

## Flagged Ambiguities

- "UC" vs exploration variants — **resolved 2026-07-13** (grill session): "UC" belongs exclusively to mu-scope's Use Case; mu-explore's five exploration types are called **variant** (renamed throughout mu-explore's SKILL.md; template and downstream skills already used "variant").
- "gate" unqualified — **resolved 2026-07-13** (grill session): never use "gate" bare; always qualify (HARD-GATE / pipeline gate / sign-off gate / size-area gate). No renames needed — the four compound names are already mutually exclusive.
- "mu-design" vs "mu-arch" — **resolved 2026-04-14**: renamed to mu-arch (`108f3f6`; hook straggler fixed in `304043d`). Dated plan snapshots under `docs/plans/` retain the old name as historical records.
