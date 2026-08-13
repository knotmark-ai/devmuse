# Token benchmark

This benchmark addresses fixed context cost and task-execution cost separately.
It records Claude Code `stream-json` result usage without assuming token prices.

```bash
bash tests/token-benchmark/run-benchmark.sh
```

The default matrix includes:

- a no-tool vanilla baseline;
- the same baseline with DevMuse loaded;
- the same approved bounded task with and without DevMuse; and
- a four-turn DevMuse architectural pipeline from mu-scope through final review.

Use at least three repetitions for a comparison worth publishing:

```bash
REPEATS=3 MODEL=sonnet bash tests/token-benchmark/run-benchmark.sh
```

For a cheap smoke run, select comma-separated scenario IDs:

```bash
SCENARIOS=fixed-vanilla,fixed-devmuse REPEATS=1 \
  bash tests/token-benchmark/run-benchmark.sh
```

`MAX_BUDGET_USD` applies per turn. `OUTPUT_DIR` selects a new raw-log directory;
the runner refuses to merge into an existing benchmark.
The runner operates only in copied temporary fixtures. `summary.json` preserves
machine-readable token categories and provider-reported cost; `summary.md`
shows totals, fixed-baseline subtraction, ranges, and comparison ratios.

Cache traffic is reported explicitly because it is not equivalent to fresh
input. Baseline subtraction is an estimate and can be noisy, so compare repeated
runs on the same model and Claude Code version. Inspect transcripts as well as
token totals: a cheaper run that failed to complete the workflow is not a win.
