import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { gunzipSync, gzipSync } from "node:zlib";

import { createTarGz, readTarGz } from "./archive.mjs";
import {
  BUNDLE_CATALOG,
  COMPATIBILITY_TARGETS,
  loadReleaseContext,
  readTrackedFile,
  selectBundleFiles,
} from "./model.mjs";

export const BUILD_SCHEMA_VERSION = 1;

const utf8Sort = (left, right) => Buffer.from(left).compare(Buffer.from(right));
const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const sha512Integrity = (body) => `sha512-${createHash("sha512").update(body).digest("base64")}`;
const TAR_BLOCK_SIZE = 512;
const NPM_ARCHIVE_EPOCH = 499_162_500;

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => utf8Sort(left, right)).map(
        ([key, child]) => [key, sortKeys(child)],
      ),
    );
  }
  return value;
}

export function stableJson(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function writeStableJson(directory, name, value) {
  fs.writeFileSync(path.join(directory, name), stableJson(value), { flag: "wx" });
}

function readJsonFile(directory, name) {
  const file = path.join(directory, name);
  const body = fs.readFileSync(file, "utf8");
  const value = JSON.parse(body);
  if (body !== stableJson(value)) throw new Error(`Release JSON is not canonical: ${name}`);
  return value;
}

function fileDigest(file) {
  return sha256(fs.readFileSync(file));
}

function artifactRecord(directory, name) {
  const body = fs.readFileSync(path.join(directory, name));
  return { name, sha256: sha256(body), size: body.length };
}

function sourceFileRecords(context, files) {
  return files.map((file) => {
    const body = readTrackedFile(context, file);
    return {
      path: file.path,
      mode: file.mode,
      sha256: sha256(body),
      size: body.length,
    };
  });
}

function submissionInputs(context, bundles) {
  return {
    schemaVersion: BUILD_SCHEMA_VERSION,
    version: context.version,
    sourceCommit: context.commit,
    hosts: {
      claude: { artifact: bundles.claude.artifact },
      codex: { artifact: bundles.codex.artifact },
      gemini: { artifact: bundles.gemini.artifact },
      hermes: { artifact: bundles.hermes.artifact },
      openclaw: { artifact: bundles.claude.artifact, compatibilityOf: "claude" },
    },
  };
}

function materializeTrackedTree(context) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-npm-stage-"));
  for (const file of context.trackedFiles) {
    const target = path.join(staging, ...file.path.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, readTrackedFile(context, file), { flag: "wx", mode: file.mode });
    fs.chmodSync(target, file.mode);
  }
  return staging;
}

function readTarString(block, offset, length) {
  const field = block.subarray(offset, offset + length);
  const end = field.indexOf(0);
  return field.subarray(0, end < 0 ? field.length : end).toString("utf8");
}

function readTarOctal(block, offset, length) {
  const value = readTarString(block, offset, length).trim();
  if (!/^[0-7]+$/.test(value)) throw new Error(`Invalid npm tar numeric field: ${JSON.stringify(value)}`);
  return Number.parseInt(value, 8);
}

function writeNpmTarOctal(block, offset, length, value) {
  const encoded = value.toString(8).padStart(length - 2, "0");
  if (encoded.length !== length - 2) throw new Error(`npm tar numeric value does not fit: ${value}`);
  block.fill(0, offset, offset + length);
  Buffer.from(`${encoded} \0`, "ascii").copy(block, offset);
}

function verifyNpmTarChecksum(header) {
  const expected = readTarOctal(header, 148, 8);
  const copy = Buffer.from(header);
  copy.fill(0x20, 148, 156);
  const actual = copy.reduce((total, byte) => total + byte, 0);
  if (actual !== expected) throw new Error("npm tar header checksum mismatch");
}

