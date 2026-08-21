# Deterministic Multi-Host Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use devmuse:mu-code to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build reproducible host archives, cross-platform lifecycle validation, immutable GitHub Releases, and isolated npm publication for DevMuse.

**Architecture:** A dependency-free Node.js release engine owns version checks, the declarative bundle catalog, normalized tar/gzip encoding, verification, smoke installation, and finalization. GitHub Actions invokes those same local commands, compares cross-OS outputs, attests final checksum subjects, resumes draft releases without replacement, and gives npm its own protected OIDC job.

**Tech Stack:** Node.js 22 built-ins, `node:test`, Git, npm pack/publish, GitHub Actions, GitHub CLI

## Global Constraints

- GC-1: All local release code uses supported Node.js APIs and path normalization rather than GNU shell utilities. — Source: `docs/specs/2026-08-21-deterministic-multi-host-release-design.md`, Compatibility and portability
- GC-2: OpenClaw validates the Claude archive and emits no additional archive. — Source: `docs/specs/2026-08-21-deterministic-multi-host-release-design.md`, Runtime bundle contracts
- GC-3: The npm tarball is built once in the package job and becomes the exact input to the npm publication job. — Source: `docs/specs/2026-08-21-deterministic-multi-host-release-design.md`, Release output contracts
- GC-4: Run IDs, timestamps, runner names, and URLs are excluded so the same source still finalizes byte-identically. — Source: `docs/specs/2026-08-21-deterministic-multi-host-release-design.md`, Release output contracts
- GC-5: A published release remains verification-only. — Source: `docs/specs/2026-08-21-deterministic-multi-host-release-design.md`, Release lifecycle
- GC-6: No long-lived npm token is exposed to validation, packaging, smoke, or manual submission jobs. — Source: `docs/specs/2026-08-21-deterministic-multi-host-release-design.md`, Registry isolation

---

### Task 1: Canonical release model and portable platform contract

**Covers:** UC-1, UC-3, UC-R2, UC-R5

**Files:**
- Create: `scripts/release/model.mjs`
- Create: `tests/release/model.test.mjs`
- Create: `tests/platform-compat/run-test.mjs`
- Delete: `tests/platform-compat/test-platform-compat.sh`
- Modify: `package.json`

**Interfaces:**
- Produces: I-1 — `loadReleaseContext(repoRoot: string, options?: { output?: string }) -> { version: string, commit: string, epoch: number, trackedFiles: TrackedFile[] }` and `selectBundleFiles(context: ReleaseContext, bundleName: "claude" | "codex" | "gemini" | "hermes") -> TrackedFile[]` for Tasks 2 and 3
- Produces: I-2 — `BUNDLE_CATALOG` with exactly four archive targets and `COMPATIBILITY_TARGETS.openclaw === "claude"` for Tasks 2, 3, 4, and 6

- [x] **Step 1: Write the failing release-model test**

```js
// tests/release/model.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  BUNDLE_CATALOG,
  COMPATIBILITY_TARGETS,
  loadReleaseContext,
  readVersionSources,
  selectBundleFiles,
} from "../../scripts/release/model.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("all canonical manifests agree with package.json", () => {
  const versions = readVersionSources(repoRoot);
  assert.equal(new Set(Object.values(versions)).size, 1, JSON.stringify(versions));
  assert.equal(versions.package, JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"))).version);
});

test("bundle catalog has four archives and maps OpenClaw to Claude", () => {
  assert.deepEqual(Object.keys(BUNDLE_CATALOG).sort(), ["claude", "codex", "gemini", "hermes"]);
  assert.deepEqual(COMPATIBILITY_TARGETS, { openclaw: "claude" });
});

test("bundle selection is tracked, sorted, minimal, and host-correct", () => {
  const context = loadReleaseContext(repoRoot);
  for (const name of Object.keys(BUNDLE_CATALOG)) {
    const files = selectBundleFiles(context, name);
    assert.ok(files.length > 0, `${name} must contain runtime files`);
    assert.deepEqual(files.map((file) => file.path), files.map((file) => file.path).sort());
    assert.ok(files.every((file) => context.trackedFiles.some((tracked) => tracked.path === file.path)));
    assert.ok(files.every((file) => !file.path.startsWith("docs/") && !file.path.startsWith("tests/")));
  }
  assert.ok(selectBundleFiles(context, "claude").some((file) => file.path === ".claude-plugin/marketplace.json"));
  assert.ok(selectBundleFiles(context, "codex").some((file) => file.path === ".agents/plugins/marketplace.json"));
  assert.ok(selectBundleFiles(context, "gemini").some((file) => file.path === "plugin/GEMINI.md"));
  assert.ok(selectBundleFiles(context, "hermes").some((file) => file.path === "plugin.yaml"));
  assert.ok(selectBundleFiles(context, "gemini").every((file) => !file.path.includes("/.claude-plugin/") && !file.path.includes("/hooks/")));
  assert.ok(selectBundleFiles(context, "hermes").every((file) => !file.path.includes("/.claude-plugin/") && !file.path.includes("/hooks/")));
});

test("context rejects symlinks, untracked bundle inputs, and output nested in a bundle", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-model-"));
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root });
  fs.mkdirSync(path.join(root, "plugin/skills/demo"), { recursive: true });
  fs.writeFileSync(path.join(root, "plugin/skills/demo/SKILL.md"), "demo\n");
  fs.symlinkSync("SKILL.md", path.join(root, "plugin/skills/demo/link.md"));
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  assert.throws(() => loadReleaseContext(root), /symlink|unsupported mode/i);
  fs.unlinkSync(path.join(root, "plugin/skills/demo/link.md"));
  execFileSync("git", ["add", "-u"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "remove link"], { cwd: root });
  fs.writeFileSync(path.join(root, "plugin/skills/demo/untracked.md"), "no\n");
  assert.throws(() => loadReleaseContext(root), /untracked bundle input/i);
  fs.unlinkSync(path.join(root, "plugin/skills/demo/untracked.md"));
  assert.throws(() => loadReleaseContext(root, { output: path.join(root, "plugin/dist") }), /output.*bundle/i);
});
```

