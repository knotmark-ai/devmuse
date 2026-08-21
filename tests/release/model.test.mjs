import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BUNDLE_CATALOG,
  COMPATIBILITY_TARGETS,
  loadReleaseContext,
  readVersionSources,
  selectBundleFiles,
} from "../../scripts/release/model.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("UC-1: all canonical manifests agree with package.json", () => {
  const versions = readVersionSources(repoRoot);
  assert.equal(new Set(Object.values(versions)).size, 1, JSON.stringify(versions));
  assert.equal(
    versions.package,
    JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")).version,
  );
});

test("UC-R5: bundle catalog has four archives and maps OpenClaw to Claude", () => {
  assert.deepEqual(Object.keys(BUNDLE_CATALOG).sort(), ["claude", "codex", "gemini", "hermes"]);
  assert.deepEqual(COMPATIBILITY_TARGETS, { openclaw: "claude" });
});

test("UC-3 UC-R2: bundle selection is tracked, sorted, minimal, and host-correct", () => {
  const context = loadReleaseContext(repoRoot);
  for (const name of Object.keys(BUNDLE_CATALOG)) {
    const files = selectBundleFiles(context, name);
    assert.ok(files.length > 0, `${name} must contain runtime files`);
    assert.deepEqual(
      files.map((file) => file.path),
      files.map((file) => file.path).sort((a, b) => Buffer.from(a).compare(Buffer.from(b))),
    );
    assert.ok(files.every((file) => context.trackedFiles.some((tracked) => tracked.path === file.path)));
    assert.ok(files.every((file) => !file.path.startsWith("docs/") && !file.path.startsWith("tests/")));
  }

  assert.ok(selectBundleFiles(context, "claude").some((file) => file.path === ".claude-plugin/marketplace.json"));
  assert.ok(selectBundleFiles(context, "codex").some((file) => file.path === ".agents/plugins/marketplace.json"));
  assert.ok(selectBundleFiles(context, "gemini").some((file) => file.path === "plugin/GEMINI.md"));
  assert.ok(selectBundleFiles(context, "hermes").some((file) => file.path === "plugin.yaml"));
  assert.ok(
    selectBundleFiles(context, "gemini").every(
      (file) => !file.path.includes("/.claude-plugin/") && !file.path.includes("/hooks/"),
    ),
  );
  assert.ok(
    selectBundleFiles(context, "hermes").every(
      (file) => !file.path.includes("/.claude-plugin/") && !file.path.includes("/hooks/"),
    ),
  );
});

test("UC-R2: context rejects symlinks, untracked bundle inputs, and nested output", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-model-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  fs.mkdirSync(path.join(root, "plugin/skills/demo"), { recursive: true });
  fs.writeFileSync(path.join(root, "plugin/skills/demo/SKILL.md"), "demo\n");
  fs.symlinkSync("SKILL.md", path.join(root, "plugin/skills/demo/link.md"));
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });

  assert.throws(() => loadReleaseContext(root), /symlink|unsupported mode/i);

  fs.unlinkSync(path.join(root, "plugin/skills/demo/link.md"));
  execFileSync("git", ["add", "-u"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "remove link"], { cwd: root });
  fs.writeFileSync(path.join(root, "plugin/skills/demo/untracked.md"), "no\n");
  assert.throws(() => loadReleaseContext(root), /untracked bundle input/i);

  fs.unlinkSync(path.join(root, "plugin/skills/demo/untracked.md"));
  assert.throws(
    () => loadReleaseContext(root, { output: path.join(root, "plugin/dist") }),
    /output.*bundle/i,
  );
});

test("UC-3: context rejects dirty npm metadata that would escape source provenance", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-model-npm-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  fs.writeFileSync(path.join(root, "README.md"), "committed\n");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  fs.writeFileSync(path.join(root, "README.md"), "dirty\n");
  assert.throws(() => loadReleaseContext(root), /modified release input.*README\.md/i);
});

test("UC-3: release provenance requires a clean tracked checkout", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-model-clean-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  fs.writeFileSync(path.join(root, "notes.txt"), "committed\n");
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  fs.writeFileSync(path.join(root, "notes.txt"), "dirty\n");
  assert.throws(() => loadReleaseContext(root), /modified checkout input.*notes\.txt/i);
});
