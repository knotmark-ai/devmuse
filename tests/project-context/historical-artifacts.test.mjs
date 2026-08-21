import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const historicalRoots = ["docs/scope", "docs/specs", "docs/plans"];

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
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
test("dated artifacts that predate the branch retain their exact Git blobs", () => {
  const base = process.env.PROJECT_CONTEXT_BASE_SHA
    ?? git(["merge-base", "origin/main", "HEAD"]);
  const before = treeAt(base);
  const after = treeAt("HEAD");
  for (const [file, objectId] of before) {
    assert.equal(after.get(file), objectId, `${file} changed after becoming historical`);
  }
});
