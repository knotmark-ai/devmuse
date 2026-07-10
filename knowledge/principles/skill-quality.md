# Skill Quality Lexicon

**When to use:** Referenced by mu-write-skill during skill creation, editing, and review. A vocabulary of quality levers and failure modes, plus a review checklist to run over any draft. Adapted from mattpocock/skills `writing-great-skills`.

**Root virtue: Predictability.** A skill exists to wrangle determinism out of a stochastic system — the agent taking the same *process* every run, not producing the same output. Every lever below serves it. This complements skill-cso.md: CSO covers *whether the skill gets found*; this file covers *whether the skill, once loaded, steers reliably and cheaply*.

## 1. Invocation Economics: Two Loads

Every skill pays exactly one of two costs. Choosing wrong wastes the payment.

- **Context load** — a model-invoked skill's `description` sits in the context window every turn, spending tokens and attention. This is the price of the agent being able to reach the skill on its own.
- **Cognitive load** — a user-invoked skill (`disable-model-invocation: true`) costs nothing in context, but the *human* must remember it exists and when to reach for it.

**The test:** could the model usefully reach for this skill autonomously, or does another skill need to invoke it? If yes, pay context load: keep a model-facing description with rich triggers. If it only ever fires by hand ("on-demand only", "manual-only", "user must explicitly request"), set `disable-model-invocation: true`, shrink the description to a one-line human-facing summary, and pay no context load.

**Review flag:** a rich trigger-laden description on a skill whose own text says it must never fire automatically is paying context load for a capability it forbids. Fix the frontmatter, not the wording.

**Splitting (granularity):** each new skill spends one of the two loads. Split off a model-invoked skill only when a distinct trigger concept should fire it on its own; split a step sequence only when visible later steps cause rushing (see premature completion). "It's cleaner" does not justify the load.

## 2. Leading Words

A **leading word** is a compact concept already in the model's pretraining that the agent thinks with while running the skill — e.g. *seam*, *tracer bullet*, *fog of war*, *tight* (loop), *red* (failing test). One token recruits priors the model already holds, anchoring a whole region of behaviour that would otherwise take sentences.

It serves predictability twice: in the body it anchors *execution* (same behaviour every time the word appears); in the description it anchors *invocation* (when the same word lives in the user's prompts and docs, the skill fires more reliably).

**The collapse test:** hunt for a quality restated as a list — "fast, deterministic, low-overhead" collapses to *tight*; "a loop you believe in" collapses to *red* (binary, observable). A triad spelled out at three sites is a passage begging to collapse into a single pretrained word. Prefer existing words: a coined term recruits no priors and costs definition tokens.

**Grading:** a leading word too weak to beat the model's default is a no-op (*be thorough* when the agent is already thorough-ish); the fix is a stronger word (*relentless*, *exhaustive over every rule*), not more sentences.

## 3. Completion Criteria

Every step ends on a **completion criterion** — the condition telling the agent the work is done. Two properties make it a lever:

- **Clarity** (can the agent tell done from not-done?) resists **premature completion** — a vague bound ("until you have a good understanding") lets the agent declare done and slip forward.
- **Demand** (how much it requires) sets **legwork** — "every changed field judged breaking or non-breaking, with reason" forces thorough work where "check compatibility" does not. Demand also binds flat reference: "every rule applied" is how a skill with no steps still carries an exhaustiveness bar.

**Defence order for a rushed step:** sharpen the criterion first — cheap and local. Only if it is irreducibly fuzzy *and* you observe the rush, hide the later steps by splitting the sequence — and hiding only works across a real context boundary (a subagent dispatch or a separate user-invoked skill; an inline reference leaves the later steps in context and clears nothing).

## 4. Failure Modes

Run each as a test over the draft; each has a distinct cure.

| Failure mode | Test | Cure |
|---|---|---|
| **No-op** | Does this line change behaviour versus what the model does by default? | Delete the whole sentence. "Be careful", "be diligent", "make it high quality" are paid noise. Model-relative: settle disputes by running the skill, not by debate. |
| **Negation** | Does this line steer by prohibition? "Don't skim" names skimming and makes it *more* available (don't think of an elephant). | State the target behaviour so the banned one is never spoken: "read every changed line, including generated files." Keep a prohibition only as a hard guardrail you cannot phrase positively — and even then pair it with the positive target. (Rationalization tables in discipline skills are such guardrails: each entry pairs the excuse with a positive Reality. Scattered "don't/never" steering lines are not — rewrite those.) |
| **Duplication** | Is this meaning stated in more than one place? | Keep a single source of truth. Repetition also inflates the meaning's apparent priority and invites drift — two copies of a rule *will* diverge. (Distinct from a leading word, which repeats a *token* on purpose, never a restated meaning.) |
| **Premature completion** | Is any step's criterion vague enough to declare done early? | See §3: sharpen first, split only as last resort. |
| **Sediment** | Is this line stale — describing behaviour or context that has since changed? | Delete. Adding feels safe and removing feels risky, so stale layers accumulate by default; pruning is a discipline, not an event. |
| **Sprawl** | Is the skill simply too long, even with every line live and unique? | Push reference down the hierarchy (§5) and split by branch or sequence so each path carries only what it needs. |

## 5. Progressive Disclosure: The Branch Test

A skill's content is either **steps** (ordered actions, the primary tier) or **reference** (consulted on demand). Reference sits on a ladder: in-file → disclosed to a sibling file behind a pointer.

**The branch test decides what moves down:** inline what *every* run of the skill needs; push behind a pointer what only *some* branches reach. A reference table needed by one step of five buries the steps for every run that never reaches it — disclose it, regardless of line count. (Line-count thresholds like "100+ lines" are a floor for *heavy* reference, not a license to inline everything smaller.)

A pointer's *wording*, not its target, decides when the agent reaches the material. A must-have target behind a weakly worded pointer is a variance bug: sharpen the wording first; inline only if that fails.

**Co-location:** once material's rung is chosen, keep a concept's definition, rules, and caveats under one heading — scattering fragments a single meaning across the file (distinct from duplication, which repeats it).

## 6. Review Checklist

Run over any draft, in order. Each item is checkable; "every line" means every line.

1. **Invocation:** does the frontmatter match how the skill is actually reached? Manual-only text + model-facing description = fix frontmatter (§1).
2. **No-op pass:** every sentence — does it change behaviour versus the default? Delete failures whole (§4).
3. **Negation pass:** every "don't/never/avoid" — steering or hard guardrail? Rewrite steering as the positive target (§4).
4. **Duplication pass:** every rule — stated exactly once? Merge copies; check they haven't already diverged (§4).
5. **Completion criteria:** every step — checkable and demanding? Rewrite vague bounds ("good understanding" → "every X accounted for") (§3).
6. **Leading-word pass:** any restated triad or fuzzy multi-sentence quality that collapses into one pretrained word? (§2).
7. **Branch test:** any inline reference that only some paths reach? Disclose it behind a well-worded pointer (§5).
8. **Sediment/sprawl:** anything stale? Anything live-but-excessive that the ladder or a split would cure? (§4).
