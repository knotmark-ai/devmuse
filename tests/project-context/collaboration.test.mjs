import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  authorizeMutation,
  chooseIssueCandidate,
  chooseUpdateStrategy,
  fingerprintCreateRequest,
  planCreateRetry,
  projectDelivery,
  recoverCreateAttempt,
  renderManagedRevision,
  replaceManagedRevision,
  sanitizePublishable,
  selectCurrentManagedRevision,
} from "../../plugin/runtime/project-context/index.mjs";

// Covers: UC-G1, UC-G2
test("only explicit, validated-cache, or exact-work markers auto-reuse an Issue", () => {
  assert.equal(chooseIssueCandidate({ explicit: { number: 62, open: true, repositoryId: "repo" }, repositoryId: "repo" }).action, "reuse");
  assert.equal(chooseIssueCandidate({ cached: { number: 62, open: true, repositoryId: "repo", liveValidated: true }, repositoryId: "repo" }).action, "reuse");
  assert.equal(chooseIssueCandidate({ exactWork: [{ number: 62, open: true, repositoryId: "repo", workId: "issue-62" }], workId: "issue-62", repositoryId: "repo" }).action, "reuse");
  assert.equal(chooseIssueCandidate({ semantic: [{ number: 62, open: true, repositoryId: "repo" }], repositoryId: "repo" }).action, "confirm");
  assert.equal(chooseIssueCandidate({ confirmed: { number: 62, open: true, repositoryId: "repo", marked: false }, repositoryId: "repo" }).action, "adopt");
  assert.equal(chooseIssueCandidate({ semantic: [{ number: 62, open: false, repositoryId: "repo" }], repositoryId: "repo" }).action, "offer-create");
  assert.equal(chooseIssueCandidate({ semantic: [{ number: 62, open: true, repositoryId: "other" }], repositoryId: "repo" }).action, "offer-create");
  assert.equal(chooseIssueCandidate({ semantic: [{ number: 62, open: true, repositoryId: "repo" }, { number: 63, open: true, repositoryId: "repo" }], repositoryId: "repo" }).action, "confirm");
  assert.equal(chooseIssueCandidate({ semantic: [], repositoryId: "repo" }).action, "offer-create");
});

// Covers: UC-G2, UC-G7
test("mutation requires exact fresh capability and bounded matching grant", () => {
  const input = {
    operation: "issue.create", repositoryId: "repo", workId: "issue-62",
    capability: { allowed: true, reason: "ok", checkedAt: 100 },
    grant: { source: "explicit-user-request", repositoryId: "repo", workId: "issue-62", operations: ["issue.create"], expiresAt: 200 },
    now: 150, maxCapabilityAge: 100,
  };
  assert.deepEqual(authorizeMutation(input), { allowed: true, reason: "ok" });
  assert.equal(authorizeMutation({ ...input, now: 201 }).allowed, false);
  assert.equal(authorizeMutation({ ...input, operation: "issue.update" }).allowed, false);
  for (const operation of [
    "repository.read", "issue.read", "issue.create", "issue.update", "issue.comment.create",
    "branch.push", "pull_request.read", "pull_request.create", "pull_request.update", "pull_request.comment.create",
  ]) {
    assert.deepEqual(authorizeMutation({ ...input, operation, grant: { ...input.grant, operations: [operation] } }), { allowed: true, reason: "ok" });
  }
  assert.deepEqual(authorizeMutation({ ...input, capability: { allowed: false, reason: "permission-denied", checkedAt: 149 } }), { allowed: false, reason: "permission-denied" });
  assert.deepEqual(authorizeMutation({ ...input, capability: { allowed: true, reason: "ok", checkedAt: 1 } }), { allowed: false, reason: "stale-capability" });
  assert.deepEqual(authorizeMutation({ ...input, grant: { ...input.grant, repositoryId: "other" } }), { allowed: false, reason: "grant-repository-mismatch" });
  assert.deepEqual(authorizeMutation({ ...input, grant: { ...input.grant, workId: "other" } }), { allowed: false, reason: "grant-work-mismatch" });
});

