# Sign-off Gate (Stakeholder-scope axis)

Shared principle consumed by `mu-biz`, `mu-prd`, and `mu-arch` at exit-criterion time when stakeholder-scope signals team-touching work. Parallels `stance-detection.md` in structure: a cheap heuristic block + a protocol the consuming skill runs locally.

Orthogonal to stance: a `create` biz doc can still require sign-off; a `skip` stance skips the work AND the gate (nothing to sign off on).

## When It Fires

All THREE conditions must hold:

1. The creative skill's existing exit criterion has been met (artifact approved by user)
2. The skill's existing HARD-GATEs are satisfied (sign-off NEVER bypasses gates)
3. Stakeholder-scope = `team-touching` per the detection heuristics below

## When It Does NOT Fire

- `stakeholder-scope = solo` — no gate
- existing HARD-GATEs not yet satisfied — those fire first; sign-off gate comes after
- stance = `skip` — pass-through; no artifact work, no sign-off needed

## Detection Heuristics (stakeholder-scope = team-touching)

Any ONE sufficient. If ALL absent → solo (no gate).

| # | Signal | Command / check |
|---|--------|-----------------|
| S1 | CODEOWNERS file exists | `test -f .github/CODEOWNERS \|\| test -f CODEOWNERS` |
| S2 | Multi-author recent history | `git log --since="90 days ago" --format=%ae -- <watched-dirs> \| sort -u \| wc -l` returns ≥3 |
| S3 | Explicit user declaration | User said "team project", "shared code", "need RFC", "team-touching" in session |

**Per-skill watched-dirs** (matches stance-detection.md parameter tables):
- mu-biz: root `README*`
- mu-prd: `src/pages/`, `src/screens/`, `src/views/`, `app/` (fallback `src/`)
- mu-arch: `src/`, `lib/`, `internal/`, `pkg/`, `cmd/`

## Gate Protocol

1. **Announce**: agent outputs one sentence before terminal invocation:
   > "This artifact touches team territory (detected via `<which signal fired>`). Circulate to stakeholders and reply 'signed off' when approved, or 'skip sign-off' to override. Stakeholders inferred from CODEOWNERS/recent git authors: `<names or count>`."

2. **Wait for user reply**. NOT blocking in the HARD-GATE sense — user can say "skip sign-off" at any time; guidance-over-control philosophy holds.

3. **On 'signed off'**: append to the artifact's History section:
   ```
   | <date> | <commit-sha> | sign-off | — | approved by: <names or N stakeholders> |
   ```

4. **On 'skip sign-off'**: append to History:
   ```
   | <date> | <commit-sha> | sign-off | — | skipped by user at <time> |
   ```

5. **Proceed** to the existing terminal invocation (next skill in pipeline).

## Consumption Pattern in Creative Skills

Each of mu-biz / mu-prd / mu-arch, at the **end of its Process section** (after artifact approval + commit, before terminal invocation), should include:

```markdown
Before terminal invocation, consult `@../../knowledge/principles/sign-off-gate.md`.
If stakeholder-scope indicates team-touching, run the gate protocol before handing off.
```

The consuming skill does NOT reimplement the detection or the protocol — it just references this principle. Agent reads, runs, moves on.

## Error Handling

- **ER-S1 CODEOWNERS missing + single-author history + no user declaration** → stakeholder-scope defaults to solo; gate does NOT fire. No ask.
- **ER-S2 CODEOWNERS exists but malformed** → treat as present (signal S1 fires); ask user in protocol for stakeholder list if names can't be parsed.
- **ER-S3 user never replies after announcement** → not this principle's problem; conversation is suspended until user returns. Agent should not force proceed.
- **ER-S4 user replies with something ambiguous** (e.g., "meh") → treat as "skip sign-off" with a History note: `"ambiguous reply: <verbatim>"`. Non-blocking.

## Interaction with Stance

Sign-off gate is independent of the artifact stance:

| Stance | Gate fires? |
|--------|-------------|
| create / update / extract | Yes, if stakeholder = team-touching |
| skip | No — pass-through skips the gate too |

## Relationship to HARD-GATEs

Sign-off gate is **NOT** a HARD-GATE. HARD-GATEs are structural ("no design without scope"; "no implementation without design"). Sign-off is **collaborative** ("stakeholders agree before proceeding"). It runs later and can be explicitly skipped by the user.

## Worked Example

mu-arch has just approved a design doc for `src/auth/`. Session context:
- `.github/CODEOWNERS` exists → S1 fires → stakeholder-scope = team-touching
- Stance is `update(sync)` (not skip)

Agent at exit:
> "This arch design touches team territory (detected via CODEOWNERS). Circulate to stakeholders and reply 'signed off' when approved, or 'skip sign-off' to override. Stakeholders from CODEOWNERS: @security-team, @backend-leads."

User (after async review): "signed off".

Artifact History gains:
```
| 2026-04-17 | abc1234 | sign-off | — | approved by: @security-team, @backend-leads |
```

Agent proceeds to `mu-plan` per existing terminal.
