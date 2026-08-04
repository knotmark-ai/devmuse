# Testing DevMuse

DevMuse tests separate deterministic contract checks from live-model behavior.
Run the cheap layer on every routing or skill edit; run live Claude scenarios
when changing descriptions, trigger boundaries, or model versions.

## Test Structure

```
tests/
├── routing-policy/          Static routing, duplication, and artifact-owner contract
├── hooks/                   Deterministic hook tests
├── skill-triggering/        Live automatic-invocation probes
├── explicit-skill-requests/ Live explicit-invocation probes for current skills
├── claude-code/             Live mu-code behavior/documentation checks
├── prd-state-modeling/      Stateful product and bootstrap pressure scenarios
├── subagent-driven-dev/     Manual architectural mu-code E2E projects
└── brainstorm-server/       Visual companion server tests
```

## Fast Deterministic Checks

```bash
bash tests/routing-policy/test-routing-policy.sh
bash tests/hooks/test-destructive-guard.sh
git diff --check
```

The routing-policy test is the regression contract for Direct, bounded, and
architectural ceremony; read-only inspection; review modes; retired artifacts;
and single-owner rules such as `docs/wiki/`.

## Live Trigger Checks

Requires the `claude` CLI and the local plugin directory.

```bash
tests/skill-triggering/run-all.sh
tests/explicit-skill-requests/run-all.sh
tests/claude-code/run-skill-tests.sh
```

- `skill-triggering` uses natural prompts and expects the model-invoked skill.
- `explicit-skill-requests` verifies named current skills load before action.
- `claude-code` asks the model to apply mu-code's proportional execution
  contract: bounded versus architectural input, task self-checks, one review
  boundary, subagent threshold, and proportional isolation.

Live trigger results are model-dependent. Save the transcript and judge both
the invoked skill and the reason; a lucky invocation with the wrong boundary is
still a regression.

## Pressure Scenarios

```bash
bash tests/prd-state-modeling/run-test.sh \
  tests/prd-state-modeling/prompts/bootstrap-routing-probes.txt
```

The bootstrap prompt covers read-only understanding, exact execution,
deceptively small contract changes, durable wiki requests, unfamiliar refactors,
report-only review, and review-and-fix.

## Architectural Execution E2E

The projects under `tests/subagent-driven-dev/` are manual, potentially costly
end-to-end scenarios:

```bash
tests/subagent-driven-dev/run-test.sh go-fractals
tests/subagent-driven-dev/run-test.sh svelte-todo
```

They produce a temporary project and a stream-json transcript. Judge plan
loading, write-set isolation, TDD evidence, task self-checks, integrated
verification, and the single final review. They intentionally do not enforce
the retired per-task reviewer fan-out.

## Token Analysis

```bash
python3 tests/claude-code/analyze-token-usage.py \
  ~/.claude/projects/<project-dir>/<session-id>.jsonl
```

Record fixed startup/context cost separately from task execution cost. A routing
change regresses when it loads a workflow or creates an artifact without a
trigger, even if the final code is correct.

## Test Authoring Rules

- Keep deterministic shell tests free of model calls.
- For trigger tests, include a positive case and the nearest confusing negative
  case (for example code understanding versus diff review).
- Parse stream-json tool calls, not prose alone.
- Preserve transcripts for failed live runs.
- Verify final artifacts and commands rather than trusting agent summaries.
