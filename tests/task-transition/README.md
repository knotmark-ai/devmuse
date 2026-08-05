# Task-transition regression

This live Claude Code test reproduces issue #46: a conversation starts as
read-only inspection, then drifts into a behavior-changing design request. The
second turn must reclassify and invoke `mu-scope`; prior conversation context
must not make it look like a harmless continuation.

Run manually (it consumes model quota):

```bash
bash tests/task-transition/run-test.sh
```

Optional environment variables: `MODEL`, `MAX_BUDGET_USD`, `KEEP_OUTPUT=1`, and
`TRANSITION_ONLY=1` (run only the first two turns while iterating). The test uses
an isolated temporary project and preserves logs only on failure or when
`KEEP_OUTPUT=1`.