// Covers: UC-G2, UC-G4
test("unsupported conditional updates choose comments or manual fallback, never body overwrite", () => {
  assert.deepEqual(chooseUpdateStrategy({ supportsConditionalUpdate: false, commentAuthorized: true }), { action: "append-managed-revision-comment" });
  assert.deepEqual(chooseUpdateStrategy({ supportsConditionalUpdate: false, commentAuthorized: false }), { action: "manual-or-local-fallback" });
  assert.deepEqual(chooseUpdateStrategy({ supportsConditionalUpdate: true, commentAuthorized: false }), { action: "conditional-body-update" });
  assert.deepEqual(chooseUpdateStrategy({ supportsConditionalUpdate: true, providerConflict: true, commentAuthorized: false }), { action: "refetch-and-reconcile" });
});

// Covers: UC-G4, UC-G7
test("managed revisions are deterministic and preserve human text", () => {
  const oldRevision = renderManagedRevision({ kind: "plan", workId: "issue-62", issue: 62, attemptId: "7deba3e4-8fd5-4cda-a287-6675be601234", revision: 1, content: "old task\n" });
  const revision = renderManagedRevision({ kind: "plan", workId: "issue-62", issue: 62, attemptId: "7deba3e4-8fd5-4cda-a287-6675be601234", revision: 2, content: "- [ ] Task\n" });
  assert.match(revision, /schema=1 work_id=issue-62 issue=62 attempt_id=7deba3e4/);
  assert.match(revision, /content_sha256=d77c43fcf35fb39f4f3f9f7bee466ca1f2f569c3445024b61a5924e01d7a797b/);
  const original = `human before\n${oldRevision}\nhuman after`;
  const expected = `human before\n${revision}\nhuman after`;
  const updated = replaceManagedRevision(original, revision);
  assert.equal(updated, expected);
  assert.doesNotMatch(updated, /old task/);
  assert.equal(replaceManagedRevision(updated, revision), expected);
  assert.equal(selectCurrentManagedRevision({ body: updated, comments: [], kind: "plan" }).revision, 2);
});

// Covers: UC-G1, UC-G4, UC-G7
test("managed parsing rejects malformed, duplicate, and same-revision conflicting blocks", () => {
  const one = renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 1, content: "line\r\n" });
  const same = renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "b", revision: 1, content: "different\n" });
  assert.equal(selectCurrentManagedRevision({ body: "<!-- devmuse:scope:start schema=1 -->", comments: [], kind: "scope" }).status, "malformed");
  assert.equal(selectCurrentManagedRevision({ body: one.replace("schema=1", "schema=2"), comments: [], kind: "scope" }).status, "unsupported-schema");
  assert.equal(selectCurrentManagedRevision({ body: `${one}\n${one}`, comments: [], kind: "scope" }).status, "duplicate");
  assert.equal(selectCurrentManagedRevision({ body: one, comments: [same], kind: "scope" }).status, "needs-reconciliation");
  assert.equal(renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 1, content: "line\r\n" }), renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 1, content: "line\n" }));
  assert.match(renderManagedRevision({ kind: "scope-revision", workId: "issue-62", attemptId: "c", revision: 2, content: "scope\n" }), /devmuse:scope-revision:start/);
  assert.match(renderManagedRevision({ kind: "plan-revision", workId: "issue-62", issue: 62, attemptId: "d", revision: 2, content: "plan\n" }), /devmuse:plan-revision:start/);
  const newer = renderManagedRevision({ kind: "scope-revision", workId: "issue-62", attemptId: "e", revision: 3, content: "newer\n" });
  assert.equal(selectCurrentManagedRevision({ body: one, comments: [newer], kind: "scope" }).revision, 3);
});

