# Stance Detection (`create` | `update` | `extract` | `skip`)

Shared principle consumed by `mu-biz`, `mu-prd`, and `mu-arch` at their Phase 0 step. Each creative skill runs this algorithm locally against its own artifact type and source dirs to pick the correct entry stance.

## Inputs

- **Artifact type**: `biz` | `prd` | `arch`
- **Artifact dir**: per skill (`docs/biz/`, `docs/prd/`, or `docs/specs/`)
- **Legacy locations**: per skill — additional paths to consider as "artifact exists"
- **Current task identifier**: extracted from user message OR from scope artifact (for `arch`)
- **Watched source dirs**: per skill — directories to check for commits newer than artifact mtime

**General rule**: a skill's artifact dir is never in its own watched set (prevents circular staleness).

## Detection Algorithm

Deterministic 9-step procedure. Every call produces exactly one output, even under uncertainty.

1. **Locate candidates**: list files matching the skill's artifact-dir glob + legacy locations
2. **If 0 candidates AND source dirs empty** → stance=`create`, sub_type=null, confidence=high
3. **If 0 candidates AND source dirs non-empty** → stance=`extract`, sub_type=null, confidence=high
4. **If ≥1 candidate**, pick the candidate whose top-level heading best matches the current task identifier, tiebroken by most recent mtime (Heuristic H2's matching function is used here)
5. **If no candidate matches**, retain the most-recent-mtime candidate and proceed to step 6 with a `no-match` flag that strengthens H2's gap signal
6. Run **Heuristic H1** (stub detection) on the picked candidate
7. Run **Heuristic H2** (coverage check) — already partially computed in step 4
8. Run **Heuristic H3** (staleness) against watched source dirs
9. Apply **Decision Table** (below) — top-to-bottom, first match wins. Emit output per Output Format section.

## Heuristics

### H1 — Stub detection

| Signal | Rule |
|--------|------|
| Clear stub | word count < 300 **OR** placeholder count ≥ 3 (placeholders = `TODO`, `<TBD>`, `FIXME`, `...` literal ellipsis at end of line) |
| Clear non-stub | word count > 500 **AND** placeholder count = 0 |
| Gray zone | 300-500 words, 1-2 placeholders → flag `AMBIGUOUS`; lean to `update(expand)` |

Threshold aligned with scope UC-C1.

### H2 — Coverage check

Parse artifact's top-level headings (Markdown H1 + H2 only). Compare against current task identifier using:
- Substring match (case-insensitive), OR
- ≥60% Jaccard token overlap (alphanumeric tokens, stop-words removed)

**≥1 heading matches** → covered. **0 matches** → gap.

### H3 — Staleness check (Strategy B: fixed directory mapping)

Compute:
```bash
git log -1 --format=%at -- <watched_dirs>
```

If any watched dir has a commit timestamp > `(artifact mtime + 7 days)` → stale. The 7-day grace period prevents noise from "wrote artifact, made follow-up tweak" scenarios.

**Fallback**: if none of the skill's declared watched dirs exist in the repo, H3 returns `insufficient-signal` and is omitted from the decision. Do NOT treat insufficient-signal as "not stale" — it's a distinct value.

### H4 — Code substance check (qualifies `code exists` in R1/R2)

`code exists` in the decision table does NOT mean "watched dir has any file." It means **substantial** code: at least one watched dir with **≥50 total non-blank lines** across all its files combined. A single placeholder file or a skeleton scaffold does not count.

If watched dirs exist but total substance is below threshold (e.g., greenfield repo with scaffolding stubs), R2 still fires for `extract` but the output **confidence is `ambiguous`** and the recommendation sentence explicitly notes "code is sparse — consider `create` if this is a fresh design." This gives the user a clear override path without taking the decision away from them.

## Decision Table

Rows evaluated top-to-bottom; first match wins.

| # | 0-candidate | H1 | H2 | H3 | code exists (H4) | → stance | → sub-type | Confidence note |
|---|-------------|----|----|----|-------------|----------|------------|-----------------|
| R1 | yes | — | — | — | no (or sparse, <50 LOC) | `create` | — | high |
| R2 | yes | — | — | — | substantial (≥50 LOC per H4) | `extract` | — | high |
| R2′ | yes | — | — | — | sparse (<50 LOC, but >0) | `extract` | — | **ambiguous** — note "code is sparse; consider `create`" |
| R3 | no | stub | — | — | — | `update` | `expand` | high |
| R4 | no | not | gap | — | — | `update` | `gap-fill` | high |
| R5 | no | not | covered | stale | — | `update` | `sync` | high |
| R6 | no | not | covered | not / insufficient | — | `skip` | — | high |

**Legacy-location note**: `0-candidate` considers both the conventional artifact dir and the skill's declared legacy paths (Step 1 of the algorithm). A legacy match flips `0-candidate` to `no`.

## Sub-type Priority

When multiple `update` signals fire simultaneously (e.g., artifact is both stub AND has coverage gap AND is stale):

```
expand > gap-fill > sync
```

(Structure first, then coverage, then content.)

Because rows are evaluated top-to-bottom and R3 (expand) precedes R4 (gap-fill) which precedes R5 (sync), this priority is enforced implicitly by the table. Commit message shows the sub-type from the winning row. Artifact History section records **all** signals that fired, so the full picture is preserved even if only one sub-type drives the commit prefix.

**Cross-reference**: scope CONFLICT-3 resolution states priority as `stub > gap-fill > sync`. Stub (an H1 detection signal) maps 1:1 to `expand` (the sub-type). The two are equivalent.

## Forced-stance Overrides

User can override detection via slash hint (`/mu-<skill> <stance>`) or one-word message after recommendation. The agent **honors the override immediately** — no re-detection, no blocking.

Four conflict cases are explicitly defined to preserve the "no silent destruction" NFR from the scope:

| User forces | Artifact state | Behavior |
|-------------|----------------|----------|
| `create` | already exists | Warn once; create new file at conventional path (possibly same name — so overwrite); **do NOT** archive/move/delete existing. User is warned; if they want to preserve the old file they rename it themselves. |
| `extract` | already exists | Warn once; write extracted output to a timestamped sibling `docs/<type>/<base>-extracted-YYYY-MM-DD.md`; original artifact untouched. |
| `skip` | no artifact | Error: cannot skip what doesn't exist. Degrade to propose `create` and ask user. |
| `update` | no artifact | Error: nothing to update. Degrade to propose `create` and ask user. |

All error paths are non-blocking — the skill produces a recommendation, not a termination.

## Mid-flow Stance Switch

If the user asks to change stance after Phase 0 has completed and work is in progress (e.g., "actually, let's extract from code instead of writing from scratch"):

1. **Do not hard-stop.** Treat the request as a graceful transition, not an abort.
2. **Preserve work-in-progress**: append any already-produced content (approved sections, drafted text) to the artifact's **History** section with a note: `mid-flow switch: was <old-stance>, now <new-stance>`.
3. **Re-run Phase 0** detection with the same inputs. If the user's new stance matches detection, use it. If the user's explicit override differs from detection, honor the user per UC-A2.
4. **Continue in the new branch.** Prior WIP remains in History; new work builds on the new stance's flow.

This preserves the "guidance over control" philosophy: the user can change their mind mid-flow without losing work and without the skill refusing to transition.

## Error Handling

Maps directly to scope ER-1..ER-4:

| ID | Condition | Handling |
|----|-----------|----------|
| ER-1 | Detection heuristics contradict (e.g., simultaneous `skip` and `extract` signals) | Output `confidence=ambiguous`, propose best-guess stance, cite contradicting signals in reason. **Do NOT block** — user's one-word override resolves. |
| ER-2 | Candidate file is unreadable / corrupted / non-markdown | Catch parse failures in H1/H2/H3. Treat artifact as absent (fall through to `create` or `extract` per R1/R2). Flag the offending path in the reason field. |
| ER-3 | User picks `extract` but all source dirs are empty | Degrade to `create` with reason "no source to extract from". |
| ER-4 | During `update(sync)` flow, artifact content and code state diverge irreconcilably | Surface the specific conflict; record both versions side-by-side in the resulting artifact; do NOT silently pick one. |

## Output Format

Detection always emits a single record of this shape:

```
stance: <create | update | extract | skip>
sub_type: <expand | gap-fill | sync | null>
confidence: <high | ambiguous>
reason: <one-sentence explanation citing which heuristics fired (e.g., "H1 stub + H3 stale")>
candidate_file: <relative path or null>
h3_status: <stale | not-stale | insufficient-signal>   # surface when H3 was relevant
```

The consuming skill uses `stance` to select its Phase 0 branch, `sub_type` to parametrize `update` behavior, and `confidence` to decide whether to flag the proposal to the user with an uncertainty notice.

## Worked example

Scenario: mu-biz invoked on a repo where `docs/biz/2025-11-pilot.md` exists (250 words, 1 TODO placeholder, mtime 2026-04-01), watched source `README.md` last changed 2026-04-10, current task identifier is "complete biz plan for pilot".

- Step 1: 1 candidate (`pilot.md`)
- Step 4: title matches task identifier → picked candidate confirmed
- Step 6 H1: 250 words < 300 → **stub signal**. But 1 placeholder < 3. Gray zone (250 is actually below 300, so clear stub triggers. Revising): 250 words < 300 = clear stub. Signal: stub.
- Step 7 H2: title contains "pilot" which substring-matches task → covered
- Step 8 H3: README newer than artifact mtime + 7d grace (2026-04-10 vs 2026-04-08) → stale
- Step 9 Decision table: 0-candidate=no, H1=stub → **R3 matches first**. stance=`update`, sub-type=`expand`.
- Output:
  ```
  stance: update
  sub_type: expand
  confidence: high
  reason: H1 stub triggered (250 words < 300)
  candidate_file: docs/biz/2025-11-pilot.md
  h3_status: stale   # recorded for history even though R3 won on structure first
  ```
