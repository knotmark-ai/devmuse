import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("UC-1 UC-R1: CI validates release code but cannot publish", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /pull_request:/);
  assert.match(ci, /branches:\s*\[main\]/);
  assert.match(ci, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(ci, /npm run test:release/);
  assert.doesNotMatch(ci, /release:publish|npm publish|contents:\s*write|id-token:\s*write/);
});

test("UC-2 UC-3 UC-7 UC-R1 UC-R4: release workflow has pure dry run and gated mutations", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /tags:\s*\n\s*- ['"]v\*['"]/);
  assert.match(workflow, /matrix:[\s\S]*ubuntu-latest[\s\S]*macos-latest[\s\S]*windows-latest/);
  for (const command of ["release:build", "release:verify", "release:smoke", "release:finalize"]) {
    assert.match(workflow, new RegExp(command.replace(":", "\\:")));
  }
  assert.match(workflow, /actions\/attest@v4/);
  assert.match(workflow, /release:publish-github/);
  assert.match(workflow, /environment:\s*npm-production/);
  assert.match(workflow, /release:publish-npm/);
  assert.match(workflow, /if:\s*github\.ref_type == 'tag'/);
  assert.match(workflow, /vars\.DEVMUSE_PUBLISH_NPM == 'true'/);
  assert.doesNotMatch(workflow, /--clobber|NODE_AUTH_TOKEN|NPM_TOKEN/);
});

test("UC-4 UC-5 UC-6 UC-R3: workflow orders every release boundary", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /compare:[\s\S]*needs:\s*package/);
  assert.match(workflow, /smoke:[\s\S]*needs:\s*compare/);
  assert.match(workflow, /finalize:[\s\S]*needs:[^\n]*smoke/);
  assert.match(workflow, /publish-release:[\s\S]*needs:\s*finalize/);
  assert.match(workflow, /publish-npm:[\s\S]*needs:\s*publish-release/);
  const preflight = workflow.indexOf("release:publish-github -- --input release-output --tag", workflow.indexOf("publish-release:"));
  const attest = workflow.indexOf("actions/attest@v4", preflight);
  const publish = workflow.indexOf("release:publish-github -- --input release-output --tag", preflight + 1);
  assert.ok(preflight > 0 && workflow.slice(preflight, attest).includes("--preflight"));
  assert.ok(attest > preflight && publish > attest);
});

test("UC-6 UC-R3: only the release job receives write permissions", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.equal((workflow.match(/contents:\s*write/g) ?? []).length, 1);
  assert.equal((workflow.match(/attestations:\s*write/g) ?? []).length, 1);
  assert.equal((workflow.match(/id-token:\s*write/g) ?? []).length, 2);
});
