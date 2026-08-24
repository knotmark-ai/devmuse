import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

// End-to-end coverage of the project-registry CLI write boundary. write-manifest
// must validate routing before persisting (I-2) and stay approval-gated — asserted
// by driving the real CLI, not the pure functions it wraps.

const CLI = path.resolve("plugin/runtime/project-registry/cli.mjs");

function tempRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-reg-cli-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function manifest(routes) {
  return {
    schema_version: 2,
    project: { id: "github:repo", repository: "github.com/org/repo" },
    collaboration: { provider: "github", mode: "github-first" },
    artifacts: { prd: null, architecture: { index: "docs/architecture.md", domain_model: "CONTEXT.md" } },
    cases: { registry: "repository", routes },
  };
}

function run(dir, input) {
  const r = spawnSync(process.execPath, [CLI, "write-manifest"], { cwd: dir, input: JSON.stringify(input), encoding: "utf8" });
  return { out: JSON.parse(r.stdout), code: r.status };
}

test("write-manifest blocks an invalid route provider before persisting (I-2)", (t) => {
  const dir = tempRepo(t);
  const { out } = run(dir, { approved: true, repo_root: dir, value: manifest({ test_cases: "made_up_provider" }) });
  assert.equal(out.status, "blocked");
  assert.equal(out.reason, "invalid-routing");
  assert.equal(out.detail, "unknown-route-provider");
  assert.equal(fs.existsSync(path.join(dir, ".devmuse", "project.yaml")), false); // nothing written
});

test("write-manifest persists a valid manifest", (t) => {
  const dir = tempRepo(t);
  const { out } = run(dir, { approved: true, repo_root: dir, value: manifest({ test_cases: "xray" }) });
  assert.equal(out.status, "written");
  const written = fs.readFileSync(path.join(dir, ".devmuse", "project.yaml"), "utf8");
  assert.match(written, /test_cases: xray/);
});

test("write-manifest is still approval-gated", (t) => {
  const dir = tempRepo(t);
  const { out, code } = run(dir, { repo_root: dir, value: manifest({ test_cases: "xray" }) });
  assert.equal(out.status, "blocked");
  assert.equal(out.reason, "approval-required");
  assert.equal(code, 1);
  assert.equal(fs.existsSync(path.join(dir, ".devmuse", "project.yaml")), false);
});
