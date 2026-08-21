import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseProjectManifest, selectManifestCandidate } from "../../plugin/runtime/project-context/manifest.mjs";
import { normalizeRepositoryRemote, resolveProjectIdentity } from "../../plugin/runtime/project-context/identity.mjs";

const manifestText = `schema_version: 1
project:
  id: "github:R_kgDOR1XohQ"
  repository: "github.com/knotmark-ai/devmuse"
collaboration:
  provider: github
  mode: github-first
artifacts:
  prd: null
  architecture:
    index: docs/architecture.md
    domain_model: CONTEXT.md
`;

// Covers: UC-G8, UC-G9, UC-GR3
test("validated manifest binds stable identity independently of checkout path", () => {
  const result = parseProjectManifest(manifestText, { repoRoot: "/repo" });
  assert.equal(result.status, "valid");
  assert.equal(result.value.project.id, "github:R_kgDOR1XohQ");
  assert.equal(result.value.artifacts.architecture.index, "docs/architecture.md");
});

// Covers: UC-G7
test("manifest rejects executable YAML and unsafe artifact paths", () => {
  for (const text of [
    manifestText.replace("schema_version: 1", "schema_version: &version 1"),
    manifestText.replace("docs/architecture.md", "../architecture.md"),
    manifestText.replace("CONTEXT.md", "/tmp/CONTEXT.md"),
  ]) assert.notEqual(parseProjectManifest(text, { repoRoot: "/repo" }).status, "valid");
});

// Covers: UC-G7, UC-G9
test("manifest rejects unknown schema, duplicate or unknown keys, and forbidden secret fields", () => {
  assert.equal(parseProjectManifest(manifestText.replace("schema_version: 1", "schema_version: 2"), { repoRoot: "/repo" }).status, "unsupported-schema");
  for (const text of [
    `${manifestText}schema_version: 1\n`,
    `${manifestText}unknown: true\n`,
    `${manifestText}token: secret-value\n`,
  ]) assert.equal(parseProjectManifest(text, { repoRoot: "/repo" }).status, "invalid");
});

// Covers: UC-G7
test("manifest rejects a repository-relative path that resolves through an escaping symlink", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-manifest-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const repo = path.join(directory, "repo");
  const outside = path.join(directory, "outside");
  fs.mkdirSync(path.join(repo, "docs"), { recursive: true });
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(repo, "docs", "linked"), process.platform === "win32" ? "junction" : "dir");
  const text = manifestText.replace("docs/architecture.md", "docs/linked/architecture.md");
  assert.equal(parseProjectManifest(text, { repoRoot: repo }).status, "invalid");
});

// Covers: UC-G8, UC-GR3
test("SSH and HTTPS remotes normalize without credentials", () => {
  assert.equal(normalizeRepositoryRemote("git@github.com:knotmark-ai/devmuse.git"), "github.com/knotmark-ai/devmuse");
  assert.equal(normalizeRepositoryRemote("https://token@github.com/knotmark-ai/devmuse.git?x=1#frag"), "github.com/knotmark-ai/devmuse");
});

// Covers: UC-G3, UC-G8, UC-GR1, UC-GR3
test("identity distinguishes exact binding, rename, conflict, and offline manifest", () => {
  assert.deepEqual(
    resolveProjectIdentity({ manifestId: "github:repo", manifestRepository: "github.com/org/repo", liveRepositoryId: "github:repo", liveRepository: "github.com/org/repo" }),
    { status: "verified", projectId: "github:repo", repository: "github.com/org/repo", remoteWrites: true, repair: null },
  );
  assert.deepEqual(
    resolveProjectIdentity({ manifestId: "github:repo", manifestRepository: "github.com/old/repo", liveRepositoryId: "github:repo", liveRepository: "github.com/new/repo" }),
    { status: "verified-renamed", projectId: "github:repo", repository: "github.com/new/repo", remoteWrites: true, repair: "update-manifest-repository" },
  );
  assert.deepEqual(
    resolveProjectIdentity({ manifestId: "github:old", manifestRepository: "github.com/org/old", liveRepositoryId: "github:new", liveRepository: "github.com/org/new" }),
    { status: "identity-conflict", projectId: null, repository: null, remoteWrites: false, repair: "adopt-current-repository" },
  );
  assert.deepEqual(
    resolveProjectIdentity({ manifestId: "github:old", manifestRepository: "github.com/org/old", liveRepositoryId: null, liveRepository: null }),
    { status: "manifest-unverified", projectId: "github:old", repository: "github.com/org/old", remoteWrites: false, repair: null },
  );
});

// Covers: UC-G8, UC-GR3
test("a live immutable provider ID establishes identity when no manifest exists", () => {
  assert.deepEqual(
    resolveProjectIdentity({ manifestId: null, manifestRepository: null, liveRepositoryId: "github:repo", liveRepository: "github.com/org/repo" }),
    { status: "verified-live", projectId: "github:repo", repository: "github.com/org/repo", remoteWrites: true, repair: "offer-manifest" },
  );
});

// Covers: UC-G8, UC-G9
test("a branch missing the manifest may read but never copy a default-branch candidate", () => {
  assert.deepEqual(
    selectManifestCandidate({ currentBranchText: null, defaultBranchText: manifestText }),
    { status: "candidate", source: "default-branch", text: manifestText, writable: false },
  );
});
