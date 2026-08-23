import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  clearRecoveryAttempt,
  mergeCache,
  readCache,
  reconcileCacheEntry,
  upsertRecoveryAttempt,
  updateCache,
  writeCacheAtomic,
} from "../../plugin/runtime/project-context/cache.mjs";
import { resolveLocalProjectContext } from "../../plugin/runtime/project-context/resolver.mjs";

function recoveryAttempt(attemptId) {
  return {
    operation: "pull_request.create",
    attempt_id: attemptId,
    work_id: "issue-62",
    object_kind: "pull_request",
    repository_id: "github:repo",
    head: "feature",
    base: "main",
    request_fingerprint: `sha256:${"a".repeat(64)}`,
    status: "indeterminate",
    started_at: "2026-08-22T00:00:00Z",
    last_error_code: "transport-timeout",
  };
}

// Covers: UC-G9
test("disjoint worktrees merge and same-entry conflicts require reconciliation", () => {
  const base = { schema_version: 1, revision: 1, project_id: "github:repo", worktrees: { main: { work_id: "a", issue: 1 } }, recovery: {} };
  const disjoint = mergeCache(base, { worktreeKey: "feature", entry: { work_id: "b", issue: 2 } });
  assert.equal(disjoint.status, "merged");
  assert.equal(disjoint.value.revision, 2);
  assert.equal(disjoint.value.worktrees.feature.issue, 2);
  const conflict = mergeCache(disjoint.value, { worktreeKey: "feature", entry: { work_id: "c", issue: 3 } });
  assert.equal(conflict.status, "needs-reconciliation");
  assert.equal(conflict.candidates.length, 2);
});

// Covers: UC-G8, UC-G9, UC-GR3
test("a different project identity in the shared Git-common cache blocks propagation and writes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-identity-conflict-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "project-context.v1.json");
  const original = '{"schema_version":1,"revision":1,"project_id":"github:repo-a","worktrees":{},"recovery":{}}\n';
  fs.writeFileSync(file, original, { mode: 0o600 });
  const result = await updateCache(file, { projectId: "github:repo-b", worktreeKey: "feature", entry: { work_id: "issue-62", issue: 62 } });
  assert.deepEqual(result, { status: "identity-conflict", sources: { cache: "github:repo-a", incoming: "github:repo-b" } });
  assert.equal(fs.readFileSync(file, "utf8"), original);
});

// Covers: UC-G9
test("reconciliation restarts on revision change and resolves a chosen live candidate", () => {
  assert.deepEqual(reconcileCacheEntry({ expectedRevision: 2, currentRevision: 3, candidates: [], choice: null }), { status: "restart" });
  assert.deepEqual(
    reconcileCacheEntry({ expectedRevision: 3, currentRevision: 3, candidates: [{ issue: 2, valid: true }, { issue: 3, valid: false }], choice: null }),
    { status: "resolved", value: { issue: 2 } },
  );
  assert.deepEqual(
    reconcileCacheEntry({ expectedRevision: 3, currentRevision: 3, candidates: [{ issue: 2, valid: true }, { pull_request: 65, valid: true }], choice: null }),
    { status: "resolved", value: { issue: 2, pull_request: 65 } },
  );
  assert.deepEqual(
    reconcileCacheEntry({ expectedRevision: 3, currentRevision: 3, candidates: [{ issue: 2, valid: true }, { issue: 3, valid: true }], choice: null }),
    { status: "needs-user-choice", candidates: [{ issue: 2, valid: true }, { issue: 3, valid: true }] },
  );
  assert.deepEqual(
    reconcileCacheEntry({ expectedRevision: 3, currentRevision: 3, candidates: [{ issue: 2, valid: true }, { issue: 3, valid: true }], choice: 1 }),
    { status: "resolved", value: { issue: 3 } },
  );
});

// Covers: UC-G7, UC-G9
test("atomic cache persistence is private on POSIX", { skip: process.platform === "win32" }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-cache-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "project-context.v1.json");
  await writeCacheAtomic(file, { schema_version: 1, revision: 1, project_id: "github:repo", worktrees: {}, recovery: {} });
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).revision, 1);
});

// Covers: UC-G8, UC-G9
test("concurrent locked updates reread and preserve disjoint worktree entries", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-lock-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "project-context.v1.json");
  fs.writeFileSync(file, '{"schema_version":1,"revision":1,"project_id":"github:repo","worktrees":{},"recovery":{}}\n', { mode: 0o600 });
  await Promise.all([
    updateCache(file, { worktreeKey: "one", entry: { work_id: "a", issue: 1 } }),
    updateCache(file, { worktreeKey: "two", entry: { work_id: "b", issue: 2 } }),
  ]);
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(value.worktrees).sort(), ["one", "two"]);
  assert.equal(value.revision, 3);
});

