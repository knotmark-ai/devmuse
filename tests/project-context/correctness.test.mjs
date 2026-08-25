import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { projectDelivery } from "../../plugin/runtime/project-context/lifecycle.mjs";
import { selectCurrentManagedRevision, renderManagedRevision, replaceManagedRevision } from "../../plugin/runtime/project-context/managed-block.mjs";
import { mergeCache, updateCache } from "../../plugin/runtime/project-context/cache.mjs";

// Covers: UC-G6
test("a required-PR-remaining check never moves MergedPendingDelivery backward to Reviewing", () => {
  const result = projectDelivery({ currentState: "MergedPendingDelivery", event: "external-work-verified", requiredPrs: [{ merged: false }] });
  assert.equal(result.currentState, "MergedPendingDelivery"); // not "Reviewing"
  assert.equal(result.reason, "required-prs-remaining");
  // From Reviewing+merged with a PR still open, it correctly stays Reviewing (not yet merged).
  assert.equal(projectDelivery({ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: false }] }).currentState, "Reviewing");
});

// Covers: UC-G6 — merged but acceptance/delivery pending is MergedPendingDelivery, not Reviewing.
test("merged work awaiting acceptance projects to MergedPendingDelivery, not the pre-merge state (#62)", () => {
  // All required PRs merged, but acceptance not yet verified → merged-but-not-delivered.
  const pendingAcceptance = projectDelivery({ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: true }], acceptanceResults: [{ status: "pending" }] });
  assert.equal(pendingAcceptance.currentState, "MergedPendingDelivery"); // was "Reviewing" before the fix
  assert.equal(pendingAcceptance.reason, "acceptance-unverified");
  // Acceptance verified but external delivery pending → also MergedPendingDelivery.
  const pendingDelivery = projectDelivery({ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: true }], acceptanceResults: [{ status: "passed" }], externalTaskResults: [{ status: "pending" }] });
  assert.equal(pendingDelivery.currentState, "MergedPendingDelivery");
  assert.equal(pendingDelivery.reason, "external-work-remaining");
  // Fully verified → Complete.
  const complete = projectDelivery({ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: true }], acceptanceResults: [{ status: "passed" }], externalTaskResults: [{ status: "passed" }] });
  assert.equal(complete.currentState, "Complete");
});

// Covers: UC-G4
test("replaceManagedRevision rejects the four illegal transitions and accepts a strictly newer one (#62)", () => {
  const base = renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 5, content: "v5\n" });
  const rev = (attrs) => renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 6, content: "v6\n", ...attrs });
  // 1. cross-work replacement (work-A -> work-B)
  assert.throws(() => replaceManagedRevision(base, rev({ workId: "issue-99" })), (e) => e.code === "managed-identity-mismatch");
  // 2. backward revision (5 -> 1)
  assert.throws(() => replaceManagedRevision(base, renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 1, content: "v1\n" })), (e) => e.code === "managed-revision-not-newer");
  // 3. changed attempt_id
  assert.throws(() => replaceManagedRevision(base, rev({ attemptId: "b" })), (e) => e.code === "managed-identity-mismatch");
  // 4. scope -> scope-revision (a -revision comment kind is not a body kind)
  assert.throws(() => replaceManagedRevision(base, renderManagedRevision({ kind: "scope-revision", workId: "issue-62", attemptId: "a", revision: 6, content: "v6\n" })), (e) => e.code === "invalid-managed-revision");
  // A strictly-newer, same-identity revision is spliced in.
  const updated = replaceManagedRevision(base, rev({}));
  assert.match(updated, /revision=6/);
  assert.doesNotMatch(updated, /revision=5/);
  // A byte-identical re-post at the same revision is an idempotent no-op.
  assert.equal(replaceManagedRevision(base, renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 5, content: "v5\n" })), base);
});

