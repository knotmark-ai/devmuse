---
name: mu-model
description: "Build or maintain the project's domain model in CONTEXT.md — concepts, archetypes, the spine, and who produces what."
disable-model-invocation: true
---

# Domain Modeling

> **Validation status — `create` is unproven.** The `update` and `sync` paths were derived from two real runs (aflaj restructure, devmuse rebuild). The `create` path is reasoned from Event Modeling and Four-Color archetypes and has **never been run on a project starting from zero**. Report what breaks: https://github.com/knotmark-ai/devmuse/issues/47

**Scope:** the concept structure a project is built on — what exists, what has a lifecycle, what depends on what, who produces and maintains each thing. Runs **before** PRD and design work. For product requirements use **mu-prd** after this; for technical architecture use **mu-arch**.

Produces the domain model at repo-root `CONTEXT.md` per @../../knowledge/principles/domain-model.md, using @../../knowledge/templates/context-md.md.

<HARD-GATE>
Do NOT hand off to mu-prd, mu-arch, or any downstream skill until the model is written to `CONTEXT.md` and the user has approved it. A model agreed in conversation but not persisted is not a model — the next session starts from zero.
</HARD-GATE>

## Why this exists

A project that skips this derives its concept structure inside the PRD, the design spec, and the research plan **separately** — three structures that agree until the first hard question, then diverge. The repair is not incremental: it invalidates whatever was built on the wrong abstraction.

The symptom that this pass was skipped: the team is deep into feature specs and someone says *"we should go back and sort out what these words actually mean."*

## Phase 0: Stance Detection

1. Read `@../../knowledge/principles/stance-detection.md`
2. Run the detection algorithm with:
   - **Artifact type**: `model`
   - **Artifact path**: repo-root `CONTEXT.md`
   - **Watched source dirs**: `src/`, `lib/`, `app/` (whichever exist); plus `docs/prd/` and `docs/specs/` — a downstream artifact carrying a state machine or an invariant means the model is behind
   - **Legacy locations**: `GLOSSARY.md`, `docs/glossary.md`, `docs/domain.md`
3. Apply the Shared Consumption Protocol, then route:

| Stance | Action | Proven? |
|---|---|---|
| `create` | No `CONTEXT.md` — run the full Process below | ❌ **unproven** |
| `update` | Model exists, new concepts or lifecycle changes to fold in — run steps 2–7 on the delta only | ✅ |
| `sync` | Model exists but a downstream artifact holds domain facts (state machine in a PRD, invariant in a spec) — **move the fact up, leave a reference down**, one History row per move | ✅ |
| `skip` | Model exists and this task does not touch it — append a History pass-through row, hand off | — |

**Commit prefix:** `docs(context): <stance>: ...`

## Process

Seven steps, producing the seven sections. Approve each before the next — a wrong archetype in step 2 invalidates step 3.

### 1. Worked example (→ §2)

One real, specific case: a named person, building a named thing, on a named stack. **Every concept later gets validated against it — a concept that cannot be located in the example is a broken concept.** Fictional-but-plausible beats abstract; abstract examples validate nothing because anything fits them.

Also seed §1: if `docs/mrd/` or `docs/brief/` exists, the product's differentiating claims are the principle candidates. If not, leave §1 empty and fill it in step 6.

### 2. Time axis, then archetypes (→ §4 time axis, §3 archetype column)

**Ask "what changes, and when?" — not "what concepts are there?"** Concept-first questioning yields a noun list; change-first questioning yields the lifecycles, and the nouns fall out of them.

Walk the worked example as a sequence of state changes: who triggers it, what moves from what to what. Every noun that surfaces gets tagged:

| Archetype | Test |
|---|---|
| **Moment** | Has a lifecycle; states migrate over time |
| **Role** | A party that acts |
| **Thing** | A party, place, or object that is acted on |
| **Description** | A type-level definition — no lifecycle of its own |
| **Derived** | Computed at read time; not an object |

Apply @../../knowledge/principles/grilling.md — one question per message with a recommendation, facts self-served, every fork converged.

### 3. Derive the spine (→ §4)

```
1. List the Moments
2. Count how many other concepts depend on each
3. Highest = candidate
4. Verify: can the whole product be told as "the life of X"?
```

**If no candidate survives step 4, say so in §4 and organize by data flow instead.** A stateless or pure-transformation domain has no spine; inventing one is worse than declaring there is none.

Write the derivation into §4, not just the conclusion — whoever changes the model next has to re-run it.

### 4. Verbalize and constrain (→ §6)

Per concept: one sentence of definition, one line of what it is **in the worked example**, and at least one constraint that must hold ("a Connection belongs to exactly one Customer at any instant"). Borrowed industry terms owe one line on how this project's meaning differs from the common one.

State machines go here too — build them per @../../knowledge/principles/state-modeling.md; this file is their home.

A concept you cannot verbalize as a fact plus a concrete example is not yet understood. Do not write it down as a placeholder — put the gap to the user.

### 5. Ownership and boundaries (→ §3)

Per concept: **who produces it, who maintains it**. This table is the highest-leverage part of the model — the product's surfaces are its projection (an asset maintained by the user needs a user-facing surface; one maintained by the system needs observability, not a screen).

Then check for bounded contexts: if one term is carrying two meanings for two audiences, split the context rather than overloading the word.

### 6. Principles, filled or verified (→ §1)

2–3 product constitutions. **The test: each must be able to reject a concept.** Take three concepts from §3 and try to reject them with each principle — a principle that rejects nothing is decoration, rewrite or drop it.

### 7. Write, review, approve

Write `CONTEXT.md` from @../../knowledge/templates/context-md.md, drafted per @../../knowledge/principles/prose-discipline.md. Run the Exit Criterion in `domain-model.md`, then:

> "Domain model written to `CONTEXT.md`. Please review — particularly the spine (§4) and the ownership table (§3), since the PRD's surfaces are derived from them."

Wait for approval. Commit.

## Quick Reference

| Symptom | Stance |
|---|---|
| New project, no shared vocabulary yet | `create` |
| Model exists, a new subsystem introduces concepts | `update` |
| A PRD or spec is carrying a state machine or an invariant | `sync` |
| Someone asks "what do these words actually mean" mid-build | `create` or `sync` — check whether `CONTEXT.md` exists first |

## Common Mistakes

| Mistake | Why it fails | Fix |
|---|---|---|
| Asking "what are the concepts?" | Yields a noun list with no lifecycles — the model reads as a static glossary | Step 2: ask what changes and when |
| Skipping the worked example | Nothing to validate concepts against; abstract models accept anything | Step 1 is not optional |
| Forcing a spine on a stateless domain | An invented centre misleads every downstream reader | Step 3's verification exists to fail |
| Writing the conclusion without the derivation | The next person cannot tell whether the spine still holds | Step 3 writes the four lines |
| Leaving a state machine in the PRD | Two homes, drift on the first correction | `sync` moves it up |
| Filling §1 with "be user-friendly" | Rejects no concept | Step 6's rejection test |

## Integration

- **Invoked by:** the user (`/mu-model`); mu-prd and mu-arch recommend it when no `CONTEXT.md` exists and the work is product-level
- **Produces:** repo-root `CONTEXT.md` — the domain model
- **Consumed by:** every skill, passively via the bootstrap rule; mu-prd (surfaces derive from the ownership table), mu-arch (names and state machines), mu-scope (transition coverage)
- **Terminal state:** per the Pipeline Graph (bootstrap) — approved model → mu-prd, or mu-scope when a PRD already exists
- **Principle:** @../../knowledge/principles/domain-model.md · **Template:** @../../knowledge/templates/context-md.md
