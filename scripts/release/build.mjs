#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRelease, parseArgs } from "./artifacts.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

try {
  const args = parseArgs(process.argv.slice(2), { output: { required: true }, source: {} });
  const result = await buildRelease({ repoRoot, output: args.output, sourceRef: args.source });
  console.log(`Built DevMuse ${result.version} release artifacts in ${result.output}`);
  for (const artifact of result.bundleChecksums.artifacts) {
    console.log(`${artifact.sha256}  ${artifact.name}`);
  }
} catch (error) {
  console.error(`release:build: ${error.message}`);
  process.exitCode = 1;
}
