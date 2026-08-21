import assert from "node:assert/strict";

import {
  authorizeMutation,
  chooseIssueCandidate,
  chooseUpdateStrategy,
  mergeCache,
  projectDelivery,
  recoverCreateAttempt,
  renderManagedRevision,
  replaceManagedRevision,
  sanitizePublishable,
} from "../../plugin/runtime/project-context/index.mjs";

function authorized(operation) {
  return authorizeMutation({
    operation,
    repositoryId: "github:repo",
    workId: "issue-62",
    capability: { allowed: true, reason: "ok", checkedAt: 100 },
    grant: { source: "approved-workflow-step", repositoryId: "github:repo", workId: "issue-62", operations: [operation], expiresAt: 200 },
    now: 150,
    maxCapabilityAge: 100,
  });
}

export const scenarios = {
  // Covers: UC-G1, UC-G2, UC-G4
  "github-write": async () => {
    assert.deepEqual(authorized("pull_request.create"), { allowed: true, reason: "ok" });
    assert.equal(chooseIssueCandidate({ explicit: { open: true, repositoryId: "github:repo", number: 62 }, repositoryId: "github:repo" }).action, "reuse");
  },

  // Covers: UC-G3, UC-G7
  "github-read-only": async () => {
    const result = authorizeMutation({
      operation: "issue.update", repositoryId: "github:repo", workId: "issue-62",
      capability: { allowed: false, reason: "read-only", checkedAt: 100 },
      grant: { source: "approved-workflow-step", repositoryId: "github:repo", workId: "issue-62", operations: ["issue.update"], expiresAt: 200 },
      now: 150, maxCapabilityAge: 100,
    });
    assert.deepEqual(result, { allowed: false, reason: "read-only" });
  },

  // Covers: UC-G3, UC-GR1
  "no-github": async () => {
    assert.deepEqual(chooseUpdateStrategy({ supportsConditionalUpdate: false, commentAuthorized: false }), { action: "manual-or-local-fallback" });
  },

  // Covers: UC-G3
  "declined-publication": async () => {
    assert.equal(authorizeMutation({ operation: "issue.create", capability: { allowed: true, checkedAt: 100 }, now: 100, maxCapabilityAge: 100 }).reason, "missing-grant");
  },

  // Covers: UC-G1, UC-G2
  "ambiguous-issue": async () => {
    const result = chooseIssueCandidate({ repositoryId: "github:repo", semantic: [
      { open: true, repositoryId: "github:repo", number: 62 },
      { open: true, repositoryId: "github:repo", number: 63 },
    ] });
    assert.equal(result.action, "confirm");
    assert.equal(result.candidates.length, 2);
  },

  // Covers: UC-G8, UC-G9, UC-GR3
  "cross-worktree-resume": async () => {
    const cache = { schema_version: 1, revision: 1, project_id: "github:repo", worktrees: { main: { issue: 62 } }, recovery: {} };
    const result = mergeCache(cache, { projectId: "github:repo", worktreeKey: "worktrees/feature", entry: { issue: 62, pull_request: 65 } });
    assert.equal(result.status, "merged");
    assert.deepEqual(Object.keys(result.value.worktrees).sort(), ["main", "worktrees/feature"]);
  },

  // Covers: UC-G4
  "concurrent-human-edit": async () => {
    const oldBlock = renderManagedRevision({ kind: "plan", workId: "issue-62", issue: 62, attemptId: "old", revision: 1, content: "old\n" });
    const newBlock = renderManagedRevision({ kind: "plan", workId: "issue-62", issue: 62, attemptId: "new", revision: 2, content: "new\n" });
    assert.equal(replaceManagedRevision(`human\n${oldBlock}\nnotes`, newBlock), `human\n${newBlock}\nnotes`);
  },

  // Covers: UC-G4, UC-G8
  "indeterminate-create": async () => {
    const attempt = { workId: "issue-62", attemptId: "a", requestFingerprint: "sha256:a" };
    assert.equal(recoverCreateAttempt(attempt, []).status, "pending");
    assert.equal(recoverCreateAttempt(attempt, [{ ...attempt, number: 65 }]).status, "adopted");
  },

  // Covers: UC-G7
  "secret-rejection": async () => {
    assert.equal(sanitizePublishable({ evidence: "Authorization: Bearer private" }).status, "secret-rejected");
  },

  // Covers: UC-G5, UC-G6
  "multiple-required-prs": async () => {
    const result = projectDelivery({
      currentState: "Reviewing", event: "merged",
      requiredPrs: [{ merged: true }, { merged: false }],
      acceptanceResults: [{ id: "tests", status: "passed" }], externalTaskResults: [],
    });
    assert.deepEqual(result, { currentState: "Reviewing", issueAction: "keep_open", reason: "required-prs-remaining" });
  },
};
