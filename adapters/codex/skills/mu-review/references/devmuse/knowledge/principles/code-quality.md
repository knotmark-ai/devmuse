# Universal Code-Quality Principles

**When to use:** `mu-code` during REFACTOR and implementation self-review;
`mu-review` / `mu-reviewer` during every `review-code` pass.

Apply every category to every implementation language. The rule is universal;
render its example and fix with the repository's language and native idioms.
Language-specific review criteria supplement this checklist without weakening it.

Treat the headings below as distinct implementation and finding categories.
Consolidate repeated occurrences inside one category, while keeping different
categories separate. Set severity from concrete impact rather than from the
principle's name.

## Pressure guardrails

| Rationalization | Required response |
| --- | --- |
| "The deadline is close, tests pass, or earlier reviews passed; show only blockers." | Deadlines, sunk cost, passing tests, late review, and requests to show only blockers do not remove categories. They may change severity, the merge verdict, or presentation length; keep non-blocking violations visible as Minor findings or a compact quality-sweep result. |
| "These are Go-specific proverbs." | Apply the universal categories in the target language's native idioms. Language-specific guidance supplements the categories; it does not gate them. |
| "Preserve every public shape to minimize the diff." | Check consumer and compatibility evidence. Remove unearned generality when the boundary is local; when external usage is unknown, report the uncertainty instead of assuming either deletion or permanence. |

## Simplicity and code shape

### 1. Inline transparent single-caller wrappers

Inline a function when its body is as clear as its name, it has one caller, and
it hides no policy, lifecycle, instrumentation, or other decision. A single
caller alone is a probe, not an automatic deletion rule.

**Bad:**

```ts
async function startApp(config: Configuration) {
  const app = createApp(config)
  await app.start()
  return app
}
const app = await startApp(loadConfiguration())
```

**Better:**

```ts
const app = createApp(loadConfiguration())
await app.start()
```

### 2. Build only for current consumers

Every export, parameter, hook, option, extension point, compatibility promise,
and documentation claim names a real consumer today. Add the generality when
the consumer arrives.

**Bad:**

```ts
export function startApp() {} // exported only for a possible future test
// README: "versioned messages" when the schema has no version field
```

**Better:**

```ts
function startApp() {} // local until another real consumer needs the contract
// README describes only the message contract that exists now
```

### 3. Prefer deep modules

A module earns its interface by hiding a decision or mechanism. A signature as
complex as its body is a shallow module with negative value.

**Bad:**

```ts
function getUserName(user: User): string { return user.name }
```

**Better:**

```ts
// One call hides close-event ordering, a settled latch, grace timeout,
// client termination, and idempotent completion.
await closeWebSocketServer(server, graceMs)
```

### 4. Finish with the fewest elements

After behavior, clarity, and necessary duplication are settled, minimize the
functions, types, files, layers, and abstractions. Each remaining element needs
a real consumer or a decision/mechanism it hides; neighbouring symmetry is not
evidence.

**Bad:**

```text
ports/ + adapters/ + application/ + base-service.ts
```

created before a dependency direction or second implementation exists.

**Better:**

```text
checkout.ts
```

split only when a real boundary or hidden mechanism appears.

### 5. Preserve line of sight

Handle failures and exclusions with guards so the happy path stays at minimum
indentation. An unconditional return or throw completes its branch.

**Bad:**

```ts
if (request.user) {
  if (request.valid) return process(request)
  else throw new ValidationError()
} else throw new AuthError()
```

**Better:**

```ts
if (!request.user) throw new AuthError()
if (!request.valid) throw new ValidationError()
return process(request)
```

## Failure and dependency boundaries

### 6. Add error context once

A layer adds context only when it can name the failed operation and useful
identifying parameters. Preserve the original cause with the language's native
error-chaining mechanism. Propagate unchanged when the layer adds no useful
information.

**Bad:**

```ts
catch (error) { throw new Error("request failed: " + String(error)) }
```

**Better:**

```ts
catch (error) {
  throw new Error(`LLM call failed (round ${round})`, { cause: error })
}
```

Use the equivalent carrier in the target language, such as Go `%w`, Python
`raise ... from ...`, Java cause constructors, or Rust `.context()`.

### 7. Model expected failures as values

Represent normal domain outcomes such as not-found, expired, conflict, and
validation rejection with an explicit typed result or the language's equivalent
value carrier. Reserve exceptions and panics for unexpected failures.

**Bad:**

```ts
if (!record) throw new GoneError()
```

**Better:**

```ts
type StartResult = { type: "gone" } | { type: "redirect"; location: string }
if (!record) return { type: "gone" }
```

Go `error` and Rust `Result` are already values; make their domain variants
distinguishable. Exception-first languages use an explicit result when callers
are expected to branch on the outcome.

### 8. Keep interfaces consumer-defined and minimal

Define the narrowest capability at the consumer. Producers may remain concrete
or capability-rich. Each additional method needs a consumer that requires the
combined capability.

**Bad:**

```ts
function registerShutdown(runtime: AppContext, source: NodeJS.Process) {}
```

**Better:**

```ts
interface Stoppable { stop(): Promise<void> }
interface SignalSource { once(signal: Signal, fn: () => void): unknown }
function registerShutdown(runtime: Stoppable, source: SignalSource) {}
```

Use implicit/structural interfaces where the language supports them and nominal
interfaces where it does not; the ownership and minimality rule stays the same.

### 9. Prefer copying a few lines to adding a dependency

Keep a small operation local when extraction would create a module or package
dependency merely to remove symmetry. Cross-boundary extraction earns its place
by owning a capability or policy.

**Bad:**

```ts
import { capitalize } from "shared/helpers"
```

for one trivial string operation.

**Better:**

```ts
const label = value[0].toUpperCase() + value.slice(1)
```

until a real shared naming policy or richer capability appears.

### 10. Name modules for their capability

A module/package/namespace name states the capability or policy it owns.
Names such as `util`, `common`, `helpers`, `shared`, and `misc` are a diagnostic,
not a blanket ban: keep one only when the boundary has a specific explainable
ownership that the visible name accurately represents.

**Bad:**

```text
helpers/retry.ts
```

**Better:**

```text
delivery/retry-policy.ts
```

### 11. Avoid package stutter

Inside a package, module, namespace, crate, assembly, workspace, or app,
identifiers rely on that enclosing context instead of repeating its name.

**Bad:**

```ts
// apps/api/configuration.ts
export interface ApiConfiguration {}
export function loadApiConfiguration(): ApiConfiguration {}
```

**Better:**

```ts
// apps/api/configuration.ts
export interface Configuration {}
export function loadConfiguration(): Configuration {}
```

With qualified imports, as in Go packages or normal Python module access, the
call site already carries the namespace and has no stutter exception. With
unqualified imports, as in TypeScript or Java, a public export may retain the
domain word when the bare name is ambiguous or collides (`ApiResponse` versus
the DOM `Response`). App-internal names do not qualify for that exception.

## Completion check

For every changed function, type, file, layer, error boundary, interface, and
module/package name, record which category was applied and either the correction
or the concrete evidence that the current shape is earned. Completion means all
eleven categories were considered, not merely that no familiar smell stood out.
