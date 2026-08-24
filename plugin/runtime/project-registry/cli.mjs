#!/usr/bin/env node
// Thin CLI over the project-registry contract. snake_case in, snake_case out.
//   validate-routing   — validate a `cases:` block
//   asset-revision     — compute the content-hash revision of an asset
//   validate-asset     — structural validation of an asset
//   serialize          — serialize a kind's assets to a Git-reviewable file
//   parse              — parse and validate a registry file
//   staleness          — result-anchored coverage staleness
//   propose-migration  — propose a v1->v2 manifest migration (no write)
// This module performs no tracked writes; mu-setup owns approval + persistence.
import {
  validateRouting,
  assetRevision,
  validateAsset,
  serializeRegistryFile,
  parseRegistryFile,
  coverageStaleness,
  proposeV2Migration,
  initRegistry,
  registryStatus,
  readKind,
  writeKind,
  providerTransition,
  classifyOutcome,
} from "./index.mjs";
import { xrayReadTestsRequest, normalizeXrayTest, xrayCapabilities } from "./providers/xray.mjs";

function write(value, status = 0) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exitCode = status;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() ? JSON.parse(text) : {};
}

const command = process.argv[2] ?? "validate-routing";
try {
  const input = await readStdin();
  if (command === "validate-routing") {
    write(validateRouting(input.cases ?? input));
  } else if (command === "asset-revision") {
    write({ revision: assetRevision(input.asset ?? input) });
  } else if (command === "validate-asset") {
    write(validateAsset(input.asset ?? input));
  } else if (command === "serialize") {
    write({ file: serializeRegistryFile(input.kind, input.assets ?? []) });
  } else if (command === "parse") {
    write(parseRegistryFile(input.text ?? ""));
  } else if (command === "staleness") {
    write(coverageStaleness(input.result ?? null, input.current ?? {}));
  } else if (command === "propose-migration") {
    write(proposeV2Migration(input.v1 ?? input.v1_value, input.cases ?? null));
  } else if (command === "init") {
    write(initRegistry(input.repo_root ?? process.cwd()));
  } else if (command === "status") {
    write(registryStatus(input.repo_root ?? process.cwd()));
  } else if (command === "read-kind") {
    write(readKind(input.repo_root ?? process.cwd(), input.kind));
  } else if (command === "write-kind") {
    write(writeKind(input.repo_root ?? process.cwd(), input.kind, input.assets ?? []));
  } else if (command === "provider-transition") {
    write(providerTransition(input));
  } else if (command === "classify-outcome") {
    write(classifyOutcome(input.outcome ?? input));
  } else if (command === "xray-capabilities") {
    write(xrayCapabilities());
  } else if (command === "xray-read-request") {
    write(xrayReadTestsRequest(input));
  } else if (command === "xray-normalize") {
    write(normalizeXrayTest(input.record ?? input));
  } else {
    write({ error: { code: "unknown-command" } }, 2);
  }
} catch (error) {
  write({ error: { code: error.code ?? "operation-failed" } }, 1);
}
