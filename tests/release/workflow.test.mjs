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
  // CI runs the shared acceptance aggregate (which includes test:release).
  assert.match(ci, /npm run test:acceptance/);
  assert.doesNotMatch(ci, /release:publish|npm publish|contents:\s*write|id-token:\s*write/);
});

test("the shared test:acceptance aggregate covers every required acceptance suite (anti-drift)", () => {
  const aggregate = JSON.parse(read("package.json")).scripts["test:acceptance"];
  assert.ok(aggregate, "package.json must define test:acceptance");
  // Both ci.yml and release.yml delegate to it, so this list is the single gate.
  for (const suite of [
    "test:generated", "test:skills", "test:platforms", "test:routing", "test:hooks", "test:mermaid",
    "test:github-first", "test:project-context", "test:project-registry", "test:regression-judge",
    "test:cross-review", "test:profiles", "test:codex-dispatch", "test:token-benchmark", "test:release",
  ]) {
    assert.match(aggregate, new RegExp(`npm run ${suite.replace(":", "\\:")}\\b`), `test:acceptance omits ${suite}`);
  }
  // The release gate delegates to the same aggregate.
  assert.match(read(".github/workflows/release.yml"), /npm run test:acceptance/);
});

test("UC-2 UC-3 UC-7 UC-R1 UC-R4: release workflow has pure dry run and gated mutations", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /tags:\s*\n\s*- ['"]v\*['"]/);
  assert.match(workflow, /matrix:[\s\S]*ubuntu-latest[\s\S]*macos-latest[\s\S]*windows-latest/);
  for (const command of ["release:build", "release:verify", "release:smoke", "release:finalize"]) {
    assert.match(workflow, new RegExp(command.replace(":", "\\:")));
  }
  assert.match(workflow, /actions\/attest@[0-9a-f]{40}/);
  assert.match(workflow, /release:publish-github/);
  assert.match(workflow, /environment:\s*npm-production/);
  assert.match(workflow, /release:publish-npm/);
  assert.equal(
    (workflow.match(/if:\s*github\.event_name == 'push' && github\.ref_type == 'tag'/g) ?? []).length,
    3,
  );
  assert.match(workflow, /vars\.DEVMUSE_PUBLISH_NPM == 'true'/);
  const nodeVersions = [...workflow.matchAll(/node-version:\s*([^\s]+)/g)].map((match) => match[1]);
  assert.ok(nodeVersions.length > 0 && nodeVersions.every((version) => version === "22.23.2"));
  assert.equal(
    (workflow.match(/npm install --global --ignore-scripts npm@11\.5\.1/g) ?? []).length,
    nodeVersions.length,
  );
  assert.match(workflow, /RELEASE_TAG:\s*\$\{\{ github\.ref_name \}\}/);
  assert.doesNotMatch(workflow, /--tag\s+\$\{\{ github\.ref_name \}\}/);
  assert.doesNotMatch(workflow, /uses:\s*[^\s]+@v\d+/);
  assert.doesNotMatch(workflow, /--clobber|NODE_AUTH_TOKEN|NPM_TOKEN/);
});

test("UC-4 UC-5 UC-6 UC-R3: workflow orders every release boundary", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /compare:[\s\S]*needs:\s*package/);
  assert.match(workflow, /smoke:[\s\S]*needs:\s*compare/);
  assert.match(workflow, /finalize:[\s\S]*needs:[^\n]*smoke/);
  assert.match(workflow, /attest:[\s\S]*needs:\s*finalize/);
  assert.match(workflow, /publish-release:[\s\S]*needs:\s*\[finalize, attest\]/);
  assert.match(workflow, /publish-npm:[\s\S]*needs:\s*publish-release/);
  const attestJob = workflow.slice(workflow.indexOf("  attest:"), workflow.indexOf("  publish-release:"));
  assert.match(attestJob, /release:verify[\s\S]*release:finalize[\s\S]*--preflight[\s\S]*actions\/attest@/);
  const publishJob = workflow.slice(workflow.indexOf("  publish-release:"), workflow.indexOf("  publish-npm:"));
  assert.match(publishJob, /release:verify[\s\S]*release:finalize[\s\S]*--preflight[\s\S]*release:publish-github/);
});

test("UC-6 UC-R3: only the release job receives write permissions", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.equal((workflow.match(/contents:\s*write/g) ?? []).length, 1);
  assert.equal((workflow.match(/attestations:\s*write/g) ?? []).length, 1);
  assert.equal((workflow.match(/id-token:\s*write/g) ?? []).length, 2);
});

test("UC-R4: registry publication is a read-only sibling after GitHub Release", () => {
  const workflow = read(".github/workflows/release.yml");
  const npmJob = workflow.slice(workflow.indexOf("  publish-npm:"));
  assert.match(npmJob, /needs:\s*publish-release/);
  assert.match(npmJob, /permissions:\s*\n\s*contents:\s*read\s*\n\s*id-token:\s*write/);
  assert.doesNotMatch(npmJob, /contents:\s*write|release:publish-github/);
});
