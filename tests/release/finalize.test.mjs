import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildRelease, stableJson } from "../../scripts/release/artifacts.mjs";
import { finalizeRelease } from "../../scripts/release/finalize-lib.mjs";
import { runSmoke } from "../../scripts/release/smoke-lib.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("UC-6 UC-8 UC-R3: finalization is deterministic and has no checksum self-reference", async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-finalize-"));
  const first = path.join(parent, "a");
  const second = path.join(parent, "b");
  await buildRelease({ repoRoot, output: first });
  await buildRelease({ repoRoot, output: second });
  const evidence = runSmoke({ repoRoot, input: first });
  const evidenceFile = path.join(parent, "evidence.json");
  fs.writeFileSync(evidenceFile, stableJson(evidence));

  finalizeRelease({ repoRoot, input: first, evidence: evidenceFile });
  finalizeRelease({ repoRoot, input: second, evidence: evidenceFile });
  for (const name of [
    "release-manifest.json",
    "marketplace-submission.md",
    "SHA256SUMS",
    "expected-assets.json",
  ]) assert.deepEqual(fs.readFileSync(path.join(first, name)), fs.readFileSync(path.join(second, name)), name);

  const expected = JSON.parse(fs.readFileSync(path.join(first, "expected-assets.json"), "utf8"));
  assert.ok(expected.assets.SHA256SUMS);
  assert.ok(!expected.assets["expected-assets.json"]);
  assert.ok(!expected.assets["bundle-checksums.json"]);
  assert.ok(!expected.assets["smoke-evidence.json"]);
  const sums = fs.readFileSync(path.join(first, "SHA256SUMS"), "utf8");
  assert.doesNotMatch(sums, /SHA256SUMS|expected-assets\.json|bundle-checksums\.json|smoke-evidence\.json/);
  assert.deepEqual(
    new Set(sums.trim().split("\n").map((line) => line.slice(66))),
    new Set(Object.keys(expected.assets).filter((name) => name !== "SHA256SUMS")),
  );
  assert.match(fs.readFileSync(path.join(first, "marketplace-submission.md"), "utf8"), /OpenClaw[\s\S]*Claude/);
});

test("UC-R3: finalizer rejects unstable or incomplete evidence", async () => {
  const input = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-finalize-bad-")), "release");
  await buildRelease({ repoRoot, output: input });
  const evidenceFile = path.join(path.dirname(input), "bad.json");
  fs.writeFileSync(
    evidenceFile,
    JSON.stringify({ schemaVersion: 1, sourceCommit: "wrong", runId: 7, gates: {} }),
  );
  assert.throws(
    () => finalizeRelease({ repoRoot, input, evidence: evidenceFile }),
    /source commit|unknown evidence field|gate/i,
  );
});

test("UC-R3: exact finalization reruns no-op and conflicting outputs fail closed", async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-finalize-rerun-"));
  const input = path.join(parent, "release");
  await buildRelease({ repoRoot, output: input });
  const evidenceFile = path.join(parent, "evidence.json");
  fs.writeFileSync(evidenceFile, stableJson(runSmoke({ repoRoot, input })));
  const first = finalizeRelease({ repoRoot, input, evidence: evidenceFile });
  const second = finalizeRelease({ repoRoot, input, evidence: evidenceFile });
  assert.deepEqual(second, first);
  fs.writeFileSync(path.join(input, "marketplace-submission.md"), "different\n");
  assert.throws(() => finalizeRelease({ repoRoot, input, evidence: evidenceFile }), /different bytes/i);
});