export function normalizeNpmTarball(input, context) {
  if (!Buffer.isBuffer(input) || input.length > 64 * 1024 * 1024) {
    throw new Error("npm tarball exceeds the supported size");
  }
  const tar = Buffer.from(gunzipSync(input, { maxOutputLength: 256 * 1024 * 1024 }));
  if (tar.length < TAR_BLOCK_SIZE * 2 || tar.length % TAR_BLOCK_SIZE !== 0) {
    throw new Error("npm tar archive size is invalid");
  }
  const trackedByPath = new Map(context.trackedFiles.map((file) => [file.path, file]));
  const seen = new Set();
  let offset = 0;
  while (offset + TAR_BLOCK_SIZE <= tar.length) {
    const header = tar.subarray(offset, offset + TAR_BLOCK_SIZE);
    if (header.every((byte) => byte === 0)) break;
    verifyNpmTarChecksum(header);
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const entryPath = prefix ? `${prefix}/${name}` : name;
    if (
      !entryPath.startsWith("package/")
      || entryPath.includes("\\")
      || entryPath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
    ) throw new Error(`Unsafe npm tar path: ${entryPath}`);
    const relative = entryPath.slice("package/".length);
    const tracked = trackedByPath.get(relative);
    if (!tracked) throw new Error(`npm tar contains a non-canonical source path: ${relative}`);
    if (seen.has(relative)) throw new Error(`npm tar contains a duplicate path: ${relative}`);
    seen.add(relative);
    const type = readTarString(header, 156, 1) || "0";
    if (type !== "0") throw new Error(`npm tar contains an unsupported entry type: ${entryPath}`);
    const size = readTarOctal(header, 124, 12);
    const bodyStart = offset + TAR_BLOCK_SIZE;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > tar.length) throw new Error(`npm tar entry is truncated: ${entryPath}`);

    writeNpmTarOctal(header, 100, 8, tracked.mode);
    header.fill(0, 108, 124);
    writeNpmTarOctal(header, 136, 12, NPM_ARCHIVE_EPOCH);
    header.fill(0, 265, 345);
    header.fill(0, 148, 156);
    header.fill(0x20, 148, 156);
    const checksum = header.reduce((total, byte) => total + byte, 0);
    writeNpmTarOctal(header, 148, 8, checksum);
    offset = bodyStart + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
  }
  const terminator = tar.subarray(offset);
  if (terminator.length !== TAR_BLOCK_SIZE * 2 || !terminator.every((byte) => byte === 0)) {
    throw new Error("npm tar archive has invalid terminators or trailing data");
  }
  if (seen.size === 0) throw new Error("npm tar archive is empty");
  const gzip = Buffer.from(gzipSync(tar, { level: 9, mtime: 0 }));
  gzip.fill(0, 4, 8);
  gzip[9] = 255;
  return gzip;
}

