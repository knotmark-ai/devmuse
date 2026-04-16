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

### rules/ (1 file)

| Name | Role |
|------|------|
| bootstrap.md | Global decision guide: skill usage rules, priority ordering, decision flow |

**Principle:** Rules consume tokens via hook injection. Only put content that must be unconditionally always-on. Anything loadable on-demand via skills should stay in skills.

### skills/ (12)

Organized in three tiers:

**Product-level tier** (runs once per product):

| Name | Role | Dispatches Agent |
|------|------|------|
| mu-biz | Business analysis — premise validation (quick) or full analysis (market, BMC, VPC, personas, MVP scope) | — |
| mu-prd | Product requirements — user flows, wireframes, feature specs, tiering rules | — |

**Feature-level tier** — core pipeline `scope → arch → plan → code → review`:

| Name | Role | Dispatches Agent |
|------|------|------|
| mu-scope | Use cases + conflict detection + impact analysis | — |
| mu-arch | Scope → technical architecture spec via collaborative dialogue | mu-reviewer (review-design) |
| mu-plan | Architecture → implementation plan | — |
| mu-code | Plan → implementation (subagent or inline, TDD, worktree) | mu-coder, mu-reviewer (review-code + review-compliance) |
| mu-review | Review + verify + integrate | mu-reviewer (review-code + review-coverage + review-security) |

**Orthogonal tier** (pipeline-external):

| Name | Role | Dispatches Agent |
|------|------|------|
| mu-explore | Systematic code-comprehension — produces living mental-model artifact for unfamiliar code | — |
| mu-debug | Systematic root cause analysis | — |
| mu-retro | Periodic retrospective with git metrics and memory capture | — |

**Router:**

| Name | Role | Dispatches Agent |
|------|------|------|
| mu-route | Pattern-matching router — proposes one of 7 routable opening moves for unprefixed user messages; bypassed by /mu-<skill> slash hints | — |

**Meta:**

| Name | Role | Dispatches Agent |
|------|------|------|
| mu-write-skill | Create/edit skills using TDD methodology | — |

### agents/ (2)

| Name | Role | Dispatched by |
|------|------|---------|
| mu-reviewer | Six-mode reviewer: design doc (review-design), implementation plans (review-plan), code quality (review-code), spec compliance (review-compliance), requirements coverage (review-coverage), security (review-security) | mu-scope, mu-arch, mu-plan, mu-code, mu-review |
| mu-coder | Implementation specialist | mu-code |

**Design decision:** 2 generic agents + knowledge injection, not N language-specific agents. Review logic is 80% universal; change once, effective globally. Adding a new language only requires a knowledge file.

### knowledge/

| Category | Purpose | Referenced by |
|---|---|---|
| languages/ | Language-specific review criteria | mu-reviewer (review-code) |
| templates/ | Artifact templates | mu-scope, mu-explore |
| principles/ | Thinking rubrics for decision points | mu-arch, mu-scope, mu-biz, mu-prd (stance-detection.md consumed at Phase 0 of each creative skill) |
| reviews/ | Review checklists for specific concerns | mu-reviewer (review-security, review-design) |

```
knowledge/
├── languages/
│   ├── typescript.md   # Type safety, async patterns, common pitfalls
│   ├── python.md       # Type hints, pythonic patterns, security
│   ├── go.md           # Error handling, concurrency, interface design
│   └── java.md         # Null handling, concurrency, resource management
├── templates/
│   ├── scope.md        # Use Case Set template for mu-scope
│   └── explore.md      # Mental-model artifact template for mu-explore
├── principles/         # Thinking rubrics loaded at decision points
│   ├── architecture-assessment.md # C4 model guide + diagram type selection
│   ├── chestertons-fence.md # Understand before changing/removing code
│   ├── graphviz-conventions.md # When/how to use digraphs in skills
│   ├── inversion.md    # Inversion reflex for approach comparison
│   ├── premise-check.md # Premise validation forcing questions
│   ├── skill-cso.md    # Claude Search Optimization for skill descriptions
│   ├── skill-testing.md # Per-type test strategies + pressure scenarios
│   ├── stance-detection.md # Stance detection for mu-biz/mu-prd/mu-arch Phase 0
│   └── sign-off-gate.md # Sign-off protocol when stakeholder-scope = team-touching
└── reviews/            # Review checklists for specific concerns
    ├── security-checklist.md  # 5-phase security audit
    └── design-audit-rubric.md # Architecture audit rubric
```

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
  "version": "0.2.0",
  "agents": [
    "./agents/mu-reviewer.md",
    "./agents/mu-coder.md"
  ],
  "skills": ["./skills/"]
}
```

`hooks/hooks.json` is auto-loaded by convention (Claude Code v2.1+), not declared in plugin.json.
