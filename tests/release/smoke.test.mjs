import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildRelease } from "../../scripts/release/artifacts.mjs";
import { INSTALL_LOCATIONS, runSmoke } from "../../scripts/release/smoke-lib.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("UC-4 UC-5: every host survives install, stale update, validation, and scoped uninstall", async () => {
  const input = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-build-")), "release");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-root-"));
  await buildRelease({ repoRoot, output: input });
  const evidence = runSmoke({ repoRoot, input, tempRoot, keep: true });
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.gates.verify, "passed");
  assert.deepEqual(evidence.gates.smoke, {
    claude: "passed",
    codex: "passed",
    gemini: "passed",
    hermes: "passed",
    openclaw: "passed",
  });

  for (const target of Object.keys(evidence.gates.smoke)) {
    const install = path.join(tempRoot, target, ...INSTALL_LOCATIONS[target].split("/"));
    assert.ok(!fs.existsSync(install), `${target} install must be removed`);
    assert.equal(fs.readFileSync(path.join(path.dirname(install), "sibling-canary"), "utf8"), "keep\n");
    assert.ok(!fs.existsSync(path.join(install, ".obsolete-sentinel")));
  }
});

test("UC-5: a failed staged move restores the previous installation", async () => {
  const input = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-fail-build-")), "release");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-fail-root-"));
  await buildRelease({ repoRoot, output: input });
  assert.throws(
    () => runSmoke({
      repoRoot,
      input,
      tempRoot,
      targets: ["claude"],
      keep: true,
      move: (from, to) => {
        if (from.endsWith(".staging")) throw new Error("injected move failure");
        fs.renameSync(from, to);
      },
    }),
    /injected move failure/,
  );
  const install = path.join(tempRoot, "claude", ...INSTALL_LOCATIONS.claude.split("/"));
  assert.ok(fs.existsSync(path.join(install, ".obsolete-sentinel")));
  assert.ok(!fs.existsSync(`${install}.rollback`));
});
