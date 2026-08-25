import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

// #54 — BEHAVIORAL acceptance for the opt-in concurrent-dispatch guidance: static
// wiring tests (platform-compat) prove the pointers exist; these run representative
// eligible / ineligible / user-declined prompts against a real model and observe the
// dispatch DECISION, feeding it the ACTUAL shipped HOST_POLICY guidance (not a
// hand-written proxy). Binary-gated on `claude`; a Claude reasoning proxy for the
// Codex-host decision logic (full Codex-host execution parity is out of scope,
// tracked separately — the guidance is opt-in and suggestion-only by design).

const root = path.resolve(import.meta.dirname, "../..");

// OPT-IN: this suite makes live model calls, so it runs only under DEVMUSE_LIVE=1
// (via `npm run test:live`). The required acceptance gate stays deterministic and
// never PATH-dependent — it does not run this suite at all.
const LIVE = process.env.DEVMUSE_LIVE === "1";
function which(binary) {
  return spawnSync("command", ["-v", binary], { shell: "/bin/bash", encoding: "utf8" }).status === 0;
}

// The real, shipped guidance — the "Optional: concurrent subagent dispatch" section.
function dispatchGuidance() {
  const body = fs.readFileSync(path.join(root, "adapters/codex/HOST_POLICY.md"), "utf8");
  const start = body.indexOf("## Optional: concurrent subagent dispatch");
  assert.ok(start !== -1, "HOST_POLICY missing the concurrent-dispatch section");
  return body.slice(start).trim();
}

function decide(scenario) {
  const prompt = `You are an agent operating under this DevMuse Codex host policy:\n\n${dispatchGuidance()}\n\n${scenario}\n\nReply with EXACTLY one word on the first line: PARALLEL or SINGLE.`;
  const r = spawnSync("claude", ["-p", prompt, "--permission-mode", "plan"], { encoding: "utf8", timeout: 90_000 });
  const match = `${r.stdout ?? ""}`.match(/\b(PARALLEL|SINGLE)\b/i);
  return match ? match[1].toUpperCase() : `NO-DECISION(${(r.stdout ?? r.stderr ?? "").slice(0, 120)})`;
}

const SCENARIOS = {
  // Eligible: mu-review's independent lenses over one diff may be offered for fan-out.
  eligible: {
    prompt: "Task: you are running $mu-review over one diff, doing its requirements-coverage, security, and code-quality passes. No user constraint on threading. May these passes be offered as parallel workers?",
    expect: "PARALLEL",
  },
  // Ineligible: mu-prd authors one artifact and is not a named fan-out candidate.
  ineligible: {
    prompt: "Task: you are running $mu-prd to author ONE product requirements document. No user constraint on threading. May this be offered as parallel workers?",
    expect: "SINGLE",
  },
  // Declined: an explicit user instruction to run single-threaded is always honored.
  declined: {
    prompt: "Task: you are running $mu-review over one diff (normally a fan-out candidate), but the user explicitly said: run this single-threaded, do not parallelize. What do you do?",
    expect: "SINGLE",
  },
};

for (const [name, { prompt, expect }] of Object.entries(SCENARIOS)) {
  test(`dispatch behavior — ${name} scenario decides ${expect} (#54)`, { skip: !LIVE || !which("claude") }, () => {
    const decision = decide(prompt);
    assert.equal(decision, expect, `${name}: expected ${expect}, model decided ${decision}`);
  });
}
