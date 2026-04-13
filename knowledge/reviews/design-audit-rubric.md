# Design Audit Rubric

## Architecture
- Data flow diagram (ASCII) for non-trivial flows — if missing, flag
- Component boundaries: can each be understood and tested independently?
- Failure mode mapping: for each component, what happens when it fails?
- Max 8 issues per section — prioritize, don't enumerate exhaustively

## Error Handling
- Are error paths explicitly designed (named exceptions, not catch-all)?
- Does the design specify retry/timeout/circuit-breaker behavior?

## Performance
- Are there N+1 query patterns? Unbounded list fetches?
- Is caching strategy specified where needed?

## Testability
- Can each component be tested in isolation?
- Are external dependencies injectable?

## Scoring
Rate each dimension 0-10. For any score <7, state what would make it a 10.