// Covers: UC-G8, UC-G9
test("concurrent attempts under one work ID survive and clear independently", () => {
  const empty = { schema_version: 1, revision: 1, project_id: "github:repo", worktrees: {}, recovery: {} };
  const one = upsertRecoveryAttempt(empty, recoveryAttempt("a"));
  const two = upsertRecoveryAttempt(one, recoveryAttempt("b"));
  assert.deepEqual(Object.keys(two.recovery).sort(), ["a", "b"]);
  const cleared = clearRecoveryAttempt(two, "a");
  assert.deepEqual(Object.keys(cleared.recovery), ["b"]);
});

// Covers: UC-G3, UC-G9
test("corrupt cache degrades to fresh discovery", () => {
  assert.deepEqual(readCache("{not-json"), { status: "fresh-discovery", value: null, reason: "corrupt-cache" });
});

// Covers: UC-G7, UC-G9
test("cache reader rejects unknown, credential-bearing, and malformed fixed-schema state", () => {
  const valid = {
    schema_version: 1,
    revision: 3,
    project_id: "github:repo",
    capability_probe: {
      checked_at: "2026-08-22T00:00:00Z",
      provider: "github",
      operations: { "issue.read": { allowed: true, reason: "ok" } },
    },
    worktrees: {
      main: {
        branch: "main", work_id: "issue-62", issue: 62, pull_request: null,
        pipeline_phase: "architecture", updated_at: "2026-08-22T00:00:00Z",
      },
    },
    recovery: {},
  };
  assert.equal(readCache(JSON.stringify(valid)).status, "loaded");
  for (const candidate of [
    { ...valid, authorization: { operations: ["issue.update"] } },
    { ...valid, token: "plain-secret-value" },
    { ...valid, worktrees: { main: { ...valid.worktrees.main, issue: "62" } } },
    { ...valid, capability_probe: { ...valid.capability_probe, operations: { "issue.read": { allowed: true, reason: "github_pat_11AA22BB33CC44DD55EE66FF77GG88HH99" } } } },
    { ...valid, recovery: { attempt: { token: "plain-secret-value" } } },
  ]) {
    assert.deepEqual(readCache(JSON.stringify(candidate)), { status: "fresh-discovery", value: null, reason: "corrupt-cache" });
  }
});

// Covers: UC-G7, UC-G9
test("cache mutation and persistence reject unsafe state before touching storage", async (t) => {
  const base = { schema_version: 1, revision: 1, project_id: "github:repo", worktrees: {}, recovery: {} };
  assert.deepEqual(
    mergeCache(base, { worktreeKey: "main", entry: { issue: 62, token: "plain-secret" } }),
    { status: "invalid-update", reason: "unsafe-cache-state" },
  );
  assert.deepEqual(
    mergeCache(base, { attempt: { ...recoveryAttempt("a"), token: "plain-secret" } }),
    { status: "invalid-update", reason: "unsafe-cache-state" },
  );
  assert.throws(
    () => upsertRecoveryAttempt(base, { ...recoveryAttempt("a"), token: "plain-secret" }),
    (error) => error.code === "invalid-cache-update",
  );
  assert.throws(
    () => clearRecoveryAttempt({ ...base, token: "plain-secret" }, "a"),
    (error) => error.code === "invalid-cache-update",
  );
  assert.equal(Object.hasOwn(base.worktrees, "main"), false);

  const calls = [];
  assert.deepEqual(await writeCacheAtomic("ignored", { schema_version: 1, token: "plain-secret" }, {
    mkdir: async () => calls.push("mkdir"),
    writeFile: async () => calls.push("write"),
    rename: async () => calls.push("rename"),
  }), { status: "rejected", reason: "unsafe-cache-state" });
  assert.deepEqual(calls, []);

  const mutable = structuredClone(base);
  let persisted = null;
  assert.deepEqual(await writeCacheAtomic("C:\\repo\\cache.json", mutable, {
    platform: "win32",
    mkdir: async () => { mutable.token = "plain-secret"; },
    writeFile: async (_file, contents) => { persisted = contents; },
    rename: async () => {},
    applyCurrentUserAcl: async () => {},
  }), { status: "persisted" });
  assert.equal(Object.hasOwn(JSON.parse(persisted), "token"), false);
  assert.equal(readCache(persisted).status, "loaded");

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-reject-cache-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "project-context.v1.json");
  const original = `${JSON.stringify(base)}\n`;
  fs.writeFileSync(file, original, { mode: 0o600 });
  assert.deepEqual(
    await updateCache(file, { worktreeKey: "main", entry: { issue: "62", token: "plain-secret" } }),
    { status: "invalid-update", reason: "unsafe-cache-state" },
  );
  assert.equal(fs.readFileSync(file, "utf8"), original);
});

