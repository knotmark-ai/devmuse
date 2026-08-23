# Domain Model (CONTEXT.md)

**When to use:** The domain model is the **`domain_model` member of the project's living architecture set** (declared at `artifacts.architecture.domain_model` in the project manifest — `CONTEXT.md` at the repo root by default). It is authored and maintained *inside* the PRD and architecture flow: `mu-prd` runs this method when a feature introduces lifecycle-bearing objects, and `mu-arch` runs it when a design coins domain concepts; both write to the single `domain_model` member. `mu-model` remains the optional dedicated tool for a focused modeling pass, not a required gate before PRD or design work. Any workflow may surface candidates for the next update, and all other skills and sessions consume the model passively via the bootstrap rule. Adapted from mattpocock/skills' shared-language mechanism, then widened from vocabulary to model.

**Purpose:** Settle the domain's concept structure before design starts — what exists, what has a lifecycle, what depends on what, who produces and who maintains each thing. Consistent naming falls out as a by-product; it is not the goal.

**Not a glossary.** A glossary optimizes for *the agent uses the same word*; a domain model optimizes for *the model is complete*. They admit different entries and carry different size limits. A file that only lists terms cannot answer "what is this system made of" — and every downstream artifact then re-derives the structure ad hoc, differently each time.

## The Artifact

- **Location:** the manifest's `artifacts.architecture.domain_model` path — `CONTEXT.md` at the repo root by default. Discoverable through project memory as a member of the architecture set rather than an orphan root file; root placement keeps the default visible to humans and agents alike, and the user may `@`-reference it from `CLAUDE.md` to force-load it.
- **Lazy creation:** create it the first time the project has a concept structure worth stating. An empty scaffold is noise.
- **Size: no term cap.** The necessary concept count is set by the domain, not by a context budget — a model missing a load-bearing concept makes downstream design wrong, which costs far more than the tokens it saved. What is capped is **isolates** (see Qualification Test).
- **Single source of truth:** PRDs, design docs, and wiki pages link here for shared terms *and domain facts* (state machines, invariants, guarantees); they never restate them. Area-local implementation jargon stays beside the source or in the relevant wiki page.
- **One model or several:** one `CONTEXT.md` until a single term carries two meanings for two audiences **and neither side can be renamed** — that is a bounded-context boundary, not a naming dispute. An open ambiguity that cannot be ruled *because both readings are correct for their own audience* is exactly this signal. Then split: a root `CONTEXT-MAP.md` naming the contexts and how they relate, plus one `CONTEXT.md` per context beside its code. **Split on the collision, never in anticipation of one** — a boundary drawn before the vocabulary forces it is a guess, and guessed boundaries are expensive to move.

## Qualification Test

An entry belongs in `CONTEXT.md` when **the model cannot be stated without it**:

- **Load-bearing** — remove the entry and something breaks: the spine no longer reads, the structure diagram has a hole, another entry dangles, or the worked example cannot be told.
- **Isolate → out** — zero inbound references ∧ zero outbound references ∧ absent from the spine, the structure overview, and the worked example. That is decoration, not model.

An industry-standard term (`dimension`, `measure`, `retention`) qualifies on the same test — **being borrowed is not disqualifying**. It owes one extra line: how this project's meaning differs from the common one. An unpaid debt is a line to write, not grounds for removal.

**What does not belong here:** product decisions (scope, MVP boundaries, user-facing copy), implementation detail (components, services, endpoints), and process notes. Those live downstream — see Dependency Direction.

## Structure

```markdown
# <Project> Domain Model
> purpose · dependency-direction note · acceptance standard

## 1. Principles          2-3 product constitutions; each must be able to REJECT a concept
## 2. Worked Example      one real case, carried through the whole file
## 3. Concept Table       concept · archetype · one-line · who produces · who maintains · arbitration source
## 4. Spine               how it was derived · the central lifecycle · the time axis
## 5. Structure Overview  one diagram + the worked example walked through it
## 6. Concepts in Detail  definition · difference-from-industry · in-the-example · state machine · guarantees · _Avoid_
## 7. History             concepts added/changed/retired · spine changes · state-machine changes
```

Template: `@../templates/context-md.md`

**Archetypes** (§3 column): **Role** · **Thing** · **Moment** (has a lifecycle; states migrate) · **Description** (type-level definition, no lifecycle of its own) · **Derived** (computed value, not an object).

**Deriving the spine** (§4): tag every concept with an archetype → list the Moments → count how many other concepts depend on each → the highest is the candidate → verify by telling the whole product as "the life of X". **If no candidate survives that verification, say so and organize by data flow instead.** A stateless or pure-transformation domain has no spine; inventing one is worse than having none.

## Entry Format

```markdown
### <Term>
<Definition.>
**Differs from the industry sense:** <only when the term is borrowed>
_Avoid_: <synonym>, <synonym>
```

`_Avoid_` is the anti-drift lever: it names the synonyms the project deliberately does not use, so agents converge on one word instead of oscillating between "issue tracker / backlog manager / issue host". Write it **per entry** — a standalone `_Avoid_` section becomes a junk drawer for unrelated prohibitions (copy rules, factual errata, reserved words) and stops steering naming at all.

## Dependency Direction

```
CONTEXT.md  ──▶  research/, brief/                allowed  (evidence and provenance)
CONTEXT.md  ──▶  prd/, specs/, plans/             forbidden
prd/, specs/, plans/, scope/  ──▶  CONTEXT.md     required
```

CONTEXT.md is the most upstream artifact: **stale content here is a bug; stale content downstream is just history.** An upstream file citing downstream files inverts that — it then has to change every time they do, and it stops being the thing you settle first.

Machine-checkable: `grep -nE 'docs/(prd|specs|plans)' CONTEXT.md` returns nothing beyond the rule statement itself.

## Maintenance Moves

- **Model** (the modeling pass, before PRD): build §1–§7 from scratch. **Primary producer** — the moves below maintain what this creates.
- **Harvest** (`mu-model update` or `sync`): run terms collected from code, conversations, and downstream artifacts through the qualification test; promote only the passers and leave implementation-local jargon near its source.
- **Coin** (`mu-arch`): read `CONTEXT.md` before naming any component or concept and reuse its language. Record an approved new name — definition plus `_Avoid_` — in the same commit as the design doc.
- **Sync**: when a downstream artifact holds a domain fact that belongs here (a state machine living in a PRD, an invariant living in a spec), move the fact up and leave a reference down. One row in §7 per sync.
- **Resolve** (any skill): on finding one term with two meanings or two terms for one meaning, rule with the user — update the winning entry's `_Avoid_` and record the retirement in §7 with its reasoning, so the dead word does not get picked back up. When the ruling needs information nobody has yet, park it in §3's open-ambiguities list together with what it blocks; an unruled ambiguity that goes unwritten gets re-litigated every session.

## Exit Criterion

Every entry is load-bearing (no isolates); every borrowed term states its difference from the industry sense; §4 either names a central lifecycle or explicitly declares the domain has none; the dependency-direction grep is clean; and no domain fact stated here is restated anywhere downstream.
