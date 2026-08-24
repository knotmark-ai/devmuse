import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { projectDelivery } from "../../plugin/runtime/project-context/lifecycle.mjs";
import { selectCurrentManagedRevision, renderManagedRevision } from "../../plugin/runtime/project-context/managed-block.mjs";
import { mergeCache, updateCache } from "../../plugin/runtime/project-context/cache.mjs";

// Covers: UC-G6
test("a required-PR-remaining check never moves MergedPendingDelivery backward to Reviewing", () => {
  const result = projectDelivery({ currentState: "MergedPendingDelivery", event: "external-work-verified", requiredPrs: [{ merged: false }] });
  assert.equal(result.currentState, "MergedPendingDelivery"); // not "Reviewing"
  assert.equal(result.reason, "required-prs-remaining");
  // From Reviewing+merged, it correctly stays Reviewing.
  assert.equal(projectDelivery({ currentState: "Reviewing", event: "merged", requiredPrs: [{ merged: false }] }).currentState, "Reviewing");
});

// Covers: UC-G4
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
