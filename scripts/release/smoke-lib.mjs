import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { extractTarGz } from "./archive.mjs";
import { verifyRelease } from "./artifacts.mjs";

export const INSTALL_LOCATIONS = Object.freeze({
  claude: "claude-marketplace/devmuse",
  codex: "codex-marketplace/devmuse",
  gemini: "gemini-extensions/devmuse",
  hermes: "hermes-plugins/devmuse",
  openclaw: "openclaw-marketplace/devmuse",
});

const TARGETS = Object.freeze(Object.keys(INSTALL_LOCATIONS));
const sha256 = (body) => createHash("sha256").update(body).digest("hex");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(root, entry.name);
    return entry.isDirectory() ? walkFiles(target) : [target];
  });
}

function resolveInside(root, base, relative, label) {
  const target = path.resolve(base, relative);
  const normalizedRoot = path.resolve(root);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`${label} escapes installation: ${relative}`);
  }
  if (!fs.existsSync(target)) throw new Error(`${label} is missing: ${relative}`);
  return target;
}

function validateCanonicalReferences(install, pluginRoot) {
  for (const file of walkFiles(pluginRoot).filter((entry) => entry.endsWith(".md"))) {
    const body = fs.readFileSync(file, "utf8");
    for (const match of body.matchAll(/@((?:\.\.?\/)+(?:agents|knowledge)\/[A-Za-z0-9._/-]+\.md)/g)) {
      resolveInside(install, path.dirname(file), match[1], `Reference in ${path.relative(install, file)}`);
    }
  }
}

function validateCodexReferences(install, adapterRoot) {
  const skillsRoot = path.join(adapterRoot, "skills");
  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillRoot = path.join(skillsRoot, entry.name);
    for (const file of walkFiles(skillRoot).filter((candidate) => candidate.endsWith(".md"))) {
      const body = fs.readFileSync(file, "utf8");
      for (const match of body.matchAll(/@?(references\/devmuse\/[A-Za-z0-9._/-]+\.md)/g)) {
        resolveInside(install, skillRoot, match[1], `Codex reference in ${entry.name}`);
      }
    }
  }
}

function validateManifestFiles(install, bundle) {
  const expected = new Set();
  for (const file of bundle.files) {
    const target = resolveInside(install, install, file.path, `Bundle file ${file.path}`);
    if (!fs.statSync(target).isFile()) throw new Error(`Bundle path is not a file: ${file.path}`);
    const body = fs.readFileSync(target);
    if (body.length !== file.size || sha256(body) !== file.sha256) {
      throw new Error(`Installed digest mismatch: ${file.path}`);
    }
    expected.add(file.path);
  }
  const actual = walkFiles(install).map((file) => path.relative(install, file).split(path.sep).join("/"));
  const extras = actual.filter((file) => !expected.has(file));
  const missing = [...expected].filter((file) => !actual.includes(file));
  if (extras.length > 0 || missing.length > 0) {
    throw new Error(`Installed file set mismatch: extra=${extras.join(",")}; missing=${missing.join(",")}`);
  }
}

function assertAbsent(install, relative) {
  if (fs.existsSync(path.join(install, ...relative.split("/")))) {
    throw new Error(`Host-specific path must be absent: ${relative}`);
  }
}

function validateClaude(install) {
  const marketplace = readJson(path.join(install, ".claude-plugin/marketplace.json"));
  const source = marketplace.plugins?.[0]?.source;
  if (typeof source !== "string") throw new Error("Claude marketplace source is missing");
  const pluginRoot = resolveInside(install, install, source, "Claude marketplace source");
  resolveInside(install, pluginRoot, ".claude-plugin/plugin.json", "Claude plugin manifest");
  for (const directory of ["agents", "knowledge", "rules", "skills", "hooks"]) {
    const target = resolveInside(install, pluginRoot, directory, `Claude ${directory}`);
    if (!fs.statSync(target).isDirectory()) throw new Error(`Claude ${directory} is not a directory`);
  }
  const hooks = readJson(path.join(pluginRoot, "hooks/hooks.json"));
  const hookBody = JSON.stringify(hooks);
  for (const hook of ["session-start", "user-prompt-submit"]) {
    if (!hookBody.includes(hook)) throw new Error(`Claude hook manifest does not reference ${hook}`);
    resolveInside(install, pluginRoot, `hooks/${hook}`, `Claude hook ${hook}`);
  }
  validateCanonicalReferences(install, pluginRoot);
}

function validateCodex(install) {
  const marketplace = readJson(path.join(install, ".agents/plugins/marketplace.json"));
  const source = marketplace.plugins?.[0]?.source?.path;
  if (typeof source !== "string") throw new Error("Codex marketplace source is missing");
  const adapterRoot = resolveInside(install, install, source, "Codex marketplace source");
  const manifest = readJson(path.join(adapterRoot, ".codex-plugin/plugin.json"));
  resolveInside(install, adapterRoot, manifest.skills, "Codex skills root");
  validateCodexReferences(install, adapterRoot);
}

