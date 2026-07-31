# Prose Discipline

**When to use:** Every skill that writes a document a human will read — MRD, PRD, scope, design spec, plan, explore artifact, wiki page, retro. Apply while drafting, not as a cleanup pass afterwards. Distilled from the aflaj readability rework (2026-07-28/29), where two full days went into repairing documents that were structurally complete and unreadable.

**Purpose:** A document that passes its template and still has to be re-read three times has failed. Templates guarantee the sections exist; these rules guarantee the sections can be used. The failure they prevent is **information stacking** — true statements piled in the order they were discovered, with the reasoning that connects them left in the author's head.

## The Rules

**1. Conclusion first.** The title states the question the document answers, not its topic ("Why identity keeps surfacing" beats "Identity research"). The opening carries a one-sentence conclusion plus *what this document answers and what it does not*. Bad news goes near the top, not in a closing caveat.

**2. Meta belongs in the appendix.** Method, scope, version, revision notes — anything about *how the document was made* — sits after the content, not before it. A reader who wants the content should not scroll past the process.

**3. Show the derivation.** A load-bearing claim states how it was reached, not just its verdict. "Three criteria, derived from X and Y" beats "the three criteria are…". The test: could a reader disagree with the reasoning? If there is nothing to disagree with, only an assertion was written.

**4. Gloss on first use.** A coined term, an abbreviation, or a borrowed word used in a project-specific sense gets one clause of explanation the first time it appears — or a pointer to `CONTEXT.md`. Later occurrences run bare.

**5. One column, one question.** Each table column's header is a question the column answers. A column carrying two questions ("Type / Status") splits into two. A table whose columns cannot be phrased as questions is prose in disguise.

**6. One symbol, one meaning.** Numbering and lettering systems must not collide across a document set: if archetypes are A–G, sub-types cannot also be A/B/C; if pages are P1–P9, priorities cannot be P0–P2. Rename one side before the collision has to be explained.

**7. One metaphor, carried through.** A figure of speech either holds for the whole passage or is dropped. Mixed metaphors ("the spine of the funnel feeds the flywheel") cost the reader more than the plain sentence would have.

**8. Readable body, rigor in footnotes.** The body stays prose a person can read at speed. Source grading, precise qualifications, and boundary conditions move to numbered footnotes and a References section. Only the single most load-bearing claim in a section keeps its qualification inline.

**9. State absence as absence.** "None found in this round" — never "there is none". A negative claim carries the scope that was searched. Unresolved items and do-not-cite material get an explicit list at the end rather than silence.

## Common Failures

| Symptom | What it actually is | Fix |
|---|---|---|
| Reader asks "so what?" after a section | Conclusion buried at the end | Rule 1 |
| Reader asks "where did this come from?" | Assertion without derivation | Rule 3 |
| Reader stops at a term and scrolls back | No gloss on first use | Rule 4 |
| A table needs a paragraph to explain how to read it | Columns carry mixed questions | Rule 5 |
| Two sections use the same letter for different things | Namespace collision | Rule 6 |
| Every sentence hedged | Rigor left in the body | Rule 8 |
| "There is no X" | Unbounded negative claim | Rule 9 |

## Exit Criterion

Before an artifact is presented for approval: its title is a question, its opening states the answer and the boundary, every load-bearing claim shows its derivation or cites its source, every coined term is glossed at first use, every table column is phrasable as a question, no symbol carries two meanings, and every negative claim names the scope it was checked against.

**The read-aloud check:** read the opening paragraph aloud. If it takes more than one breath to reach the point, rule 1 has been violated.
