import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");
const profiles = read("plugin/knowledge/principles/project-profiles.md");
const muPrd = read("plugin/skills/mu-prd/SKILL.md");
const muArch = read("plugin/skills/mu-arch/SKILL.md");
const muModel = read("plugin/skills/mu-model/SKILL.md");
const bootstrap = read("plugin/rules/bootstrap.md");
const nfr = read("plugin/knowledge/principles/nfr-checklist.md");

test("project-profiles defines four distinct composable axes", () => {
  assert.match(profiles, /## Axis 1 — Product profile/);
  assert.match(profiles, /## Axis 2 — Interaction surface/);
  assert.match(profiles, /## Axis 3 — Implementation profile/);
  assert.match(profiles, /## Axis 4 — Concern triggers/);
  // The interaction-surface axis (previously absent) exists with its values.
  for (const surface of ["cli", "gui", "api", "event", "headless"]) {
    assert.match(profiles, new RegExp(`\`${surface}\``), `surface ${surface}`);
  }
});

test("composition is common core + activated axes + concern-triggered, with the no-empty-slot rule and stateless degradation", () => {
  assert.match(profiles, /common core \+ the sections activated by each axis \+ concern-/);
  assert.match(profiles, /No axis commits to a technology or product for an empty slot/);
  assert.match(profiles, /## Stateless degradation/);
  assert.match(profiles, /does \*\*not\*\* invent a central entity/);
});

test("mu-prd composes from the axes rather than a fixed section list", () => {
  assert.match(muPrd, /project-profiles\.md/);
  assert.match(muPrd, /section set is \*\*composed\*\*/);
  assert.match(muPrd, /#### Common core \(every profile\)/);
  assert.match(muPrd, /#### Profile-activated sections/);
  // The classic 9-section list is now explicitly the user-facing app profile.
  assert.match(muPrd, /belong to the user-facing app profile, not to every project/);
  // The product-side concern scan is wired.
  assert.match(muPrd, /nfr-checklist\.md/);
  assert.match(nfr, /Referenced by \*\*mu-prd\*\*/);
});

test("mu-model is de-gated — an optional tool, not a required step before PRD/design", () => {
  assert.match(muModel, /optional dedicated tool/);
  assert.match(muModel, /not\*\* a required gate/);
  assert.doesNotMatch(muModel, /Runs \*\*before\*\* PRD and design work/);
  assert.doesNotMatch(muModel, /<HARD-GATE>/);
  // Consumers no longer make it a prerequisite.
  assert.doesNotMatch(muPrd, /recommend `\/mu-model` first/);
  assert.doesNotMatch(muArch, /recommend `\/mu-model` first/);
  assert.doesNotMatch(bootstrap, /point to `\/mu-model` if no `CONTEXT\.md`/);
});

test("both worked examples exist and carry the UC-DR3 banner", () => {
  for (const file of ["plugin/knowledge/examples/reference-booking.md", "plugin/knowledge/examples/reference-ai-plugin.md"]) {
    const body = read(file);
    assert.match(body, /not this repository's (own )?product truth \(UC-DR3\)/);
  }
  // The AI-plugin example is genuinely multi-axis.
  const aiPlugin = read("plugin/knowledge/examples/reference-ai-plugin.md");
  assert.match(aiPlugin, /developer-tool/);
  assert.match(aiPlugin, /plugin-agent/);
  assert.match(aiPlugin, /which stay out/); // shows the axes that do NOT emit sections
});
