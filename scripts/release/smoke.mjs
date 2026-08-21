#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseArgs, stableJson } from "./artifacts.mjs";
import { runSmoke } from "./smoke-lib.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

try {
  const args = parseArgs(process.argv.slice(2), { input: { required: true }, evidence: {} });
  const evidence = runSmoke({ repoRoot, input: args.input });
  if (args.evidence) {
    const body = stableJson(evidence);
    if (fs.existsSync(args.evidence) && fs.readFileSync(args.evidence, "utf8") !== body) {
      throw new Error(`Evidence file already exists with different bytes: ${args.evidence}`);
    }
    fs.writeFileSync(args.evidence, body);
  }
  console.log(`Smoked DevMuse release for ${evidence.sourceCommit}: ${Object.keys(evidence.gates.smoke).join(", ")}`);
} catch (error) {
  console.error(`release:smoke: ${error.message}`);
  process.exitCode = 1;
}
