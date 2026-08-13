# Cross-Task Contract

Use only after the trigger in `SKILL.md` fires.

## Global Constraints

Place this section after `Tech Stack` and before the header divider:

```markdown
## Global Constraints

- GC-1: `<exact requirement>` — Source: `<spec path and section>`
```

Copy each entry verbatim from the approved spec, including version floors,
dependency limits, platform requirements, naming/copy rules, and other exact
values. Include only load-bearing requirements inherited by every task; keep
subset-specific rules inside the affected tasks. Normal TDD, review, and coding
practice stays in the execution process.

## Task Interfaces

Place this block after `Files` in each affected task:

```markdown
**Interfaces:**
- Consumes: I-1 — `parse(input: RawInput) -> ParsedInput` from Task 1
- Produces: I-2 — `serialize(value: ParsedInput) -> string` for Task 3
```

Use the exact identifier, parameter and return types, schema or file format,
and producer/consumer task. Include only the applicable line when a task only
consumes or only produces. Every task-to-task dependency appears on both sides
with the same interface ID and definition; omit an empty Interfaces block.

## Completion Check

- Every shared exact spec rule appears in Global Constraints, copied verbatim.
- Every dependency edge has matching producer and consumer entries.
- Every template token is replaced with a real value before review.
