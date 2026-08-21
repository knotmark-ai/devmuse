#!/usr/bin/env node
import {
  authorizeMutation,
  chooseIssueCandidate,
  projectDelivery,
  recoverCreateAttempt,
  renderManagedRevision,
  resolveLocalProjectContext,
  safeProjectContextSummary,
} from "./index.mjs";

function write(value, status = 0) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exitCode = status;
}

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

const command = process.argv[2] ?? "summary";
const known = new Set(["summary", "resolve", "render-managed", "authorize", "select-issue", "recover-attempt", "project-delivery"]);
if (!known.has(command)) {
  write({ error: { code: "unknown-command" } }, 2);
} else if (command === "summary") {
  try {
    const result = await resolveLocalProjectContext({ cwd: process.cwd() });
    write({ summary: safeProjectContextSummary(result) });
  } catch {
    write({ error: { code: "resolution-failed" } }, 1);
  }
} else {
  let input;
  try {
    input = await readRequest();
  } catch (error) {
    write({ error: { code: error.code ?? "invalid-json" } }, 2);
  }
  if (input) {
    try {
      if (command === "resolve") {
        const result = await resolveLocalProjectContext({
          cwd: input.cwd ?? process.cwd(),
          liveRepository: input.live_repository ?? null,
          defaultBranchRef: input.default_branch_ref ?? null,
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
      }
    } catch (error) {
      write({ error: { code: error.code ?? "operation-failed" } }, 1);
    }
  }
}