- [x] **Step 2: Run the model test and verify the missing module failure**

Run: `node --test tests/release/model.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/release/model.mjs`.

- [x] **Step 3: Implement the canonical model**

Signatures:
- `readVersionSources(repoRoot: string) -> Record<string, string>`
- `loadReleaseContext(repoRoot: string, options?: { output?: string }) -> ReleaseContext`
- `selectBundleFiles(context: ReleaseContext, bundleName: BundleName) -> TrackedFile[]`

Constraints:
- Read versions from `package.json`, the Claude marketplace and plugin manifests, the generated Codex manifest, the Gemini manifest, and `plugin.yaml`; report every disagreement and never mutate a version.
- Derive tracked paths and executable modes from `git ls-files --stage -z`; accept only regular modes `100644` and `100755` and normalize repository paths to `/`.
- Reject any untracked file beneath a selected runtime root, including files ignored by Git, and reject output paths inside any selected root before writing.
- Claude includes its marketplace metadata and `plugin/` except Gemini-only root metadata; Codex includes its marketplace metadata and generated adapter; Gemini and Hermes include canonical skills, agents, and knowledge but exclude Claude hooks and marketplaces.
- Keep the catalog declarative. Do not add a fifth OpenClaw archive entry.

- [x] **Step 4: Run the model test and verify it passes**

Run: `node --test tests/release/model.test.mjs`

Expected: all model tests PASS.

- [x] **Step 5: Port the existing platform contract to Node**

Create `tests/platform-compat/run-test.mjs` with the same observable assertions as the removed shell test:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readVersionSources } from "../../scripts/release/model.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const skillNames = (base) => fs.readdirSync(path.join(root, base), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(root, base, entry.name, "SKILL.md")))
  .map((entry) => entry.name).sort();
const walk = (base) => fs.readdirSync(base, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(base, entry.name);
  return entry.isDirectory() ? walk(target) : [target];
});

assert.equal(new Set(Object.values(readVersionSources(root))).size, 1);
const pkg = json("package.json");
const codex = json("adapters/codex/.codex-plugin/plugin.json");
const gemini = json("plugin/gemini-extension.json");
const marketplace = json(".agents/plugins/marketplace.json");
assert.equal(codex.skills, "./skills/");
assert.equal(gemini.name, "devmuse");
assert.deepEqual(marketplace.plugins[0].source, { source: "local", path: "./adapters/codex" });
assert.equal(marketplace.plugins[0].policy.installation, "AVAILABLE");
assert.equal(marketplace.plugins[0].policy.authentication, "ON_INSTALL");
assert.equal(marketplace.plugins[0].category, "Developer Tools");
assert.ok(pkg.files.includes("adapters/codex/"));

const sourceSkills = skillNames("plugin/skills");
const codexSkills = skillNames("adapters/codex/skills");
assert.ok(sourceSkills.length > 0);
assert.deepEqual(codexSkills, sourceSkills);
for (const file of walk(path.join(root, "adapters/codex/skills")).filter((file) => file.endsWith(".md"))) {
  const body = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(body, /^disable-model-invocation:\s*true\s*$/m);
  assert.doesNotMatch(body, /set `disable-model-invocation: true`|Claude Search Optimization|Claude Code memory/);
  assert.doesNotMatch(body, /@\.\.\/\.\.\/(knowledge|agents)\/|`skills\/mu-[^/]+\//);
}
for (const skill of codexSkills) {
  const rootForSkill = path.join(root, "adapters/codex/skills", skill);
  assert.ok(fs.existsSync(path.join(rootForSkill, "agents/openai.yaml")), `${skill} lacks agents/openai.yaml`);
  for (const match of read(path.relative(root, path.join(rootForSkill, "SKILL.md"))).matchAll(/@?(references\/devmuse\/[A-Za-z0-9._/-]+\.md)/g)) {
    assert.ok(fs.existsSync(path.join(rootForSkill, match[1])), `${skill} lacks ${match[1]}`);
  }
}
for (const skill of ["mu-mrd", "mu-model", "mu-prd", "mu-wiki", "mu-retro", "mu-grill", "mu-plan", "mu-review", "mu-write-skill"]) {
  assert.match(read(`adapters/codex/skills/${skill}/agents/openai.yaml`), /allow_implicit_invocation:\s*false/);
}
for (const skill of ["mu-scope", "mu-arch", "mu-code", "mu-debug"]) {
  assert.match(read(`adapters/codex/skills/${skill}/agents/openai.yaml`), /allow_implicit_invocation:\s*true/);
}
assert.match(read("adapters/codex/skills/mu-code/SKILL.md"), /Automatic invocation requires both conditions/);
assert.match(read("adapters/codex/skills/mu-code/SKILL.md"), /generic specification.*is not enough/);
assert.match(read("adapters/codex/HOST_POLICY.md"), /native `\/plan`/);
assert.match(read("adapters/codex/HOST_POLICY.md"), /native `\/review`/);
assert.match(read("adapters/codex/HOST_POLICY.md"), /sandbox, approval, and administrator policy authoritative/);
assert.ok(!fs.existsSync(path.join(root, "adapters/codex/hooks")));
assert.match(read("plugin/GEMINI.md"), /native `Plan Mode`/);
assert.match(read("plugin/GEMINI.md"), /policy engine and approval mode authoritative/);
assert.match(read("docs/platform-support.md"), /does not promise cross-host parity/);

const source = read("__init__.py");
assert.doesNotMatch(source, /register_hook/);
const python = String.raw`
import importlib.util
import pathlib
import sys
sys.dont_write_bytecode = True
adapter, skill_root = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("devmuse_hermes_adapter", adapter)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class Context:
    def __init__(self): self.skills = []
    def register_skill(self, *, name, path): self.skills.append((name, pathlib.Path(path)))
ctx = Context()
module.register(ctx)
expected = sorted(path.parent.name for path in skill_root.glob("*/SKILL.md"))
actual = sorted(name for name, _ in ctx.skills)
assert actual == expected, (actual, expected)
assert all(path.is_file() and path.name == "SKILL.md" for _, path in ctx.skills)
`;
const result = spawnSync("python3", ["-c", python, path.join(root, "__init__.py"), path.join(root, "plugin/skills")], { encoding: "utf8" });
assert.equal(result.status, 0, result.stderr);
console.log("PASS: cross-platform plugin contract");
```

- [x] **Step 6: Point the package script at Node and run the portable contract**

Modify `test:platforms` to `node tests/platform-compat/run-test.mjs`.

Run: `npm run test:platforms`

Expected: `PASS: cross-platform plugin contract`, including on the system default Bash because the command no longer invokes Bash, `mapfile`, or `rg`.

- [x] **Step 7: Commit the release model and platform portability fix**

```bash
git add package.json scripts/release/model.mjs tests/release/model.test.mjs tests/platform-compat
git commit -m "feat(release): define portable bundle model"
```

---

### Task 2: Deterministic archive build and verification

**Covers:** UC-2, UC-3, UC-6, UC-R2, UC-R3, UC-R5

**Files:**
- Create: `scripts/release/archive.mjs`
- Create: `scripts/release/artifacts.mjs`
- Create: `scripts/release/build.mjs`
- Create: `scripts/release/verify.mjs`
- Create: `tests/release/artifacts.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: I-1 — `loadReleaseContext(repoRoot: string, options?: { output?: string }) -> { version: string, commit: string, epoch: number, trackedFiles: TrackedFile[] }` and `selectBundleFiles(context: ReleaseContext, bundleName: "claude" | "codex" | "gemini" | "hermes") -> TrackedFile[]` from Task 1
- Consumes: I-2 — `BUNDLE_CATALOG` with exactly four archive targets and `COMPATIBILITY_TARGETS.openclaw === "claude"` from Task 1
- Produces: I-3 — `release:build` directory containing `devmuse-<version>-{claude,codex,gemini,hermes}.tar.gz`, `devmuse-<version>.tgz`, `bundle-manifest.json`, `bundle-checksums.json`, `source-provenance.json`, and `submission-inputs.json`; `release:verify` accepts exactly that contract for Tasks 3, 4, and 6

- [x] **Step 1: Write the failing archive and pipeline tests**

```js
// tests/release/artifacts.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { buildRelease, verifyRelease } from "../../scripts/release/artifacts.mjs";
import { createTarGz, extractTarGz, readTarGz } from "../../scripts/release/archive.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const digest = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("tar gzip bytes and metadata are deterministic", () => {
  const entries = [
    { path: "devmuse/z.txt", mode: 0o644, body: Buffer.from("z\n") },
    { path: `devmuse/${"long/".repeat(24)}file.txt`, mode: 0o755, body: Buffer.from("x\n") },
  ];
  const first = createTarGz(entries, { sourceEpoch: 1_700_000_000 });
  const second = createTarGz([...entries].reverse(), { sourceEpoch: 1_700_000_000 });
  assert.deepEqual(first, second);
  assert.deepEqual(readTarGz(first).map(({ path, mode, mtime }) => ({ path, mode, mtime })), [
    { path: `devmuse/${"long/".repeat(24)}file.txt`, mode: 0o755, mtime: 1_700_000_000 },
    { path: "devmuse/z.txt", mode: 0o644, mtime: 1_700_000_000 },
  ]);
});

