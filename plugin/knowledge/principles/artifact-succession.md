# Artifact Succession

**When to use:** `mu-scope`, `mu-arch`, `mu-plan` — every skill that writes a **dated snapshot** under `docs/scope|specs|plans/`. Complements @stance-detection.md, which governs living artifacts (one file, updated in place). This one governs the dated ones: many files, and the relationships between them.

**Purpose:** work a feature twice and it leaves two artifacts. Nothing inside them says which is current, so the reader date-sorts and guesses. Measured on a real repo: **one feature carried four spec files across six days with zero cross-references** — `group-chat-agent-design`, `group-agent`, `frontend-api-changes-group-agent`, `group-agent-bot-api`. A reader cannot tell whether the later ones replace the first or add to it, and the *oldest* file is the one a date-sorted listing shows first.

The cost is not the file count. It is that **no file states its relationship to any other**.

## The question, asked once

Before writing a dated artifact: **is there a prior artifact for this same work?**

Not "does a similarly-named file exist" — names drift, as the four above show. Detection proposes; the user confirms.

1. List the artifact dir, most recent first
2. Score candidates on: task keywords ∩ the artifact's headings; the code paths this round touches ∩ the paths the artifact references
3. Ask once:
   > "Found `<path>` (`<date>`) covering what looks like the same work. Is this round continuing it? (**continue** / **new** / **unrelated**)"
4. Empty artifact dir, or "unrelated" → write fresh, no succession fields, no further ceremony

One question, never a blocking loop. A wrong guess costs the user one word.

## Three relations

| Prior artifact | Relation | What happens |
|---|---|---|
| **Not yet consumed** — nothing downstream cites it, no code implements it | **in-place** | Edit **the same file**. Filename and its date **do not change** — the date records when the work started, not when it was last touched. Append a History row. |
| **Consumed, and this round replaces its decisions** | **supersedes** | New file. Header gains `Supersedes: <path>`; the prior file gains `Superseded by: <path>`. |
| **Consumed, and this round adds without invalidating** | **extends** | New file. Header gains `Extends: <path>`; the prior file gains `Extended by: <path>`. |

**Consumed is checkable, not a judgment call:**

| Artifact | Consumed when |
|---|---|
| scope | a spec's Requirements Reference cites it |
| spec | a plan's header cites it |
| plan | any task checkbox reads `[x]`, or a commit message references its tasks |

## Both directions, always

```markdown
> **Supersedes:** docs/specs/2026-05-28-group-chat-agent-design.md
```

…and in that older file:

```markdown
> **Superseded by:** docs/specs/2026-06-03-group-agent-bot-api.md
```

A one-way link leaves the older file silently wrong for whoever opens it first — and in a date-sorted listing, the older file is exactly what gets opened first. Writing the reverse field costs one edit and is the entire point of the mechanism.

## Interaction with stance detection

For `mu-arch`, both principles run, in this order:

1. **Succession** — new file or the same one?
2. **Stance** — if the same one, how is it entered (`expand` / `gap-fill` / `sync`)?

`mu-scope` and `mu-plan` run succession only; they have no stance detection.

## Exit Criterion

Every dated artifact carrying a `Supersedes`/`Extends` field has its target carrying the matching reverse field, and no artifact was created under a new filename while its predecessor was still unconsumed.
