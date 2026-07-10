# Domain Glossary (CONTEXT.md)

**When to use:** Consumed by `mu-explore` (harvest step) and `mu-arch` (consult-before-naming, record-after-coining). All other skills and sessions consume the artifact passively via the bootstrap rule. Adapted from mattpocock/skills' shared-language mechanism.

**Purpose:** One compact term replaces a sentence, session after session — "the materialization cascade" instead of "the problem when a lesson inside a section is given a spot in the file system". A shared language makes the agent name variables/files consistently, navigate the codebase by its own vocabulary, and spend fewer tokens thinking. The glossary is read at session start, so every entry costs context every session: the bar for entry is high and pruning is part of maintenance.

## The Artifact

- **Location:** `CONTEXT.md` at the repo root. Root placement makes it visible to humans and agents alike; the user may `@`-reference it from `CLAUDE.md` to force-load it.
- **Lazy creation:** create it the first time a qualifying term exists. An empty scaffold is noise.
- **Size:** soft cap ~25 terms. At the cap, prune or merge before adding. A repo with genuinely separate bounded contexts splits into per-context files only when one glossary starts serving two vocabularies — not before.
- **Single source of truth:** explore artifacts, design docs, and wiki pages link to `CONTEXT.md` for shared terms; they never restate a definition. Area-local jargon (used only inside one component) stays in that area's explore artifact.

## Qualification Test

A term enters `CONTEXT.md` only if **all three** hold:

1. **Project-specific** — invented by or peculiar to this project. General engineering vocabulary (TDD, frontmatter, worktree, dogfooding) and the host platform's concepts fail, however often they appear.
2. **Compression** — it replaces a phrase or sentence in real conversations about the project. If the term saves no words, it earns no slot.
3. **Recurring** — needed to discuss the project across files or sessions, not to describe one file's internals.

The tie-breaker when unsure: *would a competent engineer, fluent in the stack but new to this repo, misunderstand a project conversation without this entry?* No → leave it out.

## Entry Format

```markdown
**<Term>**
<One-sentence definition.>
_Avoid_: <synonym>, <synonym>
```

The `_Avoid_` line is the anti-drift lever: it names the synonyms the project deliberately does not use, so agents stop oscillating between "issue tracker / backlog manager / issue host" and converge on one word. Write it for every term that has plausible synonyms.

## Sections

```markdown
# <Project> Domain Language
## Language        — the terms (entry format above)
## Relationships   — optional; only structural facts ("an Issue carries one Triage role at a time")
## Flagged Ambiguities — one term with two meanings, or two terms for one meaning; open or resolved
```

Template: `@../templates/context-md.md`

## Maintenance Moves

- **Harvest** (`mu-explore`): after building the explore artifact, run each collected domain term through the qualification test. Promote the passers into `CONTEXT.md` (create it if absent); the explore artifact's Domain Terms section keeps only area-local terms and links to `CONTEXT.md` for the rest.
- **Coin** (`mu-arch`): before naming a new component or concept, read `CONTEXT.md` and reuse existing language. When a design coins a name the user approves, record it — definition plus `_Avoid_` — in the same commit as the design doc.
- **Resolve** (any skill): on finding a term used with two meanings, or two terms for one meaning, add it to Flagged Ambiguities. When the user rules, record the resolution, update the winning entry's `_Avoid_` list, and rename stragglers opportunistically.

## Exit Criterion

A harvest or coin move is done when every added entry passes the qualification test, carries an `_Avoid_` list where synonyms plausibly exist, and no definition is duplicated anywhere else in the repo's docs.
