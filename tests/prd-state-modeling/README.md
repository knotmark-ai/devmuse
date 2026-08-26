# DevMuse Regression Suite

Re-runnable versions of the scenarios that gated the 1.3.0 state-modeling changes and the 2.0 guidance-over-enforcement change. Run them after editing the pipeline skills, `state-modeling.md`, `domain-model.md`, `grilling.md`, or the bootstrap routing rules — and after switching default models.

Each prompt instructs the agent to simulate the skill against a fixed product brief and end with a structured self-report. Judgment is against the self-report + artifact, per the criteria below. A scenario regresses when any of its pass criteria fails.

## Running

```bash
./run-test.sh prompts/<scenario>.txt
# transcript lands in /tmp/devmuse-tests/<ts>/prd-state-modeling/
```

Judge the transcript manually, or use the auto-judge:

```bash
./run-test.sh prompts/<scenario>.txt 6 --judge   # run, then score in one step
./judge.sh <scenario> [transcript.json]          # score an existing transcript
```

`judge.sh` builds a grading prompt from this file's criteria table (the single
source of truth — `parse-criteria.mjs` reads the rows below, nothing duplicates
them), hands the transcript to a headless `claude` judge, and parses a
per-criterion verdict. `overall` is recomputed from the sub-verdicts, so a judge
that marks any criterion `fail` cannot return an overall pass; an unparseable
judge response is an error, never a silent pass. The deterministic parser and
verdict logic are covered by `npm run test:regression-judge` (no model needed);
the judge invocation itself needs the `claude` CLI.

## Scenarios and pass criteria

| Prompt | Simulates | Pass criteria |
|---|---|---|
| `full-stateful-booking.txt` | Full-mode create, meeting-room booking (approval + check-in + no-show) | Object model triggers (quotes trigger text); closed state list with no "等/etc."; every transition has actor + boundary semantics (inclusive/exclusive, named clock); pending-occupies-slot surfaced as invariant/fork; terminal states no-revival; duplicate-submission guarantee present |
| `vague-groupbuy-dialogue.txt` | Full-mode §-interview, user gives vague group-buy answers | group states exhaustive; participant order modeled as a separate machine; boundary-instant race handled; duplicate submission guaranteed; refund-failure state present; post-confirmation cascade covered; coverage traced to skill/principle text, not domain luck |
| `stateless-cli-no-trigger.txt` | Lightweight create, stateless CLI tool | Object model does NOT fire (quotes trigger text evaluated); zero state machines written anywhere; no user-facing-app sections (information architecture, wireframes, tiering) are invented — the CLI command/flag surface is this profile's core, not a UI |
| `variation-subscription.txt` | Full-mode, SaaS subscription (domain absent from principle examples) | ≥3 machines identified (subscription, charge, seat candidate); grace-period hidden state caught; cancel-timing fork caught; catches traced to domain-agnostic detectors (lifecycle sentence blanks, classification table, self-check) |
| `lightweight-stateful.txt` | Lightweight create, stateful product, repo without CONTEXT.md | Machine written to CONTEXT.md §6, **not** into the PRD body — lightweight changes the model's size, not its home; CONTEXT.md created from `knowledge/templates/context-md.md`; PRD body cites state names only |
| `update-stance-machines.txt` | `/mu-prd update` on a PRD whose machines live in CONTEXT.md §6, dual gap-fill+sync changes | Both files loaded (quotes branch text); state edits land in CONTEXT.md, PRD body cites names; terminal-state change surfaced as user fork; sync covers machine-vs-code drift; self-check re-run per touched machine; **two History rows — machine change in CONTEXT.md §7, PRD body change in the PRD**; prefix = highest-priority sub-type |
| `bootstrap-routing-probes.txt` | Twelve routing probes against rules/bootstrap.md | Probe decisions: bug→mu-scope; code understanding→Direct read-only; small talk→no route; exact typo and reversible asset curation→Direct execution; deceptively small public-contract change→mu-scope; product-flow ask→pointer to /mu-prd; durable architecture docs→pointer to /mu-wiki; unfamiliar refactor→mu-scope Quick Probe; review of a bug-fix PR→report-only mu-review; explicit review-and-fix→authorized mu-review |
| `evidence-substitution.txt` | Detailed PRD, no scope; user asks for design directly | PRD accepted as requirements evidence; scope collapses to the evidence fast path (~1 report + 1 confirmation, no re-interview); full override honored with a flag |
| `guidance-floor.txt` | No artifacts, vague ask, "别问那么多直接开写" pressure | Recommendation made BEFORE any override; user (not agent) waives sequence; TDD/verification/approval gates never yield |

## History

Baselines and full runs for the original RED/GREEN cycle are summarized in the commit messages of `1146c85`, `7431039`, and `feace46` (2026-07-26).
