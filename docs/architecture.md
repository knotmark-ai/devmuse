# Architecture

## Four-Layer Architecture

```
devmuse/
├── plugin/           Canonical Claude/OpenClaw/Gemini runtime
│   ├── rules/            "What must be followed" — always-on principles
│   ├── skills/           "What to do" — canonical workflows (/mu-xxx)
│   ├── agents/           "Who does it" — independent roles dispatched by skills
│   └── knowledge/        "How to do it" — domain knowledge injected on demand
├── adapters/codex/   Generated Codex + portable Agent Skills bundle
├── plugin.yaml       Hermes manifest
└── __init__.py       Hermes namespaced skill registration
```

Layer paths below are relative to `plugin/`. `plugin/skills/` is the workflow
source of truth. The Codex adapter vendors each skill's external knowledge and
agent dependencies so copied Agent Skills remain self-contained. Platform
installation boundaries and whether repository docs are fetched are detailed in
[Platform support](platform-support.md).

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

## Claude loading mechanism

All four layers work through the Claude marketplace installation, with no manual setup required.

| Directory | Plugin auto-discovery | Mechanism |
|-----------|-------------|------|
| skills/ | ✅ | Standard plugin-root directory; Claude Code discovers SKILL.md |
| agents/ | ✅ | Standard plugin-root directory; Claude Code discovers agent files |
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

## Other host adapters

| Host | Adapter behavior |
|---|---|
| Codex / ChatGPT Work | `scripts/build-platform-adapters.mjs` generates a strict `.codex-plugin` package, self-contained skill references, and per-skill `agents/openai.yaml`. Scope, architecture, and debug are description-gated; code additionally requires an execution request and recognized DevMuse contract. |
| OpenClaw | Installs the Claude or Codex directory as a compatible content bundle. Skills run; Claude agents and `hooks/hooks.json` are detect-only. |
| Hermes Agent | Root `plugin.yaml` + `__init__.py` register source skills under the explicit `devmuse:` namespace. |
| Gemini CLI | `plugin/gemini-extension.json` discovers source skills; the small `GEMINI.md` coordinates activation with native Plan Mode and validation. |
| Generic Agent Skills hosts | Install generated skills from `adapters/codex/skills/`; each contains its own referenced support files. |

The adapter boundary is deliberate: workflow content is shared, while invocation,
subagent, hook, memory, and safety semantics remain host-native.

---

## Content

### rules/

| Name | Role |
|------|------|
| bootstrap.md | Global decision guide: skill usage rules, priority ordering, decision flow |

**Principle:** Rules consume tokens via hook injection. Only put content that must be unconditionally always-on. Anything loadable on-demand via skills should stay in skills.

### skills/

The **canonical skill inventory** (categories and roles) lives in the [README's Skills table](../README.md#skills) — this file does not repeat it. Recorded here is only what's architectural: which skills dispatch DevMuse agent files.

| Skill | Dispatches |
|-------|-----------|
| mu-arch | mu-reviewer (review-design) |
| mu-plan | mu-reviewer (review-plan) |
| mu-code | mu-coder |
| mu-review | mu-reviewer (review-code + review-coverage + review-security) |

Other skills dispatch no DevMuse agent files. `mu-wiki` may use platform
read-only/general subagents to partition wiki generation; those are execution
mechanisms, not additional DevMuse roles.

### agents/

| Name | Role | Dispatched by |
|------|------|---------|
| mu-reviewer | Five-mode reviewer: design doc (review-design), implementation plans (review-plan), code quality (review-code), requirements coverage (review-coverage), security (review-security) | mu-arch, mu-plan, mu-review |
| mu-coder | Implementation specialist | mu-code |

**Design decision:** 2 generic agents + knowledge injection, not N language-specific agents. Review logic is 80% universal; change once, effective globally. Adding a new language only requires a knowledge file.

### knowledge/

| Category | Purpose | Referenced by |
|---|---|---|
| languages/ | Language-specific review criteria | mu-reviewer (review-code) |
| templates/ | Artifact templates | mu-scope, mu-arch, mu-wiki |
| principles/ | Thinking rubrics for decision points | mu-arch, mu-scope, mu-mrd, mu-prd (stance-detection.md consumed at Phase 0 of each creative skill) |
| reviews/ | Review checklists for specific concerns | mu-reviewer (review-security, review-design) |

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
- **skills → skills: handoffs are declared in bootstrap's Pipeline Graph.** A skill announces completion; the graph names the successor (e.g. mu-mrd → mu-prd → mu-scope → mu-arch → mu-plan → mu-code → mu-review).
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
  "name": "devmuse"
}
```

(Version field omitted here — see `plugin/.claude-plugin/plugin.json` for the current release.)

Skills, agents, and `hooks/hooks.json` are auto-loaded from their standard
plugin-root locations, so the manifest contains metadata rather than a second
component inventory that can drift.
