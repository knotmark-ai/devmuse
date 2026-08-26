#!/usr/bin/env node
// Thin CLI over the project-registry contract. snake_case in, snake_case out.
//   validate-routing   — validate a `cases:` block
//   asset-revision     — compute the content-hash revision of an asset
//   validate-asset     — structural validation of an asset
//   serialize          — serialize a kind's assets to a Git-reviewable file
//   parse              — parse and validate a registry file
//   staleness          — result-anchored coverage staleness
//   propose-migration  — propose a v1->v2 manifest migration (no write)
//   serialize-manifest — render a manifest value to YAML text (no write)
//   read-routing       — validate the cases block of a parsed manifest
//   read-preferences   — read user-level default routes (absent file is ok)
//   resolve-routing    — merge project routes over user prefs (project wins)
//   write-preferences  — USER-LEVEL WRITE (outside repo), gated on {approved:true}
//   init / write-kind / write-manifest — TRACKED WRITES, gated on {approved:true}
// Read/validate/propose commands never write. The write commands (init,
// write-kind, write-manifest) mutate tracked files ONLY when the request carries
// approved:true — the present-before-write gate, enforced here in code.
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
  serializeManifest,
  readRouting,
  readPreferences,
  writePreferences,
  resolveEffectiveRoutes,
  containedRepoPath,
  atomicWrite,
} from "./index.mjs";
import { parseProjectManifest } from "../project-context/manifest.mjs";
import fs from "node:fs";
import path from "node:path";
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
  } else if (command === "serialize-manifest") {
    write({ manifest: serializeManifest(input.value ?? input) });
  } else if (command === "read-routing") {
    write(readRouting(input.manifest ?? input.value ?? input));
  } else if (command === "init") {
    // Tracked write — gated on explicit approval (present-before-write). `routes`
    // (the resolved effective routing) restricts creation to repository-owned kinds
    // so setup never forks a local file for an externally routed kind (#68).
    if (input.approved !== true) write({ status: "blocked", reason: "approval-required" }, 1);
    else write(initRegistry(input.repo_root ?? process.cwd(), { routes: input.routes ?? null }));
  } else if (command === "status") {
    write(registryStatus(input.repo_root ?? process.cwd()));
  } else if (command === "read-kind") {
    write(readKind(input.repo_root ?? process.cwd(), input.kind));
  } else if (command === "write-kind") {
    if (input.approved !== true) write({ status: "blocked", reason: "approval-required" }, 1);
    else write(writeKind(input.repo_root ?? process.cwd(), input.kind, input.assets ?? []));
  } else if (command === "write-manifest") {
    // Serialize + write .devmuse/project.yaml, gated on approval. Never stores
    // credentials — the value is the resolved manifest, no secrets.
    if (input.approved !== true) {
      write({ status: "blocked", reason: "approval-required" }, 1);
    } else {
      const root = input.repo_root ?? process.cwd();
      const text = serializeManifest(input.value);
      // Validate the cases routing (provider vocabulary the parser delegates here).
      const routing = readRouting(input.value);
      // Validate the COMPLETE serialized manifest with the canonical parser — project
      // id/repository shape and in-repo artifact paths, not just routing (rejects an
      // invalid id or an `../escape.md` artifact path).
      const parsed = parseProjectManifest(text, { repoRoot: root });
      if (routing.status === "invalid") {
        write({ status: "blocked", reason: "invalid-routing", detail: routing.reason }, 1);
      } else if (parsed.status !== "valid") {
        write({ status: "blocked", reason: "invalid-manifest", detail: parsed.reason }, 1);
      } else {
        try {
          // Resolve the target inside the repo (rejects a symlinked `.devmuse`
          // escaping the repository), then write atomically.
          const file = containedRepoPath(root, path.join(".devmuse", "project.yaml"));
          atomicWrite(file, text);
          write({ status: "written", file: ".devmuse/project.yaml" });
        } catch (error) {
          write({ status: "blocked", reason: error.code === "path-escapes-repo" ? "path-escapes-repo" : "write-failed" }, 1);
        }
      }
    }
  } else if (command === "read-preferences") {
    // Read-only: user-level default routes. Absent file is not an error.
    write(readPreferences());
  } else if (command === "resolve-routing") {
    // Merge project routes over user preferences (project wins), reporting the
    // per-kind source. Pure read — writes nothing.
    write(resolveEffectiveRoutes(input.project_routes ?? {}, input.preference_routes ?? readPreferences().routes));
  } else if (command === "write-preferences") {
    // User-level write (outside any repo), gated on explicit approval. Never
    // rewrites a project override — only the user's own default routes.
    if (input.approved !== true) write({ status: "blocked", reason: "approval-required" }, 1);
    else write(writePreferences(input.routes ?? {}));
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
