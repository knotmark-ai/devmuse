import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { stableJson, verifyRelease } from "./artifacts.mjs";

export const FINAL_SCHEMA_VERSION = 1;

const utf8Sort = (left, right) => Buffer.from(left).compare(Buffer.from(right));
const sha256 = (body) => createHash("sha256").update(body).digest("hex");

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.join("\0") !== wanted.join("\0")) {
    throw new Error(`Unknown evidence field or missing ${label} field: expected ${wanted.join(", ")}; got ${actual.join(", ")}`);
  }
}

function validateEvidence(file, sourceCommit) {
  const evidence = JSON.parse(fs.readFileSync(file, "utf8"));
  exactKeys(evidence, ["schemaVersion", "sourceCommit", "gates"], "evidence");
  if (evidence.schemaVersion !== 1) throw new Error(`Unsupported evidence schema: ${evidence.schemaVersion}`);
  if (evidence.sourceCommit !== sourceCommit) {
    throw new Error(`Evidence source commit ${evidence.sourceCommit} does not match ${sourceCommit}`);
  }
  exactKeys(evidence.gates, ["verify", "smoke"], "evidence gates");
  if (evidence.gates.verify !== "passed") throw new Error("Evidence verify gate did not pass");
  exactKeys(evidence.gates.smoke, ["claude", "codex", "gemini", "hermes", "openclaw"], "smoke gates");
  for (const [target, status] of Object.entries(evidence.gates.smoke)) {
    if (status !== "passed") throw new Error(`Evidence smoke gate did not pass: ${target}=${status}`);
  }
  return evidence;
}

function buildSubmissionPacket({ version, sourceCommit, submissions, digestByArtifact, evidence }) {
  const labels = {
    claude: "Claude Code",
    codex: "Codex",
    gemini: "Gemini CLI",
    hermes: "Hermes Agent",
    openclaw: "OpenClaw compatibility",
  };
  const lines = [
    `# DevMuse ${version} Marketplace Submission Packet`,
    "",
    `Source commit: \`${sourceCommit}\``,
    "",
    "Validation evidence:",
    "",
    `- Build verification: ${evidence.gates.verify}`,
    `- Install lifecycle smoke: ${Object.entries(evidence.gates.smoke).map(([target, status]) => `${target}=${status}`).join(", ")}`,
    "",
  ];
  for (const target of ["claude", "codex", "gemini", "hermes", "openclaw"]) {
    const submission = submissions.hosts[target];
    lines.push(
      `## ${labels[target]}`,
      "",
      `- Artifact: \`${submission.artifact}\``,
      `- SHA-256: \`${digestByArtifact[submission.artifact]}\``,
    );
    if (target === "openclaw") {
      lines.push("- Compatibility source: Claude archive; no separate OpenClaw artifact is produced.");
    }
    lines.push(
      "",
      "Human submission steps:",
      "",
      "1. Verify the artifact digest against `SHA256SUMS`.",
      "2. Submit the named artifact and this validation evidence to the marketplace.",
      "3. Record the marketplace acceptance or rejection without changing release bytes.",
      "",
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function assertNoConflictingOutputs(input, outputs) {
  for (const [name, body] of Object.entries(outputs)) {
    const target = path.join(input, name);
    if (fs.existsSync(target) && !fs.readFileSync(target).equals(body)) {
      throw new Error(`Final output already exists with different bytes: ${name}`);
    }
  }
}

function writeMissingOutputs(input, outputs) {
  for (const [name, body] of Object.entries(outputs)) {
    const target = path.join(input, name);
    if (!fs.existsSync(target)) fs.writeFileSync(target, body, { flag: "wx" });
  }
}

export function finalizeRelease({ repoRoot, input, evidence: evidenceFile } = {}) {
  if (!repoRoot || !input || !evidenceFile) {
    throw new Error("finalizeRelease requires repoRoot, input, and evidence");
  }
  const directory = path.resolve(input);
  const verified = verifyRelease({ repoRoot, input: directory });
  const manifest = verified.bundleManifest;
  const evidence = validateEvidence(evidenceFile, verified.sourceCommit);
  const submissions = JSON.parse(fs.readFileSync(path.join(directory, "submission-inputs.json"), "utf8"));
  const digestByArtifact = Object.fromEntries([
    ...Object.values(manifest.bundles).map((bundle) => [bundle.artifact, bundle.sha256]),
    [manifest.npm.artifact, manifest.npm.sha256],
  ]);

  const releaseManifest = {
    schemaVersion: FINAL_SCHEMA_VERSION,
    packageName: manifest.packageName,
    version: manifest.version,
    source: manifest.source,
    compatibilityTargets: manifest.compatibilityTargets,
    gates: evidence.gates,
    runtimeArtifacts: Object.fromEntries(
      Object.entries(manifest.bundles).map(([name, bundle]) => [name, {
        name: bundle.artifact,
        sha256: bundle.sha256,
        size: bundle.size,
      }]),
    ),
    npm: manifest.npm,
  };
  const releaseManifestBody = Buffer.from(stableJson(releaseManifest));
  const packetBody = Buffer.from(buildSubmissionPacket({
    version: manifest.version,
    sourceCommit: verified.sourceCommit,
    submissions,
    digestByArtifact,
    evidence,
  }));

  const uploadBodies = {};
  for (const name of [
    ...Object.values(manifest.bundles).map((bundle) => bundle.artifact),
    manifest.npm.artifact,
    "bundle-manifest.json",
    "source-provenance.json",
    "submission-inputs.json",
  ]) uploadBodies[name] = fs.readFileSync(path.join(directory, name));
  uploadBodies["release-manifest.json"] = releaseManifestBody;
  uploadBodies["marketplace-submission.md"] = packetBody;

  const sumsBody = Buffer.from(
    `${Object.keys(uploadBodies).sort(utf8Sort).map((name) => `${sha256(uploadBodies[name])}  ${name}`).join("\n")}\n`,
  );
  const assetDigests = Object.fromEntries(
    Object.keys(uploadBodies).sort(utf8Sort).map((name) => [name, sha256(uploadBodies[name])]),
  );
  assetDigests.SHA256SUMS = sha256(sumsBody);
  const expectedAssets = {
    schemaVersion: FINAL_SCHEMA_VERSION,
    version: manifest.version,
    sourceCommit: verified.sourceCommit,
    assets: assetDigests,
  };
  const outputs = {
    "release-manifest.json": releaseManifestBody,
    "marketplace-submission.md": packetBody,
    SHA256SUMS: sumsBody,
    "expected-assets.json": Buffer.from(stableJson(expectedAssets)),
  };
  assertNoConflictingOutputs(directory, outputs);
  writeMissingOutputs(directory, outputs);
  return { releaseManifest, expectedAssets, uploadAssets: Object.keys(assetDigests).sort(utf8Sort) };
}
