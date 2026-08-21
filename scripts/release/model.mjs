import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const utf8Sort = (left, right) => Buffer.from(left).compare(Buffer.from(right));
const trackedBlobCache = new WeakMap();

const runtimeRoots = [
  ".agents/plugins/marketplace.json",
  ".claude-plugin/marketplace.json",
  "__init__.py",
  "adapters/codex",
  "plugin",
  "plugin.yaml",
];

export const BUNDLE_CATALOG = Object.freeze({
  claude: Object.freeze({
    label: "Claude Code",
    include: Object.freeze([
      Object.freeze({ exact: ".claude-plugin/marketplace.json" }),
      Object.freeze({ prefix: "plugin/", exclude: Object.freeze(["plugin/GEMINI.md", "plugin/gemini-extension.json"]) }),
    ]),
  }),
  codex: Object.freeze({
    label: "Codex",
    include: Object.freeze([
      Object.freeze({ exact: ".agents/plugins/marketplace.json" }),
      Object.freeze({ prefix: "adapters/codex/" }),
    ]),
  }),
  gemini: Object.freeze({
    label: "Gemini CLI",
    include: Object.freeze([
      Object.freeze({ exact: "plugin/GEMINI.md" }),
      Object.freeze({ exact: "plugin/gemini-extension.json" }),
      Object.freeze({ prefix: "plugin/agents/" }),
      Object.freeze({ prefix: "plugin/knowledge/" }),
      Object.freeze({ prefix: "plugin/skills/" }),
    ]),
  }),
  hermes: Object.freeze({
    label: "Hermes Agent",
    include: Object.freeze([
      Object.freeze({ exact: "__init__.py" }),
      Object.freeze({ exact: "plugin.yaml" }),
      Object.freeze({ prefix: "plugin/agents/" }),
      Object.freeze({ prefix: "plugin/knowledge/" }),
      Object.freeze({ prefix: "plugin/skills/" }),
    ]),
  }),
});

export const COMPATIBILITY_TARGETS = Object.freeze({ openclaw: "claude" });

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readHermesVersion(file) {
  const body = fs.readFileSync(file, "utf8");
  const version = body.match(/^version:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1];
  if (!version) throw new Error(`Hermes manifest has no version: ${file}`);
  return version;
}

export function readVersionSources(repoRoot) {
  const root = path.resolve(repoRoot);
  return {
    package: readJson(path.join(root, "package.json")).version,
    claudeMarketplace: readJson(path.join(root, ".claude-plugin/marketplace.json")).plugins?.[0]?.version,
    claudePlugin: readJson(path.join(root, "plugin/.claude-plugin/plugin.json")).version,
    codexPlugin: readJson(path.join(root, "adapters/codex/.codex-plugin/plugin.json")).version,
    geminiExtension: readJson(path.join(root, "plugin/gemini-extension.json")).version,
    hermesPlugin: readHermesVersion(path.join(root, "plugin.yaml")),
  };
}

export function assertVersionConsistency(repoRoot) {
  const versions = readVersionSources(repoRoot);
  const expected = versions.package;
  const disagreements = Object.entries(versions).filter(([, version]) => version !== expected);
  if (!expected || disagreements.length > 0) {
    const details = Object.entries(versions).map(([name, version]) => `${name}=${version ?? "<missing>"}`).join(", ");
    throw new Error(`Release version mismatch: ${details}`);
  }
  return { version: expected, versions };
}

function git(repoRoot, args, encoding = "utf8") {
  return execFileSync("git", args, { cwd: repoRoot, encoding });
}

