#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { defaultRepoRoot, parseArgs, verifyRelease } from "./artifacts.mjs";
import { finalizeRelease } from "./finalize-lib.mjs";
import { publishNpm } from "./publish-npm-lib.mjs";

try {
  const args = parseArgs(process.argv.slice(2), { input: { required: true } });
  const repoRoot = defaultRepoRoot(import.meta.url);
  verifyRelease({ repoRoot, input: args.input });
  finalizeRelease({
    repoRoot,
    input: args.input,
    evidence: path.join(args.input, "smoke-evidence.json"),
  });
  const manifest = JSON.parse(fs.readFileSync(path.join(args.input, "bundle-manifest.json"), "utf8"));
  const result = publishNpm({
    input: args.input,
    name: manifest.packageName,
    version: manifest.version,
  });
  console.log(`npm publication ${result.action}: ${manifest.packageName}@${manifest.version}`);
} catch (error) {
  console.error(`release:publish-npm: ${error.message}`);
  process.exitCode = 1;
}
