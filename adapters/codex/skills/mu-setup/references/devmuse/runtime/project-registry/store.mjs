// Local registry file store: the repository-backed backend that makes the
// registry fully functional with no SaaS account and no database runtime
// (UC-C2). Canonical data is Git-reviewable files under `registry/<kind>.json`;
// this module reads, writes (atomically), initializes, and reports on them.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { ASSET_KINDS } from "./routing.mjs";
import { serializeRegistryFile, parseRegistryFile } from "./registry.mjs";

const KIND_SET = new Set(ASSET_KINDS);
const REGISTRY_DIR = "registry";

export function registryPath(repoRoot, kind) {
  if (!KIND_SET.has(kind)) throw Object.assign(new Error(`unknown kind: ${kind}`), { code: "unknown-kind" });
  return path.join(repoRoot, REGISTRY_DIR, `${kind}.json`);
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
  const file = registryPath(repoRoot, kind);
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
export function initRegistry(repoRoot) {
  const created = [];
  const kept = [];
  for (const kind of ASSET_KINDS) {
    const file = registryPath(repoRoot, kind);
    if (fs.existsSync(file)) { kept.push(kind); continue; }
    writeKind(repoRoot, kind, []);
    created.push(kind);
  }
  return { status: "initialized", created, kept };
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