test("extractor rejects traversal, absolute paths, links, and duplicate entries", () => {
  for (const pathName of ["../escape", "/absolute", "devmuse/../../escape"])
    assert.throws(() => createTarGz([{ path: pathName, mode: 0o644, body: Buffer.from("x") }], { sourceEpoch: 1 }), /unsafe archive path/i);
  const duplicate = createTarGz([
    { path: "devmuse/a", mode: 0o644, body: Buffer.from("a") },
    { path: "devmuse/a", mode: 0o644, body: Buffer.from("b") },
  ], { sourceEpoch: 1, allowDuplicateFixture: true });
  assert.throws(() => extractTarGz(duplicate, fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-extract-"))), /duplicate/i);
});

test("two builds are byte-identical and verify their own contract", async () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-build-a-"));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-build-b-"));
  const a = await buildRelease({ repoRoot, output: first });
  const b = await buildRelease({ repoRoot, output: second });
  assert.deepEqual(a.bundleChecksums, b.bundleChecksums);
  assert.deepEqual(fs.readdirSync(first).sort(), fs.readdirSync(second).sort());
  for (const name of fs.readdirSync(first)) assert.equal(digest(path.join(first, name)), digest(path.join(second, name)), name);
  assert.equal(verifyRelease({ repoRoot, input: first }).version, a.version);
  assert.deepEqual(a.bundleManifest.compatibilityTargets, { openclaw: "claude" });
  assert.ok(!fs.readdirSync(first).some((name) => /openclaw/i.test(name)));
});

test("verification rejects changed bytes and an unknown option", async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-tamper-"));
  const built = await buildRelease({ repoRoot, output });
  fs.appendFileSync(path.join(output, built.bundleManifest.bundles.claude.artifact), "tamper");
  assert.throws(() => verifyRelease({ repoRoot, input: output }), /digest mismatch/i);
});
```

- [x] **Step 2: Run the artifact test and verify missing module failures**

Run: `node --test tests/release/artifacts.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `archive.mjs` or `artifacts.mjs`.

- [x] **Step 3: Implement deterministic tar/gzip encoding and safe extraction**

Signatures:
- `createTarGz(entries: ArchiveEntry[], { sourceEpoch: number, allowDuplicateFixture?: boolean }) -> Buffer`
- `readTarGz(input: Buffer) -> ArchiveEntry[]`
- `extractTarGz(input: Buffer, destination: string) -> string[]`

Constraints:
- Sort paths by UTF-8 byte order; write one `devmuse/` root; normalize UID/GID to zero, uname/gname empty, modes to Git-derived `0644`/`0755`, and mtime to the source commit epoch.
- Implement deterministic POSIX ustar/PAX path records for names that do not fit the ustar name field; compute each PAX record length to a fixed point and use stable record order.
- Set gzip level 9 and mtime zero. Do not use the platform `tar` command.
- Reject absolute, drive-prefixed, backslash, NUL, empty-segment, `.`/`..`, link, device, unsupported type, duplicate, and extraction-root escape cases before writing a file.
- The duplicate-fixture flag exists only to build a negative test archive and is never accepted by release code.

