# Fold Routing into Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use devmuse:mu-code (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relocate the routing mechanism from `skills/mu-route/` into `rules/bootstrap.md` and retire the skill, preserving every routing decision.

**Architecture:** A1 inline fold per `docs/specs/2026-07-17-fold-routing-into-bootstrap-design.md` — the router must operate from always-on context alone. Acceptance oracle: 13-scenario battery decisions identical to pre-fold; `grep -r mu-route` clean outside dated snapshots; bootstrap ≤135 lines.

**Tech Stack:** Markdown rule/skill files; verification via dispatched subagent scenario batteries + grep/wc gates. No application code.

**Requirements Reference:** Scope `docs/scope/2026-07-17-fold-routing-into-bootstrap.md`; Spec `docs/specs/2026-07-17-fold-routing-into-bootstrap-design.md`.

---

### Task 1: Fold the Routing section into bootstrap

**Covers:** UC-1..UC-10, UC-E1, UC-E2, UC-R1, UC-R3

**Files:**
- Modify: `rules/bootstrap.md` (replace the `### Routing` subsection AND the on-demand line inside "Four categories")
- Scratch: `/tmp/fold-test/bootstrap-draft.md` (draft for pre-install battery)

- [ ] **Step 1: Write the draft** — copy `rules/bootstrap.md` to `/tmp/fold-test/bootstrap-draft.md`; in the draft, replace the current `### Routing` subsection (the paragraph instructing to invoke mu-route + the "Slash bypasses routing" line + the "See skills/mu-route/SKILL.md" pointer) with:

