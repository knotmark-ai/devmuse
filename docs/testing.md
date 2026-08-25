# Testing DevMuse

DevMuse tests separate deterministic contract checks from live-model behavior.
Run the cheap layer on every routing or skill edit; run live Claude scenarios
when changing descriptions, trigger boundaries, or model versions.

## Test Structure

See the `tests/` directory for the current suites. Deterministic checks cover
routing, hooks, host packaging, release behavior, metadata, Mermaid, and token
accounting; live suites cover model-trigger and end-to-end agent behavior. This
document groups them by execution cost instead of copying a directory listing.

## Fast Deterministic Checks

```bash
npm run build:adapters
npm run test:acceptance   # the single gate CI and the release job both run
git diff --check
```

`test:acceptance` is the one canonical aggregate (defined in `package.json`) that
runs every required suite — generated-drift, skills, platforms, routing, hooks,
Mermaid, GitHub-first, project-context, project-registry, regression-judge,
cross-review, profiles, token-benchmark, and release. Both `ci.yml` and
`release.yml` delegate to it, so CI and the release gate cannot drift. It is
**fully deterministic**: it makes no live model calls and its result does not
depend on which binaries are installed.

The live tests — the cross-review smoke and the codex-dispatch behavioral suite,
which invoke the real `claude`/`codex` binaries — are **opt-in** and NOT part of
the gate. Run them separately with `npm run test:live` (sets `DEVMUSE_LIVE=1`);
they skip unless that flag is set, and further skip any binary that is absent.

The platform contract compares the canonical and generated skill inventories,
checks every vendored reference, validates host manifests and version alignment,
and enforces the Codex/Gemini native-capability policy. Release validation also
runs Codex's `plugin-creator` validator against `adapters/codex/` when that
system skill is available.

The routing-policy test is the regression contract for Direct, bounded, and
architectural ceremony; read-only inspection; review modes; retired artifacts;
and single-owner rules such as `docs/wiki/`.

`npm run test:project-context` exercises manifest validation, stable identity,
linked-worktree cache behavior, operation-scoped authorization, managed
revisions, create recovery, delivery projection, and workflow wiring with
deterministic fake provider inputs. Individual named scenarios and expected
results are documented in
[`tests/project-context/live-scenarios.md`](../tests/project-context/live-scenarios.md).
They do not authorize or perform a GitHub mutation.

Live GitHub checks are a separate, explicitly authorized layer. Use a
disposable fixture repository or `--dry-run` for mutation paths; use read-only
Issue/PR queries when dogfooding against this repository. A passing fake
adapter proves the decision contract, while a live check proves the current
host binding and provider state.

## Release Verification

`npm run test:release` exercises the release model, deterministic archive
writer, two-build comparison, safe extraction, host lifecycle smoke,
finalization, publication retry boundaries, workflow permissions, and
documentation contracts without contacting GitHub Releases or npm.

Run a complete local dry run with a temporary output directory:

```bash
release_root="$(mktemp -d)/release"
npm run release:build -- --output "$release_root"
npm run release:verify -- --input "$release_root"
npm run release:smoke -- --input "$release_root" --evidence "$release_root/smoke-evidence.json"
npm run release:finalize -- --input "$release_root" --evidence "$release_root/smoke-evidence.json"
```

The tag workflow repeats packaging and smoke on Linux, macOS, and Windows,
compares the build-stage checksum contract, and finalizes one verified output.
Manual dispatch stops there. Only a matching remote version tag can reach
attestation, GitHub Release mutation, or the isolated optional npm job.

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

## Model-churn regression routine

Every model release re-breaks skill triggering, so the prd-state-modeling suite
is only meaningful against the model actually in use. **Rerun the whole suite on
every default-model change**, and after any change to the pipeline skills,
`state-modeling.md`, `domain-model.md`, `project-profiles.md`, or the bootstrap
routing rules:

```bash
bash tests/prd-state-modeling/run-all.sh          # run + auto-judge every scenario
SCENARIOS="stateless-cli-no-trigger" \
  bash tests/prd-state-modeling/run-all.sh        # or a named subset
```

`run-all.sh` runs each scenario through headless `claude`, judges the transcript
against the README criteria with `judge.sh` (the #41 auto-judge — single source
of criteria, any failed criterion fails the scenario), and exits non-zero if any
scenario regressed or could not be judged. The deterministic parser/verdict logic
is covered by `npm run test:regression-judge`; the runs themselves need the
`claude` CLI and are a manual/CI step, not part of the fast `npm` suites.

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
bash tests/token-benchmark/run-benchmark.sh
```

The benchmark pairs vanilla and DevMuse fixed baselines, runs the same bounded
task with and without the plugin, and includes a manual-cost architectural
pipeline from scope through review. It reports provider result-event tokens and
baseline-subtracted task traffic without hard-coding prices. See
`tests/token-benchmark/README.md` for repetitions, filters, and interpretation.

`tests/claude-code/analyze-token-usage.py` remains available for legacy Claude
session files. Use the benchmark for comparisons: a routing change regresses
when it loads a workflow or creates an artifact without a trigger, even if the
final code is correct.

## Test Authoring Rules

- Keep deterministic shell tests free of model calls.
- Edit `plugin/skills/`, then regenerate adapters; do not hand-edit
  `adapters/codex/skills/`.
- For trigger tests, include a positive case and the nearest confusing negative
  case (for example code understanding versus diff review).
- Parse stream-json tool calls, not prose alone.
- Preserve transcripts for failed live runs.
- Verify final artifacts and commands rather than trusting agent summaries.
