#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import path from "node:path";

import { defaultRepoRoot, parseArgs, verifyRelease } from "./artifacts.mjs";
import { finalizeRelease } from "./finalize-lib.mjs";
import { preflightGitHubRelease, publishGitHubRelease } from "./publish-github-lib.mjs";

try {
  const args = parseArgs(process.argv.slice(2), {
    input: { required: true },
    tag: { required: true },
    preflight: { boolean: true },
  });
  const repoRoot = defaultRepoRoot(import.meta.url);
  verifyRelease({ repoRoot, input: args.input });
  finalizeRelease({
    repoRoot,
    input: args.input,
    evidence: path.join(args.input, "smoke-evidence.json"),
  });
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const result = args.preflight
    ? preflightGitHubRelease({ input: args.input, tag: args.tag, sourceCommit })
    : publishGitHubRelease({ input: args.input, tag: args.tag, sourceCommit });
  console.log(`GitHub release ${result.action}: ${args.tag} (${result.assets.length} assets)`);
} catch (error) {
  console.error(`release:publish-github: ${error.message}`);
  process.exitCode = 1;
}
