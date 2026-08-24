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
  if (!/^[1-9]\d*$/.test(attributes.revision ?? "")) return { status: "malformed", blocks: [] };
  if (!/^[a-f0-9]{64}$/.test(attributes.content_sha256 ?? "")) return { status: "malformed", blocks: [] };
  if (attributes.issue !== undefined && !/^[1-9]\d*$/.test(attributes.issue)) return { status: "malformed", blocks: [] };
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
  // This is the one deterministic publication gate: refuse to render a block
  // whose content carries a secret or an untrusted-instruction pattern, so a
  // secret can never reach an Issue/PR body through the managed path (UC-G7).
  if (sanitizePublishable(normalized).status !== "safe") {
    throw Object.assign(new Error("managed content rejected"), { code: "secret-rejected" });
  }
  const issueAttribute = family === "plan" ? ` issue=${issue}` : "";
  const header = `<!-- devmuse:${kind}:start schema=1 work_id=${workId}${issueAttribute} attempt_id=${attemptId} revision=${revision} content_sha256=${hashContent(normalized)} -->`;
  return `${header}\n${normalized}<!-- devmuse:${kind}:end -->`;
}

export function selectCurrentManagedRevision({ body = "", comments = [], kind } = {}) {
  const family = familyFor(kind);
  const parsed = [parseDocument(body, family), ...comments.map((comment) => parseDocument(comment, family))];
  const invalid = parsed.find((result) => result.status !== "valid");
  if (invalid) return { status: invalid.status, revision: null };
  const blocks = parsed.flatMap((result) => result.blocks);
  if (blocks.length === 0) return { status: "missing", revision: null };
  const highest = Math.max(...blocks.map((block) => block.revision));
  const candidates = blocks.filter((block) => block.revision === highest);
  const signatures = new Set(candidates.map((block) => `${block.attributes.work_id}:${block.attributes.issue ?? ""}:${block.contentHash}`));
  if (signatures.size > 1) return { status: "needs-reconciliation", revision: highest, candidates };
  return { status: "selected", revision: highest, block: candidates[0] };
}

export function replaceManagedRevision(body, managedRevision) {
  const newKind = managedRevision.match(/^<!-- devmuse:([^:]+):start /)?.[1];
  if (!newKind || !KINDS.has(newKind)) throw Object.assign(new Error("invalid managed revision"), { code: "invalid-managed-revision" });
  const family = familyFor(newKind);
  const parsedNew = parseDocument(managedRevision, family);
  if (parsedNew.status !== "valid" || parsedNew.blocks.length !== 1) throw Object.assign(new Error("invalid managed revision"), { code: "invalid-managed-revision" });
  const parsedBody = parseDocument(body, family);
  if (parsedBody.status !== "valid") throw Object.assign(new Error("invalid managed body"), { code: parsedBody.status });
  if (parsedBody.blocks.length === 0) return body ? `${body}\n${managedRevision}` : managedRevision;
  const old = parsedBody.blocks[0];
  return `${body.slice(0, old.index)}${managedRevision}${body.slice(old.index + old.raw.length)}`;
}