// Covers: UC-G3, UC-G9
test("Windows cache uses an ACL adapter or remains memory-only", async () => {
  const calls = [];
  const value = { schema_version: 1, revision: 1, project_id: "github:repo", worktrees: {}, recovery: {} };
  const result = await writeCacheAtomic("C:\\repo\\.git\\devmuse\\project-context.v1.json", value, {
    platform: "win32",
    applyCurrentUserAcl: async (file) => calls.push(file),
    writeFile: async () => {},
    rename: async () => {},
  });
  assert.equal(result.status, "persisted");
  assert.equal(calls.length, 1);
  assert.deepEqual(
    await writeCacheAtomic("C:\\repo\\.git\\devmuse\\project-context.v1.json", value, { platform: "win32", applyCurrentUserAcl: null }),
    { status: "memory-only", reason: "private-acl-unavailable" },
  );
});

// Covers: UC-G9
test("failed atomic replacement preserves the previous cache", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-atomic-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "project-context.v1.json");
  fs.writeFileSync(file, '{"revision":1}\n', { mode: 0o600 });
  const replacement = { schema_version: 1, revision: 2, project_id: "github:repo", worktrees: {}, recovery: {} };
  await assert.rejects(writeCacheAtomic(file, replacement, { rename: async () => { throw new Error("rename failed"); } }), /rename failed/);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).revision, 1);
  assert.deepEqual(fs.readdirSync(directory), ["project-context.v1.json"]);
});

// Covers: UC-G8, UC-GR3
test("linked worktrees share one Git-common cache but retain distinct keys", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-worktree-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const main = path.join(directory, "main");
  const linked = path.join(directory, "linked");
  fs.mkdirSync(main);
  for (const args of [["init", "-b", "main"], ["config", "user.email", "test@example.com"], ["config", "user.name", "Test"]]) {
    assert.equal(spawnSync("git", args, { cwd: main }).status, 0);
  }
  fs.writeFileSync(path.join(main, "README.md"), "fixture\n");
  spawnSync("git", ["add", "README.md"], { cwd: main });
  spawnSync("git", ["commit", "-m", "fixture"], { cwd: main });
  assert.equal(spawnSync("git", ["worktree", "add", "-b", "feature", linked], { cwd: main }).status, 0);
  const a = await resolveLocalProjectContext({ cwd: main });
  const b = await resolveLocalProjectContext({ cwd: linked });
  assert.equal(a.gitCommonDir, b.gitCommonDir);
  assert.notEqual(a.worktreeKey, b.worktreeKey);
});

// Covers: UC-G8, UC-GR3
test("a branch predating the manifest resolves a read-only default-branch candidate", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-default-manifest-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const args of [["init", "-b", "main"], ["config", "user.email", "test@example.com"], ["config", "user.name", "Test"]]) {
    assert.equal(spawnSync("git", args, { cwd: directory }).status, 0);
  }
  fs.writeFileSync(path.join(directory, "README.md"), "fixture\n");
  spawnSync("git", ["add", "README.md"], { cwd: directory });
  spawnSync("git", ["commit", "-m", "fixture"], { cwd: directory });
  assert.equal(spawnSync("git", ["switch", "-c", "legacy"], { cwd: directory }).status, 0);
  assert.equal(spawnSync("git", ["switch", "main"], { cwd: directory }).status, 0);
  fs.mkdirSync(path.join(directory, ".devmuse"));
  fs.writeFileSync(path.join(directory, ".devmuse", "project.yaml"), `schema_version: 1
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
`);
  spawnSync("git", ["add", ".devmuse/project.yaml"], { cwd: directory });
  spawnSync("git", ["commit", "-m", "manifest"], { cwd: directory });
  assert.equal(spawnSync("git", ["switch", "legacy"], { cwd: directory }).status, 0);

  const result = await resolveLocalProjectContext({
    cwd: directory,
    defaultBranchRef: "main",
    liveRepository: { id: "github:repo", repository: "github.com/org/repo" },
  });
  assert.equal(result.project_id, "github:repo");
  assert.equal(result.identity_source, "verified");
  assert.equal(result.manifest_source, "default-branch");
  assert.equal(result.collaboration_mode, "github-first");
  assert.equal(fs.existsSync(path.join(directory, ".devmuse", "project.yaml")), false);
});

