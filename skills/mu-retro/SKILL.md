---
name: mu-retro
description: "Weekly or periodic retrospective — gather git metrics, review patterns, capture learnings to Claude Code memory."
---

# Retrospective

Gather quantitative git metrics and qualitative reflections for a time period. Capture non-obvious learnings to Claude Code memory for future sessions.

Independent of the main pipeline. Invoke with `/mu-retro` or `/mu-retro 14d`.

## Process

1. **Parse time window** from argument (default: 7d)
   - Convert to absolute start date at midnight
   - Example: `7d` on 2026-04-12 → start 2026-04-05T00:00:00
2. **Gather data** (run in parallel):

```bash
# Commits in window
git log --since="<date>" --format="%H|%an|%s|%aI"

# Author summary
git shortlog -sn --since="<date>"

# File change stats
git log --since="<date>" --name-only --format="" | sort | uniq -c | sort -rn | head -10

# Test file count
find . -name "*test*" -o -name "*spec*" | grep -v node_modules | wc -l
```

3. **Check for zero commits:**
   - If no commits in window → report "No activity in this period"
   - Skip metrics table, proceed directly to qualitative reflection
4. **Generate metrics table:**

| Metric | Value |
|---|---|
| Commits | N |
| Contributors | N |
| Lines changed | +N / -M |
| Test files | N |
| Hottest files | top 3 by change frequency |

5. **Per-author breakdown:**

| Author | Commits | Top area |
|---|---|---|
| ... | ... | ... |

6. **Qualitative reflection** (dialogue with user, one at a time):
   - "What went best this period?"
   - "What was most surprising?"
   - "What would you change next period?"
7. **Write retro artifact** to `docs/retro/YYYY-MM-DD-retro.md`
8. **Commit artifact**
9. **Write to Claude Code memory** (project type):
   - Only non-obvious findings worth remembering across sessions
   - Examples: "module X is a change hotspot", "test coverage thin in Y area"
   - **Check existing memory first** — update if similar memory exists, create new if not

## Key Principles

- **Data first, then reflection** — show the numbers before asking opinion
- **One reflection question at a time** — don't overwhelm
- **Memory is selective** — only write non-obvious, durable findings. Don't dump metrics.
- **Handle edge cases gracefully** — zero commits, shallow clones, monorepos
- **Standalone, no chaining** — does NOT invoke other skills
