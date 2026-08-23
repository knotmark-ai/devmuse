import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import { buildInvocation, RECURSION_ENV } from "../../plugin/runtime/cross-review/reviewer.mjs";
import { runCrossReview } from "../../plugin/runtime/cross-review/runner.mjs";
import { normalizeExternalFindings, mergeFindings } from "../../plugin/runtime/cross-review/findings.mjs";

const base = { projectDir: "/repo", outputPath: "/tmp/out.json", refs: ["main...HEAD"] };

test("reciprocal routing selects the other family per host", () => {
  const fromClaude = buildInvocation({ currentHost: "claude", ...base });
  assert.equal(fromClaude.status, "ready");
  assert.equal(fromClaude.reviewer, "codex");
  assert.equal(fromClaude.command, "codex");

  const fromCodex = buildInvocation({ currentHost: "codex", ...base });
  assert.equal(fromCodex.status, "ready");
  assert.equal(fromCodex.reviewer, "claude");
  assert.equal(fromCodex.command, "claude");
});

test("the current host is never its own reviewer", () => {
  const misconfig = buildInvocation({ currentHost: "codex", reviewer: { host: "codex", family: "openai" }, ...base });
  assert.equal(misconfig.status, "same-family");
});

test("an unconfigured non-reciprocal host has no capability, and never crashes", () => {
  const other = buildInvocation({ currentHost: "hermes", ...base });
  assert.equal(other.status, "unavailable");
});

test("a reviewer process cannot start another cross-review", () => {
  const nested = buildInvocation({ currentHost: "claude", env: { [RECURSION_ENV]: "1" }, ...base });
  assert.equal(nested.status, "recursion-blocked");
});

test("codex invocation uses exec review with ephemeral, ignore-config, and validated output; child env sets the recursion guard", () => {
  const inv = buildInvocation({ currentHost: "claude", ...base });
  assert.deepEqual(inv.args.slice(0, 5), ["exec", "review", "--ephemeral", "--ignore-user-config", "--ignore-rules"]);
  assert.ok(inv.args.includes("--output-last-message"));
  assert.equal(inv.args[inv.args.indexOf("--output-last-message") + 1], "/tmp/out.json");
  assert.equal(inv.args.includes("--base-ref"), true);
  assert.equal(inv.env[RECURSION_ENV], "1");
  assert.equal(inv.cwd, "/repo");
});

test("claude invocation is headless, read-only (plan mode), and JSON-output", () => {
  const inv = buildInvocation({ currentHost: "codex", ...base });
  assert.equal(inv.args[0], "-p");
  assert.deepEqual([inv.args.includes("--permission-mode"), inv.args[inv.args.indexOf("--permission-mode") + 1]], [true, "plan"]);
  assert.equal(inv.args[inv.args.indexOf("--output-format") + 1], "json");
});

test("malformed refs never reach argv; overrides use explicit binary/auth home, not aliases", () => {
  const inv = buildInvocation({ currentHost: "claude", reviewer: { host: "codex", family: "openai", binary: "/opt/codex", authHome: "/tmp/ch" }, projectDir: "/repo", outputPath: "/tmp/o", refs: ["main...HEAD", "; rm -rf /", "$(whoami)"] });
  assert.equal(inv.command, "/opt/codex");
  assert.equal(inv.args.filter((a) => a === "--base-ref").length, 1); // only the well-formed range
  assert.ok(inv.args.includes("--config-home"));
  assert.ok(!inv.args.some((a) => a.includes("rm -rf") || a.includes("whoami")));
});

// --- runner, with a fake spawned binary (no real process, no network) ---

function fakeChild() {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => { child.killed = true; };
  return child;
}

test("a successful reviewer run normalizes findings from its output file", async () => {
  const child = fakeChild();
  const spawn = () => child;
  const promise = runCrossReview(
    { status: "ready", reviewer: "codex", command: "codex", args: [], cwd: "/repo", env: {} },
    { spawn, readOutput: () => JSON.stringify({ findings: [{ severity: "high", file: "a.mjs", line: 3, summary: "leak" }] }) },
  );
  child.emit("close", 0);
  const result = await promise;
  assert.equal(result.status, "ok");
  assert.equal(result.findings[0].severity, "important"); // "high" aliased
  assert.equal(result.findings[0].reviewer, "codex");
});

test("a reviewer timeout falls back without blocking and kills the child", async () => {
  const child = fakeChild();
  const promise = runCrossReview(
    { status: "ready", reviewer: "codex", command: "codex", args: [], cwd: "/repo", env: {} },
    { spawn: () => child, timeoutMs: 5, readOutput: () => "{}" },
  );
  const result = await promise;
  assert.equal(result.status, "fallback");
  assert.equal(result.reason, "timeout");
  assert.equal(child.killed, true);
});

test("unreadable or unparseable reviewer output falls back, never throws", async () => {
  const child = fakeChild();
  const promise = runCrossReview(
    { status: "ready", reviewer: "codex", command: "codex", args: [], cwd: "/repo", env: {} },
    { spawn: () => child, readOutput: () => { throw new Error("ENOENT"); } },
  );
  child.emit("close", 0);
  assert.equal((await promise).reason, "no-output");

  const child2 = fakeChild();
  const p2 = runCrossReview(
    { status: "ready", reviewer: "codex", command: "codex", args: [], cwd: "/repo", env: {} },
    { spawn: () => child2, readOutput: () => "not json" },
  );
  child2.emit("close", 0);
  assert.equal((await p2).status, "fallback");
});

test("a not-ready invocation is skipped, not executed", async () => {
  const result = await runCrossReview({ status: "unavailable", reason: "no-configured-reviewer" }, { spawn: () => { throw new Error("should not spawn"); } });
  assert.equal(result.status, "skipped");
});

// --- findings normalization and contradiction surfacing ---

test("normalization validates structure over exit code and preserves provenance", () => {
  assert.equal(normalizeExternalFindings("nope", { reviewer: "codex" }).status, "invalid");
  assert.equal(normalizeExternalFindings({ notFindings: [] }, { reviewer: "codex" }).status, "invalid");
  const ok = normalizeExternalFindings({ findings: [{ severity: "critical", file: "x", line: 1, summary: "s" }] }, { reviewer: "codex" });
  assert.equal(ok.findings[0].reviewer, "codex");
});

test("merge surfaces contradictions instead of choosing a side", () => {
  const primary = [{ severity: "minor", file: "a", line: 1, summary: "p" }];
  const external = [
    { severity: "critical", file: "a", line: 1, summary: "e1", reviewer: "codex" }, // same location, different severity
    { severity: "important", file: "b", line: 2, summary: "e2", reviewer: "codex" }, // location primary missed
  ];
  const { merged, contradictions } = mergeFindings(primary, external);
  assert.equal(contradictions.length, 2);
  assert.ok(merged.some((f) => f.contested && f.externalSeverity === "critical"));
  assert.ok(merged.some((f) => f.file === "b" && f.contested));
});