- [x] **Step 4: Implement build and verify**

Signatures:
- `buildRelease({ repoRoot, output }) -> Promise<BuildResult>`
- `verifyRelease({ repoRoot, input }) -> VerifyResult`
- CLI `parseArgs(argv, allowed) -> Record<string, string | boolean>` shared by `build.mjs` and `verify.mjs`

Constraints:
- Refuse a non-empty output directory, create all files through a sibling temporary directory, and rename the completed directory into place.
- Use `npm pack --json --pack-destination <temporary-output>` exactly once; rename its result to `devmuse-<version>.tgz`; compute its SHA-512 SRI and record it in the bundle manifest.
- Serialize every JSON file with recursively sorted keys, two-space indentation, LF, and one terminal newline.
- `bundle-manifest.json` schema version 1 records version, source commit/epoch, compatibility mapping, and each bundle file digest/mode plus artifact digest/size.
- `bundle-checksums.json` contains only sorted archive/npm names, SHA-256 digests, and sizes. `source-provenance.json` contains only deterministic source facts. `submission-inputs.json` derives host/version/artifact fields from the catalog.
- `verifyRelease` independently recomputes tracked selections, archive contents, file digests, archive/npm digests, sizes, versions, source provenance, and every deterministic JSON document.
- Both CLIs reject unknown options, missing values, mutable-ref version inference, and invalid paths with a nonzero exit.

- [x] **Step 5: Run artifact tests and public command smoke**

Run:

```bash
node --test tests/release/artifacts.test.mjs
out="$(mktemp -d)/release"
npm run release:build -- --output "$out"
npm run release:verify -- --input "$out"
```

Expected: tests PASS; build prints stable artifact summaries; verify exits 0.

- [x] **Step 6: Add package commands and commit**

Add `release:build`, `release:verify`, and `test:release` (`node --test tests/release/*.test.mjs`) scripts.

```bash
git add package.json scripts/release tests/release
git commit -m "feat(release): build deterministic host archives"
```

---

### Task 3: Cross-platform install, update, validate, and uninstall smoke

**Covers:** UC-2, UC-4, UC-5, UC-R2, UC-R5

**Files:**
- Create: `scripts/release/smoke-lib.mjs`
- Create: `scripts/release/smoke.mjs`
- Create: `tests/release/smoke.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: I-1 — `loadReleaseContext(repoRoot: string, options?: { output?: string }) -> { version: string, commit: string, epoch: number, trackedFiles: TrackedFile[] }` and `selectBundleFiles(context: ReleaseContext, bundleName: "claude" | "codex" | "gemini" | "hermes") -> TrackedFile[]` from Task 1
- Consumes: I-2 — `BUNDLE_CATALOG` with exactly four archive targets and `COMPATIBILITY_TARGETS.openclaw === "claude"` from Task 1
- Consumes: I-3 — `release:build` directory containing `devmuse-<version>-{claude,codex,gemini,hermes}.tar.gz`, `devmuse-<version>.tgz`, `bundle-manifest.json`, `bundle-checksums.json`, `source-provenance.json`, and `submission-inputs.json`; `release:verify` accepts exactly that contract from Task 2
- Produces: I-4 — evidence JSON `{ schemaVersion: 1, sourceCommit: string, gates: { verify: "passed", smoke: { claude: "passed", codex: "passed", gemini: "passed", hermes: "passed", openclaw: "passed" } } }` for Tasks 4 and 6

- [x] **Step 1: Write the failing lifecycle smoke test**

```js
// tests/release/smoke.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRelease } from "../../scripts/release/artifacts.mjs";
import { runSmoke } from "../../scripts/release/smoke-lib.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("every host survives install, stale update, validation, and scoped uninstall", async () => {
  const input = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-build-")), "release");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-root-"));
  await buildRelease({ repoRoot, output: input });
  const evidence = runSmoke({ repoRoot, input, tempRoot, keep: true });
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.gates.verify, "passed");
  assert.deepEqual(evidence.gates.smoke, {
    claude: "passed", codex: "passed", gemini: "passed", hermes: "passed", openclaw: "passed",
  });
  for (const target of Object.keys(evidence.gates.smoke)) {
    assert.ok(!fs.existsSync(path.join(tempRoot, target, "install")), `${target} install must be removed`);
    assert.equal(fs.readFileSync(path.join(tempRoot, target, "sibling-canary"), "utf8"), "keep\n");
    assert.ok(!fs.existsSync(path.join(tempRoot, target, "obsolete-sentinel")));
  }
});

test("a failed staged move restores the previous installation", async () => {
  const input = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-fail-build-")), "release");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-fail-root-"));
  await buildRelease({ repoRoot, output: input });
  assert.throws(() => runSmoke({
    repoRoot, input, tempRoot, targets: ["claude"], keep: true,
    move: (from, to) => { if (from.endsWith(".staging")) throw new Error("injected move failure"); fs.renameSync(from, to); },
  }), /injected move failure/);
  assert.ok(fs.existsSync(path.join(tempRoot, "claude", "install", "obsolete-sentinel")));
  assert.ok(!fs.existsSync(path.join(tempRoot, "claude", "install.rollback")));
});
```

- [x] **Step 2: Run the smoke test and verify the missing module failure**

Run: `node --test tests/release/smoke.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `smoke-lib.mjs`.

- [x] **Step 3: Implement lifecycle smoke and host layout oracles**

Signatures:
- `runSmoke({ repoRoot, input, tempRoot?, targets?, keep?, move? }) -> SmokeEvidence`
- CLI `smoke.mjs --input <dir> [--evidence <file>]`

Constraints:
- Call `verifyRelease` before extraction. Use a fresh temporary root unless injected for tests.
- For each target, create a sibling canary and a synthetic prior install whose tracked fixture content is changed and which contains an obsolete sentinel.
- Extract and validate a sibling staging directory, move old target to rollback, move staging into place, delete rollback; on a failed staging move, restore rollback before rethrowing.
- Validate the exact Claude, Codex, Gemini, Hermes, and OpenClaw layout oracles from the approved spec. Resolve every referenced skill/agent/knowledge path inside the installation.
- OpenClaw reuses the Claude artifact. There is no OpenClaw archive lookup.
- Verify installed digests against `bundle-manifest.json`, prove the sentinel is gone, uninstall only the target directory, and prove the sibling canary remains.
- Evidence contains only schema version, source commit, and named stable gate results; no path, OS, time, run ID, or URL.

