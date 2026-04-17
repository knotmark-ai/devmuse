---
name: mu-prd
description: "Product requirements — user flows, screens, per-feature specs, tiering rules. For technical architecture use mu-arch. For business strategy use mu-biz first."
---

# Product Requirements

**Scope:** User-facing product requirements — personas, flows, wireframes, feature specs, tiering rules, NFRs, metrics. For business strategy use **mu-biz** first. For technical architecture use **mu-arch** after this.

Independent of the feature-level pipeline. Product-level skill that runs **once per product**, not per feature. Reads biz artifact as input; outputs PRD that becomes input for per-feature mu-scope.

<HARD-GATE>
Do NOT invoke mu-scope or any feature-level skill until the user has approved the PRD artifact. The PRD must cover all MVP features from the biz artifact.
</HARD-GATE>

**HARD-GATEs evaluated BEFORE Phase 0.** A `skip` stance does not bypass them.

## Phase 0: Stance Detection

Before Depth Mode Selection, detect the current state of any existing PRD artifact and pick an entry stance.

1. Read `@../../knowledge/principles/stance-detection.md`
2. Run the detection algorithm with:
   - **Artifact type**: `prd`
   - **Artifact dir**: `docs/prd/`
   - **Watched source dirs**: `src/pages/`, `src/screens/`, `src/views/`, `app/`. **Fallback**: if none of those exist (backend/CLI/library projects), fall back to top-level `src/` directly; if that also doesn't exist, H3 returns `insufficient-signal`.
   - **Legacy locations**: root `PRD.md`
   - Never watch `docs/prd/` itself (circular).
3. Present the recommendation in one sentence (exact phrasing may adapt):
   > "Detected: stance=`<stance>` (sub=`<sub-type>`), confidence=`<high|ambiguous>`. Reason: `<one-line>`. OK to proceed, or override?"
4. Accept user override in one word (`create` / `update` / `extract` / `skip`) or proceed on bare "ok". **Slash-command hints (`/mu-prd <stance>`) and upstream-invoked hints (e.g., `mu-prd create` passed from mu-biz Full-mode terminal per spec §2.5) are treated as pre-confirmed — no dialog, proceed directly.** This is how the biz→prd auto-handoff stays smooth in Full-mode chains.
5. Record approved stance. Route to matching branch below.

**Branch routing**:

| Stance | Action |
|--------|--------|
| `create` | Run Depth Mode Selection, then existing Process (Lightweight or Full) unchanged. |
| `update` | Load existing PRD artifact → apply sub-type logic (`expand` fills stub sections; `gap-fill` appends a new feature spec section titled "Gap-fill: `<feature>`"; `sync` aligns feature descriptions to current code behavior) → merge via section approval. |
| `extract` | Read source dirs (pages/screens/views/app or fallback src/) section-by-section, synthesize a PRD covering observed features + flows + screens. Commit prefix: `extract:`. |
| `skip` | Append pass-through history entry; invoke `mu-scope` for the first MVP feature per existing Integration. No stance hint is passed to `mu-scope` since it isn't a creative skill. |

**Stance × Depth Mode interaction**:

mu-prd has two independent concepts: **Stance** (Phase 0) and **Depth Mode** (lightweight/full, below). Slash hints may specify either or both; tokens are split cleanly per spec §2.5:

| User / upstream input | Stance | Depth mode |
|-----------------------|--------|-----------|
| `/mu-prd` | auto-detect in Phase 0 | auto-detect in Depth Mode Selection |
| `/mu-prd create` | `create` (forced) | auto-detect |
| `/mu-prd lightweight` | auto-detect | `lightweight` (forced) |
| `/mu-prd create full` | `create` | `full` |
| `mu-prd create` (upstream-invoked from mu-biz Full-mode terminal) | `create` (pre-confirmed, no dialog) | auto-detect |

Phase 0 parses only the stance token; Depth Mode Selection parses only the depth token.

