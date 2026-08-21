import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { createTarGz, readTarGz } from "./archive.mjs";
import {
  BUNDLE_CATALOG,
  COMPATIBILITY_TARGETS,
  loadReleaseContext,
  selectBundleFiles,
} from "./model.mjs";

export const BUILD_SCHEMA_VERSION = 1;

const utf8Sort = (left, right) => Buffer.from(left).compare(Buffer.from(right));
const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const sha512Integrity = (body) => `sha512-${createHash("sha512").update(body).digest("base64")}`;

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

function sourceFileRecords(files) {
  return files.map((file) => {
    const body = fs.readFileSync(file.absolutePath);
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

function packNpm(repoRoot, output, version) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const stdout = execFileSync(
    npm,
    ["pack", "--json", "--pack-destination", output],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const result = JSON.parse(stdout);
  if (!Array.isArray(result) || result.length !== 1 || !result[0]?.filename) {
    throw new Error(`npm pack returned an unexpected result: ${stdout}`);
  }
  const source = path.join(output, result[0].filename);
  const artifact = `devmuse-${version}.tgz`;
  const target = path.join(output, artifact);
  if (path.resolve(source) !== path.resolve(target)) fs.renameSync(source, target);
  const body = fs.readFileSync(target);
  return {
    artifact,
    sha256: sha256(body),
    integrity: sha512Integrity(body),
    size: body.length,
  };
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
    const bundles = {};
    for (const bundleName of Object.keys(BUNDLE_CATALOG)) {
      const files = selectBundleFiles(context, bundleName);
      const archive = `devmuse-${context.version}-${bundleName}.tar.gz`;
      const entries = files.map((file) => ({
        path: `devmuse/${file.path}`,
        mode: file.mode,
        body: fs.readFileSync(file.absolutePath),
      }));
      const body = createTarGz(entries, { sourceEpoch: context.epoch });
      fs.writeFileSync(path.join(temporary, archive), body, { flag: "wx" });
      bundles[bundleName] = {
        artifact: archive,
        sha256: sha256(body),
        size: body.length,
        files: sourceFileRecords(files),
      };
    }

    const npm = packNpm(context.repoRoot, temporary, context.version);
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
    const provenance = {
      schemaVersion: BUILD_SCHEMA_VERSION,
      packageName: "devmuse",
      version: context.version,
      sourceCommit: context.commit,
      sourceEpoch: context.epoch,
    };
    const submissions = submissionInputs(context, bundles);

    writeStableJson(temporary, "bundle-manifest.json", bundleManifest);
    writeStableJson(temporary, "bundle-checksums.json", bundleChecksums);
    writeStableJson(temporary, "source-provenance.json", provenance);
    writeStableJson(temporary, "submission-inputs.json", submissions);

    if (fs.existsSync(target)) fs.rmdirSync(target);
    fs.renameSync(temporary, target);
    return { output: target, version: context.version, bundleManifest, bundleChecksums };
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
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
  const expectedFiles = sourceFileRecords(selected);
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
    if (!entry.body.equals(fs.readFileSync(source.absolutePath))) {
      throw new Error(`${artifact} content mismatch: ${entry.path}`);
    }
  }
  return { artifact, sha256: manifestBundle.sha256, size: manifestBundle.size };
}

export function verifyRelease({ repoRoot, input } = {}) {
  if (!repoRoot || !input) throw new Error("verifyRelease requires repoRoot and input");
  const directory = path.resolve(input);
  const context = loadReleaseContext(repoRoot, { output: directory });
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
      files: sourceFileRecords(selectBundleFiles(context, bundleName)),
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
