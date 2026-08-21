import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { readCache } from "./cache.mjs";
import { resolveProjectIdentity } from "./identity.mjs";
import { parseProjectManifest, selectManifestCandidate } from "./manifest.mjs";

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function resolveGitPath(cwd, value) {
  if (!value) return null;
  const resolved = path.resolve(cwd, value);
  return fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
}

function emptyResult(reason) {
  return {
    project_id: null,
    identity_source: null,
    manifest_source: null,
    collaboration_mode: "local-only",
    provider: null,
    repository: null,
    capability: { operations: {} },
    authorization: null,
    active_issue: null,
    active_pr: null,
    pipeline_phase: null,
    fallback_reason: reason,
    conflicts: [],
    recovery_state: {},
  };
}

export async function resolveLocalProjectContext({ cwd, liveRepository = null, defaultBranchRef = null } = {}) {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  const commonRaw = git(cwd, ["rev-parse", "--git-common-dir"]);
  const gitDirRaw = git(cwd, ["rev-parse", "--git-dir"]);
  if (!root || !commonRaw || !gitDirRaw) return { ...emptyResult("not-a-git-repository"), gitCommonDir: null, worktreeKey: null };

  const gitCommonDir = resolveGitPath(cwd, commonRaw);
  const gitDirectory = resolveGitPath(cwd, gitDirRaw);
  const relativeAdmin = path.relative(gitCommonDir, gitDirectory);
  const worktreeKey = relativeAdmin === "" ? "main" : relativeAdmin.replaceAll(path.sep, "/");
  const manifestFile = path.join(root, ".devmuse", "project.yaml");
  const manifestExists = fs.existsSync(manifestFile);
  const manifestTracked = manifestExists
    && git(root, ["ls-files", "--error-unmatch", "--", ".devmuse/project.yaml"]) !== null;
  const manifestRegular = manifestExists && fs.lstatSync(manifestFile).isFile();
  let rejectedManifestReason = null;
  if (manifestExists && !manifestTracked) rejectedManifestReason = "untracked-manifest";
  else if (manifestExists && !manifestRegular) rejectedManifestReason = "unsafe-manifest-file";
  const currentBranchText = manifestExists && rejectedManifestReason === null
    ? fs.readFileSync(manifestFile, "utf8")
    : null;
  const discoveredDefaultRef = defaultBranchRef
    ?? git(cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  const defaultBranchText = currentBranchText === null && discoveredDefaultRef
    ? git(cwd, ["show", `${discoveredDefaultRef}:.devmuse/project.yaml`])
    : null;
  const manifestCandidate = selectManifestCandidate({ currentBranchText, defaultBranchText });
  let manifest = null;
  if (rejectedManifestReason) manifest = { status: "invalid", value: null, reason: rejectedManifestReason };
  else if (manifestCandidate.status === "candidate") manifest = parseProjectManifest(manifestCandidate.text, { repoRoot: root });
  const manifestValue = manifest?.status === "valid" ? manifest.value : null;
  const liveId = liveRepository && typeof liveRepository === "object" ? liveRepository.id ?? null : null;
  const liveTuple = liveRepository && typeof liveRepository === "object" ? liveRepository.repository ?? null : liveRepository;
  const invalidManifest = manifest && manifest.status !== "valid";
  let invalidManifestStatus = "invalid-manifest";
  if (manifest?.status === "unsupported-schema") invalidManifestStatus = "unsupported-manifest-schema";
  else if (manifest?.reason === "untracked-manifest") invalidManifestStatus = "untracked-manifest";
  const identity = invalidManifest
    ? { status: invalidManifestStatus, projectId: null, repository: null, remoteWrites: false }
    : resolveProjectIdentity({
      manifestId: manifestValue?.project.id ?? null,
      manifestRepository: manifestValue?.project.repository ?? null,
      liveRepositoryId: liveId,
      liveRepository: liveTuple,
    });

  const cacheFile = path.join(gitCommonDir, "devmuse", "project-context.v1.json");
  let cache = null;
  if (fs.existsSync(cacheFile)) cache = readCache(fs.readFileSync(cacheFile, "utf8")).value;
  const conflicts = invalidManifest
    ? [{ type: invalidManifestStatus, source: rejectedManifestReason ? "current-branch" : manifestCandidate.source, reason: manifest.reason }]
    : [];
  const cacheIdentityConflict = Boolean(cache?.project_id && identity.projectId && cache.project_id !== identity.projectId);
  if (cacheIdentityConflict) {
    conflicts.push({ type: "identity-conflict", cache: cache.project_id, resolved: identity.projectId });
  }
  const cacheBlocked = invalidManifest || identity.status === "identity-conflict" || cacheIdentityConflict;
  const entry = cacheBlocked ? {} : cache?.worktrees?.[worktreeKey] ?? {};
  const result = {
    project_id: cacheIdentityConflict ? null : identity.projectId,
    identity_source: cacheIdentityConflict ? "identity-conflict" : identity.status,
    manifest_source: rejectedManifestReason ? "current-branch" : manifestCandidate.source,
    collaboration_mode: manifestValue?.collaboration.mode ?? "local-only",
    provider: manifestValue?.collaboration.provider ?? null,
    repository: cacheIdentityConflict ? null : identity.repository,
    capability: { operations: {} },
    authorization: null,
    active_issue: entry.issue ?? null,
    active_pr: entry.pull_request ?? null,
    pipeline_phase: entry.pipeline_phase ?? null,
    fallback_reason: cacheIdentityConflict ? "identity-conflict" : identity.remoteWrites ? null : identity.status,
    conflicts,
    recovery_state: cacheBlocked ? {} : cache?.recovery ?? {},
    gitCommonDir,
    worktreeKey,
    artifacts: manifestValue?.artifacts ?? null,
  };
  return result;
}

export function safeProjectContextSummary(result) {
  const safe = {
    project_id: result.project_id,
    identity_source: result.identity_source,
    collaboration_mode: result.collaboration_mode,
    provider: result.provider,
    active_issue: result.active_issue,
    active_pr: result.active_pr,
    pipeline_phase: result.pipeline_phase,
    fallback_reason: result.fallback_reason,
    conflicts: result.conflicts,
    artifacts: result.artifacts,
  };
  return `<devmuse-project-context>${JSON.stringify(safe)}</devmuse-project-context>`;
}
