# Defensive Boundary

**When to use:** Any code that receives input from or sends output to an external system — cross-service API calls, webhook callbacks, third-party SDK responses, message queue payloads, file imports. Referenced by mu-code and mu-review.

**Core principle:** Never trust external data. Validate exhaustively at the boundary, fail fast on violation, and ensure every possible input shape is handled (MECE).

## Rules

### 1. Assume Every Field Can Be Absent, Null, Empty, or Wrong Type

External systems may send any combination. Your deserialization must handle all forms:

| Input shape | Example | Required handling |
|-------------|---------|-------------------|
| Field missing | `{}` | `required=False` / `Optional` / default value |
| Explicit null | `{"phone": null}` | `allow_null=True` / null check |
| Empty string | `{"phone": ""}` | `allow_blank=True` / empty check |
| Wrong type | `{"phone": 123}` | Type coercion or reject |

**Anti-pattern:** Assuming `required=False` covers empty strings — most frameworks (DRF, Pydantic v1, Jackson) treat "missing" and "blank" as separate validations.

### 2. Fail Fast at the Boundary

- Validate **immediately** on receipt — don't let bad data propagate into business logic
- Return clear error messages that identify which field failed and why
- Log the raw payload at WARN level for debugging (redact secrets)

### 3. MECE: Every Code Path Must Be Explicit

For each external field, ensure every possible state has an explicit branch:

```
if value is present and valid:
    # use it
elif value is present but empty/null:
    # fallback or default
else:  # value is missing
    # default or skip
```

Never rely on implicit fallthrough. If a new state appears (e.g., external system starts sending a type you didn't expect), it should hit an explicit else/default branch, not silently pass through.

### 4. Outbound: Don't Assume the Receiver's Behavior

- Document what you send — null vs absent vs empty string have different meanings downstream
- Prefer not sending a field over sending null/empty, unless the contract requires it
- Version your API contracts — adding fields is safe, changing semantics is not

## Framework-Specific Gotchas

| Framework | Gotcha |
|-----------|--------|
| **DRF CharField** | `required=False` does NOT allow blank strings — must add `allow_blank=True` separately |
| **DRF + default** | `default=''` only applies when field is absent; explicit `""` in payload still triggers blank validation |
| **Pydantic v1** | `Optional[str]` allows `None` but not missing — use `Field(default=None)` |
| **Jackson (Java)** | `@JsonInclude(NON_NULL)` skips null on serialization but still deserializes null — handle in code |
| **Gson (Java)** | Unset `String` fields serialize as absent (not `""`), but empty strings serialize as `""` |

## Checklist (for mu-code / mu-review)

- [ ] Every external-facing field handles: missing, null, empty, wrong type
- [ ] Validation happens at the boundary, not deep in business logic
- [ ] Error responses identify the failing field
- [ ] Raw payloads are logged (at WARN/DEBUG) for debugging
- [ ] Outbound serialization behavior is documented or tested
