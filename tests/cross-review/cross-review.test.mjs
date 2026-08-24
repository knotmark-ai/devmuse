import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { buildInvocation, RECURSION_ENV, baseBranch, ENV_BINARY, ENV_CONFIG_HOME } from "../../plugin/runtime/cross-review/reviewer.mjs";
import { runCrossReview, runReview } from "../../plugin/runtime/cross-review/runner.mjs";
import { normalizeExternalFindings, mergeFindings } from "../../plugin/runtime/cross-review/findings.mjs";

const base = { projectDir: "/repo", outputPath: "/tmp/out.json", schemaPath: "/tmp/schema.json", refs: ["main...HEAD"] };

function which(binary) {
  return spawnSync("command", ["-v", binary], { shell: "/bin/bash", encoding: "utf8" }).status === 0;
}
function helpText(command, subargs) {
  const r = spawnSync(command, [...subargs, "--help"], { encoding: "utf8" });
  return `${r.stdout ?? ""}${r.stderr ?? ""}`;
}

test("reciprocal routing selects the other family per host", () => {
  assert.equal(buildInvocation({ currentHost: "claude", ...base }).reviewer, "codex");
  assert.equal(buildInvocation({ currentHost: "codex", ...base }).reviewer, "claude");
});

test("the current host is never its own reviewer", () => {
  assert.equal(buildInvocation({ currentHost: "codex", reviewer: { host: "codex", family: "openai" }, ...base }).status, "same-family");
});

test("an unconfigured non-reciprocal host has no capability, and never crashes", () => {
  assert.equal(buildInvocation({ currentHost: "hermes", ...base }).status, "unavailable");
});

test("a reviewer process cannot start another cross-review", () => {
  assert.equal(buildInvocation({ currentHost: "claude", env: { [RECURSION_ENV]: "1" }, ...base }).status, "recursion-blocked");
});

test("missing schema path or base branch is a typed invalid, not a broken command", () => {
  assert.equal(buildInvocation({ currentHost: "claude", projectDir: "/repo", outputPath: "/tmp/o", refs: ["main...HEAD"] }).reason, "missing-schema-path");
  assert.equal(buildInvocation({ currentHost: "claude", ...base, refs: [] }).reason, "missing-base-branch");
});

test("codex invocation uses --base <branch> (not a range), --output-schema, ephemeral; recursion guard set", () => {
  const inv = buildInvocation({ currentHost: "claude", ...base });
  assert.deepEqual(inv.args.slice(0, 4), ["exec", "review", "--base", "main"]); // a branch, not main...HEAD
  assert.equal(inv.args[inv.args.indexOf("--output-schema") + 1], "/tmp/schema.json");
  assert.equal(inv.args[inv.args.indexOf("--output-last-message") + 1], "/tmp/out.json");
  assert.ok(inv.args.includes("--ephemeral") && inv.args.includes("--ignore-user-config"));
  assert.ok(!inv.args.includes("--base-ref") && !inv.args.includes("--config-home")); // the removed broken flags
  assert.equal(inv.outputMode, "file");
  assert.equal(inv.env[RECURSION_ENV], "1");
});

test("claude invocation is read-only (plan + tool allowlist), JSON-schema output, stdout mode", () => {
  const inv = buildInvocation({ currentHost: "codex", ...base });
  assert.equal(inv.args[0], "-p");
  assert.equal(inv.args[inv.args.indexOf("--permission-mode") + 1], "plan");
  const allow = inv.args.indexOf("--allowed-tools");
  assert.deepEqual(inv.args.slice(allow + 1, allow + 4), ["Read", "Glob", "Grep"]);
  assert.ok(inv.args.includes("--json-schema"));
  assert.equal(inv.args[inv.args.indexOf("--output-format") + 1], "json");
  assert.ok(!inv.args.includes("--settings")); // config home goes to CLAUDE_CONFIG_DIR env
  assert.equal(inv.outputMode, "stdout");
});

