import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sha256 = (body) => createHash("sha256").update(body).digest("hex");
const safeAssetName = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const semver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort().join("\0");
  const expected = [...keys].sort().join("\0");
  if (actual !== expected) throw new Error(`${label} fields are invalid`);
}

function loadExpectedAssets(input) {
  const directory = path.resolve(input);
  const contractFile = path.join(directory, "expected-assets.json");
  const contract = JSON.parse(fs.readFileSync(contractFile, "utf8"));
  exactKeys(contract, ["schemaVersion", "version", "sourceCommit", "assets"], "Expected assets contract");
  if (contract.schemaVersion !== 1) throw new Error(`Unsupported expected assets schema: ${contract.schemaVersion}`);
  if (typeof contract.version !== "string" || !semver.test(contract.version)) {
    throw new Error(`Expected assets version is invalid: ${contract.version}`);
  }
  if (typeof contract.sourceCommit !== "string" || !/^[0-9a-f]{40,64}$/.test(contract.sourceCommit)) {
    throw new Error(`Expected assets source commit is invalid: ${contract.sourceCommit}`);
  }
  if (!contract.assets || typeof contract.assets !== "object" || Array.isArray(contract.assets)) {
    throw new Error("Expected assets map is invalid");
  }
  const names = Object.keys(contract.assets).sort();
  if (names.length === 0) throw new Error("Expected assets map is empty");
  for (const name of names) {
    if (!safeAssetName.test(name) || name === "expected-assets.json") throw new Error(`Expected asset name is invalid: ${name}`);
    const digest = contract.assets[name];
    if (typeof digest !== "string" || !/^[0-9a-f]{64}$/.test(digest)) {
      throw new Error(`Expected digest is invalid for ${name}`);
    }
    const file = path.join(directory, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Expected asset is not a regular file: ${name}`);
    const actual = sha256(fs.readFileSync(file));
    if (actual !== digest) throw new Error(`Local asset digest mismatch for ${name}: expected ${digest}, got ${actual}`);
  }
  return { contract, directory, names };
}

function defaultRun(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw new Error(`Cannot run ${command}: ${result.error.message}`);
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function validateRunResult(result, label) {
  if (
    !result
    || typeof result !== "object"
    || !Number.isInteger(result.status)
    || typeof result.stdout !== "string"
    || typeof result.stderr !== "string"
  ) throw new Error(`${label} returned an invalid process result`);
  return result;
}

function checked(run, command, args, label) {
  const result = validateRunResult(run(command, args, {}), label);
  if (result.status !== 0) throw new Error(`${label} failed: ${result.stderr || result.stdout}`);
  return result;
}

function defaultVerifyRemoteTag({ tag, sourceCommit }) {
  const result = validateRunResult(
    defaultRun("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`]),
    "Remote tag lookup",
  );
  if (result.status !== 0) throw new Error(`Remote tag lookup failed: ${result.stderr || result.stdout}`);
  const references = result.stdout.trim().split("\n").filter(Boolean).map((line) => {
    const [objectId, reference] = line.split("\t");
    if (!/^[0-9a-f]{40,64}$/.test(objectId ?? "") || !reference) {
      throw new Error(`Remote tag lookup returned an invalid line: ${line}`);
    }
    return { objectId, reference };
  });
  const peeled = references.find(({ reference }) => reference === `refs/tags/${tag}^{}`);
  const direct = references.find(({ reference }) => reference === `refs/tags/${tag}`);
  const objectId = peeled?.objectId ?? direct?.objectId;
  if (!objectId) throw new Error(`Remote tag does not exist: ${tag}`);
  return objectId === sourceCommit;
}

export function preflightGitHubRelease({
  input,
  tag,
  sourceCommit,
  verifyRemoteTag = defaultVerifyRemoteTag,
} = {}) {
  if (!input || !tag || !sourceCommit) throw new Error("GitHub release preflight requires input, tag, and sourceCommit");
  const expected = loadExpectedAssets(input);
  if (sourceCommit !== expected.contract.sourceCommit) {
    throw new Error(`Source commit mismatch: ${sourceCommit} != ${expected.contract.sourceCommit}`);
  }
  const expectedTag = `v${expected.contract.version}`;
  if (tag !== expectedTag) throw new Error(`Release tag mismatch: ${tag} != ${expectedTag}`);
  const remoteResult = verifyRemoteTag({ tag, sourceCommit });
  if (remoteResult !== true && remoteResult !== sourceCommit) {
    throw new Error(`Remote tag ${tag} does not resolve to ${sourceCommit}`);
  }
  return { action: "verified", assets: expected.names, contract: expected.contract, directory: expected.directory };
}

