import { createHash } from "node:crypto";

const OPERATIONS = new Set([
  "repository.read", "issue.read", "issue.create", "issue.update", "issue.comment.create",
  "branch.push", "pull_request.read", "pull_request.create", "pull_request.update", "pull_request.comment.create",
]);

// Upper bound on how old a capability probe may be, regardless of the value a
// caller supplies. A caller cannot widen its own freshness window; see
// project-context.md ("a fresh live `allowed` result").
const MAX_CAPABILITY_AGE_CEILING_MS = 15 * 60 * 1000;

// A repository/work binding is only satisfied when both sides are present and
// equal. Absent-equals-absent must never authorize: `undefined === undefined`
// would otherwise bind a grant to no repository and no work item.
function boundMatch(expected, actual) {
  return typeof expected === "string" && expected.length > 0 && expected === actual;
}

function validCandidate(candidate, repositoryId) {
  return candidate?.open === true && boundMatch(repositoryId, candidate.repositoryId);
}

export function authorizeMutation({ operation, repositoryId, workId, capability, grant, now, maxCapabilityAge } = {}) {
  if (!OPERATIONS.has(operation)) return { allowed: false, reason: "unknown-operation" };
  if (typeof repositoryId !== "string" || repositoryId.length === 0 || typeof workId !== "string" || workId.length === 0) {
    return { allowed: false, reason: "unbound-request" };
  }
  if (!capability || capability.operation !== operation) return { allowed: false, reason: "capability-operation-mismatch" };
  if (capability.allowed !== true) return { allowed: false, reason: capability.reason ?? "capability-denied" };
  const effectiveMaxAge = Number.isFinite(maxCapabilityAge) ? Math.min(Math.max(maxCapabilityAge, 0), MAX_CAPABILITY_AGE_CEILING_MS) : NaN;
  if (!Number.isFinite(capability.checkedAt) || !Number.isFinite(now) || !Number.isFinite(effectiveMaxAge) || capability.checkedAt > now || now - capability.checkedAt > effectiveMaxAge) {
    return { allowed: false, reason: "stale-capability" };
  }
  if (!grant || !Array.isArray(grant.operations)) return { allowed: false, reason: "missing-grant" };
  if (!boundMatch(repositoryId, grant.repositoryId)) return { allowed: false, reason: "grant-repository-mismatch" };
  if (!boundMatch(workId, grant.workId)) return { allowed: false, reason: "grant-work-mismatch" };
  if (!grant.operations.includes(operation)) return { allowed: false, reason: "grant-operation-mismatch" };
  if (!Number.isFinite(grant.expiresAt) || grant.expiresAt < now) return { allowed: false, reason: "grant-expired" };
  if (!new Set(["explicit-user-request", "approved-workflow-step"]).has(grant.source)) return { allowed: false, reason: "invalid-grant-source" };
  return { allowed: true, reason: "ok" };
}

export function chooseIssueCandidate(input = {}) {
  const { repositoryId, workId } = input;
  if (validCandidate(input.explicit, repositoryId)) return { action: "reuse", candidate: input.explicit, source: "explicit" };
  if (validCandidate(input.cached, repositoryId) && input.cached.liveValidated === true && boundMatch(workId, input.cached.workId)) return { action: "reuse", candidate: input.cached, source: "validated-cache" };
  const exact = (input.exactWork ?? []).filter((candidate) => validCandidate(candidate, repositoryId) && boundMatch(workId, candidate.workId));
  if (exact.length === 1) return { action: "reuse", candidate: exact[0], source: "exact-work" };
  if (exact.length > 1) return { action: "reconcile", candidates: exact, source: "exact-work" };
  if (validCandidate(input.confirmed, repositoryId)) return { action: input.confirmed.marked ? "reuse" : "adopt", candidate: input.confirmed, source: "confirmed" };
  const semantic = (input.semantic ?? []).filter((candidate) => validCandidate(candidate, repositoryId));
  if (semantic.length > 0) return { action: "confirm", candidates: semantic };
  return { action: "offer-create" };
}

export function chooseUpdateStrategy({ supportsConditionalUpdate, providerConflict = false, commentAuthorized = false } = {}) {
  if (supportsConditionalUpdate && providerConflict) return { action: "refetch-and-reconcile" };
  if (supportsConditionalUpdate) return { action: "conditional-body-update" };
  if (commentAuthorized) return { action: "append-managed-revision-comment" };
  return { action: "manual-or-local-fallback" };
}

