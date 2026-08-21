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
  const currentBranchText = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, "utf8") : null;
  const discoveredDefaultRef = defaultBranchRef
    ?? git(cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);
  const defaultBranchText = currentBranchText === null && discoveredDefaultRef
    ? git(cwd, ["show", `${discoveredDefaultRef}:.devmuse/project.yaml`])
    : null;
  const manifestCandidate = selectManifestCandidate({ currentBranchText, defaultBranchText });
  const manifest = manifestCandidate.status === "candidate"
    ? parseProjectManifest(manifestCandidate.text, { repoRoot: root })
    : null;
  const manifestValue = manifest?.status === "valid" ? manifest.value : null;
  const liveId = liveRepository && typeof liveRepository === "object" ? liveRepository.id ?? null : null;
  const liveTuple = liveRepository && typeof liveRepository === "object" ? liveRepository.repository ?? null : liveRepository;
  const invalidManifest = manifest && manifest.status !== "valid";
  const invalidManifestStatus = manifest?.status === "unsupported-schema"
    ? "unsupported-manifest-schema"
    : "invalid-manifest";
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
    ? [{ type: invalidManifestStatus, source: manifestCandidate.source, reason: manifest.reason }]
    : [];
  if (cache?.project_id && identity.projectId && cache.project_id !== identity.projectId) {
    conflicts.push({ type: "identity-conflict", cache: cache.project_id, resolved: identity.projectId });
  }
  const entry = cache?.worktrees?.[worktreeKey] ?? {};
  const result = {
    project_id: identity.projectId,
    identity_source: identity.status,
    manifest_source: manifestCandidate.source,
    collaboration_mode: manifestValue?.collaboration.mode ?? "local-only",
    provider: manifestValue?.collaboration.provider ?? null,
    repository: identity.repository,
    capability: { operations: {} },
    authorization: null,
    active_issue: entry.issue ?? null,
    active_pr: entry.pull_request ?? null,
    pipeline_phase: entry.pipeline_phase ?? null,
    fallback_reason: identity.remoteWrites ? null : identity.status,
    conflicts,
    recovery_state: cache?.recovery ?? {},
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