test("auth home goes to the reviewer's env (CODEX_HOME/CLAUDE_CONFIG_DIR), never a flag; injection never reaches argv", () => {
  const codex = buildInvocation({ currentHost: "claude", reviewer: { host: "codex", family: "openai", binary: "/opt/codex", authHome: "/tmp/ch" }, projectDir: "/repo", outputPath: "/tmp/o", schemaPath: "/tmp/s", refs: ["main...HEAD", "; rm -rf /", "$(whoami)"] });
  assert.equal(codex.command, "/opt/codex");
  assert.equal(codex.env.CODEX_HOME, "/tmp/ch");
  assert.equal(codex.args.filter((a) => a === "--base").length, 1);
  assert.ok(!codex.args.some((a) => a.includes("rm -rf") || a.includes("whoami")));
  const claude = buildInvocation({ currentHost: "codex", reviewer: { host: "claude", family: "anthropic", authHome: "/tmp/cc" }, projectDir: "/repo", outputPath: "/tmp/o", schemaPath: "/tmp/s", refs: ["main...HEAD"] });
  assert.equal(claude.env.CLAUDE_CONFIG_DIR, "/tmp/cc");
});

test("env overrides supply binary and config home without shell aliases", () => {
  const inv = buildInvocation({ currentHost: "claude", ...base, env: { [ENV_BINARY]: "/custom/codex", [ENV_CONFIG_HOME]: "/env/home" } });
  assert.equal(inv.command, "/custom/codex");
  assert.equal(inv.env.CODEX_HOME, "/env/home");
});

test("the reviewer child env is a strict allowlist — host secrets are never forwarded", () => {
  const inv = buildInvocation({ currentHost: "claude", ...base, env: { PATH: "/bin", HOME: "/home/u", SECRET_TOKEN: "leak", GITHUB_TOKEN: "leak2" } });
  assert.equal(inv.env.PATH, "/bin");
  assert.equal(inv.env.HOME, "/home/u");
  assert.equal("SECRET_TOKEN" in inv.env, false);
  assert.equal("GITHUB_TOKEN" in inv.env, false);
  assert.equal(inv.env[RECURSION_ENV], "1");
});

test("baseBranch extracts the base from a range or a bare branch", () => {
  assert.equal(baseBranch(["main...HEAD"]), "main");
  assert.equal(baseBranch(["release/2.0..HEAD"]), "release/2.0");
  assert.equal(baseBranch(["feature-x"]), "feature-x");
  assert.equal(baseBranch(["--evil"]), null);
});

// --- runner (fake spawn; no real process, no network) ---

function fakeChild({ withStdout = false } = {}) {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  if (withStdout) child.stdout = new EventEmitter();
  child.kill = () => { child.killed = true; };
  return child;
}

test("codex (file mode) normalizes findings from its output file", async () => {
  const child = fakeChild();
  const promise = runCrossReview(
    { status: "ready", reviewer: "codex", outputMode: "file", command: "codex", args: [], cwd: "/repo", env: {} },
    { spawn: () => child, outputPath: "/tmp/out.json", readOutput: () => JSON.stringify({ findings: [{ severity: "high", file: "a.mjs", line: 3, summary: "leak" }] }) },
  );
  child.emit("close", 0);
  const result = await promise;
  assert.equal(result.status, "ok");
  assert.equal(result.findings[0].severity, "important"); // "high" aliased
});

test("claude (stdout mode) reads findings from drained stdout, never deadlocks", async () => {
  const child = fakeChild({ withStdout: true });
  const promise = runCrossReview(
    { status: "ready", reviewer: "claude", outputMode: "stdout", command: "claude", args: [], cwd: "/repo", env: {} },
    { spawn: () => child },
  );
  child.stdout.emit("data", JSON.stringify({ findings: [{ severity: "critical", summary: "x" }] }));
  child.emit("close", 0);
  const result = await promise;
  assert.equal(result.status, "ok");
  assert.equal(result.findings[0].severity, "critical");
});

test("a synchronous spawn failure returns a typed fallback, not a timer ReferenceError", async () => {
  const result = await runCrossReview(
    { status: "ready", reviewer: "codex", outputMode: "file", command: "x", args: [], cwd: "/repo", env: {} },
    { spawn: () => { throw Object.assign(new Error("nope"), { code: "ENOENT" }); } },
  );
  assert.equal(result.status, "fallback");
  assert.equal(result.reason, "spawn-failed");
});

