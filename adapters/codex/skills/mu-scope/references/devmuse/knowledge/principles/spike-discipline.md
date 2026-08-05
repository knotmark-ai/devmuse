# Spike Discipline

**When to use:** the routing rules select **Spike** when feasibility is unknown — "can this even be done", "which of these two approaches survives contact", "先做一个看看". Also reachable from mu-scope's depth decision when the probe finds a use case whose feasibility nobody can state.

**Purpose:** a spike answers a question with code. Its product is **knowledge**, not an asset. Without that distinction the pipeline has only two speeds — full ceremony, or abandoning discipline — so unknown-feasibility work either gets over-planned on guesses or skips scoping entirely and calls the result a feature.

## Spike or not

| | |
|---|---|
| **Spike** | The question is *can it / which way* — and no amount of reading answers it. Stop condition is stated up front. |
| **Not a spike** | The path is known and the work is just large. That is scoping, not uncertainty. |
| **Not a spike** | "I don't want to write a scope." Skipping ceremony is a decision the user makes explicitly at the scope gate — dressing it as a spike launders the override. |

The tell: **you can name the question, and you can say what answer would end it.** If neither is true, run mu-scope instead.

## Three rules

**1. Isolate physically, not by convention.** The spike lives in `spikes/<name>/`, outside the main workspace, with its own dependency manifest. Convention alone leaks: a spike that declares an LLM SDK inside the main workspace turns a project red-line ("zero AI on the data path") from an absolute into a caveat. Physical isolation is what keeps the main tree's invariants checkable.

**2. Register what it does NOT answer — at the top, on day one.** A spike that ran halfway and stopped is the most dangerous artifact in the repo: it looks like evidence. The README's first lines state the question, the answer if there is one, and **what was never done**. Measured failure: a feasibility ledger once cited a spike whose scoring columns were empty, from a superseded copy of the directory.

**3. The product is a starting point, not a component.** Spike code never becomes product code by promotion — it has no tests, and its shortcuts were the point. When the answer says "build it", that is a new scope with the spike as evidence. Say so in the README so nobody tries to graduate the files.

## The artifact

```
spikes/<name>/
├── README.md          ← question · answer · what was NOT done · what it unblocks
├── <its own manifest> ← package.json / pyproject / go.mod, independent of the main tree
└── ...                ← throwaway code; no test discipline expected
```

README front matter:

```markdown
# Spike: <the question, phrased as a question>

> **Asked:** YYYY-MM-DD · **Stop condition:** <what answer ends this>
> **Verdict:** answered / partial / abandoned
> **NOT answered:** <every part deliberately left undone — this line is not optional>
> **Unblocks:** <the scope or decision this feeds>
```

## Exit

| Verdict | Next |
|---|---|
| **answered — build it** | mu-scope, citing the spike as evidence. The spike's code stays where it is. |
| **answered — don't build it** | Record the verdict where the decision lives (MRD, ADR, or the scope that raised it). The spike has done its whole job. |
| **partial** | State what remains in `NOT answered` and decide with the user: continue the spike, or proceed with the uncertainty flagged in the scope. |

A spike with no verdict written is a spike that never ended — it just stopped being worked on, and whoever finds it next has to redo it to learn anything.

## Exit Criterion

The spike directory has a README whose `NOT answered` line is filled in (or explicitly `none`), a stated verdict, and a dependency manifest separate from the main tree's.