const SENSITIVE_KEY = /^(?:access[_-]?token|api[_-]?(?:key|token)|authorization|auth(?:entication|orization)?[_-]?token|aws[_-]?secret[_-]?access[_-]?key|client[_-]?secret|credentials?|github[_-]?token|oauth[_-]?(?:cache|token)|password|private[_-]?key|refresh[_-]?token|secret|token)$/i;

function inspectPublishable(value, key = null) {
  if (key !== null && SENSITIVE_KEY.test(key) && value !== null && value !== "") return "secret-rejected";
  if (typeof value === "string") {
    if (/gh[pousr]_[A-Za-z0-9_]{20,}/.test(value)) return "secret-rejected";
    if (/github_pat_[A-Za-z0-9_]{20,}/.test(value)) return "secret-rejected";
    if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(value) || /\bAKIA[A-Z0-9]{16}\b/.test(value)) return "secret-rejected";
    if (/(?:api[_-]?token|refresh[_-]?token|authorization)\s*[:=]\s*(?:bearer\s+)?[^\s,}]+/i.test(value)) return "secret-rejected";
    // Provider token prefixes that appear as bare values (never behind a sensitive
    // key), so the object-key screen alone would miss them in free-form content.
    if (/\bsk-(?:proj|ant)-[A-Za-z0-9_-]{8,}/i.test(value)) return "secret-rejected";   // OpenAI project / Anthropic keys
    if (/\bsk-[A-Za-z0-9]{20,}/.test(value)) return "secret-rejected";                   // classic OpenAI key
    if (/\bnpm_[A-Za-z0-9]{20,}/.test(value)) return "secret-rejected";                  // npm automation token
    // Free-form `key = value` assignments for the same sensitive-key vocabulary the
    // object-key screen uses — so a secret in raw content (api_key=, client_secret=,
    // token=, secret=, OPENAI_API_KEY=, password=, …) is caught, not just as a map key.
    if (/(?<![A-Za-z0-9])(?:access[_-]?token|api[_-]?key|api[_-]?token|authorization|aws[_-]?secret[_-]?access[_-]?key|client[_-]?secret|credentials?|github[_-]?token|oauth[_-]?token|passwd|password|private[_-]?key|refresh[_-]?token|secret|token)\s*[:=]\s*[^\s,;}'"]+/i.test(value)) return "secret-rejected";
    if (/\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i.test(value)) return "secret-rejected"; // credential-bearing URL (user:pass@host)
    if (/\brm\s+-rf\s+\/(?:\s|$)/i.test(value)) return "untrusted-instruction";
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = inspectPublishable(item);
      if (result) return result;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [name, item] of Object.entries(value)) {
      const result = inspectPublishable(item, name);
      if (result) return result;
    }
  }
  return null;
}

export function sanitizePublishable(value) {
  const status = inspectPublishable(value);
  return status ? { status, value: null } : { status: "safe", value: structuredClone(value) };
}

export function fingerprintCreateRequest({ repositoryId, workId, objectKind, title = null, head = null, base = null, contentHash } = {}) {
  if ([repositoryId, workId, objectKind, contentHash].some((value) => typeof value !== "string" || value.length === 0)) {
    throw Object.assign(new Error("invalid create request"), { code: "invalid-create-request" });
  }
  const serialized = JSON.stringify([repositoryId, workId, objectKind, title, head, base, contentHash]);
  return `sha256:${createHash("sha256").update(serialized, "utf8").digest("hex")}`;
}

export function recoverCreateAttempt(attempt = {}, candidates = []) {
  // A recovery match must be positively identified by all three bindings;
  // an attempt missing any of them can never adopt an existing object.
  if (![attempt.workId, attempt.attemptId, attempt.requestFingerprint].every((value) => typeof value === "string" && value.length > 0)) {
    return { status: "pending" };
  }
  const exact = candidates.filter((candidate) => boundMatch(attempt.workId, candidate.workId)
    && boundMatch(attempt.attemptId, candidate.attemptId)
    && boundMatch(attempt.requestFingerprint, candidate.requestFingerprint));
  if (exact.length === 0) return { status: "pending" };
  if (exact.length === 1) return { status: "adopted", candidate: exact[0] };
  return { status: "needs-reconciliation", candidates: exact };
}

export function planCreateRetry({ outcome, retryAfter = null, grantActive = false } = {}) {
  if (!grantActive) return { action: "stop", reason: "grant-inactive" };
  if (outcome === "definite-no-side-effect") return { action: "retry-same-attempt" };
  if (outcome === "rate-limited") return { action: "wait", retryAfter };
  if (outcome === "timeout" || outcome === "lost-response") return { action: "record-indeterminate-and-probe", autoRetry: false };
  return { action: "stop", reason: "unknown-outcome" };
}
