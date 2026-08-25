import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { readCache } from "./cache.mjs";
import { resolveProjectIdentity } from "./identity.mjs";
import { parseProjectManifest, selectManifestCandidate } from "./manifest.mjs";

// Hardening flags applied to every git invocation: neutralize a hostile
// per-repository fsmonitor/pager hook (the hook runs git in an untrusted cwd
// before the user types anything) and ignore system-level git config.
const GIT_HARDENING = ["-c", "core.fsmonitor=", "-c", "core.pager=cat"];

function git(cwd, args) {
  const result = spawnSync("git", [...GIT_HARDENING, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_PAGER: "cat", GIT_TERMINAL_PROMPT: "0" },
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

// A ref that reaches a `git show` argv slot must not begin with "-" (else git
// parses it as an option, e.g. --output=) and must stay within a conservative
// ref charset. Anything else is treated as "no discovered ref".
function safeRef(ref) {
  return typeof ref === "string" && ref.length > 0 && !ref.startsWith("-") && /^[A-Za-z0-9._/-]+$/.test(ref) ? ref : null;
}

function readTextFile(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
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
    identity_repair: null,
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
    ? readTextFile(manifestFile)
    : null;
  const discoveredDefaultRef = safeRef(defaultBranchRef
    ?? git(cwd, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]));
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
  const cacheText = readTextFile(cacheFile);
  const cache = cacheText === null ? null : readCache(cacheText).value;
  const conflicts = invalidManifest
    ? [{ type: invalidManifestStatus, source: rejectedManifestReason ? "current-branch" : manifestCandidate.source, reason: manifest.reason }]
    : [];
  // A valid manifest whose immutable ID disagrees with the live repository is
  // the conflict the design calls out most explicitly; surface it so callers
  // can act on identity.repair rather than silently reading fallback_reason.
  if (!invalidManifest && identity.status === "identity-conflict") {
    conflicts.push({ type: "identity-conflict", source: "manifest-vs-live", repair: identity.repair });
  }
  const cacheIdentityConflict = Boolean(cache?.project_id && identity.projectId && cache.project_id !== identity.projectId);
  if (cacheIdentityConflict) {
    conflicts.push({ type: "identity-conflict", cache: cache.project_id, resolved: identity.projectId });
  }
  const cacheBlocked = invalidManifest || identity.status === "identity-conflict" || cacheIdentityConflict;
  const entry = cacheBlocked ? {} : cache?.worktrees?.[worktreeKey] ?? {};
  // Expose the case-registry control plane so pipeline skills can discover, through
  // the project-context contract, whether an asset kind is repository/CI/SaaS-owned.
  // The manifest parser has already validated the routing's structure (an invalid
  // block is surfaced as a manifest conflict, never silently dropped); the specific
  // provider vocabulary and user-preference merge remain project-registry's job
  // (resolve-routing), which consumes exactly this declared project policy.
  const projectCases = cacheBlocked ? null : manifestValue?.cases ?? null;
  const caseRouting = projectCases
    ? { registry: projectCases.registry ?? "repository", routes: projectCases.routes ?? {} }
    : (manifestValue && !cacheBlocked ? { registry: "repository", routes: {} } : null);
  const result = {
    project_id: cacheIdentityConflict ? null : identity.projectId,
    identity_source: cacheIdentityConflict ? "identity-conflict" : identity.status,
    manifest_source: rejectedManifestReason ? "current-branch" : manifestCandidate.source,
    collaboration_mode: manifestValue?.collaboration.mode ?? "local-only",
    provider: manifestValue?.collaboration.provider ?? null,
    repository: cacheIdentityConflict ? null : identity.repository,
    // Resolution never surfaces capability or a grant: a mutation's capability
    // comes from a fresh live probe and its authorization from an explicit
    // grant (grants are never cached). These stay empty by design.
    capability: { operations: {} },
    authorization: null,
    identity_repair: cacheBlocked ? null : identity.repair ?? null,
    active_issue: entry.issue ?? null,
    active_pr: entry.pull_request ?? null,
    pipeline_phase: entry.pipeline_phase ?? null,
    fallback_reason: cacheIdentityConflict ? "identity-conflict" : identity.remoteWrites ? null : identity.status,
    conflicts,
    recovery_state: cacheBlocked ? {} : cache?.recovery ?? {},
    gitCommonDir,
    worktreeKey,
    artifacts: manifestValue?.artifacts ?? null,
    case_routing: caseRouting,
    case_routes_source: projectCases ? "project" : (manifestValue && !cacheBlocked ? "default" : "unavailable"),
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
    case_routing: result.case_routing,
    case_routes_source: result.case_routes_source,
  };
  // JSON.stringify does NOT escape <, >, or &, so a cache value like
  // "</devmuse-project-context><system>…" would close the model-facing fence early
  // and inject a second tag. Escape those to \uXXXX — still valid JSON that parses
  // back to the original text, but no payload can terminate the tag boundary.
  const json = JSON.stringify(safe).replace(/[<>&]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return `<devmuse-project-context>${json}</devmuse-project-context>`;
}