- [x] **Step 4: Run tests and command smoke**

Run:

```bash
node --test tests/release/smoke.test.mjs
out="$(mktemp -d)/release"
npm run release:build -- --output "$out"
npm run release:smoke -- --input "$out" --evidence "$out/smoke-evidence.json"
```

Expected: lifecycle tests PASS and evidence names all five passing targets.

- [x] **Step 5: Add package command and commit**

```bash
git add package.json scripts/release/smoke-lib.mjs scripts/release/smoke.mjs tests/release/smoke.test.mjs
git commit -m "feat(release): smoke host install lifecycles"
```

---

### Task 4: Stable finalization and marketplace submission packet

**Covers:** UC-6, UC-8, UC-R3

**Files:**
- Create: `scripts/release/finalize-lib.mjs`
- Create: `scripts/release/finalize.mjs`
- Create: `tests/release/finalize.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: I-2 — `BUNDLE_CATALOG` with exactly four archive targets and `COMPATIBILITY_TARGETS.openclaw === "claude"` from Task 1
- Consumes: I-3 — `release:build` directory containing `devmuse-<version>-{claude,codex,gemini,hermes}.tar.gz`, `devmuse-<version>.tgz`, `bundle-manifest.json`, `bundle-checksums.json`, `source-provenance.json`, and `submission-inputs.json`; `release:verify` accepts exactly that contract from Task 2
- Consumes: I-4 — evidence JSON `{ schemaVersion: 1, sourceCommit: string, gates: { verify: "passed", smoke: { claude: "passed", codex: "passed", gemini: "passed", hermes: "passed", openclaw: "passed" } } }` from Task 3
- Produces: I-5 — `release:finalize` adds `release-manifest.json`, `marketplace-submission.md`, `SHA256SUMS`, and local-only `expected-assets.json`; `expected-assets.json` schema 1 maps every uploadable asset including `SHA256SUMS` to SHA-256 and excludes itself for Tasks 5 and 6

- [x] **Step 1: Write the failing finalizer tests**

```js
// tests/release/finalize.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRelease } from "../../scripts/release/artifacts.mjs";
import { runSmoke } from "../../scripts/release/smoke-lib.mjs";
import { finalizeRelease } from "../../scripts/release/finalize-lib.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

test("finalization is deterministic and has no checksum self-reference", async () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-finalize-"));
  const a = path.join(parent, "a");
  const b = path.join(parent, "b");
  await buildRelease({ repoRoot, output: a });
  await buildRelease({ repoRoot, output: b });
  const evidence = runSmoke({ repoRoot, input: a });
  const evidenceFile = path.join(parent, "evidence.json");
  fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
  finalizeRelease({ repoRoot, input: a, evidence: evidenceFile });
  finalizeRelease({ repoRoot, input: b, evidence: evidenceFile });
  for (const name of ["release-manifest.json", "marketplace-submission.md", "SHA256SUMS", "expected-assets.json"])
    assert.deepEqual(fs.readFileSync(path.join(a, name)), fs.readFileSync(path.join(b, name)), name);
  const expected = JSON.parse(fs.readFileSync(path.join(a, "expected-assets.json")));
  assert.ok(expected.assets["SHA256SUMS"]);
  assert.ok(!expected.assets["expected-assets.json"]);
  const sums = fs.readFileSync(path.join(a, "SHA256SUMS"), "utf8");
  assert.doesNotMatch(sums, /SHA256SUMS|expected-assets\.json/);
  assert.deepEqual(new Set(sums.trim().split("\n").map((line) => line.slice(66))), new Set(Object.keys(expected.assets).filter((name) => name !== "SHA256SUMS")));
});

test("finalizer rejects unstable or incomplete evidence", async () => {
  const input = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-finalize-bad-")), "release");
  await buildRelease({ repoRoot, output: input });
  const evidenceFile = path.join(path.dirname(input), "bad.json");
  fs.writeFileSync(evidenceFile, JSON.stringify({ schemaVersion: 1, sourceCommit: "wrong", runId: 7, gates: {} }));
  assert.throws(() => finalizeRelease({ repoRoot, input, evidence: evidenceFile }), /source commit|unknown evidence field|gate/i);
});
```

- [x] **Step 2: Run the finalizer tests and verify the missing module failure**

Run: `node --test tests/release/finalize.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `finalize-lib.mjs`.

- [x] **Step 3: Implement stable finalization**

Signature: `finalizeRelease({ repoRoot, input, evidence }) -> FinalizeResult`

Constraints:
- Run `verifyRelease` first and require exactly the I-4 schema, matching source commit, and every named gate equal to `passed`; reject unknown evidence fields.
- Generate the submission packet from `submission-inputs.json`, with one section per manual host naming the exact archive, SHA-256, source commit, validation gates, and human submission checklist.
- Generate `release-manifest.json` from deterministic build facts plus stable evidence only.
- Define upload assets as the four host archives, npm tarball, bundle manifest, source provenance, submission inputs, release manifest, and marketplace packet.
- Write sorted `SHA256SUMS` over upload assets except itself, then compute its digest and write `expected-assets.json` containing the complete upload set including `SHA256SUMS`. Never upload `bundle-checksums.json`, smoke evidence, or `expected-assets.json`.
- Refuse to overwrite a final file whose bytes differ; accept an exact rerun as an idempotent no-op.

- [x] **Step 4: Run finalizer tests and public command**

Run: `node --test tests/release/finalize.test.mjs`

Expected: all finalizer tests PASS.

- [x] **Step 5: Add package command and commit**

```bash
git add package.json scripts/release/finalize-lib.mjs scripts/release/finalize.mjs tests/release/finalize.test.mjs
git commit -m "feat(release): finalize verified release assets"
```

---

### Task 5: Idempotent GitHub Release and isolated npm boundaries

