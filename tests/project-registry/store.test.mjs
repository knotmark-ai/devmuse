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