function viewRelease(run, tag) {
  const result = validateRunResult(
    run("gh", ["release", "view", tag, "--json", "isDraft,tagName,assets"], {}),
    "GitHub release view",
  );
  if (result.status !== 0) {
    if (/release.*not found|not found.*release/i.test(result.stderr || result.stdout)) return null;
    throw new Error(`GitHub release view failed: ${result.stderr || result.stdout}`);
  }
  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error("GitHub release view returned invalid JSON");
  }
  if (
    !payload
    || typeof payload.isDraft !== "boolean"
    || typeof payload.tagName !== "string"
    || !Array.isArray(payload.assets)
  ) throw new Error("GitHub release view is missing isDraft, tagName, or assets");
  if (payload.tagName !== tag) throw new Error(`GitHub release tag mismatch: ${payload.tagName} != ${tag}`);
  const assets = payload.assets.map((asset) => {
    if (!asset || typeof asset.name !== "string" || !safeAssetName.test(asset.name)) {
      throw new Error("GitHub release asset has an invalid name");
    }
    return asset.name;
  });
  if (new Set(assets).size !== assets.length) throw new Error("GitHub release returned duplicate assets");
  return { isDraft: payload.isDraft, assets };
}

function verifyRemoteAsset(run, tag, directory, name, expectedDigest) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-gh-asset-"));
  try {
    checked(
      run,
      "gh",
      ["release", "download", tag, "--pattern", name, "--dir", temporary],
      `GitHub release download ${name}`,
    );
    const files = fs.readdirSync(temporary, { withFileTypes: true });
    if (files.length !== 1 || files[0].name !== name || !files[0].isFile()) {
      throw new Error(`GitHub release download returned an invalid file set for ${name}`);
    }
    const digest = sha256(fs.readFileSync(path.join(temporary, name)));
    if (digest !== expectedDigest) {
      throw new Error(`GitHub release asset digest mismatch for ${name}: expected ${expectedDigest}, got ${digest}`);
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function verifyReleaseAssets(run, tag, state, preflight, { allowMissing }) {
  const expectedNames = new Set(preflight.assets);
  const unexpected = state.assets.filter((name) => !expectedNames.has(name));
  if (unexpected.length > 0) throw new Error(`GitHub release has unexpected assets: ${unexpected.join(", ")}`);
  for (const name of state.assets) {
    verifyRemoteAsset(run, tag, preflight.directory, name, preflight.contract.assets[name]);
  }
  const missing = preflight.assets.filter((name) => !state.assets.includes(name));
  if (!allowMissing && missing.length > 0) throw new Error(`GitHub release is missing assets: ${missing.join(", ")}`);
  return missing;
}

export function publishGitHubRelease({
  input,
  tag,
  sourceCommit,
  run = defaultRun,
  verifyRemoteTag = defaultVerifyRemoteTag,
} = {}) {
  const preflight = preflightGitHubRelease({ input, tag, sourceCommit, verifyRemoteTag });
  let state = viewRelease(run, tag);
  if (state && !state.isDraft) {
    verifyReleaseAssets(run, tag, state, preflight, { allowMissing: false });
    return { action: "matched", assets: preflight.assets };
  }
  if (!state) {
    checked(
      run,
      "gh",
      [
        "release",
        "create",
        tag,
        "--draft",
        "--verify-tag",
        "--title",
        `DevMuse ${preflight.contract.version}`,
        "--notes",
        `Verified DevMuse ${preflight.contract.version} release artifacts.`,
      ],
      "GitHub release draft creation",
    );
    state = { isDraft: true, assets: [] };
  }

  const missing = verifyReleaseAssets(run, tag, state, preflight, { allowMissing: true });
  for (const name of missing) {
    checked(
      run,
      "gh",
      ["release", "upload", tag, path.join(preflight.directory, name)],
      `GitHub release upload ${name}`,
    );
  }
  const complete = viewRelease(run, tag);
  if (!complete || !complete.isDraft) throw new Error("GitHub draft disappeared or was published during upload");
  verifyReleaseAssets(run, tag, complete, preflight, { allowMissing: false });
  checked(run, "gh", ["release", "edit", tag, "--draft=false"], "GitHub release publication");
  return { action: "published", assets: preflight.assets };
}