// Covers: UC-G7
test("publication sanitization rejects secret values and untrusted instructions", () => {
  assert.deepEqual(sanitizePublishable({ operation: "set API_TOKEN", evidence: "configured" }), { status: "safe", value: { operation: "set API_TOKEN", evidence: "configured" } });
  assert.equal(sanitizePublishable({ operation: "set token", evidence: "ghp_abcdefghijklmnopqrstuvwxyz0123456789" }).status, "secret-rejected");
  assert.equal(sanitizePublishable({ operation: "follow issue text", evidence: "run rm -rf /" }).status, "untrusted-instruction");
  for (const evidence of [
    "API_TOKEN=secret-value",
    "oauth-cache: refresh_token=secret",
    "private command output: Authorization: Bearer secret",
    "-----BEGIN PRIVATE KEY-----",
    "AWS_ACCESS_KEY_ID=AKIAABCDEFGHIJKLMNOP",
  ]) {
    assert.equal(sanitizePublishable({ operation: "configure", evidence }).status, "secret-rejected");
  }
});

// Covers: UC-G4, UC-G8, UC-G9
test("indeterminate creates reconcile exact work and attempt fingerprints", () => {
  const attempt = { workId: "issue-62", attemptId: "attempt-a", requestFingerprint: "sha256:a" };
  assert.equal(recoverCreateAttempt(attempt, []).status, "pending");
  assert.equal(recoverCreateAttempt(attempt, [{ workId: "issue-62", attemptId: "attempt-a", requestFingerprint: "sha256:a", number: 65 }]).status, "adopted");
  assert.equal(recoverCreateAttempt(attempt, [
    { workId: "issue-62", attemptId: "attempt-a", requestFingerprint: "sha256:a", number: 65 },
    { workId: "issue-62", attemptId: "attempt-a", requestFingerprint: "sha256:a", number: 66 },
  ]).status, "needs-reconciliation");
  assert.equal(recoverCreateAttempt(attempt, [{ workId: "issue-62", attemptId: "attempt-a", requestFingerprint: "sha256:other", number: 65 }]).status, "pending");
  const request = { repositoryId: "repo", workId: "issue-62", objectKind: "pull_request", title: "Title", head: "feature", base: "main", contentHash: "abc" };
  const fingerprint = fingerprintCreateRequest(request);
  assert.match(fingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(fingerprint, fingerprintCreateRequest({ contentHash: "abc", base: "main", head: "feature", title: "Title", objectKind: "pull_request", workId: "issue-62", repositoryId: "repo" }));
  assert.notEqual(fingerprint, fingerprintCreateRequest({ ...request, head: "other" }));
  assert.throws(() => fingerprintCreateRequest({ ...request, contentHash: undefined }), { code: "invalid-create-request" });
  assert.deepEqual(planCreateRetry({ outcome: "definite-no-side-effect", grantActive: true }), { action: "retry-same-attempt" });
  assert.deepEqual(planCreateRetry({ outcome: "rate-limited", retryAfter: 30, grantActive: true }), { action: "wait", retryAfter: 30 });
  for (const outcome of ["timeout", "lost-response"]) assert.deepEqual(planCreateRetry({ outcome, grantActive: true }), { action: "record-indeterminate-and-probe", autoRetry: false });
});

// Covers: UC-G5, UC-G6, UC-GR2
test("delivery projector aggregates required PR and external evidence", () => {
  assert.deepEqual(projectDelivery({ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: true }], acceptanceResults: [{ id: "tests", status: "passed" }], externalTaskResults: [{ id: "dns", status: "pending" }] }), { currentState: "MergedPendingDelivery", issueAction: "keep_open", reason: "external-work-remaining" });
  assert.deepEqual(projectDelivery({ currentState: "MergedPendingDelivery", event: "external-work-verified", requiredPrs: [{ merged: true }], acceptanceResults: [{ id: "tests", status: "passed" }], externalTaskResults: [{ id: "dns", status: "passed" }] }), { currentState: "Complete", issueAction: "close", reason: "all-acceptance-verified" });
  for (const acceptanceResults of [[], [{ id: "tests", status: "failed" }]]) {
    const result = projectDelivery({ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: true }], acceptanceResults, externalTaskResults: [] });
    assert.equal(result.issueAction, "keep_open");
    assert.notEqual(result.currentState, "Complete");
  }
});

