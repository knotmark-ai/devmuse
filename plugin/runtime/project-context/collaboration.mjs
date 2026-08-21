import { createHash } from "node:crypto";

const OPERATIONS = new Set([
  "repository.read", "issue.read", "issue.create", "issue.update", "issue.comment.create",
  "branch.push", "pull_request.read", "pull_request.create", "pull_request.update", "pull_request.comment.create",
]);

function validCandidate(candidate, repositoryId) {
  return candidate?.open === true && candidate.repositoryId === repositoryId;
}

export function authorizeMutation({ operation, repositoryId, workId, capability, grant, now, maxCapabilityAge } = {}) {
  if (!OPERATIONS.has(operation)) return { allowed: false, reason: "unknown-operation" };
  if (!capability || capability.allowed !== true) return { allowed: false, reason: capability?.reason ?? "capability-denied" };
  if (!Number.isFinite(capability.checkedAt) || !Number.isFinite(now) || !Number.isFinite(maxCapabilityAge) || capability.checkedAt > now || now - capability.checkedAt > maxCapabilityAge) {
    return { allowed: false, reason: "stale-capability" };
  }
  if (!grant || !Array.isArray(grant.operations)) return { allowed: false, reason: "missing-grant" };
  if (grant.repositoryId !== repositoryId) return { allowed: false, reason: "grant-repository-mismatch" };
  if (grant.workId !== workId) return { allowed: false, reason: "grant-work-mismatch" };
  if (!grant.operations.includes(operation)) return { allowed: false, reason: "grant-operation-mismatch" };
  if (!Number.isFinite(grant.expiresAt) || grant.expiresAt < now) return { allowed: false, reason: "grant-expired" };
  if (!new Set(["explicit-user-request", "approved-workflow-step"]).has(grant.source)) return { allowed: false, reason: "invalid-grant-source" };
  return { allowed: true, reason: "ok" };
}

export function chooseIssueCandidate(input = {}) {
  const { repositoryId, workId } = input;
  if (validCandidate(input.explicit, repositoryId)) return { action: "reuse", candidate: input.explicit, source: "explicit" };
  if (validCandidate(input.cached, repositoryId) && input.cached.liveValidated === true) return { action: "reuse", candidate: input.cached, source: "validated-cache" };
  const exact = (input.exactWork ?? []).filter((candidate) => validCandidate(candidate, repositoryId) && candidate.workId === workId);
  if (exact.length === 1) return { action: "reuse", candidate: exact[0], source: "exact-work" };
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

function inspectPublishable(value) {
  if (typeof value === "string") {
    if (/gh[pousr]_[A-Za-z0-9_]{20,}/.test(value)) return "secret-rejected";
    if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(value) || /\bAKIA[A-Z0-9]{16}\b/.test(value)) return "secret-rejected";
    if (/(?:api[_-]?token|refresh[_-]?token|authorization)\s*[:=]\s*(?:bearer\s+)?[^\s,}]+/i.test(value)) return "secret-rejected";
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
    for (const item of Object.values(value)) {
      const result = inspectPublishable(item);
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

export function recoverCreateAttempt(attempt, candidates = []) {
  const exact = candidates.filter((candidate) => candidate.workId === attempt.workId
    && candidate.attemptId === attempt.attemptId
    && candidate.requestFingerprint === attempt.requestFingerprint);
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
