import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { proposeV2Migration } from "../../plugin/runtime/project-registry/migration.mjs";
import { serializeManifest, readRouting } from "../../plugin/runtime/project-registry/manifest-io.mjs";
import { resolveProvider } from "../../plugin/runtime/project-registry/routing.mjs";
import { parseProjectManifest } from "../../plugin/runtime/project-context/manifest.mjs";

const cli = fileURLToPath(new URL("../../plugin/runtime/project-registry/cli.mjs", import.meta.url));
const runCli = (command, input, opts = {}) => {
  const r = spawnSync(process.execPath, [cli, command], { input: JSON.stringify(input), encoding: "utf8", ...opts });
  return { status: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout) : null };
};

const v1 = {
  project: { id: "github:R_kg", repository: "github.com/o/r" },
  collaboration: { provider: "github", mode: "github-first" },
  artifacts: { prd: null, architecture: { index: "docs/architecture.md", domain_model: "CONTEXT.md" } },
};

test("the setup loop closes: propose → serialize → parse → route (B1+B2)", (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-loop-"));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));

  const proposal = proposeV2Migration(v1, { routes: { test_cases: "xray", test_results: "ci" } });
  assert.equal(proposal.status, "proposed");

  const yaml = serializeManifest(proposal.proposal);
  // The serialized v2 manifest is READABLE by the project-context parser...
  const parsed = parseProjectManifest(yaml, { repoRoot: repo });
  assert.equal(parsed.status, "valid", yaml);
  assert.equal(parsed.value.schema_version, 2);

  // ...and its cases block resolves into a usable router.
  const routing = readRouting(parsed.value);
  assert.equal(routing.status, "valid");
  assert.equal(resolveProvider(routing.value, "test_cases"), "xray");
  assert.equal(resolveProvider(routing.value, "test_results"), "ci");
  assert.equal(resolveProvider(routing.value, "acceptance_examples"), "repository"); // default fill
});

test("a written v2 manifest is re-read as v2 with its routing (round-trip through disk)", (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-loop-disk-"));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const proposal = proposeV2Migration(v1, { routes: { test_cases: "xray" } });

  // write-manifest requires approval, then the file is a valid v2 manifest.
  assert.equal(runCli("write-manifest", { repo_root: repo, value: proposal.proposal }).out.reason, "approval-required");
  assert.equal(runCli("write-manifest", { repo_root: repo, value: proposal.proposal, approved: true }).out.status, "written");
  const written = fs.readFileSync(path.join(repo, ".devmuse", "project.yaml"), "utf8");
  const parsed = parseProjectManifest(written, { repoRoot: repo });
  assert.equal(parsed.status, "valid");
  assert.equal(readRouting(parsed.value).value.routes.test_cases, "xray");
});

test("tracked writes are gated on explicit approval (H3)", (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-gate-"));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));

  // Without approval, init writes nothing and reports blocked.
  assert.equal(runCli("init", { repo_root: repo }).out.reason, "approval-required");
  assert.equal(fs.existsSync(path.join(repo, "registry")), false);
  // With approval, it initializes.
  assert.equal(runCli("init", { repo_root: repo, approved: true }).out.status, "initialized");
  assert.equal(fs.existsSync(path.join(repo, "registry", "test_cases.json")), true);

  // write-kind is likewise gated.
  assert.equal(runCli("write-kind", { repo_root: repo, kind: "test_cases", assets: [] }).out.reason, "approval-required");
});
