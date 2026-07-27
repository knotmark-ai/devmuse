# DevMuse Regression Suite

Re-runnable versions of the scenarios that gated the 1.3.0 state-modeling changes and the 2.0 guidance-over-enforcement change. Run them after editing the pipeline skills, state-modeling.md, grilling.md, or the bootstrap routing rules — and after switching default models.

Each prompt instructs the agent to simulate the skill against a fixed product brief and end with a structured self-report. Judgment is against the self-report + artifact, per the criteria below. A scenario regresses when any of its pass criteria fails.

## Running

```bash
./run-test.sh prompts/<scenario>.txt
# transcript lands in /tmp/devmuse-tests/<ts>/prd-state-modeling/
```

Judge the transcript manually or hand it to a subagent with the criteria table below.

## Scenarios and pass criteria

| Prompt | Simulates | Pass criteria |
|---|---|---|
| `full-stateful-booking.txt` | Full-mode create, meeting-room booking (approval + check-in + no-show) | Object model triggers (quotes trigger text); closed state list with no "等/etc."; every transition has actor + boundary semantics (inclusive/exclusive, named clock); pending-occupies-slot surfaced as invariant/fork; terminal states no-revival; duplicate-submission guarantee present |
| `vague-groupbuy-dialogue.txt` | Full-mode §-interview, user gives vague group-buy answers | All six lifecycle gaps covered ([a] group states exhaustive, [b] participant order as separate machine, [c] boundary-instant race, [d] duplicate submission, [e] refund-failure state, [f] post-confirmation cascade); coverage traced to skill/principle text, not domain luck |
| `stateless-cli-no-trigger.txt` | Lightweight create, stateless CLI tool | Object model does NOT fire (quotes trigger text evaluated); zero state machines/companion files; output limited to the 3 lightweight sections |
| `variation-subscription.txt` | Full-mode, SaaS subscription (domain absent from principle examples) | ≥3 machines identified (subscription, charge, seat candidate); grace-period hidden state caught; cancel-timing fork caught; catches traced to domain-agnostic detectors (lifecycle sentence blanks, classification table, self-check) |
| `lightweight-stateful.txt` | Lightweight create, stateful product, repo without CONTEXT.md | In-body state tables placed before core flows; CONTEXT.md created via domain-glossary qualification test; header uses "in-body"; no companion file |
| `update-stance-companion.txt` | `/mu-prd update` on a PRD with `.objects.md`, dual gap-fill+sync changes | Companion loaded (quotes branch text); state edits go to object model, body cites names; terminal-state change surfaced as user fork; sync covers object-model drift; self-check re-run per touched machine; History one row per change, prefix = highest-priority sub-type |
| `bootstrap-routing-probes.txt` | Five routing probes against rules/bootstrap.md | Probe decisions: (1) bug→mu-scope silent, (2) understand→mu-explore silent, (3) small talk→no route, (4) "太简单直接改"→still routes (cites Red Flags + WHAT-not-HOW), (5) product-flow ask→pointer to /mu-prd, no invocation |
| `evidence-substitution.txt` | Detailed PRD, no scope; user asks for design directly | PRD accepted as requirements evidence; scope collapses to the evidence fast path (~1 report + 1 confirmation, no re-interview); full override honored with a flag |
| `guidance-floor.txt` | No artifacts, vague ask, "别问那么多直接开写" pressure | Recommendation made BEFORE any override; user (not agent) waives sequence; TDD/verification/approval gates never yield |

## History

Baselines and full runs for the original RED/GREEN cycle are summarized in the commit messages of `1146c85`, `7431039`, and `feace46` (2026-07-26).
