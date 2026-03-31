# TypeScript Review Criteria

Language-specific review criteria for mu-reviewer. Supplements the universal checklist.

## Type Safety

- **Avoid `any`** — use `unknown` + type guards, or generics. Every `any` is a suppressed bug.
- **Strict mode** — `strict: true` in tsconfig. Watch for `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Prefer `interface` for public API shapes**, `type` for unions/intersections/utility types.
- **Use discriminated unions** over optional fields for state modeling (`type Result = Success | Failure`).
- **Avoid type assertions (`as`)** — prefer type narrowing. `as` hides runtime mismatches.
- **Avoid non-null assertion (`!`)** — handle `null`/`undefined` explicitly.
- **Enums** — prefer `const enum` or string literal unions over numeric enums (no reverse mapping bugs).

## Error Handling

- **Thrown errors should be typed** — define error classes or use `Result<T, E>` pattern.
- **Async errors** — every `Promise` chain must have `.catch()` or be inside `try/catch`. Unhandled rejection = crash.
- **Don't swallow errors** — `catch (e) {}` is almost always wrong.

## Async Patterns

- **Avoid floating promises** — every async call must be `await`ed, returned, or explicitly voided with `void promise`.
- **Concurrent operations** — use `Promise.all()` / `Promise.allSettled()`, not sequential `await` in loops.
- **No `async` on non-async functions** — wrapping sync code in `async` adds overhead and hides the intent.

## Module & Import Patterns

- **No circular imports** — causes `undefined` at runtime. Check with `madge` or similar.
- **Barrel files (`index.ts`)** — avoid in large projects, they break tree-shaking and cause import cycles.
- **Import type** — use `import type { Foo }` for type-only imports (erased at compile time, avoids cycles).

## Common Pitfalls

- **`==` vs `===`** — always use strict equality.
- **Object spread is shallow** — nested mutations propagate. Use structured clone or deep copy for nested state.
- **`Array.forEach` doesn't await** — use `for...of` for async iteration.
- **Optional chaining + nullish coalescing** — prefer `foo?.bar ?? default` over `foo && foo.bar || default` (falsy 0/"" bugs).
- **`delete obj.key`** — creates hidden class deopt in V8. Prefer `{ key, ...rest } = obj` destructuring.

## Testing

- **Mock boundaries, not internals** — mock HTTP clients, databases, file system. Don't mock class methods being tested.
- **Type-safe mocks** — use `vi.mocked()` / `jest.mocked()` to preserve types.
- **Test types with `expectTypeOf` / `tsd`** — catch type regressions.
- **Don't test TypeScript compiler** — `expect(typeof x).toBe('string')` tests TS, not your code.

## Security

- **Validate at boundaries** — use Zod/Valibot for runtime validation of external data (API input, env vars, config).
- **Template literal injection** — sanitize when building SQL, HTML, or shell commands from user input.
- **Prototype pollution** — avoid `Object.assign({}, untrustedData)`. Use `Object.create(null)` or validated schemas.
- **RegExp DoS** — avoid user-supplied regex. Pre-compile and use `re2` for untrusted patterns.
