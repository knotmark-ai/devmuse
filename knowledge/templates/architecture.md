# Architecture: <feature-name>

> **Date:** YYYY-MM-DD
> **Scope reference:** docs/scope/YYYY-MM-DD-<name>.md
> **Stance:** <create | update | extract | skip>

## Requirements Reference
- Scope: [link to scope artifact]
- Use cases covered: UC-1, UC-2, ...

## Architecture Overview
- High-level description of the solution
- Architecture diagram (graphviz digraph)

## Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| A: <name> | ... | ... | **Selected** / Rejected |
| B: <name> | ... | ... | Selected / **Rejected** — <reason> |
| C: <name> | ... | ... | Selected / **Rejected** — <reason> |

## Component Design
### <Component Name>
- **Responsibility:** what it does
- **Interface:** public API / contract
- **Dependencies:** what it needs

## Data Flow
- Sequence or data flow diagram
- Key transformations and handoffs

## Error Handling
- Failure modes and recovery strategies
- Error propagation path

## Testing Strategy
- Unit test approach
- Integration test approach
- UC coverage mapping

## Failure Mode Analysis (Inversion Test)
- What would make this design fail?
- What assumptions must hold?

## Out of Scope
- <explicitly excluded item> — <reason>

## History

| Date | Commit | Change |
|------|--------|--------|
| YYYY-MM-DD | `<sha>` | Initial creation |
