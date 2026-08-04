# Chesterton's Fence

**When to use:** Before simplifying, refactoring, or removing any code. Referenced by mu-code during refactoring tasks and mu-review during code quality review.

Before changing or removing code, understand why it exists.

## The Principle

> "Don't ever take a fence down until you know the reason it was put up." — G.K. Chesterton

Code that looks unnecessary, overcomplicated, or wrong often exists for a reason that isn't immediately visible: a bug workaround, a performance optimization, a compatibility constraint, an edge case discovered in production.

## Before Simplifying

Ask these questions:

1. **What is this code's responsibility?** — not what it does, but what would break without it
2. **Who or what calls it?** — trace all callers, not just the obvious ones
3. **When was it written, and what changed around that time?** — `git log` and `git blame` reveal context
4. **Is there a comment, commit message, or PR that explains the "why"?**
5. **If I remove this, what test fails?** — if no test fails, that's a signal the behavior is untested, not that it's unnecessary

## Red Flags

- "This looks dead/unused" → grep harder, check dynamic references
- "This is overcomplicated for what it does" → the complication may handle an edge case you haven't seen
- "Nobody knows why this is here" → that's a reason to investigate, not to delete
- "The tests still pass without it" → the tests may not cover the scenario it guards against
