# Grilling

**When to use:** Referenced by mu-scope (use case elicitation), mu-arch (clarifying questions), mu-prd (section interviews), and mu-biz (full-mode sections) at their questioning steps; standalone via `/mu-grill`. Adapted from mattpocock/skills' grilling.

**Purpose:** one interview discipline shared by every skill that questions the user — the same process every run, whichever skill is asking.

## The Discipline

- **Walk the decision tree in dependency order.** When an answer opens a sub-branch, follow it down before moving to sibling questions.
- **One question per message.** Multiple questions at once is bewildering. Offer concrete options (A/B/C) where they exist, attach your recommendation with a one-line reason, and put the recommended option first.
- **Facts are yours; decisions are the user's.** Anything observable from the codebase, docs, or a command — look it up before asking; asking a greppable question wastes the user's turn. Anything that is preference, priority, or trade-off — put it to the user. When the user answers "you decide," make the call and record it as an explicit assumption in the artifact.
- **Converge every fork.** A *fork* is a decision point whose wrong guess forces rework. Every fork ends with either a user answer or a user-visible assumption. There is no question-count budget: stop when the forks are resolved, not when the questions feel like enough. If the user tires of questioning, offer to convert the remaining forks into written assumptions — their call, never an automatic cap.

## Exit Criterion

Grilling is done when every remaining unknown is either (a) answerable by reading code/docs, or (b) recorded as an explicit assumption the user has seen — and every fork carries a user answer or a user-approved assumption. Do not enact, design past, or finalize the artifact until the user confirms shared understanding; in pipeline skills, artifact approval is that confirmation.
