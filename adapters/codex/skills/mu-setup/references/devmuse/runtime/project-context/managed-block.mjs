import { createHash } from "node:crypto";

import { sanitizePublishable } from "./collaboration.mjs";

const KINDS = new Set(["scope", "scope-revision", "plan", "plan-revision"]);
const WORK_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const ATTRIBUTE = /^[a-z0-9_]+=[^\s]+$/;

function normalizeContent(content) {
  return `${String(content).replace(/\r\n?/g, "\n").replace(/\n+$/, "")}\n`;
}

function hashContent(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function familyFor(kind) {
  return kind.startsWith("scope") ? "scope" : "plan";
}

function familyPattern(family) {
  return family === "scope" ? "scope(?:-revision)?" : "plan(?:-revision)?";
}

function parseAttributes(header) {
  const result = {};
  for (const token of header.trim().split(/\s+/)) {
    if (!ATTRIBUTE.test(token)) return null;
    const index = token.indexOf("=");
    const key = token.slice(0, index);
    if (Object.hasOwn(result, key)) return null;
    result[key] = token.slice(index + 1);
  }
  const allowed = new Set(["schema", "work_id", "issue", "attempt_id", "revision", "content_sha256"]);
  if (Object.keys(result).some((key) => !allowed.has(key))) return null;
  return result;
}

function parseDocument(text, family) {
  const source = typeof text === "string" ? text.replace(/\r\n?/g, "\n") : "";
  const kindPattern = familyPattern(family);
  const starts = source.match(new RegExp(`<!-- devmuse:${kindPattern}:start\\b`, "g")) ?? [];
  const ends = source.match(new RegExp(`<!-- devmuse:${kindPattern}:end -->`, "g")) ?? [];
  const expression = new RegExp(`<!-- devmuse:(${kindPattern}):start ([^>\\n]+) -->\\n([\\s\\S]*?)<!-- devmuse:\\1:end -->`, "g");
  const blocks = [...source.matchAll(expression)];
  if (starts.length !== ends.length || starts.length !== blocks.length) return { status: "malformed", blocks: [] };
  if (blocks.length > 1) return { status: "duplicate", blocks: [] };
  if (blocks.length === 0) return { status: "valid", blocks: [] };

  const match = blocks[0];
  const attributes = parseAttributes(match[2]);
  if (!attributes) return { status: "malformed", blocks: [] };
  if (attributes.schema !== "1") return { status: "unsupported-schema", blocks: [] };
  if (!WORK_ID.test(attributes.work_id ?? "") || !WORK_ID.test(attributes.attempt_id ?? "")) return { status: "malformed", blocks: [] };
  // Bound the digit count so a pathological value (e.g. a 400-digit revision) can
  // never parse to Infinity and later serialize to null — fail closed as malformed.
  if (!/^[1-9]\d{0,8}$/.test(attributes.revision ?? "")) return { status: "malformed", blocks: [] };
  if (!/^[a-f0-9]{64}$/.test(attributes.content_sha256 ?? "")) return { status: "malformed", blocks: [] };
  if (attributes.issue !== undefined && !/^[1-9]\d{0,8}$/.test(attributes.issue)) return { status: "malformed", blocks: [] };
  if ((family === "plan") !== (attributes.issue !== undefined)) return { status: "malformed", blocks: [] };
  const content = normalizeContent(match[3]);
  if (hashContent(content) !== attributes.content_sha256) return { status: "malformed", blocks: [] };
  return {
    status: "valid",
    blocks: [{
      kind: match[1], family, attributes, content,
      revision: Number(attributes.revision),
      contentHash: attributes.content_sha256,
      raw: match[0],
      index: match.index,
    }],
  };
}

export function renderManagedRevision({ kind, workId, issue = null, attemptId, revision, content } = {}) {
  if (!KINDS.has(kind) || !WORK_ID.test(workId ?? "") || !WORK_ID.test(attemptId ?? "") || !Number.isInteger(revision) || revision < 1) {
    throw Object.assign(new Error("invalid managed revision"), { code: "invalid-managed-revision" });
  }
  const family = familyFor(kind);
  if ((family === "plan") !== (Number.isInteger(issue) && issue > 0)) {
    throw Object.assign(new Error("managed plan requires issue"), { code: "invalid-managed-revision" });
  }
  const normalized = normalizeContent(content);
  // Best-effort publication gate: refuse to render a block whose content matches a
  // known secret or untrusted-instruction pattern (provider token prefixes,
  // credential-bearing URLs, inline password=…, etc.). A regex screen cannot
  // guarantee arbitrary-secret detection — treat it as a strong filter, not an
  // absolute guarantee (UC-G7).
  if (sanitizePublishable(normalized).status !== "safe") {
    throw Object.assign(new Error("managed content rejected"), { code: "secret-rejected" });
  }
  const issueAttribute = family === "plan" ? ` issue=${issue}` : "";
  const header = `<!-- devmuse:${kind}:start schema=1 work_id=${workId}${issueAttribute} attempt_id=${attemptId} revision=${revision} content_sha256=${hashContent(normalized)} -->`;
  return `${header}\n${normalized}<!-- devmuse:${kind}:end -->`;
}

export function selectCurrentManagedRevision({ body = "", comments = [], kind, workId = null, issue = null } = {}) {
  const family = familyFor(kind);
  const parsed = [parseDocument(body, family), ...comments.map((comment) => parseDocument(comment, family))];
  const invalid = parsed.find((result) => result.status !== "valid");
  if (invalid) return { status: invalid.status, revision: null };
  let blocks = parsed.flatMap((result) => result.blocks);
  // Bind selection to the expected work identity: a block carrying a foreign
  // work_id (or, for plans, a foreign issue) must never win by having the highest
  // revision. When no expected identity is supplied, selection is unfiltered.
  if (workId !== null) {
    blocks = blocks.filter((block) => block.attributes.work_id === workId
      && (issue === null || String(block.attributes.issue ?? "") === String(issue)));
  }
  if (blocks.length === 0) return { status: "missing", revision: null };
  const highest = Math.max(...blocks.map((block) => block.revision));
  const candidates = blocks.filter((block) => block.revision === highest);
  const signatures = new Set(candidates.map((block) => `${block.attributes.work_id}:${block.attributes.issue ?? ""}:${block.contentHash}`));
  if (signatures.size > 1) return { status: "needs-reconciliation", revision: highest, candidates };
  return { status: "selected", revision: highest, block: candidates[0] };
}

// The body carries only the BASE kind; `-revision` kinds are append-only comment
// markers and must never be spliced into the body.
const BODY_KINDS = new Set(["scope", "plan"]);
const ANY_MANAGED_START = /<!-- devmuse:(scope|scope-revision|plan|plan-revision):start\b/g;

export function replaceManagedRevision(body, managedRevision) {
  const revision = typeof managedRevision === "string" ? managedRevision.replace(/\r\n?/g, "\n") : "";
  const newKind = revision.match(/^<!-- devmuse:([^:]+):start /)?.[1];
  if (!newKind || !BODY_KINDS.has(newKind)) throw Object.assign(new Error("invalid managed revision"), { code: "invalid-managed-revision" });
  const family = familyFor(newKind);
  const parsedNew = parseDocument(revision, family);
  // The candidate must be EXACTLY one complete block — no leading/trailing content,
  // so a `<block> + password=…` or a second managed marker cannot ride along.
  if (parsedNew.status !== "valid" || parsedNew.blocks.length !== 1 || parsedNew.blocks[0].raw !== revision.trim()) {
    throw Object.assign(new Error("invalid managed revision"), { code: "invalid-managed-revision" });
  }
  // A non-string body is a caller error, not an empty document — fail closed rather
  // than silently discarding the original input. `null`/`undefined` mean "no body
  // yet" (a fresh create).
  if (body != null && typeof body !== "string") {
    throw Object.assign(new Error("invalid managed body"), { code: "invalid-managed-body" });
  }
  // parseDocument normalizes internally for validation, but we splice against the
  // ORIGINAL body so surrounding human text is preserved byte-for-byte (its CRLF and
  // all). We never rewrite the whole body's line endings.
  const original = typeof body === "string" ? body : "";
  const parsedBody = parseDocument(original, family);
  if (parsedBody.status !== "valid") throw Object.assign(new Error("invalid managed body"), { code: parsedBody.status });
  const next = parsedNew.blocks[0];
  if (parsedBody.blocks.length === 0) {
    // No block of this family. If the body already holds a managed block of ANOTHER
    // family, blindly appending would create two managed blocks — that is a
    // reconciliation situation, not an append.
    if ([...original.matchAll(ANY_MANAGED_START)].some((m) => familyFor(m[1]) !== family)) {
      throw Object.assign(new Error("managed block family conflict"), { code: "managed-family-conflict" });
    }
    return original ? `${original}\n${revision.trim()}` : revision.trim();
  }
  const old = parsedBody.blocks[0];
  // An in-place replacement must be the SAME managed object at a strictly newer
  // revision: identical kind, work_id, issue, and attempt_id (a stable attempt_id
  // across body updates is the design) — rejects work-A→work-B and changed attempt_id.
  const sameIdentity = old.kind === next.kind
    && old.attributes.work_id === next.attributes.work_id
    && (old.attributes.issue ?? null) === (next.attributes.issue ?? null)
    && old.attributes.attempt_id === next.attributes.attempt_id;
  if (!sameIdentity) {
    throw Object.assign(new Error("managed revision identity mismatch"), { code: "managed-identity-mismatch" });
  }
  // A byte-identical re-post at the same revision is an idempotent no-op — return the
  // ORIGINAL body unchanged (do not even rewrite its line endings).
  if (next.revision === old.revision && next.raw === old.raw) return original;
  if (next.revision < old.revision || (next.revision === old.revision && next.raw !== old.raw)) {
    throw Object.assign(new Error("managed revision is not strictly newer"), { code: "managed-revision-not-newer" });
  }
  // Locate the old block by its markers in the ORIGINAL body and replace just that
  // span; everything around it (human text, its CRLF) is preserved verbatim.
  const startMarker = `<!-- devmuse:${old.kind}:start`;
  const endMarker = `<!-- devmuse:${old.kind}:end -->`;
  const startIdx = original.indexOf(startMarker);
  const endIdx = startIdx === -1 ? -1 : original.indexOf(endMarker, startIdx);
  if (startIdx === -1 || endIdx === -1) throw Object.assign(new Error("invalid managed body"), { code: "malformed" });
  return `${original.slice(0, startIdx)}${revision.trim()}${original.slice(endIdx + endMarker.length)}`;
}