**Stance → artifact metadata**: add `> **Stance:** <stance>`, `> **Sub-type:** <sub-type or —>`, `> **Detected at:** YYYY-MM-DD (commit <short-sha>)` to the PRD header. Commit prefix: `docs(prd): <stance>[(sub-type)]: ...`. Opt-out per invocation via `--no-stance-meta`.

## Depth Mode Selection

| Signal | Depth mode | Scope |
|---|---|---|
| Solo dev, small project, "lightweight PRD", `/mu-prd lightweight` | **Lightweight** | Core flows + key specs only |
| Team project, investor-facing, formal product, `/mu-prd full` | **Full** | All 9 sections |
| Unclear | Ask; default to lightweight |

## Process Flow

```dot
digraph mu_prd {
    "Read biz artifact" [shape=box];
    "Biz artifact exists?" [shape=diamond];
    "Ask user for biz context inline\n(flag 'no biz artifact')" [shape=box];
    "Detect mode\n(lightweight or full)" [shape=diamond];
    "Produce PRD sections\n(one at a time, user approves each)" [shape=box];
    "Visual Companion\n(for wireframes)" [shape=box];
    "Write PRD artifact\n(docs/prd/)" [shape=box];
    "User picks first MVP feature" [shape=box];
    "Invoke mu-scope\nfor that feature" [shape=doublecircle];

    "Read biz artifact" -> "Biz artifact exists?";
    "Biz artifact exists?" -> "Detect mode\n(lightweight or full)" [label="yes"];
    "Biz artifact exists?" -> "Ask user for biz context inline\n(flag 'no biz artifact')" [label="no"];
    "Ask user for biz context inline\n(flag 'no biz artifact')" -> "Detect mode\n(lightweight or full)";
    "Detect mode\n(lightweight or full)" -> "Produce PRD sections\n(one at a time, user approves each)";
    "Produce PRD sections\n(one at a time, user approves each)" -> "Visual Companion\n(for wireframes)" [label="when visual needed"];
    "Visual Companion\n(for wireframes)" -> "Produce PRD sections\n(one at a time, user approves each)";
    "Produce PRD sections\n(one at a time, user approves each)" -> "Write PRD artifact\n(docs/prd/)";
    "Write PRD artifact\n(docs/prd/)" -> "User picks first MVP feature";
    "User picks first MVP feature" -> "Invoke mu-scope\nfor that feature";
}
```

## Process

### 1. Read biz artifact

Look for `docs/biz/YYYY-MM-DD-*.md`. If found, extract:
- Target persona (baseline)
- MVP feature list
- Tiering rules (if any)
- Success metrics / North Star

If not found, ask the user to provide business context inline. Log "no biz artifact referenced" in the PRD header.

### 2. PRD Sections

Produce sections one at a time, approving each before moving on.

#### Full mode (9 sections)

1. **Persona deepening** — concrete scenarios for the target persona(s). "A day in the life" / usage contexts.
2. **Information architecture / feature map** — hierarchy of features, navigation structure
3. **Core user flows** — journey maps or sequence diagrams for primary tasks
4. **Key screen wireframes** — text/mermaid wireframes for critical screens. Use Visual Companion for mockups when visual questions arise.
5. **Per-feature specs** — for each MVP feature: what it does, why, user-facing rules (edge cases in user terms, not code). **Scope boundary:** these are product-level rules (what the user sees and agrees to) — mu-scope later enumerates all concrete paths (happy / edge / error use cases) through those rules on a per-feature basis. Do not pre-enumerate UCs here.
6. **Tiering rules** — free vs paid behavioral boundaries (quotas, features, upgrade triggers)
7. **Non-functional requirements** — performance targets, privacy/compliance needs, accessibility, localization
8. **Success metrics → instrumentation** — which events to track for each flow; how funnel metrics are computed
9. **Open questions / assumptions** — things not yet decided that downstream work must resolve

#### Lightweight mode (3 sections)

