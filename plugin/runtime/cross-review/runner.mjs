// Execute a cross-review invocation with a bounded timeout and graceful
// fallback. Any failure — missing CLI, timeout, non-zero exit, unreadable
// output — resolves to a typed fallback result and NEVER rejects, so the
// primary review is never blocked by the external reviewer.
import { spawn as nodeSpawn } from "node:child_process";
import fs from "node:fs";

import { normalizeExternalFindings } from "./findings.mjs";

const DEFAULT_TIMEOUT_MS = 180_000;

export async function runCrossReview(invocation, { spawn = nodeSpawn, timeoutMs = DEFAULT_TIMEOUT_MS, outputPath, readOutput } = {}) {
  if (!invocation || invocation.status !== "ready") {
    return { status: "skipped", reason: invocation?.reason ?? invocation?.status ?? "not-ready" };
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    let child;
    try {
      // Array args, no shell: untrusted refs cannot become a second command.
      child = spawn(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, shell: false });
    } catch (error) {
      return done({ status: "fallback", reason: "spawn-failed", detail: error.code ?? error.message });
    }

    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
      done({ status: "fallback", reason: "timeout" });
    }, timeoutMs);

    let stderr = "";
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => done({ status: "fallback", reason: "spawn-error", detail: error.code ?? error.message }));
    child.on("close", (code) => {
      // Validate structured output rather than trusting exit code 0.
      let raw;
      try {
        raw = readOutput ? readOutput() : fs.readFileSync(outputPath ?? invocation.args.at(-1), "utf8");
      } catch {
        return done({ status: "fallback", reason: "no-output", exitCode: code });
      }
      const normalized = normalizeExternalFindings(raw, { reviewer: invocation.reviewer });
      if (normalized.status !== "ok") {
        return done({ status: "fallback", reason: normalized.reason, exitCode: code, stderr: stderr.slice(0, 500) });
      }
      done({ status: "ok", reviewer: invocation.reviewer, exitCode: code, findings: normalized.findings });
    });
  });
}
