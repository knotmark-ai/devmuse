# Architecture Decision Records

**When to use:** `mu-arch` records one whenever a decision carries meaningful trade-offs; `mu-model` records concept-level rulings the same way; any skill may cite one. This principle defines where they live and what earns one — not how to think, which is the deciding skill's job.

**Purpose:** an ADR captures **what was decided and why, including what was rejected**. That last part is why it cannot live in the wiki: the wiki is rebuildable from source, and a rejected alternative leaves no trace in source. It is also why it cannot live only in a spec — specs freeze, and decisions outlive the change that produced them.

## The home

```
docs/adr/NNNN-<kebab-slug>.md      0001-event-sourced-orders.md
```

**One global sequence, four digits, never reused.** Measured failure: a project ran ADR-1..17 across three spec files, needed a commit purely to fix their ordering, and its README could not link to them because they had no stable address.

Multi-context repos (see `domain-model.md` §The Artifact) put system-wide decisions in root `docs/adr/` and context-local ones beside their context.

## What earns one

All three must hold:

1. **A real fork** — at least one alternative was genuinely viable. "We used the library everyone uses" is not a decision.
2. **Expensive to reverse** — undoing it later touches code you cannot see from here.
3. **The reasoning would otherwise be lost** — it is not derivable from reading the result.

Fail any one → it belongs in the spec's prose, not in an ADR. **ADR inflation is the failure mode**: fifty records nobody reads, because the tenth one said "we used JSON".

## Format

```markdown
# ADR-NNNN: <the decision, stated as a decision>

> **Status:** Proposed | Accepted | Superseded by [ADR-NNNN](NNNN-slug.md)
> **Date:** YYYY-MM-DD
> **Deciders:** <who>

## Context
<The forces. What made this a fork rather than an obvious call.>

## Decision
<What was chosen, in the present tense: "We route control signals out-of-band.">

## Alternatives rejected
| Option | Why not |
|---|---|
| <name> | <the specific failure mode, not "worse"> |

## Consequences
<What this makes easy, what it makes hard, and what has to be revisited if the context changes.>
```

**Superseding is a new record, never an edit.** The old one keeps its number, flips Status to `Superseded by`, and stays readable — a decision reversed for reasons is more instructive than one that was never made. Both directions are written, as with dated artifacts (`artifact-succession.md`).

## Relationship to the other artifacts

| Artifact | Holds |
|---|---|
| `docs/wiki/` | What the system **is** — rebuildable from source |
| `docs/adr/` | What was **decided**, and what was rejected — not rebuildable |
| `docs/specs/*.md` | How one change is designed — cites ADRs by number, does not restate them |
| `CONTEXT.md` §7 | Domain-model changes: concepts added, retired, spine moved |

The overlap to watch is CONTEXT.md §7 versus an ADR. Rule of thumb: a **vocabulary** ruling ("Signal retires; use evidence") is a History row; an **architecture** ruling ("no message queue in the MVP") is an ADR. When it is genuinely both, the ADR holds the reasoning and History cites its number.

## Exit Criterion

Every ADR has a status, at least one genuinely rejected alternative with its specific failure mode, and a number no other record shares. Every superseded record links forward to its replacement, and the replacement links back.
