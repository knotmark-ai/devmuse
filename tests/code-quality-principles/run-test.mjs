#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  const file = path.join(root, relativePath);
  assert.ok(fs.existsSync(file), `${relativePath} must exist`);
  return fs.readFileSync(file, "utf8");
}

const principle = read("plugin/knowledge/principles/code-quality.md");
const expectedPrinciples = [
  "Inline transparent single-caller wrappers",
  "Build only for current consumers",
  "Prefer deep modules",
  "Finish with the fewest elements",
  "Preserve line of sight",
  "Add error context once",
  "Model expected failures as values",
  "Keep interfaces consumer-defined and minimal",
  "Prefer copying a few lines to adding a dependency",
  "Name modules for their capability",
  "Avoid package stutter",
];

const sections = [...principle.matchAll(/^### \d+\. (.+)$/gm)];
assert.deepEqual(
  sections.map((match) => match[1]),
  expectedPrinciples,
  "the universal checklist must expose every issue #60/#61 principle as a distinct category",
);

for (let index = 0; index < sections.length; index += 1) {
  const start = sections[index].index;
  const end = sections[index + 1]?.index ?? principle.length;
  const body = principle.slice(start, end);
  assert.match(body, /\*\*Bad:\*\*/, `${expectedPrinciples[index]} lacks a bad example`);
  assert.match(body, /\*\*Better:\*\*/, `${expectedPrinciples[index]} lacks a better example`);
}

assert.match(principle, /Apply every category to every implementation language/);
assert.match(principle, /language's native\s+error-chaining mechanism/);
assert.match(principle, /qualified imports/);
assert.match(principle, /unqualified imports/);
assert.match(principle, /diagnostic,\s+not a blanket ban/);
assert.match(principle, /real consumer or a decision\/mechanism it hides/);
assert.match(principle, /requests? to (?:show|report) only\s+blockers\s+do not remove categories/i);
assert.match(principle, /^## Pressure guardrails$/m);
assert.match(principle, /Go-specific proverbs.*universal categories/is);
assert.match(principle, /Preserve every public shape.*consumer and compatibility evidence/is);

const consumers = [
  ["plugin/skills/mu-code/SKILL.md", "@../../knowledge/principles/code-quality.md"],
  ["plugin/skills/mu-review/SKILL.md", "@../../knowledge/principles/code-quality.md"],
  ["plugin/agents/mu-coder.md", "@../knowledge/principles/code-quality.md"],
  ["plugin/agents/mu-reviewer.md", "@../knowledge/principles/code-quality.md"],
];

for (const [file, reference] of consumers) {
  assert.match(read(file), new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${file} must load the universal checklist`);
}

assert.match(read("plugin/skills/mu-code/SKILL.md"), /REFACTOR.*every category/s);
assert.match(read("plugin/agents/mu-coder.md"), /every category.*before reporting/s);
assert.match(read("plugin/skills/mu-review/SKILL.md"), /distinct\s+finding categor/);
assert.match(read("plugin/agents/mu-reviewer.md"), /different principle categories remain distinct/);

console.log("PASS: universal code-quality principles are complete and wired into implementation and review");