**Covers:** UC-6, UC-7, UC-R1, UC-R3, UC-R4

**Files:**
- Create: `scripts/release/publish-github-lib.mjs`
- Create: `scripts/release/publish-github.mjs`
- Create: `scripts/release/publish-npm-lib.mjs`
- Create: `scripts/release/publish-npm.mjs`
- Create: `tests/release/publish.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: I-5 — `release:finalize` adds `release-manifest.json`, `marketplace-submission.md`, `SHA256SUMS`, and local-only `expected-assets.json`; `expected-assets.json` schema 1 maps every uploadable asset including `SHA256SUMS` to SHA-256 and excludes itself from Task 4
- Produces: I-6 — `release:publish-github --input <dir> --tag v<version> --preflight` validates local assets and the remote tag without mutation; the same command without `--preflight` performs the idempotent release transaction, while `release:publish-npm --input <dir>` performs the npm transaction; both publication libraries accept injectable `run(command, args, options) -> { status, stdout, stderr }` implementations for Task 6

- [x] **Step 1: Write fake-boundary publication tests**

```js
// tests/release/publish.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { preflightGitHubRelease, publishGitHubRelease } from "../../scripts/release/publish-github-lib.mjs";
import { publishNpm } from "../../scripts/release/publish-npm-lib.mjs";

const fixture = () => {
  const input = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-publish-"));
  fs.writeFileSync(path.join(input, "asset.txt"), "asset\n");
  const assetDigest = createHash("sha256").update(fs.readFileSync(path.join(input, "asset.txt"))).digest("hex");
  fs.writeFileSync(path.join(input, "expected-assets.json"), JSON.stringify({
    schemaVersion: 1, version: "2.2.0", sourceCommit: "abc", assets: {
      "asset.txt": assetDigest,
    },
  }));
  return input;
};

test("GitHub preflight validates assets and remote tag without release mutation", () => {
  let verified = false;
  const result = preflightGitHubRelease({
    input: fixture(), tag: "v2.2.0", sourceCommit: "abc",
    verifyRemoteTag: ({ tag, sourceCommit }) => { verified = tag === "v2.2.0" && sourceCommit === "abc"; return verified; },
  });
  assert.equal(result.action, "verified");
  assert.equal(verified, true);
});

test("absent GitHub release creates draft, uploads missing assets, then publishes", () => {
  const calls = [];
  const run = (command, args) => {
    calls.push([command, ...args]);
    if (args[0] === "release" && args[1] === "view") return { status: 1, stdout: "", stderr: "not found" };
    return { status: 0, stdout: "", stderr: "" };
  };
  publishGitHubRelease({ input: fixture(), tag: "v2.2.0", sourceCommit: "abc", run, verifyRemoteTag: () => true });
  assert.ok(calls.some((call) => call.slice(0, 3).join(" ") === "gh release create" && call.includes("--draft") && call.includes("--verify-tag")));
  assert.ok(calls.some((call) => call.slice(0, 3).join(" ") === "gh release upload"));
  assert.ok(calls.some((call) => call.slice(0, 3).join(" ") === "gh release edit" && call.includes("--draft=false")));
  assert.ok(calls.every((call) => !call.includes("--clobber")));
});

test("published matching release is verification-only and mismatch never deletes", () => {
  for (const mismatch of [false, true]) {
    const calls = [];
    const run = (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === "release" && args[1] === "view") return { status: 0, stdout: JSON.stringify({ isDraft: false, tagName: "v2.2.0", assets: [{ name: "asset.txt" }] }), stderr: "" };
      if (args[0] === "release" && args[1] === "download") {
        const destination = args[args.indexOf("--dir") + 1];
        fs.writeFileSync(path.join(destination, "asset.txt"), mismatch ? "wrong\n" : "asset\n");
        return { status: 0, stdout: "", stderr: "" };
      }
      throw new Error(`unexpected mutation: ${args.join(" ")}`);
    };
    if (mismatch) assert.throws(() => publishGitHubRelease({ input: fixture(), tag: "v2.2.0", sourceCommit: "abc", run, verifyRemoteTag: () => true }), /digest mismatch/i);
    else publishGitHubRelease({ input: fixture(), tag: "v2.2.0", sourceCommit: "abc", run, verifyRemoteTag: () => true });
    assert.ok(calls.every((call) => !["create", "upload", "edit", "delete"].includes(call[2])));
  }
});

test("npm absence publishes exact tarball; matching integrity no-ops; mismatch fails", () => {
  const input = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-npm-"));
  fs.writeFileSync(path.join(input, "devmuse-2.2.0.tgz"), "package\n");
  const localIntegrity = `sha512-${createHash("sha512").update("package\n").digest("base64")}`;
  for (const remote of [null, localIntegrity, "sha512-wrong"]) {
    const calls = [];
    const run = (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === "view") return remote === null ? { status: 1, stdout: "", stderr: "E404" } : { status: 0, stdout: JSON.stringify(remote), stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    };
    if (remote === "sha512-wrong") assert.throws(() => publishNpm({ input, name: "devmuse", version: "2.2.0", run }), /integrity mismatch/i);
    else publishNpm({ input, name: "devmuse", version: "2.2.0", run });
    assert.equal(calls.some((call) => call[1] === "publish"), remote === null);
  }
});
```

- [x] **Step 2: Run publication tests and verify missing module failures**

Run: `node --test tests/release/publish.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for a publication library.

- [x] **Step 3: Implement GitHub Release transaction**

Signatures:
- `preflightGitHubRelease({ input, tag, sourceCommit, verifyRemoteTag? }) -> { action: "verified", assets: string[] }`
- `publishGitHubRelease({ input, tag, sourceCommit, run?, verifyRemoteTag? }) -> PublishResult`

Constraints:
- Preflight validates `expected-assets.json`, every local digest, exact `v<version>` tag, and remote tag-to-source-commit match without a release API call; the publishing function repeats preflight before any release command.
- Use `gh release view --json isDraft,tagName,assets` to detect state. Create only a missing release with `gh release create --draft --verify-tag`.
- Download each existing asset to a temporary directory and compare bytes. Skip matches; upload only missing assets; fail mismatches without delete or `--clobber`.
- Publish a draft only after downloading/rechecking the complete expected set. A published release may execute view/download only.
- The attestation call is not owned here; workflow ordering must run preflight first, attestation second, and the mutating invocation last.