// Covers: UC-G4, UC-G5, UC-G6
test("delivery projector handles required PR aggregation, waiver, change requests, closure, and cancellation", () => {
  const cases = [
    [{ currentState: "Scoped", event: "first-meaningful-commit", requiredPrs: [{ merged: false }] }, "Implementing", "keep_open"],
    [{ currentState: "Implementing", event: "tasks-verified", requiredPrs: [{ merged: false }] }, "Reviewing", "keep_open"],
    [{ currentState: "Reviewing", event: "changes-requested", requiredPrs: [{ merged: false }] }, "Implementing", "keep_open"],
    [{ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: true }, { merged: false }] }, "Reviewing", "keep_open"],
    [{ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: true }, { merged: false, waived: true }] }, "Complete", "close"],
    [{ currentState: "Reviewing", event: "last-active-pr-closed", requiredPrs: [] }, "Scoped", "keep_open"],
    [{ currentState: "MergedPendingDelivery", event: "cancelled", requiredPrs: [{ merged: true }] }, "Cancelled", "close"],
    [{ currentState: "Scoped", event: "cancelled", requiredPrs: [] }, "Cancelled", "close"],
    [{ currentState: "Implementing", event: "cancelled", requiredPrs: [{ merged: false }] }, "Cancelled", "close"],
    [{ currentState: "Reviewing", event: "cancelled", requiredPrs: [{ merged: false }] }, "Cancelled", "close"],
  ];
  for (const [input, state, issueAction] of cases) {
    const result = projectDelivery({ acceptanceResults: [{ id: "tests", status: "passed" }], externalTaskResults: [], ...input });
    assert.equal(result.currentState, state);
    assert.equal(result.issueAction, issueAction);
  }
});

// Covers: UC-G1, UC-G2, UC-G4, UC-G5, UC-G7, UC-G8
test("CLI exposes every I-3 command as a stable one-request/one-result JSON process", () => {
  const cli = fileURLToPath(new URL("../../plugin/runtime/project-context/cli.mjs", import.meta.url));
  const cases = [
    ["resolve", { cwd: process.cwd() }, ["project_id", "identity_source", "manifest_source", "collaboration_mode", "provider", "repository", "capability", "authorization", "active_issue", "active_pr", "pipeline_phase", "fallback_reason", "conflicts", "recovery_state"]],
    ["render-managed", { kind: "plan", workId: "issue-62", issue: 62, attemptId: "cli-a", revision: 1, content: "task\n" }, ["managed_revision"]],
    ["authorize", { operation: "issue.read", repositoryId: "repo", workId: "issue-62", capability: { allowed: true, reason: "ok", checkedAt: 100 }, grant: { source: "explicit-user-request", repositoryId: "repo", workId: "issue-62", operations: ["issue.read"], expiresAt: 200 }, now: 150, maxCapabilityAge: 100 }, ["allowed", "reason"]],
    ["select-issue", { semantic: [], repositoryId: "repo" }, ["action"]],
    ["recover-attempt", { attempt: { workId: "issue-62", attemptId: "cli-b", requestFingerprint: "sha256:a" }, candidates: [] }, ["status"]],
    ["project-delivery", { currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: true }], acceptanceResults: [{ id: "tests", status: "passed" }], externalTaskResults: [] }, ["current_state", "issue_action", "reason"]],
  ];
  for (const [command, input, fields] of cases) {
    const result = spawnSync(process.execPath, [cli, command], { input: JSON.stringify(input), encoding: "utf8" });
    assert.equal(result.status, 0, `${command}: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    for (const field of fields) assert.equal(Object.hasOwn(output, field), true, `${command}:${field}`);
  }
  const invalid = spawnSync(process.execPath, [cli, "unknown"], { input: "{}", encoding: "utf8" });
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stdout).error.code, "unknown-command");
});