```markdown
### Routing

For any **unprefixed** in-domain message — at task start or on a task
transition — classify and route directly from this section. `/mu-*`
bypasses routing.

**Signals** (cheap, never fabricate — on computation error, ask the user
for the opening move): intent verbs (table below); artifact existence
(`docs/scope|specs|prd|biz/*.md` on disk — inline conversation content
never counts); recent-author familiarity (`git log --author --since="30
days ago" -- <area>`) when reshape fires; plausible match against
installed non-DevMuse skills.

**Intent → opening move** (first match wins; multi-verb priority:
fix > review > reshape > create-feature > implement > understand):

| Signal | Opening move |
|---|---|
| understand / figure out / take over / evaluate / what does this do | **Explore** (mu-explore) |
| fix / broken / error / bug / test failing / crash | **Reproduce** (mu-scope 1-UC repro) |
| review / 检查 / look at this diff or PR / 审一下 | **Review** (mu-review) |
| reshape (refactor / clean up / restructure) — unfamiliar area | **Explore** (pre-change) → Design-tech |
| reshape or create-feature — familiar, no specs on disk | **Design-tech** (mu-arch, stance=auto) |
| implement / build this — no specs on disk | **Design-tech** (mu-arch, stance=auto) |
| implement / build this — specs exist | **Implement** (mu-code) |
| plausibly matches an installed non-DevMuse skill | propose delegating to it |
| no verb match / pathological repo state (empty, shallow) | **Explore** safe default / ask the user |

**Confidence sets friction:** single unambiguous verb → invoke silently;
two candidate moves, one dominant → one-line check ("→ **<Skill>**, ok?");
vaguer → full proposal with one-word overrides (explore / design-tech /
reproduce / review / implement). An unparseable reply to a proposal →
ask the user to restate with one word from the override list (non-blocking).
```

Also in the draft's **Four categories** block, replace the on-demand line with:

```markdown
- **On-demand** (slash only, never auto-routed — matching intents get a
  pointer, not an invocation: validate idea / business model → `/mu-biz`;
  product requirements / user flows → `/mu-prd`; wiki / architecture docs
  → `/mu-wiki`; retro / look back → `/mu-retro`; grill me / stress-test
  this plan → `/mu-grill`): mu-biz, mu-prd, mu-wiki, mu-retro, mu-grill
```

And delete the now-redundant `**Meta**` line's mu-route mention: `**Meta**: mu-route (router), mu-write-skill (skill authoring)` → `**Meta**: mu-write-skill (skill authoring)`.

- [ ] **Step 2: Gate — line count.** Run: `wc -l /tmp/fold-test/bootstrap-draft.md`. Expected: ≤135. If over, cut proposal wording (never table rows).

- [ ] **Step 3: Battery against the draft (the failing-test analogue).** Dispatch ONE fresh subagent: guidance = draft path ONLY; scenarios = the 13 below; ask for decision per scenario (invoke mu-route is NOT a valid answer anymore — valid: invoke skill X / respond normally / continue current / pointer to /command / one-line check → X / ask user). Expected decisions in brackets:
  1. "fix this bug in the login flow", no active skill → [silent invoke mu-scope (Reproduce)]
  2. "什么是 monad？" → [respond normally]
  3. active mu-debug, "再查一下这条日志" → [continue, no re-route]
  4. active mu-debug, root cause found, "好，把它修掉" → [re-route; fix verb → **Reproduce** (mu-scope 1-UC repro), per pre-fold mu-route R3 — CORRECTED during execution: this bracket originally said mu-code, inherited from the transition table deleted in the bootstrap slim; mu-route's R3 is the pre-fold canon and UC-R1 binds to it]
  5. "/mu-arch create" → [direct invocation mu-arch]
  6. "帮我看看这个产品想法值不值得做" → [pointer to /mu-biz]
  7. "就补一行代码的事，别走流程了，直接改" → [respond normally per Instruction Priority]
  8. active mu-code mid-task, "这块写完先 review 一下吧" → [re-route → mu-review]
  9. "帮我 review 一下这个 diff", fresh → [silent invoke mu-review]
  10. "look at this PR before I merge it" → [silent invoke mu-review]
  11. "fix this failing test" → [silent invoke mu-scope (Reproduce)]
  12. "这段代码看不懂，帮我理一理" → [silent invoke mu-explore]
  13. "review and fix the auth bug" → [fix wins priority → Reproduce, one-line check (medium)]

Expected: 13/13 match. Any mismatch → fix draft wording, re-run battery. Do not install until 13/13.

- [ ] **Step 4: Install.** Copy draft over `rules/bootstrap.md`. Run `wc -l rules/bootstrap.md` (≤135) and `grep -c "mu-route" rules/bootstrap.md` (expected: 0).

- [ ] **Step 5: Commit.**
```bash
git add rules/bootstrap.md
git commit -m "feat(bootstrap): inline the router — fold mu-route's tables into the always-on rule"
```

### Task 2: Contract docs — CLAUDE.md + CONTEXT.md

**Covers:** UC-R4 (canonical map + all THREE CONTEXT.md entries per design, not just Opening move)

**Files:**
- Modify: `CLAUDE.md` (canonical homes item 3; touch list item 4)
- Modify: `CONTEXT.md` (entries: Opening move, On-demand skill, Task transition)

- [ ] **Step 1:** CLAUDE.md canonical homes: replace `**Skill category lists for routing**: rules/bootstrap.md + skills/mu-route/SKILL.md (these two must agree).` with `**Routing** (intent tables, categories, confidence): rules/bootstrap.md — its only home.`
- [ ] **Step 2:** CLAUDE.md touch list: delete item 4 (`skills/mu-route/SKILL.md — on-demand pointer row...`); renumber item 5 → 4.
- [ ] **Step 3:** CONTEXT.md — three subject rewords, definitions otherwise unchanged:
  - Opening move: "The first skill `mu-route` selects" → "The first skill the routing rules (bootstrap) select"
  - On-demand skill: "mu-route answers matching intents with a pointer, not an invocation" → "the routing rules answer matching intents with a pointer, not an invocation"
  - Task transition: "requiring mu-route to re-fire" → "requiring re-classification by the routing rules"
- [ ] **Step 4:** Gate: `grep -c "mu-route" CLAUDE.md CONTEXT.md` → 0 and 0.
- [ ] **Step 5: Commit.** `git add CLAUDE.md CONTEXT.md && git commit -m "docs: routing's canonical home is bootstrap; reword CONTEXT.md subjects"`

### Task 3: README twins

**Covers:** UC-R4 (skill-count docs return to 13)

**Files:**
- Modify: `README.md` (Skills table Router row; prose "### Routing" paragraph)
- Modify: `README_CN.md` (mirror both)

- [ ] **Step 1:** README.md Skills table: delete the `| Router | **mu-route** | ... |` row.
- [ ] **Step 2:** README.md "### Routing" prose: replace the mu-route sentence with: `Routing lives in the always-on bootstrap rule: unprefixed messages are classified by intent and repo state — clear intent routes silently, ambiguous intent gets a proposal. Non-dev/product messages are not routed.`
- [ ] **Step 3:** README_CN.md: mirror both (表格删 `| 路由 | **mu-route** | ... |` 行；叙述段同义改写).
- [ ] **Step 4:** Gate: `grep -c "mu-route" README.md README_CN.md` → 0 and 0.
- [ ] **Step 5: Commit.** `git add README.md README_CN.md && git commit -m "docs: remove Router row, routing prose points to bootstrap (13 skills)"`

### Task 4: Passing mentions — four SKILL.md files + explore artifact

**Covers:** UC-R4

**Files:**
- Modify: `skills/mu-arch/SKILL.md`, `skills/mu-biz/SKILL.md`, `skills/mu-explore/SKILL.md`, `skills/mu-wiki/SKILL.md` (grep for the exact line in each; reword "mu-route" → "the routing rules (bootstrap)" preserving sentence meaning)
- Modify: `docs/explore/_overview.md` — reword ALL FOUR mu-route hits (line 30 four-categories Router bullet — delete or reword to routing-in-bootstrap; line 102 `Axis-*` row "(mu-route)" → "(bootstrap routing)"; line 103 confidence-tiers row "mu-route's" → "the routing rules'"; line 115 Unknowns "`mu-route` skill — Shipped..." → mark resolved: "routing folded into bootstrap 2026-07-17"); append History row: fold + today's date + current commit

- [ ] **Step 1:** `grep -n "mu-route" skills/mu-arch/SKILL.md skills/mu-biz/SKILL.md skills/mu-explore/SKILL.md skills/mu-wiki/SKILL.md docs/explore/_overview.md` — reword each hit in place.
- [ ] **Step 2:** Gate: re-run the same grep → no output.
- [ ] **Step 3: Commit.** `git add skills/ docs/explore/ && git commit -m "docs: reword routing mentions after mu-route retirement"`

### Task 5: Retire the skill + final gates

**Covers:** UC-R2, UC-R4

**Files:**
- Delete: `skills/mu-route/` (entire directory)

- [ ] **Step 1:** `git rm -r skills/mu-route/`
- [ ] **Step 2: Final grep gate.** Run: `grep -rn "mu-route" --include="*.md" . | grep -v "^\./\.git" | grep -v "docs/plans/\|docs/specs/\|docs/scope/\|docs/proposals/\|docs/retro/\|docs/wiki/"`. Expected: NO output (wiki excluded — regenerated later; dated snapshots exempt).
- [ ] **Step 3: Skill-count check.** `ls skills/ | wc -l` → 13.
- [ ] **Step 4: UC-R2 assert.** Confirm the five on-demand skills' FRONTMATTER still carries the flag (grep the frontmatter, not the body — mu-write-skill's body mentions the string without having the field): `grep -c "^disable-model-invocation: true" skills/mu-biz/SKILL.md skills/mu-prd/SKILL.md skills/mu-wiki/SKILL.md skills/mu-retro/SKILL.md skills/mu-grill/SKILL.md` → each reports 1. Then `git diff --stat skills/mu-biz/SKILL.md skills/mu-prd/SKILL.md skills/mu-wiki/SKILL.md skills/mu-retro/SKILL.md skills/mu-grill/SKILL.md` → only expected mention-reword deltas (mu-biz, mu-wiki from Task 4), no frontmatter lines in the diff.
- [ ] **Step 5: Commit + push.**
```bash
git commit -m "feat!: retire mu-route — routing now lives in bootstrap"
git push
```

### Task 6: Post-landing (user actions — reminders only, do not execute)

- [ ] Remind the user: run `/reload-plugins` (plugin cache serves stale bootstrap + skill list until reload — see memory: reload-plugins-after-skill-edits)
- [ ] Remind the user: run `/mu-wiki update` (5 wiki pages reference mu-route; regeneration is the sanctioned path — never hand-edit)
- [ ] Note for next release: version bump to 1.2.0 (breaking-ish: skill removed) — files: `.claude-plugin/plugin.json` AND `.claude-plugin/marketplace.json` (both carry a version field)