Minimum viable PRD for solo/small projects:
1. **Core user flow(s)** — 1-3 primary flows only
2. **Key per-feature specs** — MVP features, minimal detail
3. **Open questions** — what to defer

### 3. Visual Companion

For screen/layout questions, offer the Visual Companion (same pattern as mu-arch). Accept → browser-based wireframing. Decline → mermaid/ASCII in the doc.

### 4. Write artifact

Save to `docs/prd/YYYY-MM-DD-<product>.md`. Commit.

### 5. Invoke mu-scope

Ask the user which MVP feature to start with. Then invoke mu-scope for that feature. Remaining features go through mu-scope iteratively, one at a time.

## Artifact Format

```markdown
# PRD: <product name>

> **Date:** YYYY-MM-DD
> **Depth mode:** lightweight | full
> **Stance:** <create | update | extract | skip>
> **Sub-type:** <expand | gap-fill | sync | —>
> **Detected at:** YYYY-MM-DD (commit `<short-sha>`)
> **Biz reference:** docs/biz/YYYY-MM-DD-<name>.md (or "inline" if none)

## 1. Persona Deepening
...

## 2. Information Architecture
...

## 3. Core User Flows
[mermaid or text diagrams]

## 4. Key Screen Wireframes
[mermaid / ASCII / companion screenshots]

## 5. Per-Feature Specs
### Feature: <name>
- **What:** ...
- **Why:** ...
- **Rules:** ...

## 6. Tiering Rules
| Capability | Free | Paid |
|---|---|---|
...

## 7. NFRs
- Performance: ...
- Privacy: ...
- Accessibility: ...

## 8. Success Metrics
| Metric | Target | Instrumentation |
|---|---|---|
...

## 9. Open Questions
- ...

## History

| Date | Commit | Stance | Sub-type | Change |
|------|--------|--------|----------|--------|
| YYYY-MM-DD | `<sha>` | create | — | Initial creation |
```

### Commit Convention

- `docs(prd): create: ...` — from-zero PRD
- `docs(prd): update(expand): ...` — filled stub sections
- `docs(prd): update(gap-fill): ...` — added new feature section
- `docs(prd): update(sync): ...` — aligned to current code behavior
- `docs(prd): extract: ...` — reverse-engineered from source dirs
- `docs(prd): skip: passthrough for <task>` — history-only commit if needed

**Opt-out**: user can pass `--no-stance-meta` to suppress the Stance / Sub-type / Detected-at header fields. Default is on.

## Key Principles

- **One section at a time** — get approval before moving on
- **User-facing, not tech** — describe what users see/do, not how it's built
- **Concrete specs** — "rules" are user-observable behaviors, not API contracts
- **Reference the biz artifact** — personas and MVP scope come from there; don't re-derive
- **Defer technical choices** — tech stack, API schema, DB design belong in mu-arch, not here
- **Defer use case enumeration** — per-feature UCs (happy/edge/error paths) are mu-scope's job, not mu-prd's. PRD states product rules; mu-scope enumerates concrete scenarios through them.
- **Visual when helpful** — flows and wireframes benefit from diagrams; requirements/rules are text

**Sign-off gate (before terminal):**

Before invoking mu-scope, consult `@../../knowledge/principles/sign-off-gate.md`. If stakeholder-scope indicates team-touching, run the gate protocol. Sign-off gate is skipped when stance was `skip`.

## Integration

- **Invoked by:** user manually (`/mu-prd`); or auto-invoked by `mu-biz full` on completion (passing `stance=create` pre-confirmed per spec §2.5)
- **Reads:** `docs/biz/*.md` (biz artifact if present); `@../../knowledge/principles/stance-detection.md` (Phase 0); `@../../knowledge/principles/sign-off-gate.md` (terminal if team-touching)
- **Produces:** `docs/prd/YYYY-MM-DD-<product>.md`
- **Terminal state:** Invoke mu-scope for the first MVP feature. Further features iterate through mu-scope one at a time.
