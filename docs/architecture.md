# Architecture

## Four-Layer Architecture

```
devmuse/
├── rules/        "What must be followed" — always-on principles
├── skills/       "What to do" — user-triggered workflows (/mu-xxx)
├── agents/       "Who does it" — independent roles dispatched by skills
└── knowledge/    "How to do it" — domain knowledge injected on demand
```

## Layer Classification

| Question | Answer | Layer |
|------|------|--------|
| Always active, no user trigger needed? | Yes | rules/ |
| User invokes with `/xxx`? | Yes | skills/ |
| Independent role, needs context isolation? | Yes | agents/ |
| Reference material, loaded on demand? | Yes | knowledge/ |

### knowledge/ — refined criteria

| Case | Location | Reason |
|------|--------|------|
| Used by only one skill | Stay in skill directory | Locality first |
| Injected into agents across scenarios | knowledge/ | Cross-role reuse |
| Language/framework specific patterns | knowledge/ | Same agent, different tech stacks |
| Thinking rubrics for decision points | knowledge/principles/ | Cross-skill reuse at design/scope time |
| Review checklists for specific concerns | knowledge/reviews/ | Cross-mode reuse within mu-reviewer |

---

## Loading Mechanism

All four layers work through plugin installation (`claude plugin add`), no manual setup required.

| Directory | Plugin auto-discovery | Mechanism |
|-----------|-------------|------|
| skills/ | ✅ | plugin.json declares, Claude Code discovers SKILL.md |
| agents/ | ✅ | plugin.json lists each agent file explicitly |
| hooks/hooks.json | ✅ | Convention-based auto-load (not declared in plugin.json) |
| knowledge/ | ❌ | Not auto-discovered; referenced via `@` relative paths |
| rules/ | ❌ | Not natively supported; loaded via SessionStart hook |

### rules/ loading

```
hooks/
├── hooks.json       # Declares SessionStart hook
└── session-start    # Script: reads rules/ → JSON output → injects into session context
```

The `session-start` script reads `rules/bootstrap.md` and injects it via `hookSpecificOutput.additionalContext` into every session.

### knowledge/ referencing

Skills and agents reference knowledge via `@` relative paths within the plugin:

```markdown
# In a skill SKILL.md:
@../../knowledge/languages/java.md
```

`@` relative paths work across directories within the plugin (the entire plugin is copied to cache on install).

---

## Content

### rules/

| Name | Role |
|------|------|
| bootstrap.md | Global decision guide: skill usage rules, priority ordering, decision flow |

**Principle:** Rules consume tokens via hook injection. Only put content that must be unconditionally always-on. Anything loadable on-demand via skills should stay in skills.

### skills/

The **canonical skill inventory** (categories and roles) lives in the [README's Skills table](../README.md#skills) — this file does not repeat it. Recorded here is only what's architectural: which skills dispatch agents.

| Skill | Dispatches |
|-------|-----------|
| mu-arch | mu-reviewer (review-design) |
| mu-plan | mu-reviewer (review-plan) |
| mu-code | mu-coder; mu-reviewer (review-code + review-compliance) |
| mu-review | mu-reviewer (review-code + review-coverage + review-security) |

All other skills dispatch no agents.

### agents/

| Name | Role | Dispatched by |
|------|------|---------|
| mu-reviewer | Six-mode reviewer: design doc (review-design), implementation plans (review-plan), code quality (review-code), spec compliance (review-compliance), requirements coverage (review-coverage), security (review-security) | mu-arch, mu-plan, mu-code, mu-review |
| mu-coder | Implementation specialist | mu-code |

**Design decision:** 2 generic agents + knowledge injection, not N language-specific agents. Review logic is 80% universal; change once, effective globally. Adding a new language only requires a knowledge file.

### knowledge/

| Category | Purpose | Referenced by |
|---|---|---|
| languages/ | Language-specific review criteria | mu-reviewer (review-code) |
| templates/ | Artifact templates | mu-scope, mu-explore, mu-arch, mu-wiki |
| principles/ | Thinking rubrics for decision points | mu-arch, mu-scope, mu-biz, mu-prd (stance-detection.md consumed at Phase 0 of each creative skill) |
| reviews/ | Review checklists for specific concerns | mu-reviewer (review-security, review-design) |
| schemas/ | Structured output schemas for external tool invocation | mu-review (codex cross-review) |

Each file opens with a **"When to use"** header naming its consuming skills — the directory itself is the current inventory (file-level lists are not repeated here; they drift).

> **Future expansion:** A `knowledge/frameworks/` subdirectory (e.g., spring-boot.md, react.md, flutter.md) can be added when framework-specific review criteria are needed. Not currently populated.

---

## Inter-Layer Relations

### Call Direction Matrix

| Caller → Callee | rules | skills | agents | knowledge |
|-------------------|-------|--------|--------|-----------|
| **rules** | — | guides invocation | ✗ | @ref |
| **skills** | constrained | chain calls | dispatch | @ref |
| **agents** | constrained | **✗ forbidden** | nested dispatch | @ref |
| **knowledge** | — | — | — | — |

### Key Constraints

- **skills → agents: one-way dispatch.** Skills orchestrate, agents execute.
- **agents → skills: forbidden.** Agents don't trigger user-level workflows.
- **skills → skills: chain calls allowed.** e.g. mu-biz → mu-prd → mu-scope → mu-arch → mu-plan → mu-code → mu-review.
- **rules guide but don't call.** bootstrap.md tells Claude when to invoke which skill.
- **knowledge is passive.** Only referenced, never calls anything.

### Dependency Direction

**Strictly downward, no upward callbacks.**

```
rules ──constrain──→ all layers
  │
  └──guide──→ skills ──dispatch──→ agents
               │                     │
               │                     └──@──→ knowledge
               └──@──→ knowledge
```

---

## plugin.json

```json
{
  "agents": [
    "./agents/mu-reviewer.md",
    "./agents/mu-coder.md"
  ],
  "skills": ["./skills/"]
}
```

(Version field omitted here — see `.claude-plugin/plugin.json` for the current release.)

`hooks/hooks.json` is auto-loaded by convention (Claude Code v2.1+), not declared in plugin.json.
