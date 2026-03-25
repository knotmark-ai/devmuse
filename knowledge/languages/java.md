# Java Review Criteria

Language-specific review criteria for craft-reviewer. Supplements the universal checklist.

## Type Safety & Null Handling

- **Null discipline** — use `Optional<T>` for return types that may be absent. Never return `null` from public API.
- **`@Nullable` / `@NonNull`** — annotate parameters and fields. Enable NullAway or Checker Framework.
- **Avoid raw types** — `List` → `List<String>`. Raw types bypass generic type checking.
- **Bounded wildcards** — `<? extends T>` for producers, `<? super T>` for consumers (PECS).
- **Sealed classes (17+)** — use for exhaustive pattern matching instead of `instanceof` chains.
- **Records (16+)** — use for immutable data carriers instead of mutable POJOs.

## Error Handling

- **Catch specific exceptions** — never `catch (Exception e)` unless re-throwing. Never `catch (Throwable)`.
- **Don't swallow exceptions** — `catch (E e) { /* empty */ }` is always wrong. At minimum log.
- **Use try-with-resources** — for all `AutoCloseable` resources. Not `try/finally`.
- **Checked vs unchecked** — use unchecked (`RuntimeException`) for programmer errors. Checked for recoverable conditions.
- **Don't use exceptions for control flow** — exceptions are 100x slower than conditionals.
- **Preserve cause chain** — `throw new FooException("msg", cause)`. Don't drop the original exception.

## Concurrency

- **Prefer `java.util.concurrent`** — `ExecutorService`, `CompletableFuture`, not raw `Thread`.
- **Virtual threads (21+)** — prefer for I/O-bound work. Don't `synchronized` block virtual threads (pins carrier).
- **`synchronized` scope** — minimize critical section. Prefer `ReentrantLock` for complex locking.
- **`volatile` vs `Atomic*`** — `volatile` for single reads/writes. `AtomicInteger` for compound operations.
- **Immutable objects are thread-safe** — prefer immutable state. Use `Collections.unmodifiableList()` or Guava `ImmutableList`.
- **Don't `Thread.stop()`** — use interrupt + cooperative cancellation.

## Resource Management

- **Connection pools** — database connections, HTTP clients must be pooled and reused.
- **Close resources** — `InputStream`, `Connection`, `ExecutorService` must be closed. Use try-with-resources.
- **Avoid `finalize()`** — deprecated and unreliable. Use `Cleaner` (9+) or explicit close.
- **String concatenation in loops** — use `StringBuilder`. `+` in loops creates O(n²) garbage.

## Common Pitfalls

- **`equals()` and `hashCode()` contract** — override both or neither. Inconsistency breaks `HashMap`.
- **`==` on objects** — compares reference, not value. Use `.equals()`. Exception: enums.
- **Integer cache** — `Integer.valueOf(127) == Integer.valueOf(127)` is `true`, `128` is `false`. Always use `.equals()`.
- **`ConcurrentModificationException`** — don't modify collection while iterating. Use `Iterator.remove()` or `CopyOnWriteArrayList`.
- **`SimpleDateFormat` is not thread-safe** — use `DateTimeFormatter` (8+).
- **`BigDecimal` for money** — never use `float`/`double` for financial calculations.
- **`Optional.get()` without check** — use `orElse()`, `orElseThrow()`, or `ifPresent()`.

## Testing

- **JUnit 5** — prefer over JUnit 4. Use `@Nested` for test organization.
- **Mockito patterns** — `@ExtendWith(MockitoExtension.class)` + `@Mock` + `@InjectMocks`.
- **Don't mock value objects** — mock interfaces/services, not data classes.
- **`assertThat` (AssertJ)** — prefer fluent assertions over `assertEquals`. Better failure messages.
- **Test names describe behavior** — `shouldReturnEmptyWhenUserNotFound()` not `testGetUser()`.
- **`@ParameterizedTest`** — for data-driven tests. Use `@CsvSource` or `@MethodSource`.
- **Testcontainers** — for integration tests with real databases/services. Don't mock repositories.

## Security

- **SQL injection** — use PreparedStatement. Never concatenate user input into SQL.
- **Deserialization** — never deserialize untrusted data with Java serialization (`ObjectInputStream`). Use JSON + validation.
- **XXE** — disable external entities in XML parsers: `factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true)`.
- **SSRF** — validate and whitelist URLs before making HTTP requests.
- **Log injection** — sanitize user input before logging. Don't log passwords/tokens.
- **Dependency vulnerabilities** — run `dependencyCheck` / OWASP plugin. Keep dependencies updated.
- **Secrets** — never hardcode. Use environment variables or vault. No secrets in `application.properties` committed to git.
