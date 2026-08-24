import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseCriteria, criteriaFor } from "./parse-criteria.mjs";
import { buildJudgePrompt, splitSubCriteria, parseVerdict, criteriaCount } from "./judge.mjs";

const directory = path.dirname(fileURLToPath(import.meta.url));

test("every prompt file has a criteria row and every row has a prompt file", () => {
  const parsed = parseCriteria();
  const prompts = new Set(
    fs.readdirSync(path.join(directory, "prompts"))
      .filter((file) => file.endsWith(".txt"))
      .map((file) => file.replace(/\.txt$/, "")),
  );
  for (const [name, row] of parsed) {
    assert.equal(row.scenario, name);
    assert.ok(row.criteria.length > 0, `${name} has empty criteria`);
    assert.ok(splitSubCriteria(row.criteria).length >= 1);
    assert.ok(prompts.has(name), `criteria row '${name}' has no prompts/${name}.txt`);
  }
  for (const prompt of prompts) {
    assert.ok(parsed.has(prompt), `prompts/${prompt}.txt has no criteria row in README.md`);
  }
});

test("criteriaFor rejects an unknown scenario", () => {
  assert.throws(() => criteriaFor("does-not-exist"), (error) => error.code === "unknown-scenario");
});

test("the judge prompt carries the scenario's numbered sub-criteria and the transcript", () => {
  const prompt = buildJudgePrompt("stateless-cli-no-trigger", "TRANSCRIPT_BODY_MARKER");
  assert.match(prompt, /Object model does NOT fire/);
  assert.match(prompt, /zero state machines/);
  assert.match(prompt, /^1\. /m);
  assert.match(prompt, /TRANSCRIPT_BODY_MARKER/);
  assert.match(prompt, /Respond with ONLY a JSON object/);
});

test("verdict parsing extracts JSON from fenced or inline responses", () => {
  const fenced = parseVerdict('here is my grade\n```json\n{"criteria":[{"n":1,"verdict":"pass","evidence":"x"}],"overall":"pass"}\n```');
  assert.equal(fenced.overall, "pass");
  const inline = parseVerdict('{"criteria":[{"n":1,"verdict":"pass"},{"n":2,"verdict":"pass"}],"overall":"pass"}');
  assert.equal(inline.overall, "pass");
});

test("overall is recomputed so a failed criterion cannot pass the scenario", () => {
  // The model claimed overall pass while marking criterion 2 fail; we override.
  const verdict = parseVerdict('{"criteria":[{"n":1,"verdict":"pass"},{"n":2,"verdict":"fail","evidence":"missing"}],"overall":"pass"}');
  assert.equal(verdict.overall, "fail");
});

test("an unparseable judge response is a typed error, not a silent pass", () => {
  assert.throws(() => parseVerdict("the transcript looks fine to me"), (error) => error.code === "unparseable-verdict");
});

test("an empty criteria array is a typed error, never a pass (B5)", () => {
  // [].every() === true would otherwise let a judge that grades nothing pass.
  assert.throws(() => parseVerdict('{"criteria":[],"overall":"pass"}'), (error) => error.code === "empty-criteria");
});

test("a judge that grades fewer criteria than asked is rejected (H1)", () => {
  const short = '{"criteria":[{"n":1,"verdict":"pass"}],"overall":"pass"}';
  assert.throws(() => parseVerdict(short, { expectedCount: 6 }), (error) => error.code === "criteria-count-mismatch");
  // The exact count passes.
  assert.equal(parseVerdict(short, { expectedCount: 1 }).overall, "pass");
});

test("a missing/malformed per-criterion verdict is not a pass", () => {
  assert.equal(parseVerdict('{"criteria":[{"n":1},{"n":2,"verdict":"pass"}],"overall":"pass"}').overall, "fail");
});

test("criteriaCount returns a scenario's sub-criteria count and vague-groupbuy now splits into 7", () => {
  assert.equal(criteriaCount("stateless-cli-no-trigger"), 3);
  assert.equal(criteriaCount("vague-groupbuy-dialogue"), 7);
});