function packNpm(context, output) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const staging = materializeTrackedTree(context);
  try {
    const stdout = execFileSync(
      npm,
      ["pack", "--ignore-scripts", "--json", "--pack-destination", output],
      { cwd: staging, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const result = JSON.parse(stdout);
    const artifact = `devmuse-${context.version}.tgz`;
    if (!Array.isArray(result) || result.length !== 1 || result[0]?.filename !== artifact) {
      throw new Error(`npm pack returned an unexpected artifact: ${stdout}`);
    }
    const target = path.join(output, artifact);
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`npm pack output is not a regular file: ${artifact}`);
    }
    const body = normalizeNpmTarball(fs.readFileSync(target), context);
    fs.writeFileSync(target, body);
    return {
      artifact,
      sha256: sha256(body),
      integrity: sha512Integrity(body),
      size: body.length,
    };
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

function assertSourceRef(repoRoot, sourceRef, commit) {
  if (!sourceRef) return;
  const resolved = execFileSync("git", ["rev-parse", `${sourceRef}^{commit}`], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
  if (resolved !== commit) {
    throw new Error(`Source ref ${sourceRef} resolves to ${resolved}; checkout is ${commit}`);
  }
}

function prepareOutput(output) {
  const target = path.resolve(output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory()) throw new Error(`Release output is not a directory: ${target}`);
    if (fs.readdirSync(target).length > 0) throw new Error(`Release output must be empty: ${target}`);
  }
  const temporary = fs.mkdtempSync(path.join(path.dirname(target), `.${path.basename(target)}.tmp-`));
  return { target, temporary };
}

export async function buildRelease({ repoRoot, output, sourceRef } = {}) {
  if (!repoRoot || !output) throw new Error("buildRelease requires repoRoot and output");
  const context = loadReleaseContext(repoRoot, { output });
  assertSourceRef(context.repoRoot, sourceRef, context.commit);
  const { target, temporary } = prepareOutput(output);
  try {
    const { bundleManifest, bundleChecksums } = buildCanonicalArtifacts(context, temporary);

    if (fs.existsSync(target)) fs.rmdirSync(target);
    fs.renameSync(temporary, target);
    return { output: target, version: context.version, bundleManifest, bundleChecksums };
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
}

function buildCanonicalArtifacts(context, output) {
  const bundles = {};
  for (const bundleName of Object.keys(BUNDLE_CATALOG)) {
    const files = selectBundleFiles(context, bundleName);
    const archive = `devmuse-${context.version}-${bundleName}.tar.gz`;
    const entries = files.map((file) => ({
      path: `devmuse/${file.path}`,
      mode: file.mode,
      body: readTrackedFile(context, file),
    }));
    const body = createTarGz(entries, { sourceEpoch: context.epoch });
    fs.writeFileSync(path.join(output, archive), body, { flag: "wx" });
    bundles[bundleName] = {
      artifact: archive,
      sha256: sha256(body),
      size: body.length,
      files: sourceFileRecords(context, files),
    };
  }

  const npm = packNpm(context, output);
  const bundleManifest = {
    schemaVersion: BUILD_SCHEMA_VERSION,
    packageName: "devmuse",
    version: context.version,
    source: { commit: context.commit, epoch: context.epoch },
    compatibilityTargets: COMPATIBILITY_TARGETS,
    bundles,
    npm,
  };
  const bundleChecksums = {
    schemaVersion: BUILD_SCHEMA_VERSION,
    artifacts: [
      ...Object.values(bundles).map(({ artifact: name, sha256: digest, size }) => ({ name, sha256: digest, size })),
      { name: npm.artifact, sha256: npm.sha256, size: npm.size },
    ].sort((left, right) => utf8Sort(left.name, right.name)),
  };
  writeStableJson(output, "bundle-manifest.json", bundleManifest);
  writeStableJson(output, "bundle-checksums.json", bundleChecksums);
  writeStableJson(output, "source-provenance.json", {
    schemaVersion: BUILD_SCHEMA_VERSION,
    packageName: "devmuse",
    version: context.version,
    sourceCommit: context.commit,
    sourceEpoch: context.epoch,
  });
  writeStableJson(output, "submission-inputs.json", submissionInputs(context, bundles));
  return { bundleManifest, bundleChecksums };
}

function assertEqual(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(`${label} mismatch`);
}

function verifyArchive(input, context, bundleName, manifestBundle) {
  const artifact = `devmuse-${context.version}-${bundleName}.tar.gz`;
  if (manifestBundle.artifact !== artifact) throw new Error(`${bundleName} artifact name mismatch`);
  const artifactPath = path.join(input, artifact);
  const body = fs.readFileSync(artifactPath);
  if (sha256(body) !== manifestBundle.sha256) throw new Error(`${artifact} digest mismatch`);
  if (body.length !== manifestBundle.size) throw new Error(`${artifact} size mismatch`);

  const selected = selectBundleFiles(context, bundleName);
  const expectedFiles = sourceFileRecords(context, selected);
  assertEqual(manifestBundle.files, expectedFiles, `${bundleName} file manifest`);
  const entries = readTarGz(body);
  if (entries.length !== selected.length) throw new Error(`${artifact} file set mismatch`);
  for (let index = 0; index < selected.length; index += 1) {
    const source = selected[index];
    const entry = entries[index];
    const expectedPath = `devmuse/${source.path}`;
    if (entry.path !== expectedPath) throw new Error(`${artifact} path mismatch: ${entry.path}`);
    if (entry.mode !== source.mode) throw new Error(`${artifact} mode mismatch: ${entry.path}`);
    if (entry.mtime !== context.epoch) throw new Error(`${artifact} mtime mismatch: ${entry.path}`);
    if (!entry.body.equals(readTrackedFile(context, source))) {
      throw new Error(`${artifact} content mismatch: ${entry.path}`);
    }
  }
  return { artifact, sha256: manifestBundle.sha256, size: manifestBundle.size };
}

export function verifyRelease({ repoRoot, input } = {}) {
  if (!repoRoot || !input) throw new Error("verifyRelease requires repoRoot and input");
  const directory = path.resolve(input);
  const context = loadReleaseContext(repoRoot, { output: directory });
  const canonical = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-release-verify-"));
  try {
    buildCanonicalArtifacts(context, canonical);
    for (const name of fs.readdirSync(canonical).sort(utf8Sort)) {
      const actual = fs.readFileSync(path.join(directory, name));
      const expected = fs.readFileSync(path.join(canonical, name));
      if (!actual.equals(expected)) throw new Error(`Canonical release artifact mismatch: ${name}`);
    }
  } finally {
    fs.rmSync(canonical, { recursive: true, force: true });
  }
  const manifest = readJsonFile(directory, "bundle-manifest.json");
  if (manifest.schemaVersion !== BUILD_SCHEMA_VERSION) throw new Error("Unsupported bundle manifest schema");

  const bundles = {};
  const checksumArtifacts = [];
  for (const bundleName of Object.keys(BUNDLE_CATALOG)) {
    const manifestBundle = manifest.bundles?.[bundleName];
    if (!manifestBundle) throw new Error(`Bundle manifest is missing ${bundleName}`);
    const record = verifyArchive(directory, context, bundleName, manifestBundle);
    checksumArtifacts.push({ name: record.artifact, sha256: record.sha256, size: record.size });
    bundles[bundleName] = {
      artifact: record.artifact,
      sha256: record.sha256,
      size: record.size,
      files: sourceFileRecords(context, selectBundleFiles(context, bundleName)),
    };
  }

  const npmArtifact = `devmuse-${context.version}.tgz`;
  const npmBody = fs.readFileSync(path.join(directory, npmArtifact));
  const npm = {
    artifact: npmArtifact,
    sha256: sha256(npmBody),
    integrity: sha512Integrity(npmBody),
    size: npmBody.length,
  };
  checksumArtifacts.push({ name: npm.artifact, sha256: npm.sha256, size: npm.size });

  const expectedManifest = {
    schemaVersion: BUILD_SCHEMA_VERSION,
    packageName: "devmuse",
    version: context.version,
    source: { commit: context.commit, epoch: context.epoch },
    compatibilityTargets: COMPATIBILITY_TARGETS,
    bundles,
    npm,
  };
  assertEqual(manifest, expectedManifest, "Bundle manifest");

  const expectedChecksums = {
    schemaVersion: BUILD_SCHEMA_VERSION,
    artifacts: checksumArtifacts.sort((left, right) => utf8Sort(left.name, right.name)),
  };
  assertEqual(readJsonFile(directory, "bundle-checksums.json"), expectedChecksums, "Bundle checksums");
  assertEqual(
    readJsonFile(directory, "source-provenance.json"),
    {
      schemaVersion: BUILD_SCHEMA_VERSION,
      packageName: "devmuse",
      version: context.version,
      sourceCommit: context.commit,
      sourceEpoch: context.epoch,
    },
    "Source provenance",
  );
  assertEqual(readJsonFile(directory, "submission-inputs.json"), submissionInputs(context, bundles), "Submission inputs");

  const allowed = new Set([
    ...checksumArtifacts.map(({ name }) => name),
    "bundle-manifest.json",
    "bundle-checksums.json",
    "source-provenance.json",
    "submission-inputs.json",
    "smoke-evidence.json",
    "release-manifest.json",
    "marketplace-submission.md",
    "SHA256SUMS",
    "expected-assets.json",
  ]);
  const unexpected = fs.readdirSync(directory, { withFileTypes: true }).filter(
    (entry) => !entry.isFile() || !allowed.has(entry.name),
  );
  if (unexpected.length > 0) throw new Error(`Unexpected release output: ${unexpected.map((entry) => entry.name).join(", ")}`);

  return { version: context.version, sourceCommit: context.commit, bundleManifest: manifest, bundleChecksums: expectedChecksums };
}

export function parseArgs(argv, definitions) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (!option.startsWith("--") || !(option.slice(2) in definitions)) throw new Error(`Unknown option: ${option}`);
    const name = option.slice(2);
    if (definitions[name].boolean) result[name] = true;
    else {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}`);
      result[name] = value;
      index += 1;
    }
  }
  for (const [name, definition] of Object.entries(definitions)) {
    if (definition.required && !(name in result)) throw new Error(`Missing required option --${name}`);
  }
  return result;
}

export function defaultRepoRoot(moduleUrl) {
  return path.resolve(path.dirname(new URL(moduleUrl).pathname), "../..");
}

export function digestFile(file) {
  return fileDigest(file);
}
