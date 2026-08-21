import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createTarGz, extractTarGz, readTarGz } from "../../scripts/release/archive.mjs";
import { buildRelease, stableJson, verifyRelease } from "../../scripts/release/artifacts.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const digest = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("UC-3: tar gzip bytes and metadata are deterministic", () => {
  const longPath = `devmuse/${"x".repeat(180)}/file.txt`;
  const entries = [
    { path: "devmuse/z.txt", mode: 0o644, body: Buffer.from("z\n") },
    { path: longPath, mode: 0o755, body: Buffer.from("x\n") },
  ];
  const first = createTarGz(entries, { sourceEpoch: 1_700_000_000 });
  const second = createTarGz([...entries].reverse(), { sourceEpoch: 1_700_000_000 });
  assert.deepEqual(first, second);
  assert.deepEqual(
    readTarGz(first).map(({ path: entryPath, mode, mtime }) => ({ path: entryPath, mode, mtime })),
    [
      { path: longPath, mode: 0o755, mtime: 1_700_000_000 },
      { path: "devmuse/z.txt", mode: 0o644, mtime: 1_700_000_000 },
    ],
  );
});

test("UC-R2: archive boundaries reject traversal, absolute paths, links, and duplicates", () => {
  for (const pathName of ["../escape", "/absolute", "C:/absolute", "devmuse/../../escape", "devmuse\\escape"]) {
    assert.throws(
      () => createTarGz([{ path: pathName, mode: 0o644, body: Buffer.from("x") }], { sourceEpoch: 1 }),
      /unsafe archive path/i,
    );
  }

  const duplicate = createTarGz(
    [
      { path: "devmuse/a", mode: 0o644, body: Buffer.from("a") },
      { path: "devmuse/a", mode: 0o644, body: Buffer.from("b") },
    ],
    { sourceEpoch: 1, allowDuplicateFixture: true },
  );
  assert.throws(
    () => extractTarGz(duplicate, fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-extract-"))),
    /duplicate/i,
  );
});

test("UC-2 UC-3 UC-R3 UC-R5: two builds are byte-identical and verify", async () => {
  const first = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-build-a-")), "release");
  const second = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-build-b-")), "release");
  const a = await buildRelease({ repoRoot, output: first });
  const b = await buildRelease({ repoRoot, output: second });
  assert.deepEqual(a.bundleChecksums, b.bundleChecksums);
  assert.deepEqual(fs.readdirSync(first).sort(), fs.readdirSync(second).sort());
  for (const name of fs.readdirSync(first)) {
    assert.equal(digest(path.join(first, name)), digest(path.join(second, name)), name);
  }
  assert.equal(verifyRelease({ repoRoot, input: first }).version, a.version);
  assert.deepEqual(a.bundleManifest.compatibilityTargets, { openclaw: "claude" });
  assert.ok(!fs.readdirSync(first).some((name) => /openclaw/i.test(name)));
});

test("UC-R3: verification rejects changed artifact bytes", async () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-tamper-")), "release");
  const built = await buildRelease({ repoRoot, output });
  const artifact = built.bundleManifest.bundles.claude.artifact;
  fs.appendFileSync(path.join(output, artifact), "tamper");
  assert.throws(() => verifyRelease({ repoRoot, input: output }), /canonical release artifact|digest mismatch/i);
});

test("UC-3: builds from LF and autocrlf checkouts are byte-identical", async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-checkouts-"));
  const checkout = path.join(parent, "autocrlf");
  execFileSync("git", ["clone", "-q", "--no-checkout", "--no-local", repoRoot, checkout]);
  execFileSync("git", ["config", "core.autocrlf", "true"], { cwd: checkout });
  execFileSync("git", ["checkout", "-q", "HEAD"], { cwd: checkout });
  const first = path.join(parent, "lf-release");
  const second = path.join(parent, "crlf-release");
  const a = await buildRelease({ repoRoot, output: first });
  const b = await buildRelease({ repoRoot: checkout, output: second });
  assert.deepEqual(b.bundleChecksums, a.bundleChecksums);
  for (const name of fs.readdirSync(first)) {
    assert.equal(digest(path.join(second, name)), digest(path.join(first, name)), name);
  }
});

test("UC-R3: verification rejects self-consistent host and npm tampering", async () => {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-self-tamper-")), "release");
  await buildRelease({ repoRoot, output });
  const manifestFile = path.join(output, "bundle-manifest.json");
  const checksumsFile = path.join(output, "bundle-checksums.json");
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const checksums = JSON.parse(fs.readFileSync(checksumsFile, "utf8"));

  const artifact = manifest.bundles.claude.artifact;
  const body = fs.readFileSync(path.join(output, artifact));
  body[4] ^= 1;
  fs.writeFileSync(path.join(output, artifact), body);
  manifest.bundles.claude.sha256 = createHash("sha256").update(body).digest("hex");
  const hostRecord = checksums.artifacts.find((record) => record.name === artifact);
  hostRecord.sha256 = manifest.bundles.claude.sha256;
  fs.writeFileSync(manifestFile, stableJson(manifest));
  fs.writeFileSync(checksumsFile, stableJson(checksums));
  assert.throws(() => verifyRelease({ repoRoot, input: output }), /canonical|gzip|archive/i);

  await fs.promises.rm(output, { recursive: true });
  await buildRelease({ repoRoot, output });
  const npmManifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const npmChecksums = JSON.parse(fs.readFileSync(checksumsFile, "utf8"));
  const npmBody = Buffer.from("not an npm package\n");
  fs.writeFileSync(path.join(output, npmManifest.npm.artifact), npmBody);
  npmManifest.npm.sha256 = createHash("sha256").update(npmBody).digest("hex");
  npmManifest.npm.integrity = `sha512-${createHash("sha512").update(npmBody).digest("base64")}`;
  npmManifest.npm.size = npmBody.length;
  const npmRecord = npmChecksums.artifacts.find((record) => record.name === npmManifest.npm.artifact);
  Object.assign(npmRecord, { sha256: npmManifest.npm.sha256, size: npmBody.length });
  fs.writeFileSync(manifestFile, stableJson(npmManifest));
  fs.writeFileSync(checksumsFile, stableJson(npmChecksums));
  assert.throws(() => verifyRelease({ repoRoot, input: output }), /canonical|npm|tarball/i);
});
