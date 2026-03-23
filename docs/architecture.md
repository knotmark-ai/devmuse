# Architecture

## Four-Layer Architecture

```
craft-claude/
├── rules/        "What must be followed" — always-on principles
├── skills/       "What to do" — user-triggered workflows (/craft-xxx)
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

### rules/ (1 file)

| Name | Role |
|------|------|
| bootstrap.md | Global decision guide: skill usage rules, priority ordering, decision flow |

**Principle:** Rules consume tokens via hook injection. Only put content that must be unconditionally always-on. Anything loadable on-demand via skills should stay in skills.

### skills/ (6)

Core pipeline: `design → plan → code → review`

| Name | Role | Dispatches Agent |
|------|------|------|
| craft-design | Ideas → design spec via collaborative dialogue | craft-reviewer (Mode A) |
| craft-plan | Design → implementation plan | — |
| craft-code | Plan → implementation (subagent or inline, TDD, worktree) | craft-coder, craft-reviewer (Mode B+C) |
| craft-review | Review + verify + integrate | craft-reviewer (Mode B) |

Independent:

| Name | Role | Dispatches Agent |
|------|------|------|
| craft-debug | Systematic root cause analysis | — |

Meta:

| Name | Role | Dispatches Agent |
|------|------|------|
| craft-write-skill | Create/edit skills using TDD methodology | — |

### agents/ (2)

| Name | Role | Dispatched by |
|------|------|---------|
| craft-reviewer | Three-mode reviewer: design doc (A), code quality (B), spec compliance (C) | craft-design, craft-code, craft-review |
| craft-coder | Implementation specialist | craft-code |

**Design decision:** 2 generic agents + knowledge injection, not N language-specific agents. Review logic is 80% universal; change once, effective globally. Adding a new language only requires a knowledge file.

### knowledge/ (empty, reserved)

Created on demand when craft-reviewer needs language/framework-specific review criteria.

```
knowledge/
├── languages/        # java.md, go.md, python.md, typescript.md
└── frameworks/       # spring-boot.md, react.md, flutter.md
```

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
- **skills → skills: chain calls allowed.** e.g. craft-design → craft-plan → craft-code → craft-review.
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
  "version": "0.2.0",
  "agents": [
    "./agents/craft-reviewer.md",
    "./agents/craft-coder.md"
  ],
  "skills": ["./skills/"]
}
```

`hooks/hooks.json` is auto-loaded by convention (Claude Code v2.1+), not declared in plugin.json.
