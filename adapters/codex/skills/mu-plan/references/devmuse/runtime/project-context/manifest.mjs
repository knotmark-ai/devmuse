import fs from "node:fs";
import path from "node:path";

const CONTAINERS = new Set(["project", "collaboration", "artifacts", "artifacts.architecture"]);
const LEAVES = new Set([
  "schema_version",
  "project.id",
  "project.repository",
  "collaboration.provider",
  "collaboration.mode",
  "artifacts.prd",
  "artifacts.architecture.index",
  "artifacts.architecture.domain_model",
]);

// Detect C0 control characters and DEL. `allowStructuralWhitespace` keeps tab,
// newline and carriage return (which the multi-line manifest grammar handles
// itself) while still rejecting NUL and the rest; scalar values allow none.
function hasControlChar(text, { allowStructuralWhitespace = false } = {}) {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code === 0x7f || (code <= 0x1f && !(allowStructuralWhitespace && (code === 0x09 || code === 0x0a || code === 0x0d)))) {
      return true;
    }
  }
  return false;
}
// Each artifact-path segment is limited to this set. It is everything the
// documented schema needs; forbidding the rest keeps manifest-controlled text
// (spaces, angle brackets, quotes) out of the injected session summary.
const ARTIFACT_SEGMENT = /^[A-Za-z0-9._-]+$/;

function invalid(reason) {
  return { status: "invalid", value: null, reason };
}

function parseScalar(raw) {
  if (raw === "null") return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      const value = JSON.parse(raw);
      // A double-quoted scalar decodes escapes, so the raw-text control screen
      // above does not cover the decoded result. Re-check it, otherwise a
      // manifest can smuggle a control character into injected session context.
      if (typeof value !== "string" || hasControlChar(value)) return undefined;
      return value;
    } catch {
      return undefined;
    }
  }
  return /^[A-Za-z0-9._:/-]+$/.test(raw) ? raw : undefined;
}

function realExistingPath(file) {
  let cursor = path.resolve(file);
  const suffix = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return path.resolve(file);
    suffix.unshift(path.basename(cursor));
    cursor = parent;
  }
  return path.join(fs.realpathSync(cursor), ...suffix);
}

function safeArtifactPath(value, repoRoot) {
  if (value === null) return true;
  if (typeof value !== "string" || value.length === 0 || value.includes("\\") || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  const segments = value.split("/");
  if (segments.some((segment) => !ARTIFACT_SEGMENT.test(segment) || segment === "." || segment === "..")) return false;
  const root = realExistingPath(repoRoot);
  const resolved = realExistingPath(path.resolve(repoRoot, ...segments));
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}

function setNested(target, dotted, value) {
  const parts = dotted.split(".");
  let cursor = target;
  for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
  cursor[parts.at(-1)] = value;
}

export function parseProjectManifest(text, { repoRoot } = {}) {
  if (typeof text !== "string" || typeof repoRoot !== "string" || hasControlChar(text, { allowStructuralWhitespace: true })) {
    return invalid("invalid-input");
  }
  if (/(^|[\s:])[&*!][^\s]*/m.test(text) || /[{}[\]]/.test(text)) return invalid("unsupported-yaml-feature");

  const stack = [];
  const values = new Map();
  for (const originalLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (originalLine.trim() === "") continue;
    if (originalLine.includes("\t") || /^\s*#/.test(originalLine)) return invalid("unsupported-yaml-feature");
    const indent = originalLine.length - originalLine.trimStart().length;
    if (indent % 2 !== 0 || indent > 4) return invalid("invalid-indentation");
    const match = originalLine.trim().match(/^([a-z_]+):(.*)$/);
    if (!match) return invalid("invalid-mapping");
    const [, key, tail] = match;
    const depth = indent / 2;
    if (depth > stack.length) return invalid("invalid-indentation");
    stack.length = depth;
    const dotted = [...stack, key].join(".");
    if (values.has(dotted)) return invalid("duplicate-key");
    values.set(dotted, true);
    const raw = tail.trim();
    if (raw === "") {
      if (!CONTAINERS.has(dotted)) return invalid("unknown-key");
      stack.push(key);
      continue;
    }
    if (!LEAVES.has(dotted)) return invalid("unknown-key");
    const scalar = parseScalar(raw);
    if (typeof scalar === "undefined") return invalid("invalid-scalar");
    values.set(dotted, scalar);
  }

  if ([...CONTAINERS, ...LEAVES].some((key) => !values.has(key))) return invalid("missing-key");
  if (values.get("schema_version") !== 1) {
    return { status: "unsupported-schema", value: null, reason: "unsupported-schema" };
  }
  if (!/^github:[A-Za-z0-9_-]+$/.test(values.get("project.id"))) return invalid("invalid-project-id");
  if (!/^[A-Za-z0-9.-]+\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(values.get("project.repository"))) return invalid("invalid-repository");
  if (values.get("collaboration.provider") !== "github") return invalid("invalid-provider");
  if (!new Set(["github-first", "local-first"]).has(values.get("collaboration.mode"))) return invalid("invalid-mode");
  for (const key of ["artifacts.prd", "artifacts.architecture.index", "artifacts.architecture.domain_model"]) {
    if (!safeArtifactPath(values.get(key), repoRoot)) return invalid("unsafe-artifact-path");
  }

  const value = {};
  for (const key of LEAVES) setNested(value, key, values.get(key));
  return { status: "valid", value, reason: null };
}

export function selectManifestCandidate({ currentBranchText = null, defaultBranchText = null } = {}) {
  if (typeof currentBranchText === "string") {
    return { status: "candidate", source: "current-branch", text: currentBranchText, writable: true };
  }
  if (typeof defaultBranchText === "string") {
    return { status: "candidate", source: "default-branch", text: defaultBranchText, writable: false };
  }
  return { status: "missing", source: null, text: null, writable: false };
}