test("replaceManagedRevision closes the three envelope bypasses (CRLF / body -revision / trailing suffix) (#62)", () => {
  const base = renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 5, content: "v5\n" });
  const newer = renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 6, content: "v6\n" });
  // 1. A CRLF body is spliced without misalignment — surrounding text preserved, no stray "-->".
  const crlfBody = `human before\r\n${base}\r\nhuman after`.replace(/\n/g, "\r\n");
  const spliced = replaceManagedRevision(crlfBody, newer);
  assert.match(spliced, /revision=6/);
  assert.doesNotMatch(spliced, /revision=5/);
  assert.equal((spliced.match(/devmuse:scope:end -->/g) ?? []).length, 1); // exactly one block, no leftover marker
  assert.match(spliced, /human before/);
  assert.match(spliced, /human after/);
  // 2. With no existing block, a -revision comment marker cannot be written into the body.
  assert.throws(() => replaceManagedRevision("", renderManagedRevision({ kind: "scope-revision", workId: "issue-62", attemptId: "a", revision: 1, content: "c\n" })), (e) => e.code === "invalid-managed-revision");
  // 3. A candidate with any trailing content (a second marker or a secret) is rejected.
  assert.throws(() => replaceManagedRevision(base, `${newer}\npassword=hunter2`), (e) => e.code === "invalid-managed-revision");
  assert.throws(() => replaceManagedRevision(base, `${newer}\n${renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 7, content: "extra\n" })}`), (e) => e.code === "invalid-managed-revision");
});

test("managed-revision selection is bound to the expected work identity", () => {
  const mine = renderManagedRevision({ kind: "scope", workId: "issue-62", attemptId: "a", revision: 1, content: "mine\n" });
  // A foreign higher-revision block arriving in a comment (the finding's vector).
  const foreign = renderManagedRevision({ kind: "scope", workId: "other-work", attemptId: "b", revision: 999, content: "foreign\n" });
  // Without an expected workId, the highest revision (the foreign one) wins — the old behavior.
  assert.equal(selectCurrentManagedRevision({ body: mine, comments: [foreign], kind: "scope" }).block.attributes.work_id, "other-work");
  // Bound to issue-62, the foreign higher-revision block is filtered out.
  const bound = selectCurrentManagedRevision({ body: mine, comments: [foreign], kind: "scope", workId: "issue-62" });
  assert.equal(bound.status, "selected");
  assert.equal(bound.block.attributes.work_id, "issue-62");
});

// Covers: UC-G8, UC-G9
test("progressive same-work enrichment merges instead of demanding reconciliation", () => {
  const base = { schema_version: 1, revision: 1, project_id: "github:repo", worktrees: { main: { work_id: "issue-62", issue: 62 } }, recovery: {} };
  // Adding a PR and phase for the same work item enriches the entry.
  const enriched = mergeCache(base, { worktreeKey: "main", entry: { pull_request: 65, pipeline_phase: "implementing" } });
  assert.equal(enriched.status, "merged");
  assert.deepEqual(enriched.value.worktrees.main, { work_id: "issue-62", issue: 62, pull_request: 65, pipeline_phase: "implementing" });
  // A contradictory value on a shared field still reconciles.
  const conflict = mergeCache(enriched.value, { worktreeKey: "main", entry: { issue: 99 } });
  assert.equal(conflict.status, "needs-reconciliation");
});

// Covers: UC-G8 — an explicit null placeholder is enriched, not treated as a conflict (F3).
test("enriching an explicit null field is progressive enhancement, not a contradiction", () => {
  const base = { schema_version: 1, revision: 1, project_id: "github:repo", worktrees: { main: { work_id: "issue-62", issue: 62, pull_request: null } }, recovery: {} };
  const enriched = mergeCache(base, { worktreeKey: "main", entry: { pull_request: 65 } });
  assert.equal(enriched.status, "merged"); // was "needs-reconciliation" before F3
  assert.equal(enriched.value.worktrees.main.pull_request, 65);
});

// Covers: UC-G8
test("a stale cache lock is broken AND the current write is persisted, not dropped", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-lock-retry-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "project-context.v1.json");
  const lock = `${file}.lock`;
  fs.mkdirSync(lock, { recursive: true });
  fs.utimesSync(lock, new Date(Date.now() - 60_000), new Date(Date.now() - 60_000)); // stale
  const result = await updateCache(file, { projectId: "github:repo", worktreeKey: "main", entry: { work_id: "issue-62", issue: 62 } }, { lockTimeoutMs: 40 });
  assert.equal(result.status, "merged"); // persisted, not lock-unavailable
  assert.equal(result.persistence, "persisted");
  assert.ok(fs.existsSync(file));
});