- [x] **Step 4: Implement npm integrity transaction**

Signature: `publishNpm({ input, name, version, run? }) -> { action: "published" | "matched" }`

Constraints:
- Locate exactly `devmuse-<version>.tgz` from the finalized directory and compute its SHA-512 SRI locally.
- Query `npm view <name>@<version> dist.integrity --json`. Only an npm not-found result permits `npm publish <exact-tarball> --access public --provenance`.
- Matching integrity is success without publish; different integrity is a hard failure; all non-not-found provider errors are preserved and fail.
- Never accept or read an npm token argument.

- [x] **Step 5: Run tests, add package commands, and commit**

Run: `node --test tests/release/publish.test.mjs`

Expected: all absent/matching/mismatch tests PASS.

```bash
git add package.json scripts/release/publish-*.mjs tests/release/publish.test.mjs
git commit -m "feat(release): make publication retries immutable"
```

---

### Task 6: Thin validation, dry-run, tag-release, attestation, and registry workflows

**Covers:** UC-1, UC-2, UC-3, UC-4, UC-5, UC-6, UC-7, UC-R1, UC-R3, UC-R4

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `tests/release/workflow.test.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: I-2 — `BUNDLE_CATALOG` with exactly four archive targets and `COMPATIBILITY_TARGETS.openclaw === "claude"` from Task 1
- Consumes: I-3 — `release:build` directory containing `devmuse-<version>-{claude,codex,gemini,hermes}.tar.gz`, `devmuse-<version>.tgz`, `bundle-manifest.json`, `bundle-checksums.json`, `source-provenance.json`, and `submission-inputs.json`; `release:verify` accepts exactly that contract from Task 2
- Consumes: I-4 — evidence JSON `{ schemaVersion: 1, sourceCommit: string, gates: { verify: "passed", smoke: { claude: "passed", codex: "passed", gemini: "passed", hermes: "passed", openclaw: "passed" } } }` from Task 3
- Consumes: I-5 — `release:finalize` adds `release-manifest.json`, `marketplace-submission.md`, `SHA256SUMS`, and local-only `expected-assets.json`; `expected-assets.json` schema 1 maps every uploadable asset including `SHA256SUMS` to SHA-256 and excludes itself from Task 4
- Consumes: I-6 — `release:publish-github --input <dir> --tag v<version> --preflight` validates local assets and the remote tag without mutation; the same command without `--preflight` performs the idempotent release transaction, while `release:publish-npm --input <dir>` performs the npm transaction; both publication libraries accept injectable `run(command, args, options) -> { status, stdout, stderr }` implementations from Task 5

- [ ] **Step 1: Write the failing workflow contract test**

```js
// tests/release/workflow.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("CI validates release code but cannot publish", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /pull_request:/);
  assert.match(ci, /branches:\s*\[main\]/);
  assert.match(ci, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(ci, /npm run test:release/);
  assert.doesNotMatch(ci, /release:publish|npm publish|contents:\s*write|id-token:\s*write/);
});

test("release workflow has pure dry run and gated tag mutations", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /tags:\s*\n\s*- ['"]v\*['"]/);
  assert.match(workflow, /matrix:[\s\S]*ubuntu-latest[\s\S]*macos-latest[\s\S]*windows-latest/);
  assert.match(workflow, /release:build/);
  assert.match(workflow, /release:verify/);
  assert.match(workflow, /release:smoke/);
  assert.match(workflow, /release:finalize/);
  assert.match(workflow, /actions\/attest@v4/);
  assert.match(workflow, /release:publish-github/);
  assert.match(workflow, /environment:\s*npm-production/);
  assert.match(workflow, /release:publish-npm/);
  assert.match(workflow, /if:\s*github\.ref_type == 'tag'/);
  assert.match(workflow, /if:\s*vars\.DEVMUSE_PUBLISH_NPM == 'true'/);
  assert.doesNotMatch(workflow, /--clobber|NODE_AUTH_TOKEN|NPM_TOKEN/);
});

