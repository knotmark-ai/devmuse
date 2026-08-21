#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, verifyRelease } from "./artifacts.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

try {
  const args = parseArgs(process.argv.slice(2), { input: { required: true } });
  const result = verifyRelease({ repoRoot, input: args.input });
  console.log(`Verified DevMuse ${result.version} release artifacts for ${result.sourceCommit}`);
} catch (error) {
  console.error(`release:verify: ${error.message}`);
  process.exitCode = 1;
}