function splitNull(buffer) {
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function trackedFiles(repoRoot) {
  const records = splitNull(git(repoRoot, ["ls-files", "--stage", "-z"], "buffer"));
  return records.map((record) => {
    const separator = record.indexOf("\t");
    if (separator < 0) throw new Error(`Unexpected git index record: ${record}`);
    const [mode, objectId, stage] = record.slice(0, separator).split(" ");
    const filePath = record.slice(separator + 1).replaceAll("\\", "/");
    if (stage !== "0") throw new Error(`Unmerged bundle input is unsupported: ${filePath}`);
    if (mode === "120000") throw new Error(`Symlink bundle input is unsupported: ${filePath}`);
    if (mode !== "100644" && mode !== "100755") {
      throw new Error(`Unsupported mode ${mode} for bundle input: ${filePath}`);
    }
    return Object.freeze({
      path: filePath,
      absolutePath: path.join(repoRoot, ...filePath.split("/")),
      objectId,
      mode: mode === "100755" ? 0o755 : 0o644,
    });
  }).sort((left, right) => utf8Sort(left.path, right.path));
}

function matchesRule(filePath, rule) {
  if (rule.exact) return filePath === rule.exact;
  if (!filePath.startsWith(rule.prefix)) return false;
  return !(rule.exclude ?? []).includes(filePath);
}

function matchesBundle(filePath, definition) {
  return definition.include.some((rule) => matchesRule(filePath, rule));
}

function isRuntimePath(filePath) {
  return Object.values(BUNDLE_CATALOG).some((definition) => matchesBundle(filePath, definition));
}

function isNpmMetadataPath(filePath) {
  if (filePath === "package.json") return true;
  if (filePath.includes("/")) return false;
  return /^(?:readme|licen[sc]e)(?:\..*)?$/i.test(filePath);
}

function isReleaseInput(filePath) {
  return isRuntimePath(filePath) || isNpmMetadataPath(filePath);
}

function rejectNestedOutput(repoRoot, output) {
  if (!output) return;
  const relative = path.relative(repoRoot, path.resolve(output)).replaceAll("\\", "/");
  if (relative === "" || relative === ".") throw new Error("Release output cannot be the repository root or a source bundle");
  if (relative.startsWith("../") || path.isAbsolute(relative)) return;
  const nested = runtimeRoots.some((root) => relative === root || relative.startsWith(`${root}/`));
  if (nested) throw new Error(`Release output is inside a source bundle: ${relative}`);
}

function rejectDirtyCheckout(repoRoot, output) {
  const modified = splitNull(git(repoRoot, ["diff", "HEAD", "--name-only", "-z"], "buffer"));
  const untracked = splitNull(git(repoRoot, ["ls-files", "--others", "--exclude-standard", "-z"], "buffer"));
  const ignored = splitNull(
    git(repoRoot, ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"], "buffer"),
  );
  const normalizedModified = modified.map((file) => file.replaceAll("\\", "/")).sort(utf8Sort);
  const dirtyReleaseInputs = normalizedModified.filter(isReleaseInput);
  if (dirtyReleaseInputs.length > 0) {
    throw new Error(`Modified release input must be committed: ${dirtyReleaseInputs.join(", ")}`);
  }
  if (normalizedModified.length > 0) {
    throw new Error(`Modified checkout input must be committed: ${normalizedModified.join(", ")}`);
  }

  let outputRelative = null;
  if (output) {
    const relative = path.relative(repoRoot, path.resolve(output)).replaceAll("\\", "/");
    if (relative && !relative.startsWith("../") && !path.isAbsolute(relative)) outputRelative = relative;
  }
  const outsideOutput = (file) => !outputRelative || (file !== outputRelative && !file.startsWith(`${outputRelative}/`));
  const normalizedUntracked = [...new Set(untracked.map((file) => file.replaceAll("\\", "/")))].filter(outsideOutput);
  const bundleInputs = normalizedUntracked.filter(isRuntimePath).sort(utf8Sort);
  if (bundleInputs.length > 0) {
    throw new Error(`Untracked bundle input must be removed or committed: ${bundleInputs.join(", ")}`);
  }
  const metadataInputs = normalizedUntracked.filter(isNpmMetadataPath).sort(utf8Sort);
  if (metadataInputs.length > 0) {
    throw new Error(`Untracked release input must be removed or committed: ${metadataInputs.join(", ")}`);
  }
  if (normalizedUntracked.length > 0) {
    throw new Error(`Untracked checkout input must be removed or committed: ${normalizedUntracked.sort(utf8Sort).join(", ")}`);
  }

  const ignoredBundleInputs = [...new Set(ignored.map((file) => file.replaceAll("\\", "/")))]
    .filter(outsideOutput)
    .filter(isReleaseInput)
    .sort(utf8Sort);
  if (ignoredBundleInputs.length > 0) {
    throw new Error(`Ignored release input must be removed or committed: ${ignoredBundleInputs.join(", ")}`);
  }
}

export function loadReleaseContext(repoRoot, options = {}) {
  const root = path.resolve(repoRoot);
  rejectNestedOutput(root, options.output);
  const files = trackedFiles(root);
  rejectDirtyCheckout(root, options.output);
  const { version, versions } = assertVersionConsistency(root);
  const commit = git(root, ["rev-parse", "HEAD"]).trim();
  const epoch = Number(git(root, ["show", "-s", "--format=%ct", commit]).trim());
  if (!/^[0-9a-f]{40,64}$/.test(commit) || !Number.isSafeInteger(epoch) || epoch < 0) {
    throw new Error(`Invalid source facts from Git: commit=${commit}, epoch=${epoch}`);
  }
  return Object.freeze({ repoRoot: root, version, versions, commit, epoch, trackedFiles: Object.freeze(files) });
}

export function selectBundleFiles(context, bundleName) {
  const definition = BUNDLE_CATALOG[bundleName];
  if (!definition) throw new Error(`Unknown release bundle: ${bundleName}`);
  return context.trackedFiles.filter((file) => matchesBundle(file.path, definition));
}

export function readTrackedFile(context, file) {
  if (!context?.repoRoot || !file?.objectId || !context.trackedFiles.includes(file)) {
    throw new Error("Tracked release file does not belong to this context");
  }
  let blobs = trackedBlobCache.get(context);
  if (!blobs) {
    const objectIds = [...new Set(context.trackedFiles.map((tracked) => tracked.objectId))];
    const output = execFileSync("git", ["cat-file", "--batch"], {
      cwd: context.repoRoot,
      input: `${objectIds.join("\n")}\n`,
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    });
    blobs = new Map();
    let offset = 0;
    for (const objectId of objectIds) {
      const newline = output.indexOf(0x0a, offset);
      if (newline < 0) throw new Error(`Git omitted blob header for ${objectId}`);
      const header = output.subarray(offset, newline).toString("ascii").split(" ");
      const size = Number(header[2]);
      if (header[0] !== objectId || header[1] !== "blob" || !Number.isSafeInteger(size) || size < 0) {
        throw new Error(`Git returned an invalid blob header for ${objectId}`);
      }
      const start = newline + 1;
      const end = start + size;
      if (end >= output.length || output[end] !== 0x0a) throw new Error(`Git returned a truncated blob for ${objectId}`);
      blobs.set(objectId, Buffer.from(output.subarray(start, end)));
      offset = end + 1;
    }
    if (offset !== output.length) throw new Error("Git returned unexpected trailing blob data");
    trackedBlobCache.set(context, blobs);
  }
  const body = blobs.get(file.objectId);
  if (!body) throw new Error(`Tracked blob is unavailable: ${file.path}`);
  return Buffer.from(body);
}
