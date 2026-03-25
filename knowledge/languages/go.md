# Go Review Criteria

Language-specific review criteria for craft-reviewer. Supplements the universal checklist.

## Error Handling

- **Check every error** — `val, _ := fn()` discarding errors is a bug. Use `errcheck` linter.
- **Wrap errors with context** — `fmt.Errorf("failed to open config: %w", err)`. Unwrap with `errors.Is()` / `errors.As()`.
- **Don't `log.Fatal` / `os.Exit` in libraries** — return errors, let the caller decide.
- **Sentinel errors** — define as `var ErrNotFound = errors.New("not found")`. Check with `errors.Is()`.
- **Error types** — implement `error` interface for rich errors. Don't return `string`.
- **Don't panic in library code** — panic is for truly unrecoverable states (programmer errors).

## Concurrency

- **No shared mutable state without sync** — use channels, `sync.Mutex`, or `sync/atomic`.
- **Goroutine lifecycle** — every goroutine must have a clear shutdown path. Use `context.Context` for cancellation.
- **Don't leak goroutines** — unbuffered channel send without receiver = leaked goroutine. Use `select` with `ctx.Done()`.
- **`sync.WaitGroup` patterns** — `wg.Add()` before `go`, `wg.Done()` in `defer`.
- **Race detector** — run tests with `-race`. Zero tolerance for data races.
- **`sync.Once` for initialization** — not `if initialized { return }` (race condition).
- **Channel direction** — annotate `chan<-` or `<-chan` in function signatures.

## Interface Design

- **Accept interfaces, return structs** — keep interfaces small (1-3 methods).
- **Define interfaces at the consumer** — not the implementer. Go interfaces are implicit.
- **Don't export interfaces prematurely** — unexported until needed.
- **`io.Reader` / `io.Writer`** — use standard interfaces, don't reinvent.

## Common Pitfalls

- **Range loop variable capture** — fixed in Go 1.22+, but for earlier versions: `v := v` in goroutines/closures.
- **Nil slice vs empty slice** — `var s []int` (nil) marshals to `null`. `s := []int{}` marshals to `[]`. Choose deliberately.
- **`defer` in loops** — deferred calls run at function exit, not loop iteration. Use anonymous function.
- **Pointer receivers vs value receivers** — be consistent per type. Pointer for mutation, value for immutable.
- **`time.After` in `select` loops** — leaks timer. Use `time.NewTimer` + `timer.Stop()`.
- **String to `[]byte` conversion** — allocates. Avoid in hot paths.
- **`init()` functions** — avoid. They hide side effects and make testing hard. Prefer explicit initialization.

## Package Design

- **Small, focused packages** — avoid mega-packages. One package = one idea.
- **No circular imports** — Go enforces this, but plan your dependency graph.
- **`internal/`** — use for private packages you don't want importers to depend on.
- **Don't stutter** — `http.HTTPServer` → `http.Server`. Package name is context.

## Testing

- **Table-driven tests** — standard Go pattern. `[]struct{ name string; input; want }`.
- **`testify` assertions** — prefer for readability, but `testing` stdlib is fine.
- **`t.Parallel()`** — mark tests parallel when possible. Catches shared-state bugs.
- **`t.Helper()`** — mark helper functions to get correct line numbers in failures.
- **`httptest.NewServer`** — for HTTP client tests. Don't mock `http.Client`.
- **`t.TempDir()`** — auto-cleaned temp directories. Don't use `os.MkdirTemp` in tests.
- **Golden files** — `testdata/` directory for expected outputs. Update with `-update` flag.

## Security

- **SQL injection** — use `db.Query("... WHERE id = $1", id)`. Never `fmt.Sprintf` SQL.
- **Template injection** — `html/template` auto-escapes. Never use `text/template` for HTML.
- **Integer overflow** — Go doesn't panic. Check bounds on untrusted numeric input.
- **Path traversal** — `filepath.Clean()` + `strings.HasPrefix()` after resolving.
- **Crypto** — use `crypto/rand`, never `math/rand` for security-sensitive operations.
- **Context propagation** — pass `context.Context` as first parameter. Don't store in structs.
