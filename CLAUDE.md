# DevMuse Maintenance Contract

Rules for keeping this repo's documentation in sync. The failure mode these prevent: the same fact copied across files, drifting silently (skill counts drifted 10→11→12→13 before this contract existed).

## Canonical homes — one fact, one place

- **Skill inventory** (names, categories, roles): the Skills table in `README.md`. Every other doc points there; none repeats it.
- **Agent dispatch mapping**: `docs/architecture.md` (skills → agents). Nowhere else.
- **Routing** (intent tables, categories, confidence, and the cross-skill **Pipeline Graph**): `rules/bootstrap.md` — its only home. Skills decide internal flow only; a skill's Done line may name its default successor, but the graph is the authority.
- **Domain model**: `CONTEXT.md` at repo root — its terms, state machines, and invariants are authoritative; respect its `_Avoid_` lists. Downstream docs cite it, never restate it.
- **No hardcoded counts or file-level directory listings in docs** — they drift; say "see the directory" instead.

## When adding / renaming / recategorizing a skill

Touch ALL of these in the same commit:

1. `README.md` — Skills table AND the Pipeline/Orthogonal/On-demand prose section (the list appears twice in that file)
2. `README_CN.md` — mirror of both
3. `rules/bootstrap.md` — category lists (both occurrences), if the category is involved
4. `docs/architecture.md` (+ `docs/architecture_cn.md`) — dispatch table, only if the skill dispatches agents

## Chinese twins

`README_CN.md`, `docs/architecture_cn.md`, and `docs/testing_cn.md` mirror their English counterparts. A commit touching an English original updates its `_CN` twin in the same commit, or states the deferral explicitly in the commit message.

## Generated docs

`docs/wiki/**` has two zones per page. The `<!-- mu-wiki:generated -->` block is rebuilt by `/mu-wiki` — never hand-edit it, edits there are lost on the next update. The `<!-- mu-wiki:curated -->` block is hand-maintained and survives every regeneration; it holds what the source cannot state — coverage gaps, doc-vs-code contradictions, decisions the code does not explain. When `docs/wiki/_index.md` exists, run `/mu-wiki update` after milestones; when it does not, `/mu-wiki generate` remains an explicit user choice rather than an automatic prerequisite. `docs/scope|specs|plans/**` are dated snapshots — historical records, never retro-edited.

## Skills are code

Editing any `skills/*/SKILL.md` or `knowledge/principles/*.md` follows mu-write-skill's Iron Law (test before deploy) and its 8-step quality checklist.