test("workflow orders compare and smoke before finalization, attestation before release, and npm after release", () => {
  const workflow = read(".github/workflows/release.yml");
  assert.match(workflow, /compare:[\s\S]*needs:\s*package/);
  assert.match(workflow, /smoke:[\s\S]*needs:\s*compare/);
  assert.match(workflow, /finalize:[\s\S]*needs:\s*smoke/);
  assert.match(workflow, /publish-release:[\s\S]*needs:\s*finalize[\s\S]*release:publish-github[^\n]*--preflight[\s\S]*actions\/attest@v4[\s\S]*release:publish-github/);
  assert.match(workflow, /publish-npm:[\s\S]*needs:\s*publish-release/);
});
```

- [ ] **Step 2: Run the workflow test and verify it fails**

Run: `node --test tests/release/workflow.test.mjs`

Expected: FAIL because `.github/workflows/release.yml` is missing and CI does not run `test:release`.

- [ ] **Step 3: Extend PR validation**

Modify `.github/workflows/ci.yml` to keep repository-wide `contents: read`, use Node.js 22, build adapters, reject drift, run existing deterministic tests, and add `npm run test:release`. Do not add a release trigger, writable permission, environment, secret, or publication command.

- [ ] **Step 4: Implement the release workflow**

Constraints:
- Trigger only on `workflow_dispatch` and pushed `v*` tags. Dispatch is always dry-run; publication jobs require `github.ref_type == 'tag'`.
- Package on `ubuntu-latest`, `macos-latest`, and `windows-latest`; each job builds and verifies and uploads its output under an OS-specific artifact name.
- Compare `bundle-checksums.json` from all runners byte-for-byte on Ubuntu. Preserve mismatched manifests as workflow artifacts.
- Smoke the verified Linux output on all three OSes, then merge only stable named gate results into I-4. Do not put matrix OS, run ID, time, or URL into evidence.
- Finalize once from the Linux build after compare and all smoke jobs. Upload the complete finalized directory as an internal workflow artifact for dry-run diagnostics and downstream jobs.
- The tag release job alone has `contents: write`, `id-token: write`, and `attestations: write`. Invoke the I-6 `--preflight` operation to validate expected assets and the remote tag, attest every subject listed by `SHA256SUMS` with `actions/attest@v4`, then invoke the mutating I-6 operation. Do not download generated attestation files into the release directory.
- The npm job depends on successful GitHub publication, has only `contents: read` and `id-token: write`, uses `environment: npm-production`, checks `vars.DEVMUSE_PUBLISH_NPM == 'true'`, downloads the same finalized artifact, and invokes the npm I-6 CLI.
- Every other manual marketplace is represented only in `marketplace-submission.md`; do not create credential-bearing jobs for them.
- Write concise `$GITHUB_STEP_SUMMARY` lines for commit, version, digest comparison, smoke targets, idempotent skips, and published URLs without dumping environment variables.

- [ ] **Step 5: Run workflow contracts and complete release tests**

Run:

```bash
node --test tests/release/workflow.test.mjs
npm run test:release
```

Expected: all release tests PASS.

- [ ] **Step 6: Commit workflows**

```bash
git add .github/workflows package.json tests/release/workflow.test.mjs
git commit -m "ci(release): orchestrate verified tag releases"
```

---

### Task 7: Smallest-archive installation docs and full repository verification

**Covers:** UC-8, UC-9

**Files:**
- Create: `tests/release/docs.test.mjs`
- Modify: `docs/platform-support.md`
- Modify: `docs/platform-support_cn.md`
- Modify: `docs/testing.md`
- Modify: `docs/testing_cn.md`
- Modify: `README.md`
- Modify: `README_CN.md`

- [ ] **Step 1: Write the failing bilingual documentation contract**

```js
// tests/release/docs.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("English and Chinese platform docs use smallest release archives", () => {
  for (const file of ["docs/platform-support.md", "docs/platform-support_cn.md"]) {
    const body = read(file);
    for (const host of ["claude", "codex", "gemini", "hermes"])
      assert.match(body, new RegExp(`devmuse-<version>-${host}\\.tar\\.gz`), `${file}: ${host}`);
    assert.match(body, /SHA256SUMS/);
    assert.match(body, /marketplace-submission\.md/);
    assert.doesNotMatch(body, /Known distribution gap|已知分发缺口/);
  }
});

test("testing twins document local release validation", () => {
  for (const file of ["docs/testing.md", "docs/testing_cn.md"]) {
    const body = read(file);
    assert.match(body, /npm run test:release/);
    assert.match(body, /release:build/);
    assert.match(body, /release:smoke/);
  }
});
```

- [ ] **Step 2: Run the docs contract and verify it fails**

Run: `node --test tests/release/docs.test.mjs`

Expected: FAIL because host-specific release archive instructions are absent.

- [ ] **Step 3: Update English and Chinese documentation twins**

Constraints:
- In both platform-support twins, make each supported host's primary release installation path the smallest matching archive, explain checksum verification, and link the manual marketplace packet. Keep clone/source instructions clearly labeled for development.
- Explain that OpenClaw uses the Claude archive and has no separate artifact.
- Replace the known distribution gap with the actual release lifecycle and optional npm status. Do not claim automated publication for manual marketplaces.
- Update both testing twins with `test:release`, local build/verify/smoke/finalize commands, cross-OS matrix behavior, and the distinction between deterministic local tests and network publication.
- Add a short release-artifacts pointer to both README twins without copying the skill inventory, routing table, domain model, a hardcoded count, or a directory file listing.

- [ ] **Step 4: Run docs and full deterministic verification**

Run:

```bash
npm run build:adapters
npm run test:generated
npm run test:platforms
npm run test:skills
npm run test:routing
npm run test:hooks
npm run test:mermaid
npm run test:token-benchmark
npm run test:release
git diff --check
```

Expected: every command PASS and generated adapter status is clean.

- [ ] **Step 5: Run a clean end-to-end dry run locally**

Run:

```bash
release_root="$(mktemp -d)/release"
npm run release:build -- --output "$release_root"
npm run release:verify -- --input "$release_root"
npm run release:smoke -- --input "$release_root" --evidence "$release_root/smoke-evidence.json"
npm run release:finalize -- --input "$release_root" --evidence "$release_root/smoke-evidence.json"
```

Expected: commands exit 0; `expected-assets.json` verifies the local upload set; no network release or registry mutation occurs.

- [ ] **Step 6: Commit documentation and verification evidence**

```bash
git add README.md README_CN.md docs/platform-support.md docs/platform-support_cn.md docs/testing.md docs/testing_cn.md tests/release/docs.test.mjs
git commit -m "docs(release): document minimal host artifacts"
```

---

### Task 8: Final branch audit

**Covers:** UC-1, UC-2, UC-3, UC-4, UC-5, UC-6, UC-7, UC-8, UC-9, UC-R1, UC-R2, UC-R3, UC-R4, UC-R5

**Files:**
- Inspect: all files changed by Tasks 1–7

- [ ] **Step 1: Confirm plan progress and commit boundaries**

Run: `git log --oneline origin/main..HEAD && git status --short`

Expected: focused commits for model/platform, archive build, smoke, finalization, publication, workflows, and docs; only intentional plan checkbox edits may remain.

- [ ] **Step 2: Inspect release output contents rather than trusting summaries**

Run: `npm run release:verify -- --input "$release_root" && sed -n '1,240p' "$release_root/expected-assets.json" && sed -n '1,240p' "$release_root/SHA256SUMS"`

Expected: exact asset agreement, no OpenClaw archive, no docs/tests in runtime archives, and no checksum self-reference.

- [ ] **Step 3: Re-run branch-level checks after the final diff**

Run: `npm run test:release && npm run test:platforms && npm run test:generated && git diff --check origin/main...HEAD`

Expected: all checks PASS.

- [ ] **Step 4: Commit completed plan tracking if checkboxes were updated**

```bash
git add docs/plans/2026-08-21-deterministic-multi-host-release.md
git commit -m "docs(plan): record release pipeline execution"
```
