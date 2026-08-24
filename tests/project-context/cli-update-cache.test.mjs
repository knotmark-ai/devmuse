import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

// End-to-end coverage of the `update-cache` CLI boundary (C1/F2/F4). The earlier
// UC-G8/UC-G9 tests called mergeCache/updateCache directly with already-snake_case
// entries, so they never exercised cli.mjs's camelizeKeys layer — the exact place
// the nested payload keys were being destroyed. These drive the real CLI over
// stdin with snake_case, the way a skill actually invokes it.

const CLI = path.resolve("plugin/runtime/project-context/cli.mjs");

const MANIFEST = `schema_version: 1
project:
  id: "github:repo"
  repository: "github.com/org/repo"
collaboration:
  provider: github
  mode: github-first
artifacts:
  prd: null
  architecture:
    index: docs/architecture.md
    domain_model: CONTEXT.md
`;

function repoWithManifest(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-cli-cache-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const args of [["init", "-b", "main"], ["config", "user.email", "t@e.com"], ["config", "user.name", "T"]]) {
    assert.equal(spawnSync("git", args, { cwd: dir }).status, 0);
  }
  fs.mkdirSync(path.join(dir, ".devmuse"));
  fs.writeFileSync(path.join(dir, ".devmuse", "project.yaml"), MANIFEST);
  spawnSync("git", ["add", ".devmuse/project.yaml"], { cwd: dir });
  spawnSync("git", ["commit", "-m", "manifest"], { cwd: dir });
  return dir;
}

function runUpdateCache(dir, incoming) {
  const result = spawnSync(process.execPath, [CLI, "update-cache"], {
    cwd: dir,
    input: JSON.stringify({ cwd: dir, incoming }),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function readCacheFile(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, ".git", "devmuse", "project-context.v1.json"), "utf8"));
}

// Covers: UC-G8, UC-G9 — the writer actually persists the snake_case pointer keys.
test("update-cache persists work_id / pull_request / pipeline_phase through the CLI (C1)", (t) => {
  const dir = repoWithManifest(t);
  const out = runUpdateCache(dir, {
    worktree_key: "main",
    entry: { work_id: "issue-62", issue: 62, pull_request: 65, pipeline_phase: "Reviewing", updated_at: "2026-08-22T00:00:00Z" },
  });
  // Before the fix this was "invalid-update" (camelize mangled every multi-word key).
  assert.equal(out.status, "merged");
  const cache = readCacheFile(dir);
  assert.deepEqual(cache.worktrees.main, {
    work_id: "issue-62", issue: 62, pull_request: 65, pipeline_phase: "Reviewing", updated_at: "2026-08-22T00:00:00Z",
  });
});

// Covers: UC-G9 — a recovery attempt payload round-trips through the CLI.
test("update-cache persists a recovery attempt through the CLI (C1)", (t) => {
  const dir = repoWithManifest(t);
  const attempt = {
    operation: "pull_request.create", attempt_id: "issue-62", work_id: "issue-62",
    object_kind: "pull_request", repository_id: "github:repo", head: "feature", base: "main",
    request_fingerprint: `sha256:${"a".repeat(64)}`, status: "indeterminate", started_at: "2026-08-22T00:00:00Z",
  };
  const out = runUpdateCache(dir, { attempt });
  assert.equal(out.status, "merged");
  const cache = readCacheFile(dir);
  assert.deepEqual(cache.recovery["issue-62"], attempt);
  // And the writer can clear it — clear_attempt_id is a runtime param (camelCase-bound).
  const cleared = runUpdateCache(dir, { clear_attempt_id: "issue-62" });
  assert.equal(cleared.status, "merged");
  assert.deepEqual(readCacheFile(dir).recovery, {});
});

// Covers: UC-GR3 — a caller-supplied project_id cannot override the resolved one (F4).
test("update-cache injects the repository-resolved identity over a caller-supplied one (F4)", (t) => {
  const dir = repoWithManifest(t);
  const out = runUpdateCache(dir, {
    project_id: "github:attacker",
    worktree_key: "main",
    entry: { work_id: "issue-62", issue: 62 },
  });
  assert.equal(out.status, "merged");
  assert.equal(readCacheFile(dir).project_id, "github:repo"); // not "github:attacker"
});
