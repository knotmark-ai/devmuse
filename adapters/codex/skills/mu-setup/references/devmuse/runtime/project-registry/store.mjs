// Local registry file store: the repository-backed backend that makes the
// registry fully functional with no SaaS account and no database runtime
// (UC-C2). Canonical data is Git-reviewable files under `registry/<kind>.json`;
// this module reads, writes (atomically), initializes, and reports on them.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { ASSET_KINDS, repositoryOwnedKinds } from "./routing.mjs";
import { serializeRegistryFile, parseRegistryFile } from "./registry.mjs";

const KIND_SET = new Set(ASSET_KINDS);
const REGISTRY_DIR = "registry";

export function registryPath(repoRoot, kind) {
  if (!KIND_SET.has(kind)) throw Object.assign(new Error(`unknown kind: ${kind}`), { code: "unknown-kind" });
  return path.join(repoRoot, REGISTRY_DIR, `${kind}.json`);
}

// Real path of the nearest existing ancestor of `target`, so symlink escape is
// detected even for a file that does not exist yet.
function realExistingPath(target) {
  let cursor = path.resolve(target);
  const suffix = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return path.resolve(target);
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  return path.join(fs.realpathSync(cursor), ...suffix);
}

// A tracked write target must resolve to a real path INSIDE the repo. A
// `registry` dir that is (or is under) a symlink pointing elsewhere is rejected,
// so an approved write can never land outside the repository.
function containedRegistryPath(repoRoot, kind) {
  const file = registryPath(repoRoot, kind);
  const root = realExistingPath(repoRoot);
  const resolved = realExistingPath(file);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw Object.assign(new Error("registry path escapes the repository"), { code: "registry-escapes-repo" });
  }
  return file;
}

// Resolve a tracked-write target inside the repo, rejecting a path (or a symlinked
// parent directory) that resolves outside it. Used by any writer that must not be
// tricked into writing beyond the repository (e.g. a symlinked `.devmuse`).
export function containedRepoPath(repoRoot, relativeFile) {
  const file = path.resolve(repoRoot, relativeFile);
  const root = realExistingPath(repoRoot);
  const resolved = realExistingPath(file);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw Object.assign(new Error("path escapes the repository"), { code: "path-escapes-repo" });
  }
  return file;
}

// Durable, all-or-nothing write: a same-directory temp file then an atomic rename,
// so a crash mid-write never leaves a half-written file. The temp name is
// UNPREDICTABLE and created with O_EXCL ("wx"): a pre-planted symlink at the temp
// path is never followed. A predictable `.tmp-<pid>` symlink could otherwise make
// writeFileSync write THROUGH it to a file outside the repo — the C-review found
// this hole in the earlier containment fix, which validated only the final target.
export function atomicWrite(file, text) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${randomUUID()}`);
  const fd = fs.openSync(tmp, "wx", 0o644); // O_CREAT|O_EXCL — fails if tmp exists; never follows a symlink
  try {
    fs.writeFileSync(fd, text, { encoding: "utf8" });
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

// Read one kind's assets. An absent file is an empty kind, not an error — a fresh
// project has no assets yet. A present-but-corrupt file is surfaced, not hidden.
export function readKind(repoRoot, kind) {
  const file = registryPath(repoRoot, kind);
  if (!fs.existsSync(file)) return { status: "empty", kind, assets: [] };
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { status: "unreadable", kind, assets: [] };
  }
  return parseRegistryFile(text);
}

// Atomic write: temp file + rename, so a crash never leaves a half-written
// registry file. Tracked file, normal mode.
export function writeKind(repoRoot, kind, assets) {
  const file = containedRegistryPath(repoRoot, kind); // rejects a symlink escape
  const serialized = serializeRegistryFile(kind, assets); // validates + rejects on bad input
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, serialized, { encoding: "utf8" });
  fs.renameSync(temporary, file);
  return { status: "written", kind, count: assets.length };
}

// Initialize the repository-backed registry: create `registry/` plus an empty
// file per kind. Idempotent — an existing kind file is left untouched (UC-C5, no
// destructive rewrite), so a rerun only fills what is missing.
// Create empty registry files for repository-owned kinds only. When `routes` is
// given, a kind routed to CI or an external provider is SKIPPED (never given a
// local canonical file that would compete with the system that owns it, #68); with
// no routes, every kind is repository-owned by default. Idempotent.
export function initRegistry(repoRoot, { routes = null } = {}) {
  const owned = new Set(routes ? repositoryOwnedKinds(routes) : ASSET_KINDS);
  const created = [];
  const kept = [];
  const skipped = [];
  for (const kind of ASSET_KINDS) {
    if (!owned.has(kind)) { skipped.push(kind); continue; } // externally routed — validate/bind, do not fork locally
    const file = registryPath(repoRoot, kind);
    if (fs.existsSync(file)) { kept.push(kind); continue; }
    writeKind(repoRoot, kind, []);
    created.push(kind);
  }
  return { status: "initialized", created, kept, skipped };
}

// Report current state without mutating anything (UC-C5 rerun).
export function registryStatus(repoRoot) {
  const kinds = ASSET_KINDS.map((kind) => {
    const result = readKind(repoRoot, kind);
    return { kind, present: result.status !== "empty", status: result.status, count: result.assets.length };
  });
  return { status: "reported", registry_dir: REGISTRY_DIR, kinds };
}

export { REGISTRY_DIR };