function validateGemini(install) {
  const pluginRoot = resolveInside(install, install, "plugin", "Gemini plugin root");
  const manifest = readJson(path.join(pluginRoot, "gemini-extension.json"));
  resolveInside(install, pluginRoot, manifest.contextFileName, "Gemini context");
  for (const directory of ["agents", "knowledge", "skills"]) {
    resolveInside(install, pluginRoot, directory, `Gemini ${directory}`);
  }
  for (const absent of [".claude-plugin", "hooks", "rules"]) assertAbsent(pluginRoot, absent);
  assertAbsent(install, ".claude-plugin");
  validateCanonicalReferences(install, pluginRoot);
}

function validateHermes(install) {
  resolveInside(install, install, "plugin.yaml", "Hermes manifest");
  const adapter = resolveInside(install, install, "__init__.py", "Hermes adapter");
  const body = fs.readFileSync(adapter, "utf8");
  if (!body.includes('Path(__file__).parent / "plugin" / "skills"')) {
    throw new Error("Hermes adapter does not resolve the canonical skill root");
  }
  const pluginRoot = resolveInside(install, install, "plugin", "Hermes plugin root");
  for (const directory of ["agents", "knowledge", "skills"]) {
    resolveInside(install, pluginRoot, directory, `Hermes ${directory}`);
  }
  for (const absent of [".claude-plugin", "GEMINI.md", "gemini-extension.json", "hooks", "rules"]) {
    assertAbsent(pluginRoot, absent);
  }
  assertAbsent(install, ".agents");
  assertAbsent(install, ".claude-plugin");
  validateCanonicalReferences(install, pluginRoot);
}

function validateLayout(target, install) {
  if (target === "claude" || target === "openclaw") validateClaude(install);
  else if (target === "codex") validateCodex(install);
  else if (target === "gemini") validateGemini(install);
  else if (target === "hermes") validateHermes(install);
  else throw new Error(`Unknown smoke target: ${target}`);
}

function replaceInstallation({ target, staging, rollback, move }) {
  let oldMoved = false;
  try {
    move(target, rollback);
    oldMoved = true;
    move(staging, target);
  } catch (error) {
    if (oldMoved && !fs.existsSync(target) && fs.existsSync(rollback)) move(rollback, target);
    throw error;
  }
  fs.rmSync(rollback, { recursive: true, force: true });
}

function runTarget({ root, target, bundle, archive, move }) {
  const workspace = path.join(root, target);
  const install = path.join(workspace, ...INSTALL_LOCATIONS[target].split("/"));
  const parent = path.dirname(install);
  const staging = `${install}.staging`;
  const rollback = `${install}.rollback`;
  const extraction = `${install}.extract`;
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.mkdirSync(parent, { recursive: true });
  fs.writeFileSync(path.join(parent, "sibling-canary"), "keep\n");

  extractTarGz(fs.readFileSync(archive), extraction);
  fs.renameSync(path.join(extraction, "devmuse"), staging);
  fs.rmSync(extraction, { recursive: true, force: true });
  validateManifestFiles(staging, bundle);
  validateLayout(target, staging);

  fs.cpSync(staging, install, { recursive: true });
  const changed = path.join(install, ...bundle.files[0].path.split("/"));
  fs.writeFileSync(changed, "synthetic previous state\n");
  fs.writeFileSync(path.join(install, ".obsolete-sentinel"), "remove me\n");

  replaceInstallation({ target: install, staging, rollback, move });
  validateManifestFiles(install, bundle);
  validateLayout(target, install);
  if (fs.existsSync(path.join(install, ".obsolete-sentinel"))) {
    throw new Error(`${target} update retained the obsolete sentinel`);
  }

  fs.rmSync(install, { recursive: true });
  if (fs.existsSync(install)) throw new Error(`${target} uninstall retained its installation`);
  if (fs.readFileSync(path.join(parent, "sibling-canary"), "utf8") !== "keep\n") {
    throw new Error(`${target} uninstall changed its sibling canary`);
  }
}

export function runSmoke({
  repoRoot,
  input,
  tempRoot,
  targets = TARGETS,
  keep = false,
  move = fs.renameSync,
} = {}) {
  if (!repoRoot || !input) throw new Error("runSmoke requires repoRoot and input");
  const verified = verifyRelease({ repoRoot, input });
  const rootOwned = !tempRoot;
  const root = tempRoot ? path.resolve(tempRoot) : fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-smoke-"));
  fs.mkdirSync(root, { recursive: true });
  const requested = [...new Set(targets)];
  if (requested.length === 0 || requested.some((target) => !TARGETS.includes(target))) {
    throw new Error(`Unknown or empty smoke target set: ${requested.join(", ")}`);
  }

  const results = {};
  try {
    for (const target of requested) {
      const bundleName = target === "openclaw" ? "claude" : target;
      const bundle = verified.bundleManifest.bundles[bundleName];
      runTarget({
        root,
        target,
        bundle,
        archive: path.join(input, bundle.artifact),
        move,
      });
      results[target] = "passed";
    }
  } finally {
    if (!keep && rootOwned) fs.rmSync(root, { recursive: true, force: true });
  }

  return {
    schemaVersion: 1,
    sourceCommit: verified.sourceCommit,
    gates: { verify: "passed", smoke: results },
  };
}
