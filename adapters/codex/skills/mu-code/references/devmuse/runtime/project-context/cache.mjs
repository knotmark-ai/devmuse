import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { sanitizePublishable } from "./collaboration.mjs";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const WORK_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const PROJECT_ID = /^(?:github:[A-Za-z0-9_-]+|uuid:[A-Fa-f0-9-]+)$/;
const FINGERPRINT = /^sha256:[a-f0-9]{64}$/;
const OPERATIONS = new Set([
  "repository.read", "issue.read", "issue.create", "issue.update", "issue.comment.create",
  "branch.push", "pull_request.read", "pull_request.create", "pull_request.update", "pull_request.comment.create",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function validText(value, { nullable = false } = {}) {
  return (nullable && value === null)
    || (typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f\u007f]/.test(value));
}

function validInstant(value) {
  return validText(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

function validPointer(value) {
  return value === null || (Number.isInteger(value) && value > 0);
}

function validCapabilityProbe(value) {
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(["checked_at", "provider", "operations"]))) return false;
  if (!validInstant(value.checked_at) || value.provider !== "github" || !isRecord(value.operations)) return false;
  for (const [operation, result] of Object.entries(value.operations)) {
    if (!OPERATIONS.has(operation) || !isRecord(result) || !hasOnlyKeys(result, new Set(["allowed", "reason"]))) return false;
    if (typeof result.allowed !== "boolean" || !validText(result.reason)) return false;
  }
  return true;
}

function validWorktreeEntry(value) {
  const allowed = new Set(["branch", "work_id", "issue", "pull_request", "pipeline_phase", "updated_at", "path_hint"]);
  if (!isRecord(value) || !hasOnlyKeys(value, allowed)) return false;
  if (Object.hasOwn(value, "branch") && !validText(value.branch, { nullable: true })) return false;
  if (Object.hasOwn(value, "work_id") && !WORK_ID.test(value.work_id ?? "")) return false;
  if (Object.hasOwn(value, "issue") && !validPointer(value.issue)) return false;
  if (Object.hasOwn(value, "pull_request") && !validPointer(value.pull_request)) return false;
  if (Object.hasOwn(value, "pipeline_phase") && !validText(value.pipeline_phase, { nullable: true })) return false;
  if (Object.hasOwn(value, "updated_at") && !validInstant(value.updated_at)) return false;
  if (Object.hasOwn(value, "path_hint") && !validText(value.path_hint)) return false;
  return true;
}

function validRecoveryRecord(key, value) {
  const required = new Set(["operation", "attempt_id", "work_id", "object_kind", "repository_id", "request_fingerprint", "status", "started_at"]);
  const allowed = new Set([...required, "head", "base", "last_error_code"]);
  if (!WORK_ID.test(key) || !isRecord(value) || !hasOnlyKeys(value, allowed)) return false;
  if ([...required].some((field) => !Object.hasOwn(value, field))) return false;
  if (!OPERATIONS.has(value.operation) || value.attempt_id !== key || !WORK_ID.test(value.attempt_id) || !WORK_ID.test(value.work_id)) return false;
  if (!new Set(["issue", "pull_request", "comment"]).has(value.object_kind) || !PROJECT_ID.test(value.repository_id)) return false;
  if (!FINGERPRINT.test(value.request_fingerprint) || !new Set(["pending", "indeterminate"]).has(value.status) || !validInstant(value.started_at)) return false;
  for (const field of ["head", "base", "last_error_code"]) {
    if (Object.hasOwn(value, field) && !validText(value[field], { nullable: true })) return false;
  }
  return true;
}

function validCache(value) {
  const allowed = new Set(["schema_version", "revision", "project_id", "capability_probe", "worktrees", "recovery"]);
  if (!isRecord(value) || !hasOnlyKeys(value, allowed)) return false;
  if (value.schema_version !== 1 || !Number.isInteger(value.revision) || value.revision < 1 || !PROJECT_ID.test(value.project_id ?? "")) return false;
  if (Object.hasOwn(value, "capability_probe") && value.capability_probe !== null && !validCapabilityProbe(value.capability_probe)) return false;
  if (!isRecord(value.worktrees) || !isRecord(value.recovery)) return false;
  for (const [key, entry] of Object.entries(value.worktrees)) {
    if (!validText(key) || !validWorktreeEntry(entry)) return false;
  }
  for (const [key, record] of Object.entries(value.recovery)) {
    if (!validRecoveryRecord(key, record)) return false;
  }
  return sanitizePublishable(value).status === "safe";
}

function clone(value) {
  return structuredClone(value);
}

function requireValidCache(value) {
  if (validCache(value)) return value;
  const error = new Error("unsafe cache state");
  error.code = "invalid-cache-update";
  throw error;
}

function withoutValidity(candidate) {
  const { valid: _valid, ...value } = candidate;
  return value;
}

export function readCache(text) {
  try {
    const value = JSON.parse(text);
    if (!validCache(value)) throw new Error("invalid cache");
    return { status: "loaded", value, reason: null };
  } catch {
    return { status: "fresh-discovery", value: null, reason: "corrupt-cache" };
  }
}

export function mergeCache(current, incoming) {
  if (!validCache(current)) return { status: "invalid-cache", reason: "unsafe-cache-state" };
  if (!isRecord(incoming)) return { status: "invalid-update", reason: "unsafe-cache-state" };
  const incomingProjectId = incoming.projectId ?? incoming.project_id ?? null;
  if (incomingProjectId && current.project_id && incomingProjectId !== current.project_id) {
    return { status: "identity-conflict", sources: { cache: current.project_id, incoming: incomingProjectId } };
  }
  const next = clone(current);
  next.worktrees ??= {};
  next.recovery ??= {};
  if (incoming.worktreeKey) {
    const existing = next.worktrees[incoming.worktreeKey];
    const entry = incoming.entry ?? {};
    if (existing) {
      // Same work item → enrich in place (issue → PR → phase is normal delivery
      // progress, not a conflict). Reconcile only when a shared field carries a
      // contradictory value, or the work_id itself changed.
      const existingWork = existing.work_id ?? null;
      const incomingWork = entry.work_id ?? existingWork;
      const contradiction = incomingWork !== existingWork
        || Object.keys(entry).some((key) => existing[key] !== undefined && JSON.stringify(existing[key]) !== JSON.stringify(entry[key]));
      if (contradiction) {
        return { status: "needs-reconciliation", candidates: [clone(existing), clone(entry)], revision: current.revision };
      }
      next.worktrees[incoming.worktreeKey] = { ...existing, ...entry };
    } else {
      next.worktrees[incoming.worktreeKey] = clone(entry);
    }
  }
  if (incoming.attempt) next.recovery[incoming.attempt.attempt_id] = clone(incoming.attempt);
  if (incoming.clearAttemptId) delete next.recovery[incoming.clearAttemptId];
  next.project_id = next.project_id || incomingProjectId;
  next.revision = current.revision + 1;
  if (!validCache(next)) return { status: "invalid-update", reason: "unsafe-cache-state" };
  return { status: "merged", value: next };
}

export function reconcileCacheEntry({ expectedRevision, currentRevision, candidates = [], choice = null } = {}) {
  if (expectedRevision !== currentRevision) return { status: "restart" };
  const valid = candidates.filter((candidate) => candidate?.valid === true);
  if (Number.isInteger(choice) && valid[choice]) return { status: "resolved", value: withoutValidity(valid[choice]) };
  if (valid.length === 0) return { status: "fresh-discovery", value: null };
  // Null-prototype accumulator so a candidate key of "__proto__" is stored as
  // an own property and compared, instead of mutating the prototype and slipping
  // the conflict check.
  const combined = Object.create(null);
  for (const candidate of valid) {
    for (const [key, value] of Object.entries(withoutValidity(candidate))) {
      if (Object.hasOwn(combined, key) && combined[key] !== value) {
        return { status: "needs-user-choice", candidates: clone(valid) };
      }
      combined[key] = value;
    }
  }
  return { status: "resolved", value: { ...combined } };
}

export function upsertRecoveryAttempt(cache, attempt) {
  const next = clone(cache);
  next.recovery ??= {};
  next.recovery[attempt.attempt_id] = clone(attempt);
  return requireValidCache(next);
}

export function clearRecoveryAttempt(cache, attemptId) {
  const next = clone(cache);
  next.recovery ??= {};
  delete next.recovery[attemptId];
  return requireValidCache(next);
}

export async function writeCacheAtomic(file, value, options = {}) {
  let serialized;
  try {
    const snapshot = clone(value);
    if (!validCache(snapshot)) return { status: "rejected", reason: "unsafe-cache-state" };
    serialized = `${JSON.stringify(snapshot)}\n`;
  } catch {
    return { status: "rejected", reason: "unsafe-cache-state" };
  }
  const platform = options.platform ?? process.platform;
  if (platform === "win32" && typeof options.applyCurrentUserAcl !== "function") {
    return { status: "memory-only", reason: "private-acl-unavailable" };
  }
  const mkdir = options.mkdir ?? fs.promises.mkdir.bind(fs.promises);
  const writeFile = options.writeFile ?? fs.promises.writeFile.bind(fs.promises);
  const rename = options.rename ?? fs.promises.rename.bind(fs.promises);
  const remove = options.remove ?? fs.promises.rm.bind(fs.promises);
  const directory = path.dirname(file);
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(temporary, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
    if (platform === "win32") await options.applyCurrentUserAcl(temporary);
    await rename(temporary, file);
    if (platform !== "win32") await fs.promises.chmod(file, 0o600);
    return { status: "persisted" };
  } catch (error) {
    await remove(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

const STALE_LOCK_MS = 30_000;

// A crashed writer can leave the mkdir mutex directory behind. Rather than wedge
// every future update for good, break a lock whose own recorded timestamp is
// older than STALE_LOCK_MS, then retry the acquire once.
async function breakStaleLock(lockDirectory) {
  try {
    const stat = await fs.promises.stat(lockDirectory);
    if (Date.now() - stat.mtimeMs >= STALE_LOCK_MS) {
      await fs.promises.rmdir(lockDirectory).catch(() => {});
    }
  } catch {
    // Lock vanished between EEXIST and here; the next acquire attempt handles it.
  }
}

async function acquireLock(lockDirectory, options = {}) {
  const deadline = Date.now() + (options.lockTimeoutMs ?? 5_000);
  await fs.promises.mkdir(path.dirname(lockDirectory), { recursive: true, mode: 0o700 });
  while (true) {
    try {
      await fs.promises.mkdir(lockDirectory, { mode: 0o700 });
      return async () => fs.promises.rmdir(lockDirectory).catch(() => {});
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        // Break a stale lock and retry the acquire ONCE, so the current write is
        // persisted rather than silently dropped to memory-only. Only if the
        // retry still fails do we degrade.
        await breakStaleLock(lockDirectory);
        try {
          await fs.promises.mkdir(lockDirectory, { mode: 0o700 });
          return async () => fs.promises.rmdir(lockDirectory).catch(() => {});
        } catch {
          return null;
        }
      }
      await delay(10);
    }
  }
}

export async function updateCache(file, incoming, options = {}) {
  const release = await acquireLock(`${file}.lock`, options);
  // A contended-and-stale lock could not be taken; degrade to memory-only rather
  // than throwing, matching the "corrupt or absent state" degradation contract.
  if (release === null) return { status: "lock-unavailable", persistence: "memory-only" };
  try {
    let current;
    try {
      const loaded = readCache(await fs.promises.readFile(file, "utf8"));
      current = loaded.value;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    current ??= { schema_version: 1, revision: 1, project_id: incoming.projectId ?? incoming.project_id, worktrees: {}, recovery: {} };
    const result = mergeCache(current, incoming);
    if (result.status !== "merged") return result;
    const persisted = await writeCacheAtomic(file, result.value, options);
    return { ...result, persistence: persisted.status };
  } finally {
    await release();
  }
}
