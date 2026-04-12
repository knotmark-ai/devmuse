# Premise Check

**When to use:** Standalone via /mu-premise (full 4 questions), or inline by mu-scope Quick Probe (lightweight 3 questions, skip Q4).

Validate the premise before investing in scoping/design.

## Forcing Questions

### Q1: Problem Specificity
"Who exactly has this problem? What do they do today to work around it?"
- Red flag: vague answer ("users want..."), no specific person or workaround described

### Q2: Temporal Durability
"If the world changes in 3 years, is this more or less essential?"
- Red flag: depends on a trend that could reverse

### Q3: Narrowest Wedge
"What's the smallest thing we could build to test whether this matters?"
- Red flag: "we need the full platform first"

### Q4: Observation Test (full version only)
"Have you watched someone use a similar solution without helping them?"
- Red flag: "demos are theater" / "nothing surprising happened"

## Modes
- **Lightweight (3 questions):** Used by mu-scope inline in Quick Probe. Skip Q4.
- **Full (4 questions):** Used by standalone /mu-premise skill. All questions.

## Output
Produce a premise artifact at docs/premise/YYYY-MM-DD-<name>.md:
- Problem owner, status quo, temporal test, narrowest wedge, validation status
