import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const historicalRoots = ["docs/scope", "docs/specs", "docs/plans"];

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function refExists(ref) {
  return spawnSync("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { encoding: "utf8" }).status === 0;
}

// Resolve the point this branch diverged from the trunk. An explicit override
// wins (CI can pass the PR base); otherwise try the trunk refs that exist in
// this checkout. A shallow single-branch CI checkout may have none, in which
// case the baseline cannot be established and the caller skips.
function resolveBaseSha() {
  if (process.env.PROJECT_CONTEXT_BASE_SHA) return process.env.PROJECT_CONTEXT_BASE_SHA;
  for (const ref of ["origin/main", "main"]) {
    if (refExists(ref)) return git(["merge-base", ref, "HEAD"]);
  }
  return null;
}

function treeAt(revision) {
  const output = git(["ls-tree", "-r", revision, "--", ...historicalRoots]);
  return new Map(output.split("\n").filter(Boolean).map((line) => {
    const match = line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/);
    assert.ok(match, line);
    return [match[2], match[1]];
  }));
}

// Covers: UC-G10
test("dated artifacts that predate the branch retain their exact Git blobs", (t) => {
  const base = resolveBaseSha();
  if (!base) {
    t.skip("no trunk ref (origin/main or main) and no PROJECT_CONTEXT_BASE_SHA — cannot establish the historical baseline");
    return;
  }
  const before = treeAt(base);
  const after = treeAt("HEAD");
  for (const [file, objectId] of before) {
    assert.equal(after.get(file), objectId, `${file} changed after becoming historical`);
  }
});