// Covers: UC-G7, UC-G8
test("an invalid tracked manifest blocks live-only identity and remote writes", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-invalid-manifest-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.equal(spawnSync("git", ["init", "-b", "main"], { cwd: directory }).status, 0);
  fs.mkdirSync(path.join(directory, ".devmuse"));
  fs.writeFileSync(path.join(directory, ".devmuse", "project.yaml"), "schema_version: 1\ntoken: secret\n");
  assert.equal(spawnSync("git", ["add", ".devmuse/project.yaml"], { cwd: directory }).status, 0);
  const result = await resolveLocalProjectContext({
    cwd: directory,
    liveRepository: { id: "github:repo", repository: "github.com/org/repo" },
  });
  assert.equal(result.project_id, null);
  assert.equal(result.identity_source, "invalid-manifest");
  assert.equal(result.manifest_source, "current-branch");
  assert.equal(result.collaboration_mode, "local-only");
  assert.equal(result.fallback_reason, "invalid-manifest");
  assert.deepEqual(result.conflicts, [{ type: "invalid-manifest", source: "current-branch", reason: "unknown-key" }]);
});

// Covers: UC-G8, UC-G9, UC-GR3
test("a conflicting cache identity blocks resolution and hides its coordination pointers", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-resolver-conflict-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  for (const args of [["init", "-b", "main"], ["config", "user.email", "test@example.com"], ["config", "user.name", "Test"]]) {
    assert.equal(spawnSync("git", args, { cwd: directory }).status, 0);
  }
  fs.mkdirSync(path.join(directory, ".devmuse"));
  fs.writeFileSync(path.join(directory, ".devmuse", "project.yaml"), `schema_version: 1
project:
  id: "github:repo-a"
  repository: "github.com/org/repo"
collaboration:
  provider: github
  mode: github-first
artifacts:
  prd: null
  architecture:
    index: docs/architecture.md
    domain_model: CONTEXT.md
`);
  spawnSync("git", ["add", ".devmuse/project.yaml"], { cwd: directory });
  spawnSync("git", ["commit", "-m", "manifest"], { cwd: directory });
  const cacheDirectory = path.join(directory, ".git", "devmuse");
  fs.mkdirSync(cacheDirectory);
  fs.writeFileSync(path.join(cacheDirectory, "project-context.v1.json"), JSON.stringify({
    schema_version: 1, revision: 1, project_id: "github:repo-b",
    worktrees: { main: { work_id: "other", issue: 999, pull_request: 1000 } },
    recovery: {},
  }));
  const result = await resolveLocalProjectContext({
    cwd: directory,
    liveRepository: { id: "github:repo-a", repository: "github.com/org/repo" },
  });
  assert.equal(result.project_id, null);
  assert.equal(result.identity_source, "identity-conflict");
  assert.equal(result.fallback_reason, "identity-conflict");
  assert.equal(result.active_issue, null);
  assert.equal(result.active_pr, null);
  assert.deepEqual(result.recovery_state, {});
  assert.deepEqual(result.conflicts, [{ type: "identity-conflict", cache: "github:repo-b", resolved: "github:repo-a" }]);
});

// Covers: UC-G7, UC-G8
test("an untracked manifest cannot establish project identity", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-untracked-manifest-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  assert.equal(spawnSync("git", ["init", "-b", "main"], { cwd: directory }).status, 0);
  fs.mkdirSync(path.join(directory, ".devmuse"));
  fs.writeFileSync(path.join(directory, ".devmuse", "project.yaml"), "schema_version: 1\n");
  const result = await resolveLocalProjectContext({
    cwd: directory,
    liveRepository: { id: "github:repo", repository: "github.com/org/repo" },
  });
  assert.equal(result.project_id, null);
  assert.equal(result.identity_source, "untracked-manifest");
  assert.equal(result.fallback_reason, "untracked-manifest");
});

// Covers: UC-G3, UC-G8
test("SessionStart injects a sanitized local summary and remains read-only", () => {
  const result = spawnSync("bash", ["plugin/hooks/session-start"], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  const context = payload.hookSpecificOutput.additionalContext;
  assert.match(context, /devmuse-project-context/);
  const projectContext = context.match(/<devmuse-project-context>.*<\/devmuse-project-context>/)?.[0];
  assert.ok(projectContext);
  assert.doesNotMatch(projectContext, /token|oauth|authorization:/i);
});
