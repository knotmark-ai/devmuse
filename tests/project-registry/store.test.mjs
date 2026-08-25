import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { initRegistry, registryStatus, readKind, writeKind, registryPath } from "../../plugin/runtime/project-registry/store.mjs";
import { ASSET_KINDS } from "../../plugin/runtime/project-registry/routing.mjs";

function tempRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-registry-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("init creates one empty file per kind and is idempotent", (t) => {
  const repo = tempRepo(t);
  const first = initRegistry(repo);
  assert.deepEqual(first.created.sort(), [...ASSET_KINDS].sort());
  assert.deepEqual(first.kept, []);
  for (const kind of ASSET_KINDS) assert.ok(fs.existsSync(registryPath(repo, kind)));
  // Rerun keeps everything, creates nothing (UC-C5, no destructive rewrite).
  const second = initRegistry(repo);
  assert.deepEqual(second.created, []);
  assert.deepEqual(second.kept.sort(), [...ASSET_KINDS].sort());
});

test("init with routes creates files only for repository-owned kinds, never forking externally routed ones (#68)", (t) => {
  const repo = tempRepo(t);
  // test_cases routed to xray, product_requirements to jira → those kinds are NOT
  // given local files; the rest (repository-owned) are.
  const routes = { test_cases: "xray", product_requirements: "jira" };
  const result = initRegistry(repo, { routes });
  assert.deepEqual(result.created.sort(), ["acceptance_examples", "rules", "test_results"]);
  assert.deepEqual(result.skipped.sort(), ["product_use_cases", "test_cases"]); // product_requirements route owns product_use_cases
  assert.equal(fs.existsSync(registryPath(repo, "test_cases")), false); // no competing local authority
  assert.equal(fs.existsSync(registryPath(repo, "product_use_cases")), false);
  assert.ok(fs.existsSync(registryPath(repo, "rules")));
  // A provider-outage rerun with the same routes stays idempotent and still skips.
  const rerun = initRegistry(repo, { routes });
  assert.deepEqual(rerun.created, []);
  assert.deepEqual(rerun.kept.sort(), ["acceptance_examples", "rules", "test_results"]);
  assert.deepEqual(rerun.skipped.sort(), ["product_use_cases", "test_cases"]);
});

test("a rerun after adding assets does not overwrite them", (t) => {
  const repo = tempRepo(t);
  initRegistry(repo);
  writeKind(repo, "product_use_cases", [{ id: "duc:checkout", kind: "product_use_cases", fields: { title: "Checkout" } }]);
  initRegistry(repo); // idempotent rerun
  const read = readKind(repo, "product_use_cases");
  assert.equal(read.status, "valid");
  assert.equal(read.assets.length, 1);
  assert.equal(read.assets[0].id, "duc:checkout");
  assert.match(read.assets[0].revision, /^sha256:/); // written with a computed revision
});

test("readKind reports empty for an absent kind, valid after a write", (t) => {
  const repo = tempRepo(t);
  assert.equal(readKind(repo, "test_results").status, "empty");
  writeKind(repo, "test_results", []);
  assert.equal(readKind(repo, "test_results").status, "valid");
});

test("status reports per-kind presence and counts without mutating", (t) => {
  const repo = tempRepo(t);
  initRegistry(repo);
  writeKind(repo, "test_cases", [
    { id: "tc:a", kind: "test_cases", fields: {} },
    { id: "tc:b", kind: "test_cases", fields: {} },
  ]);
  const status = registryStatus(repo);
  const testCases = status.kinds.find((k) => k.kind === "test_cases");
  assert.equal(testCases.present, true);
  assert.equal(testCases.count, 2);
  assert.equal(status.kinds.length, 5);
});

test("writeKind rejects an asset of the wrong kind (validation via serialize)", (t) => {
  const repo = tempRepo(t);
  assert.throws(() => writeKind(repo, "rules", [{ id: "BAD ID", kind: "rules" }]));
});

test("writeKind rejects a registry dir that symlinks outside the repo", (t) => {
  const repo = tempRepo(t);
  const outside = tempRepo(t);
  fs.symlinkSync(outside, path.join(repo, "registry"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => writeKind(repo, "test_cases", [{ id: "tc:x", kind: "test_cases", fields: {} }]), (error) => error.code === "registry-escapes-repo");
  // Nothing was written outside the repo.
  assert.equal(fs.existsSync(path.join(outside, "test_cases.json")), false);
});
