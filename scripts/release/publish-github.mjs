#!/usr/bin/env node

import { execFileSync } from "node:child_process";

import { parseArgs } from "./artifacts.mjs";
import { preflightGitHubRelease, publishGitHubRelease } from "./publish-github-lib.mjs";

try {
  const args = parseArgs(process.argv.slice(2), {
    input: { required: true },
    tag: { required: true },
    preflight: { boolean: true },
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
