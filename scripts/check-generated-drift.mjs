#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = execFileSync(
  "git",
  ["status", "--short", "--untracked-files=all", "--", "adapters/codex"],
  { cwd: repoRoot, encoding: "utf8" },
).trim();

if (output) {
  console.error("FAIL: generated Codex adapter differs from the committed source:");
  console.error(output);
  process.exitCode = 1;
} else {
  console.log("PASS: generated Codex adapter matches the committed source");
}
