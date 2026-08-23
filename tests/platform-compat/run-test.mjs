#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { readVersionSources } from "../../scripts/release/model.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function skillNames(relativeRoot) {
  return fs.readdirSync(path.join(root, relativeRoot), { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory()
        && fs.existsSync(path.join(root, relativeRoot, entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort();
}

function assertPackagedReference(skill, skillRoot, file, reference, target) {
  const packagedPath = path.relative(skillRoot, target);
  assert.ok(
    packagedPath !== ".."
      && !packagedPath.startsWith(`..${path.sep}`)
      && !path.isAbsolute(packagedPath),
    `${skill}: reference escapes skill package: ${reference} from ${path.relative(skillRoot, file)}`,
  );
  assert.ok(
    fs.existsSync(target),
    `${skill}: missing packaged reference ${reference} from ${path.relative(skillRoot, file)}`,
  );
}

for (const file of [
  ".agents/plugins/marketplace.json",
  "adapters/codex/.codex-plugin/plugin.json",
  "plugin/GEMINI.md",
  "plugin/gemini-extension.json",
  "plugin.yaml",
  "__init__.py",
]) assert.ok(fs.existsSync(path.join(root, file)), `missing host contract: ${file}`);

const versions = readVersionSources(root);
assert.equal(new Set(Object.values(versions)).size, 1, JSON.stringify(versions));

const pkg = json("package.json");
const codex = json("adapters/codex/.codex-plugin/plugin.json");
const gemini = json("plugin/gemini-extension.json");
const marketplace = json(".agents/plugins/marketplace.json");
assert.equal(codex.skills, "./skills/");
assert.equal(gemini.name, "devmuse");
assert.deepEqual(marketplace.plugins?.[0]?.source, { source: "local", path: "./adapters/codex" });
assert.equal(marketplace.plugins?.[0]?.policy?.installation, "AVAILABLE");
assert.equal(marketplace.plugins?.[0]?.policy?.authentication, "ON_INSTALL");
assert.equal(marketplace.plugins?.[0]?.category, "Developer Tools");
assert.ok(pkg.files?.includes("adapters/codex/"));

const sourceSkills = skillNames("plugin/skills");
const codexSkills = skillNames("adapters/codex/skills");
assert.ok(sourceSkills.length > 0, "no source skills found");
assert.deepEqual(codexSkills, sourceSkills, "Codex skill inventory differs from canonical skills");

for (const file of walk(path.join(root, "adapters/codex/skills")).filter((entry) => entry.endsWith(".md"))) {
  const body = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(body, /^disable-model-invocation:\s*true\s*$/m, file);
  assert.doesNotMatch(
    body,
    /set `disable-model-invocation: true`|Claude Search Optimization|Claude Code memory/,
    file,
  );
  assert.doesNotMatch(body, /@\.\.\/\.\.\/(knowledge|agents)\/|`skills\/mu-[^/]+\//, file);
}

for (const skill of codexSkills) {
  const skillRoot = path.join(root, "adapters/codex/skills", skill);
  assert.ok(fs.existsSync(path.join(skillRoot, "agents/openai.yaml")), `${skill} lacks agents/openai.yaml`);
  for (const file of walk(skillRoot).filter((entry) => entry.endsWith(".md"))) {
    const body = fs.readFileSync(file, "utf8");
    for (const match of body.matchAll(/@((?:\.\.\/|\.\/)+[A-Za-z0-9._/-]+\.md)/g)) {
      assertPackagedReference(
        skill,
        skillRoot,
        file,
        match[1],
        path.resolve(path.dirname(file), match[1]),
      );
    }
    for (const match of body.matchAll(
      /(?:^|[^A-Za-z0-9._/-])(references\/devmuse\/[A-Za-z0-9._/-]+\.md)/gm,
    )) {
      assertPackagedReference(skill, skillRoot, file, match[1], path.join(skillRoot, match[1]));
    }
  }
}

for (const skill of [
  "mu-mrd",
  "mu-model",
  "mu-prd",
  "mu-wiki",
  "mu-grill",
  "mu-plan",
  "mu-review",
  "mu-write-skill",
]) {
  assert.match(
    read(`adapters/codex/skills/${skill}/agents/openai.yaml`),
    /allow_implicit_invocation:\s*false/,
  );
}

for (const skill of ["mu-scope", "mu-arch", "mu-code", "mu-debug"]) {
  assert.match(
    read(`adapters/codex/skills/${skill}/agents/openai.yaml`),
    /allow_implicit_invocation:\s*true/,
  );
}

const muCode = read("adapters/codex/skills/mu-code/SKILL.md");
assert.match(
  muCode,
  /^description: Use when the user asks to implement a mu-scope bounded execution contract or an approved DevMuse implementation plan$/m,
);
assert.match(muCode, /Automatic invocation requires both conditions/);
assert.match(muCode, /generic specification.*is not enough/);

for (const skill of ["mu-scope", "mu-arch", "mu-plan", "mu-code", "mu-review"]) {
  assert.ok(
    fs.existsSync(path.join(
      root,
      "adapters/codex/skills",
      skill,
      "references/devmuse/knowledge/principles/project-context.md",
    )),
    `${skill} lacks the packaged project-context principle`,
  );
  assert.ok(
    fs.existsSync(path.join(
      root,
      "adapters/codex/skills",
      skill,
      "references/devmuse/runtime/project-context/cli.mjs",
    )),
    `${skill} lacks the packaged project-context runtime`,
  );
}
assert.ok(
  fs.existsSync(path.join(
    root,
    "adapters/codex/skills/mu-scope/references/devmuse/knowledge/principles/artifact-succession.md",
  )),
  "mu-scope lacks the packaged fallback succession contract",
);

// Cross-review runtime is vendored into mu-review, and the reviewer direction is
// reciprocal: the generated Codex adapter reviews with Claude Code, never Codex.
assert.ok(
  fs.existsSync(path.join(root, "adapters/codex/skills/mu-review/references/devmuse/runtime/cross-review/cli.mjs")),
  "mu-review lacks the packaged cross-review runtime",
);
const codexReview = read("adapters/codex/skills/mu-review/SKILL.md");
assert.match(codexReview, /`Codex -> Claude Code`/);
assert.doesNotMatch(codexReview, /`Claude Code -> Codex`/);
assert.match(codexReview, /"current_host":"codex"/);
assert.doesNotMatch(codexReview, /"current_host":"claude"/);
const claudeReview = read("plugin/skills/mu-review/SKILL.md");
assert.match(claudeReview, /`Claude Code -> Codex`/);
assert.match(claudeReview, /"current_host":"claude"/);

assert.match(read("adapters/codex/HOST_POLICY.md"), /native `\/plan`/);
assert.match(read("adapters/codex/HOST_POLICY.md"), /native `\/review`/);
assert.match(read("adapters/codex/HOST_POLICY.md"), /GitHub-first/);
assert.match(read("adapters/codex/HOST_POLICY.md"), /host-native capability and approval/);
assert.doesNotMatch(read("adapters/codex/HOST_POLICY.md"), /GitHub write permission is cached/);
assert.match(
  read("adapters/codex/HOST_POLICY.md"),
  /sandbox, approval, and administrator policy authoritative/,
);
// Opt-in concurrent-dispatch guidance must stay opt-in, untested-on-Codex, and
// non-overriding — the constraints carried over from #50/#54.
const hostPolicy = read("adapters/codex/HOST_POLICY.md");
assert.match(hostPolicy, /concurrent subagent dispatch \(opt-in\)/);
assert.match(hostPolicy, /not\*\* behavior-tested on Codex/);
assert.match(hostPolicy, /claims no parity with the Claude adapter/);
assert.match(hostPolicy, /never overrides the host's manager/);
assert.match(hostPolicy, /manager\/worker model with git-worktree isolation/);
assert.ok(!fs.existsSync(path.join(root, "adapters/codex/hooks")));
assert.match(read("plugin/GEMINI.md"), /native Plan Mode/);
assert.match(read("plugin/GEMINI.md"), /policy engine and approval mode authoritative/);
assert.match(read("docs/platform-support.md"), /does not promise cross-host parity/);
assert.doesNotMatch(read("__init__.py"), /register_hook/);

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
    def __init__(self):
        self.skills = []

    def register_skill(self, *, name, path):
        self.skills.append((name, pathlib.Path(path)))

ctx = Context()
module.register(ctx)
expected = sorted(file.parent.name for file in skill_root.glob("*/SKILL.md"))
actual = sorted(name for name, _ in ctx.skills)
assert actual == expected, (actual, expected)
assert all(file.is_file() and file.name == "SKILL.md" for _, file in ctx.skills)
`;
const pythonCommand = process.platform === "win32" ? "python" : "python3";
const result = spawnSync(
  pythonCommand,
  ["-c", python, path.join(root, "__init__.py"), path.join(root, "plugin/skills")],
  { encoding: "utf8" },
);
assert.equal(result.status, 0, result.error?.message ?? result.stderr);

console.log("PASS: cross-platform plugin contract");
