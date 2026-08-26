#!/usr/bin/env node
import path from "node:path";

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
  resolveLocalProjectContext,
  safeProjectContextSummary,
  sanitizePublishable,
  selectCurrentManagedRevision,
  updateCache,
} from "./index.mjs";

function write(value, status = 0) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exitCode = status;
}

const CAMEL = /_([a-z0-9])/g;
function camelizeKey(key) {
  return key.replace(CAMEL, (_, char) => char.toUpperCase());
}

// The CLI's external contract is snake_case (matching every command's output);
// the runtime functions are camelCase. Translate object keys deeply at this
// boundary so a snake_case request binds to the real parameters instead of
// silently leaving them undefined — a correctness and a security requirement,
// since an unbound identity must never satisfy an authorization check.
//
// `opaqueKeys` names pass-through *payloads* (update-cache's `entry`/`attempt`)
// that are stored verbatim and validated as snake_case downstream. Their KEY is
// still camelized, but their VALUE must not be descended into — camelizing
// `work_id`/`pull_request`/`pipeline_phase` inside them would produce keys the
// cache validator rejects, silently dropping every write (the C1 defect).
function camelizeKeys(value, opaqueKeys = null) {
  if (Array.isArray(value)) return value.map((item) => camelizeKeys(item, opaqueKeys));
  if (value && typeof value === "object") {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      const camel = camelizeKey(key);
      result[camel] = opaqueKeys && opaqueKeys.has(camel) ? item : camelizeKeys(item, opaqueKeys);
    }
    return result;
  }
  return value;
}

// Payload keys whose snake_case schema must survive the boundary untouched.
const OPAQUE_PAYLOAD_KEYS = new Set(["entry", "attempt"]);

async function readRequest() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Object.assign(new Error("request too large"), { code: "request-too-large" });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  const value = text.trim() ? JSON.parse(text) : {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SyntaxError("request must be an object");
  return value;
}

function serializeResolution(result) {
  const { gitCommonDir, worktreeKey, ...portable } = result;
  return { ...portable, git_common_dir: gitCommonDir, worktree_key: worktreeKey };
}

async function cacheFileFor(cwd) {
  const context = await resolveLocalProjectContext({ cwd });
  if (!context.gitCommonDir) return { error: "not-a-git-repository" };
  return { file: path.join(context.gitCommonDir, "devmuse", "project-context.v1.json"), projectId: context.project_id };
}

const command = process.argv[2] ?? "summary";
const known = new Set([
  "summary", "resolve", "render-managed", "authorize", "select-issue", "recover-attempt", "project-delivery",
  "select-managed", "replace-managed", "fingerprint-create", "sanitize", "update-strategy", "plan-retry", "update-cache",
]);

if (!known.has(command)) {
  write({ error: { code: "unknown-command" } }, 2);
} else if (command === "summary") {
  // The SessionStart hook injects this verbatim, so emit the bare fenced string
  // (not a JSON envelope) and inject nothing when resolution fails.
  try {
    const result = await resolveLocalProjectContext({ cwd: process.cwd() });
    process.stdout.write(safeProjectContextSummary(result));
  } catch {
    process.exitCode = 0;
  }
} else {
  let input;
  try {
    input = camelizeKeys(await readRequest(), OPAQUE_PAYLOAD_KEYS);
  } catch (error) {
    write({ error: { code: error.code ?? "invalid-json" } }, 2);
  }
  if (input) {
    try {
      if (command === "resolve") {
        const result = await resolveLocalProjectContext({
          cwd: input.cwd ?? process.cwd(),
          liveRepository: input.liveRepository ?? null,
          defaultBranchRef: input.defaultBranchRef ?? null,
        });
        write(serializeResolution(result));
      } else if (command === "render-managed") {
        write({ managed_revision: renderManagedRevision(input) });
      } else if (command === "authorize") {
        write(authorizeMutation(input));
      } else if (command === "select-issue") {
        write(chooseIssueCandidate(input));
      } else if (command === "recover-attempt") {
        write(recoverCreateAttempt(input.attempt, input.candidates));
      } else if (command === "project-delivery") {
        const result = projectDelivery(input);
        write({ current_state: result.currentState, issue_action: result.issueAction, reason: result.reason });
      } else if (command === "select-managed") {
        write(selectCurrentManagedRevision(input));
      } else if (command === "replace-managed") {
        write({ body: replaceManagedRevision(input.body, input.managedRevision) });
      } else if (command === "fingerprint-create") {
        write({ fingerprint: fingerprintCreateRequest(input) });
      } else if (command === "sanitize") {
        write(sanitizePublishable(input.value));
      } else if (command === "update-strategy") {
        write(chooseUpdateStrategy(input));
      } else if (command === "plan-retry") {
        write(planCreateRetry(input));
      } else if (command === "update-cache") {
        // The write target is resolved from the repository, never caller-supplied,
        // and the resolved project identity is injected so a delta cannot fork it.
        const target = await cacheFileFor(input.cwd ?? process.cwd());
        if (target.error) {
          write({ error: { code: target.error } }, 1);
        } else {
          // Injected identity goes LAST so a caller-supplied project_id cannot
          // override the repository-resolved one (F4).
          const incoming = { ...(input.incoming ?? {}), projectId: target.projectId };
          const result = await updateCache(target.file, incoming, {});
          write({ status: result.status, persistence: result.persistence ?? null, revision: result.value?.revision ?? null });
        }
      }
    } catch (error) {
      write({ error: { code: error.code ?? "operation-failed" } }, 1);
    }
  }
}
