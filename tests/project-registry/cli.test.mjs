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

test("write-manifest validates the WHOLE manifest, not just routing (#68)", (t) => {
  const dir = tempRepo(t);
  // An invalid project id is caught by the canonical parser, not just routing.
  const badId = manifest({ test_cases: "xray" });
  badId.project.id = "not a valid id";
  const r1 = run(dir, { approved: true, repo_root: dir, value: badId });
  assert.equal(r1.out.status, "blocked");
  assert.equal(r1.out.reason, "invalid-manifest");
  assert.equal(fs.existsSync(path.join(dir, ".devmuse", "project.yaml")), false);
  // An artifact path escaping the repo is rejected as an unsafe path.
  const badPath = manifest({ test_cases: "xray" });
  badPath.artifacts.prd = "../escape.md";
  const r2 = run(dir, { approved: true, repo_root: dir, value: badPath });
  assert.equal(r2.out.status, "blocked");
  assert.equal(r2.out.reason, "invalid-manifest");
});

test("write-manifest refuses to write through a symlinked .devmuse escaping the repo (#68)", (t) => {
  const dir = tempRepo(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-outside-"));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.symlinkSync(outside, path.join(dir, ".devmuse")); // .devmuse -> external dir
  const { out } = run(dir, { approved: true, repo_root: dir, value: manifest({ test_cases: "xray" }) });
  assert.equal(out.status, "blocked");
  assert.equal(out.reason, "path-escapes-repo");
  assert.equal(fs.existsSync(path.join(outside, "project.yaml")), false); // nothing written outside
});

test("write-manifest is still approval-gated", (t) => {
  const dir = tempRepo(t);
  const { out, code } = run(dir, { repo_root: dir, value: manifest({ test_cases: "xray" }) });
  assert.equal(out.status, "blocked");
  assert.equal(out.reason, "approval-required");
  assert.equal(code, 1);
  assert.equal(fs.existsSync(path.join(dir, ".devmuse", "project.yaml")), false);
});
