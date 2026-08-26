import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");
const files = {
  bootstrap: read("plugin/rules/bootstrap.md"),
  scope: read("plugin/skills/mu-scope/SKILL.md"),
  arch: read("plugin/skills/mu-arch/SKILL.md"),
  plan: read("plugin/skills/mu-plan/SKILL.md"),
  code: read("plugin/skills/mu-code/SKILL.md"),
  review: read("plugin/skills/mu-review/SKILL.md"),
  reviewer: read("plugin/agents/mu-reviewer.md"),
};

test("every pipeline stage consumes the canonical project-context contract", () => {
  for (const [name, body] of Object.entries(files)) assert.match(body, /project-context\.md/, name);
});

test("scope and plan prefer GitHub canonical surfaces with explicit fallback", () => {
  assert.match(files.scope, /matching GitHub Issue/);
  assert.match(files.scope, /explicit creation approval/);
  assert.match(files.scope, /fallback reason/);
  assert.match(files.scope, /artifact-succession\.md/);
  assert.match(files.plan, /managed plan revision/);
  assert.match(files.plan, /Draft PR/);
  assert.doesNotMatch(files.plan, /Save plans to:\*\* `docs\/plans/);
});

test("code and review preserve delivery beyond merge", () => {
  assert.match(files.code, /first meaningful commit/);
  assert.match(files.code, /required PR/);
  assert.match(files.review, /external work/);
  assert.match(files.review, /issue_action/);
});

// Covers: UC-GR2
test("architecture design and ADRs stay authoritative repository files, not PR-owned", () => {
  assert.match(files.arch, /technical design and ADRs remain repository/);
});

// Covers: UC-G1
test("scope writes a dated local file only as an explicit fallback, never by default", () => {
  const fallbackAt = files.scope.indexOf("explicit local fallback");
  const datedAt = files.scope.indexOf("docs/scope/");
  assert.ok(fallbackAt > 0, "explicit local fallback framing is present");
  assert.ok(datedAt > fallbackAt, "the dated scope path appears only within the fallback gate");
});

test("every pipeline stage references the case-registry traceability contract", () => {
  for (const name of ["scope", "arch", "plan", "code", "review"]) {
    assert.match(files[name], /case-registry\.md/, name);
  }
  // The reviewer marks coverage stale, not merely covered, when a bound revision moved.
  assert.match(files.reviewer, /staleness/);
  assert.match(files.reviewer, /Stale/);
});

test("review agents accept GitHub evidence without requiring a local plan or scope file", () => {
  assert.match(files.reviewer, /PLAN_EVIDENCE_URL/);
  assert.match(files.reviewer, /SCOPE_EVIDENCE_URL/);
  assert.match(files.reviewer, /exactly one of/);
});

test("pipeline mutations use the packaged decision CLI or an explicit host-native fallback", () => {
  for (const name of ["scope", "plan", "code", "review"]) {
    assert.match(files[name], /project-context\/cli\.mjs/, name);
    assert.match(files[name], /host-native/, name);
  }
});

test("each pipeline stage names the decision commands it consumes", () => {
  const commands = {
    scope: ["resolve", "select-issue", "authorize", "render-managed", "recover-attempt"],
    arch: ["resolve", "render-managed"],
    plan: ["resolve", "authorize", "render-managed", "recover-attempt"],
    code: ["resolve", "authorize", "render-managed", "recover-attempt", "project-delivery"],
    review: ["resolve", "authorize", "render-managed", "project-delivery"],
  };
  for (const [skill, required] of Object.entries(commands)) {
    for (const command of required) assert.match(files[skill], new RegExp(`\\b${command}\\b`), `${skill}:${command}`);
  }
});