test("a non-zero reviewer exit is a fallback, not trusted output", async () => {
  const child = fakeChild();
  const promise = runCrossReview(
    { status: "ready", reviewer: "codex", outputMode: "file", command: "codex", args: [], cwd: "/repo", env: {} },
    { spawn: () => child, readOutput: () => JSON.stringify({ findings: [] }) },
  );
  child.emit("close", 2);
  assert.equal((await promise).reason, "nonzero-exit");
});

test("timeout, unparseable output, and not-ready all fall back typed, never throw or block", async () => {
  const c1 = fakeChild();
  const p1 = runCrossReview({ status: "ready", reviewer: "codex", outputMode: "file", command: "codex", args: [], cwd: "/repo", env: {} }, { spawn: () => c1, timeoutMs: 5, readOutput: () => "{}" });
  assert.equal((await p1).reason, "timeout");
  assert.equal(c1.killed, true);

  const c2 = fakeChild();
  const p2 = runCrossReview({ status: "ready", reviewer: "codex", outputMode: "file", command: "codex", args: [], cwd: "/repo", env: {} }, { spawn: () => c2, readOutput: () => "not json" });
  c2.emit("close", 0);
  assert.equal((await p2).status, "fallback");

  assert.equal((await runCrossReview({ status: "unavailable", reason: "no-configured-reviewer" }, { spawn: () => { throw new Error("no"); } })).status, "skipped");
});

test("runReview owns a private temp dir + schema and cleans it up", async () => {
  const child = fakeChild({ withStdout: true });
  const promise = runReview({
    currentHost: "codex", projectDir: "/repo", refs: ["main...HEAD"],
    spawn: () => child,
  });
  child.stdout.emit("data", JSON.stringify({ findings: [] }));
  child.emit("close", 0);
  const result = await promise;
  assert.equal(result.status, "ok");
  assert.deepEqual(result.findings, []);
  // No devmuse-xreview- temp dir left behind.
  const fs = await import("node:fs"); const os = await import("node:os");
  const leaked = fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith("devmuse-xreview-"));
  assert.deepEqual(leaked, []);
});

// --- live flag-acceptance smoke (skipped when the binary is absent) ---
// The fake-spawn tests above passed even when the flags were wrong; this asserts
// every flag we build is actually recognized by the installed CLI's help.

test("every codex flag we build is accepted by the installed codex", { skip: !which("codex") }, () => {
  const help = helpText("codex", ["exec", "review"]);
  const inv = buildInvocation({ currentHost: "claude", ...base });
  for (const flag of inv.args.filter((a) => a.startsWith("--"))) {
    assert.ok(help.includes(flag), `codex 'exec review --help' does not list ${flag}`);
  }
});

test("every claude flag we build is accepted by the installed claude", { skip: !which("claude") }, () => {
  const help = helpText("claude", []);
  const inv = buildInvocation({ currentHost: "codex", ...base });
  for (const flag of inv.args.filter((a) => a.startsWith("--"))) {
    assert.ok(help.includes(flag), `claude --help does not list ${flag}`);
  }
});

// --- findings normalization and contradiction surfacing ---

test("normalization validates structure over exit code and preserves provenance", () => {
  assert.equal(normalizeExternalFindings("nope", { reviewer: "codex" }).status, "invalid");
  assert.equal(normalizeExternalFindings({ notFindings: [] }, { reviewer: "codex" }).status, "invalid");
  assert.equal(normalizeExternalFindings({ findings: [{ severity: "critical", file: "x", line: 1, summary: "s" }] }, { reviewer: "codex" }).findings[0].reviewer, "codex");
});

test("merge surfaces contradictions instead of choosing a side", () => {
  const primary = [{ severity: "minor", file: "a", line: 1, summary: "p" }];
  const external = [
    { severity: "critical", file: "a", line: 1, summary: "e1", reviewer: "codex" },
    { severity: "important", file: "b", line: 2, summary: "e2", reviewer: "codex" },
  ];
  const { merged, contradictions } = mergeFindings(primary, external);
  assert.equal(contradictions.length, 2);
  assert.ok(merged.some((f) => f.contested && f.externalSeverity === "critical"));
  assert.ok(merged.some((f) => f.file === "b" && f.contested));
});
