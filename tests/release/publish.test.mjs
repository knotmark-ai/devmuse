import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  preflightGitHubRelease,
  publishGitHubRelease,
} from "../../scripts/release/publish-github-lib.mjs";
import { publishNpm } from "../../scripts/release/publish-npm-lib.mjs";

const SOURCE_COMMIT = "a".repeat(40);

function githubFixture() {
  const input = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-publish-"));
  fs.writeFileSync(path.join(input, "asset.txt"), "asset\n");
  const assetDigest = createHash("sha256").update(fs.readFileSync(path.join(input, "asset.txt"))).digest("hex");
  fs.writeFileSync(path.join(input, "expected-assets.json"), JSON.stringify({
    schemaVersion: 1,
    version: "2.2.0",
    sourceCommit: SOURCE_COMMIT,
    assets: { "asset.txt": assetDigest },
  }));
  return input;
}

function fakeGh(initial = null) {
  const state = initial
    ? { exists: true, draft: initial.draft, assets: new Map(Object.entries(initial.assets ?? {})) }
    : { exists: false, draft: false, assets: new Map() };
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args]);
    assert.equal(command, "gh");
    if (args[0] !== "release") throw new Error(`unexpected gh command: ${args.join(" ")}`);
    if (args[1] === "view") {
      if (!state.exists) return { status: 1, stdout: "", stderr: "release not found" };
      return {
        status: 0,
        stdout: JSON.stringify({
          isDraft: state.draft,
          tagName: "v2.2.0",
          assets: [...state.assets.keys()].map((name) => ({ name })),
        }),
        stderr: "",
      };
    }
    if (args[1] === "create") {
      state.exists = true;
      state.draft = true;
      return { status: 0, stdout: "", stderr: "" };
    }
    if (args[1] === "upload") {
      const file = args[3];
      state.assets.set(path.basename(file), fs.readFileSync(file));
      return { status: 0, stdout: "", stderr: "" };
    }
    if (args[1] === "download") {
      const name = args[args.indexOf("--pattern") + 1];
      const destination = args[args.indexOf("--dir") + 1];
      fs.writeFileSync(path.join(destination, name), state.assets.get(name));
      return { status: 0, stdout: "", stderr: "" };
    }
    if (args[1] === "edit") {
      state.draft = false;
      return { status: 0, stdout: "", stderr: "" };
    }
    throw new Error(`unexpected gh command: ${args.join(" ")}`);
  };
  return { calls, run, state };
}

test("UC-6: GitHub preflight validates assets and remote tag without release mutation", () => {
  let verified = false;
  const result = preflightGitHubRelease({
    input: githubFixture(),
    tag: "v2.2.0",
    sourceCommit: SOURCE_COMMIT,
    verifyRemoteTag: ({ tag, sourceCommit }) => {
      verified = tag === "v2.2.0" && sourceCommit === SOURCE_COMMIT;
      return verified;
    },
  });
  assert.equal(result.action, "verified");
  assert.equal(verified, true);
});

test("UC-6 UC-R3: absent release creates a verified draft, uploads missing assets, then publishes", () => {
  const gh = fakeGh();
  const result = publishGitHubRelease({
    input: githubFixture(),
    tag: "v2.2.0",
    sourceCommit: SOURCE_COMMIT,
    run: gh.run,
    verifyRemoteTag: () => true,
  });
  assert.equal(result.action, "published");
  assert.ok(gh.calls.some((call) => call[2] === "create" && call.includes("--draft") && call.includes("--verify-tag")));
  assert.ok(gh.calls.some((call) => call[2] === "upload"));
  assert.ok(gh.calls.some((call) => call[2] === "edit" && call.includes("--draft=false")));
  assert.ok(gh.calls.every((call) => !call.includes("--clobber") && call[2] !== "delete"));
});

test("UC-R3: a partial draft resumes only missing assets", () => {
  const input = githubFixture();
  const matching = fs.readFileSync(path.join(input, "asset.txt"));
  const gh = fakeGh({ draft: true, assets: { "asset.txt": matching } });
  const result = publishGitHubRelease({
    input,
    tag: "v2.2.0",
    sourceCommit: SOURCE_COMMIT,
    run: gh.run,
    verifyRemoteTag: () => true,
  });
  assert.equal(result.action, "published");
  assert.ok(!gh.calls.some((call) => call[2] === "upload"));
  assert.ok(gh.calls.some((call) => call[2] === "edit"));
});

test("UC-R3: published matching release is verification-only and mismatch never deletes", () => {
  for (const body of [Buffer.from("asset\n"), Buffer.from("wrong\n")]) {
    const gh = fakeGh({ draft: false, assets: { "asset.txt": body } });
    const action = () => publishGitHubRelease({
      input: githubFixture(),
      tag: "v2.2.0",
      sourceCommit: SOURCE_COMMIT,
      run: gh.run,
      verifyRemoteTag: () => true,
    });
    if (body.toString() === "wrong\n") assert.throws(action, /digest mismatch/i);
    else assert.equal(action().action, "matched");
    assert.ok(gh.calls.every((call) => !["create", "upload", "edit", "delete"].includes(call[2])));
  }
});

test("UC-7 UC-R3: npm absence publishes exact tarball; matching no-ops; mismatch fails", () => {
  const input = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-npm-"));
  fs.writeFileSync(path.join(input, "devmuse-2.2.0.tgz"), "package\n");
  const localIntegrity = `sha512-${createHash("sha512").update("package\n").digest("base64")}`;
  const mismatchedIntegrity = `sha512-${createHash("sha512").update("wrong\n").digest("base64")}`;
  for (const remote of [null, localIntegrity, mismatchedIntegrity]) {
    const calls = [];
    const run = (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === "view") {
        return remote === null
          ? { status: 1, stdout: "", stderr: "npm error code E404" }
          : { status: 0, stdout: JSON.stringify(remote), stderr: "" };
      }
      return { status: 0, stdout: "", stderr: "" };
    };
    const action = () => publishNpm({ input, name: "devmuse", version: "2.2.0", run });
    if (remote === mismatchedIntegrity) assert.throws(action, /integrity mismatch/i);
    else assert.equal(action().action, remote === null ? "published" : "matched");
    assert.equal(calls.some((call) => call[1] === "publish"), remote === null);
  }
});

test("UC-R3 UC-R4: malformed provider responses fail before mutation", () => {
  const ghCalls = [];
  assert.throws(
    () => publishGitHubRelease({
      input: githubFixture(),
      tag: "v2.2.0",
      sourceCommit: SOURCE_COMMIT,
      verifyRemoteTag: () => true,
      run: (command, args) => {
        ghCalls.push([command, ...args]);
        return { status: 0, stdout: "{}", stderr: "" };
      },
    }),
    /isDraft|tagName|assets/i,
  );
  assert.ok(ghCalls.every((call) => !["create", "upload", "edit"].includes(call[2])));

  const input = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-npm-bad-"));
  fs.writeFileSync(path.join(input, "devmuse-2.2.0.tgz"), "package\n");
  assert.throws(
    () => publishNpm({
      input,
      name: "devmuse",
      version: "2.2.0",
      run: () => ({ status: 0, stdout: "null", stderr: "" }),
    }),
    /integrity response/i,
  );
});
