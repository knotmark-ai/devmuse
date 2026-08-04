# Design Audit Rubric

Review checklist for mu-reviewer's review-design mode. Organized to match the design template structure.

## C4 Positioning
- Are the affected containers and components identified?
- Is the architecture diagram present (with ➕/✏️/➖ overlay for changes)?
- Are the C4 levels appropriate for the project type? (see architecture-assessment.md)
- Max 8 issues per section — prioritize, don't enumerate exhaustively

## Functional Design
- **Interface contracts:** Are API endpoints fully specified (method, path, request/response format, error codes)?
- **Data model:** Are schema changes explicit (new tables/columns, types, constraints)?
- **Sequence diagrams:** If multi-party interaction, is there a per-scenario sequence diagram? Does each scenario show data availability at each hop?
- **State machine:** If entity has lifecycle, are all states and transitions enumerated? Any missing transitions or dead-end states?
- Component boundaries: can each be understood and tested independently?

## Non-Functional Design
- Were NFR trigger conditions scanned against the feature?
- Are relevant NFRs elaborated (concern, how addressed, trade-offs)?
- Are irrelevant NFRs omitted (not listed as "N/A")?

## Architecture Decision Records
- Are decisions with meaningful trade-offs recorded as ADRs?
- Does each ADR include context, decision, alternatives, and consequences?
- Are approach selection decisions from step 6 captured?

## Error Handling
- Are error paths explicitly designed (named exceptions, not catch-all)?
- Does the design specify retry/timeout/circuit-breaker behavior where applicable?

## Testability
- Can each component be tested in isolation?
- Are external dependencies injectable?
- Is UC coverage mapping present?

## Scoring
Rate each dimension 0-10. For any score <7, state what would make it a 10.
