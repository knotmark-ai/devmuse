// Execute a cross-review invocation with a bounded timeout and graceful
// fallback. Any failure — missing CLI, timeout, non-zero exit, unreadable
// output — resolves to a typed fallback result and NEVER rejects, so the
// primary review is never blocked by the external reviewer.
import { spawn as nodeSpawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildInvocation, FINDINGS_SCHEMA, ENV_TIMEOUT_MS } from "./reviewer.mjs";
import { normalizeExternalFindings, extractClaudeStructuredOutput, extractCodexReviewFindings } from "./findings.mjs";

const DEFAULT_TIMEOUT_MS = 180_000;

// Low-level: run a ready invocation. stdout is ALWAYS drained (an un-drained
// pipe deadlocks the child once its buffer fills); the reviewer's findings are
// read from its output file or from the captured stdout per `outputMode`.
export async function runCrossReview(invocation, { spawn = nodeSpawn, timeoutMs = DEFAULT_TIMEOUT_MS, outputPath, readOutput } = {}) {
  if (!invocation || invocation.status !== "ready") {
    return { status: "skipped", reason: invocation?.reason ?? invocation?.status ?? "not-ready" };
  }
  return new Promise((resolve) => {
    let settled = false;
    let timer = null; // declared before `done` so a synchronous spawn failure
    const done = (result) => {   // does not hit a temporal-dead-zone ReferenceError
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    let child;
    try {
      child = spawn(invocation.command, invocation.args, { cwd: invocation.cwd, env: invocation.env, shell: false });
    } catch (error) {
      return done({ status: "fallback", reason: "spawn-failed", detail: error.code ?? error.message });
    }

    timer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* already gone */ }
      done({ status: "fallback", reason: "timeout" });
    }, timeoutMs);

    let stdout = "";
    let stderr = "";
    // Drain both pipes so a large review never deadlocks the child (the B4b bug).
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => done({ status: "fallback", reason: "spawn-error", detail: error.code ?? error.message }));
    child.on("close", (code) => {
      // A reviewer that exited non-zero failed; do not trust partial output.
      if (code !== 0) return done({ status: "fallback", reason: "nonzero-exit", exitCode: code, stderr: stderr.slice(0, 500) });
      let raw;
      try {
        if (readOutput) raw = readOutput();                       // test injection
        else if (invocation.outputMode === "stdout") raw = extractClaudeStructuredOutput(stdout); // claude → stdout event stream
        else if (invocation.reviewer === "codex") {
          // codex → --output-last-message file. codex `exec review` ignores
          // --output-schema and writes a native review report, so parse that
          // into findings rather than JSON.parsing prose (M4). If the report shape
          // is unrecognized, degrade to a fallback rather than a silent clean review.
          const parsed = extractCodexReviewFindings(fs.readFileSync(outputPath ?? "", "utf8"));
          if (!parsed.recognized) return done({ status: "fallback", reason: "unrecognized-codex-format", exitCode: code, stderr: stderr.slice(0, 500) });
          raw = { findings: parsed.findings };
        } else {
          raw = fs.readFileSync(outputPath ?? "", "utf8");
        }
      } catch {
        return done({ status: "fallback", reason: "no-output", exitCode: code, stderr: stderr.slice(0, 500) });
      }
      // Validate structured output rather than trusting exit code 0.
      const normalized = normalizeExternalFindings(raw, { reviewer: invocation.reviewer });
      if (normalized.status !== "ok") {
        return done({ status: "fallback", reason: normalized.reason, exitCode: code, stderr: stderr.slice(0, 500) });
      }
      done({ status: "ok", reviewer: invocation.reviewer, exitCode: code, findings: normalized.findings });
    });
  });
}

// High-level: own a private temp dir (0700) holding the output schema and the
// reviewer's output file, build the invocation, run it, and clean up — so the
// caller never leaks a schema/output artifact and never has to construct paths.
export async function runReview(params = {}) {
  const { spawn, timeoutMs } = params;
  const effectiveTimeout = Number.isFinite(timeoutMs)
    ? timeoutMs
    : Number.parseInt(params.env?.[ENV_TIMEOUT_MS] ?? "", 10) || DEFAULT_TIMEOUT_MS;

  let dir;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-xreview-"));
    fs.chmodSync(dir, 0o700);
  } catch (error) {
    return { status: "fallback", reason: "temp-dir-failed", detail: error.code ?? error.message };
  }
  const schemaPath = path.join(dir, "schema.json");
  const outputPath = path.join(dir, "out.json");
  try {
    fs.writeFileSync(schemaPath, `${JSON.stringify(FINDINGS_SCHEMA)}\n`, { encoding: "utf8", mode: 0o600 });
    const invocation = buildInvocation({ ...params, outputPath, schemaPath });
    return await runCrossReview(invocation, { spawn, timeoutMs: effectiveTimeout, outputPath });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
