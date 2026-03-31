# Python Review Criteria

Language-specific review criteria for craft-reviewer. Supplements the universal checklist.

## Type Safety

- **Type hints on public APIs** — all public functions/methods should have parameter and return type annotations.
- **Use `typing` properly** — `Optional[X]` means `X | None`, not "parameter is optional". Use `X | None` (3.10+).
- **Generic collections** — `list[int]` not `List[int]` (3.9+). `dict[str, Any]` not `Dict[str, Any]`.
- **`TypedDict` for structured dicts** — avoid `dict[str, Any]` when the shape is known.
- **`Protocol` over ABC** — for structural subtyping (duck typing with type safety).
- **Run `mypy --strict` or `pyright`** — catch type errors before runtime.

## Error Handling

- **Catch specific exceptions** — `except Exception` is too broad. `except BaseException` catches `KeyboardInterrupt`.
- **Don't suppress with bare `except:`** — always specify the exception type.
- **Use `raise ... from e`** — preserve exception chains for debugging.
- **Context managers** — use `with` for resource cleanup (files, locks, DB connections). Don't rely on `__del__`.

## Async Patterns

- **Don't mix sync and async** — `asyncio.run()` in async context deadlocks. Use `await` consistently.
- **Avoid `asyncio.gather()` without `return_exceptions=True`** — one failure cancels all.
- **No blocking calls in async** — `time.sleep()`, sync I/O in `async def` blocks the event loop. Use `asyncio.sleep()`, `aiohttp`, etc.

## Pythonic Patterns

- **EAFP over LBYL** — `try/except KeyError` over `if key in dict` (when the happy path is common).
- **List comprehensions** — prefer over `map()`/`filter()` for readability. But don't nest more than 2 levels.
- **`pathlib.Path`** — prefer over `os.path.join()` for path manipulation.
- **`dataclasses` or `attrs`** — prefer over plain classes for data containers. Use `frozen=True` for immutability.
- **`Enum`** — use `StrEnum` (3.11+) or `Enum` for fixed sets of values, not string constants.
- **Walrus operator (`:=`)** — use for assignment in conditions, but don't abuse for readability.

## Common Pitfalls

- **Mutable default arguments** — `def f(items=[])` shares the list across calls. Use `None` + create inside.
- **Late binding closures** — `lambda` in loops captures variable by reference. Use default argument `lambda x=x: ...`.
- **`is` vs `==`** — `is` for `None`/singletons only. `is` on integers > 256 is undefined behavior.
- **String concatenation in loops** — use `"".join(parts)` or `io.StringIO`.
- **Circular imports** — restructure or use `TYPE_CHECKING` guard + `from __future__ import annotations`.
- **`datetime.now()`** — use `datetime.now(tz=timezone.utc)` to avoid naive datetime bugs.

## Testing

- **`pytest` idioms** — use fixtures, parametrize, tmp_path. Avoid `unittest.TestCase` unless needed.
- **Mock at the boundary** — `@patch("module.where_used.thing")` not `@patch("module.where_defined.thing")`.
- **Don't mock what you don't own** — wrap third-party APIs in your own interface, mock that.
- **`freezegun` / `time-machine`** — for time-dependent tests instead of mocking `datetime`.

## Security

- **Never `eval()` / `exec()` user input** — use `ast.literal_eval()` for safe parsing.
- **SQL injection** — use parameterized queries. Never f-string SQL.
- **`subprocess`** — use `subprocess.run([...], check=True)` with list args, never `shell=True` with user input.
- **`pickle` deserialization** — never unpickle untrusted data (arbitrary code execution).
- **Path traversal** — validate and resolve paths with `Path.resolve()`, check against allowed directory.
- **YAML** — use `yaml.safe_load()`, never `yaml.load()` (arbitrary code execution).
