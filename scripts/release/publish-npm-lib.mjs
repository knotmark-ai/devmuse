import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const npmName = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const semver = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const integrityPattern = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

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

export function publishNpm({ input, name, version, run = defaultRun } = {}) {
  if (typeof input !== "string" || !npmName.test(name ?? "") || !semver.test(version ?? "")) {
    throw new Error("npm publication requires a valid input, package name, and version");
  }
  const directory = path.resolve(input);
  const artifact = `devmuse-${version}.tgz`;
  const tarball = path.join(directory, artifact);
  const stat = fs.lstatSync(tarball);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`npm artifact is not a regular file: ${artifact}`);
  const integrity = `sha512-${createHash("sha512").update(fs.readFileSync(tarball)).digest("base64")}`;

  const manifestFile = path.join(directory, "bundle-manifest.json");
  if (fs.existsSync(manifestFile)) {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    if (manifest.packageName !== name || manifest.version !== version || manifest.npm?.artifact !== artifact) {
      throw new Error("npm publication arguments do not match the bundle manifest");
    }
    if (manifest.npm.integrity !== integrity) throw new Error("npm tarball integrity does not match the bundle manifest");
  }

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const view = validateRunResult(
    run(npm, ["view", `${name}@${version}`, "dist.integrity", "--json"], {}),
    "npm view",
  );
  if (view.status === 0) {
    let remote;
    try {
      remote = JSON.parse(view.stdout);
    } catch {
      throw new Error("npm integrity response is invalid JSON");
    }
    if (typeof remote !== "string" || !integrityPattern.test(remote)) {
      throw new Error("npm integrity response is missing or invalid");
    }
    if (remote !== integrity) throw new Error(`npm integrity mismatch for ${name}@${version}`);
    return { action: "matched", integrity };
  }
  if (!/\bE404\b/i.test(view.stderr || view.stdout)) {
    throw new Error(`npm view failed: ${view.stderr || view.stdout}`);
  }

  const publish = validateRunResult(
    run(npm, ["publish", tarball, "--access", "public", "--provenance"], {}),
    "npm publish",
  );
  if (publish.status !== 0) throw new Error(`npm publish failed: ${publish.stderr || publish.stdout}`);
  return { action: "published", integrity };
}
