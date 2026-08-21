#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs } from "./artifacts.mjs";
import { finalizeRelease } from "./finalize-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

try {
  const args = parseArgs(process.argv.slice(2), {
    input: { required: true },
    evidence: { required: true },
  });
  const result = finalizeRelease({ repoRoot, input: args.input, evidence: args.evidence });
  console.log(`Finalized DevMuse ${result.releaseManifest.version} with ${result.uploadAssets.length} upload assets`);
} catch (error) {
  console.error(`release:finalize: ${error.message}`);
  process.exitCode = 1;
}
