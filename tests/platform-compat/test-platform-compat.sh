#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLAUDE_ROOT="$ROOT/plugin"
CODEX_ROOT="$ROOT/adapters/codex"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

[[ -f "$CODEX_ROOT/.codex-plugin/plugin.json" ]] || fail "missing Codex manifest"
[[ -f "$ROOT/.agents/plugins/marketplace.json" ]] || fail "missing Codex repo marketplace"
[[ -f "$CLAUDE_ROOT/gemini-extension.json" ]] || fail "missing Gemini extension manifest"
[[ -f "$CLAUDE_ROOT/GEMINI.md" ]] || fail "missing Gemini host policy"
[[ -f "$ROOT/plugin.yaml" && -f "$ROOT/__init__.py" ]] || fail "missing Hermes plugin adapter"

node --input-type=module - "$ROOT" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const claudeMarketplace = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin/marketplace.json"), "utf8"));
const claude = JSON.parse(fs.readFileSync(path.join(root, "plugin/.claude-plugin/plugin.json"), "utf8"));
const codex = JSON.parse(fs.readFileSync(path.join(root, "adapters/codex/.codex-plugin/plugin.json"), "utf8"));
const gemini = JSON.parse(fs.readFileSync(path.join(root, "plugin/gemini-extension.json"), "utf8"));
const marketplace = JSON.parse(fs.readFileSync(path.join(root, ".agents/plugins/marketplace.json"), "utf8"));
const hermes = fs.readFileSync(path.join(root, "plugin.yaml"), "utf8");
const hermesVersion = hermes.match(/^version:\s*["']?([^"'\s]+)["']?\s*$/m)?.[1];

for (const [label, version] of [
  ["package", pkg.version],
  ["Claude marketplace", claudeMarketplace.plugins?.[0]?.version],
  ["Claude", claude.version],
  ["Codex", codex.version],
  ["Gemini", gemini.version],
  ["Hermes", hermesVersion],
]) {
  if (version !== "2.2.0") {
    throw new Error(`${label} version is ${version}; expected 2.2.0`);
  }
}

if (codex.skills !== "./skills/") throw new Error("Codex skills path must be ./skills/");
if (gemini.name !== "devmuse") throw new Error("Gemini extension name must be devmuse");
if (marketplace.plugins?.[0]?.source?.path !== "./adapters/codex") {
  throw new Error("Codex marketplace must point to ./adapters/codex");
}
if (marketplace.plugins?.[0]?.source?.source !== "local") {
  throw new Error("Codex marketplace source type must be local");
}
if (marketplace.plugins?.[0]?.policy?.installation !== "AVAILABLE") {
  throw new Error("Codex marketplace install policy must be AVAILABLE");
}
if (marketplace.plugins?.[0]?.policy?.authentication !== "ON_INSTALL") {
  throw new Error("Codex marketplace auth policy must be ON_INSTALL");
}
if (marketplace.plugins?.[0]?.category !== "Developer Tools") {
  throw new Error("Codex marketplace category must be Developer Tools");
}
if (!pkg.files?.includes("adapters/codex/")) {
  throw new Error("npm package must include adapters/codex/");
}
NODE

mapfile -t source_skills < <(find "$CLAUDE_ROOT/skills" -mindepth 2 -maxdepth 2 -name SKILL.md -exec dirname {} \; | xargs -n1 basename | sort)
mapfile -t codex_skills < <(find "$CODEX_ROOT/skills" -mindepth 2 -maxdepth 2 -name SKILL.md -exec dirname {} \; | xargs -n1 basename | sort)

[[ "${#source_skills[@]}" -gt 0 ]] || fail "no source skills found"
[[ "${source_skills[*]}" == "${codex_skills[*]}" ]] || fail "Codex skill inventory differs from Claude"

if rg -n '^disable-model-invocation:\s*true\s*$' "$CODEX_ROOT/skills"; then
  fail "Codex adapter contains Claude-only disable-model-invocation"
fi

if rg -n 'set `disable-model-invocation: true`|Claude Search Optimization|Claude Code memory' "$CODEX_ROOT/skills"; then
  fail "Codex adapter teaches Claude-only authoring or memory behavior"
fi

if rg -n '@\.\./\.\./(knowledge|agents)/|`skills/mu-[^/]+/' "$CODEX_ROOT/skills"; then
  fail "Codex adapter contains non-portable cross-root references"
fi

node --input-type=module - "$CODEX_ROOT" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const skillRoot = path.join(root, "skills");

function walkMarkdown(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(file));
    else if (entry.isFile() && file.endsWith(".md")) files.push(file);
  }
  return files;
}

function assertPackagedReference(skill, root, file, reference, target) {
  const packagedPath = path.relative(root, target);
  if (packagedPath === ".." || packagedPath.startsWith(`..${path.sep}`) || path.isAbsolute(packagedPath)) {
    throw new Error(`${skill}: reference escapes skill package: ${reference} from ${path.relative(root, file)}`);
  }
  if (!fs.existsSync(target)) {
    throw new Error(`${skill}: missing packaged reference ${reference} from ${path.relative(root, file)}`);
  }
}

for (const skill of fs.readdirSync(skillRoot)) {
  const root = path.join(skillRoot, skill);
  if (!fs.statSync(root).isDirectory() || !fs.existsSync(path.join(root, "SKILL.md"))) continue;

  for (const file of walkMarkdown(root)) {
    const body = fs.readFileSync(file, "utf8");
    for (const match of body.matchAll(/@((?:\.\.\/|\.\/)+[A-Za-z0-9._/-]+\.md)/g)) {
      assertPackagedReference(skill, root, file, match[1], path.resolve(path.dirname(file), match[1]));
    }
    for (const match of body.matchAll(/(?:^|[^A-Za-z0-9._/-])(references\/devmuse\/[A-Za-z0-9._/-]+\.md)/gm)) {
      assertPackagedReference(skill, root, file, match[1], path.join(root, match[1]));
    }
  }
}
NODE

for skill in "${codex_skills[@]}"; do
  [[ -f "$CODEX_ROOT/skills/$skill/agents/openai.yaml" ]] || fail "$skill lacks agents/openai.yaml"
done

for skill in mu-mrd mu-model mu-prd mu-wiki mu-retro mu-grill mu-plan mu-review mu-write-skill; do
  rg -q 'allow_implicit_invocation:\s*false' "$CODEX_ROOT/skills/$skill/agents/openai.yaml" \
    || fail "$skill must be explicit-only on Codex"
done

for skill in mu-scope mu-arch mu-code mu-debug; do
  rg -q 'allow_implicit_invocation:\s*true' "$CODEX_ROOT/skills/$skill/agents/openai.yaml" \
    || fail "$skill must remain auto-discoverable on Codex"
done

rg -q '^description: Use when the user asks to implement a mu-scope bounded execution contract or an approved DevMuse implementation plan$' \
  "$CODEX_ROOT/skills/mu-code/SKILL.md" || fail "mu-code must use the contract-gated trigger description"
rg -q 'Automatic invocation requires both conditions' "$CODEX_ROOT/skills/mu-code/SKILL.md" \
  || fail "mu-code must enforce its conditional entry gate"
rg -q 'generic specification.*is not enough' "$CODEX_ROOT/skills/mu-code/SKILL.md" \
  || fail "mu-code must reject ordinary coding/spec requests"

rg -q 'native `/plan`' "$CODEX_ROOT/HOST_POLICY.md" || fail "Codex policy must prefer native /plan"
rg -q 'native `/review`' "$CODEX_ROOT/HOST_POLICY.md" || fail "Codex policy must prefer native /review"
rg -q 'sandbox, approval, and administrator policy authoritative' "$CODEX_ROOT/HOST_POLICY.md" \
  || fail "Codex policy must keep native safety authoritative"
[[ ! -e "$CODEX_ROOT/hooks" ]] || fail "Codex adapter must not bundle a duplicate safety hook"
rg -q 'native Plan Mode' "$CLAUDE_ROOT/GEMINI.md" || fail "Gemini policy must prefer native Plan Mode"
rg -q "policy engine and approval mode authoritative" "$CLAUDE_ROOT/GEMINI.md" \
  || fail "Gemini policy must keep native safety authoritative"
rg -q 'does not promise cross-host parity' "$ROOT/docs/platform-support.md" \
  || fail "platform docs must define the cross-host safety boundary"
if rg -q 'register_hook' "$ROOT/__init__.py"; then
  fail "Hermes adapter must not register an implicit safety hook"
fi

python3 - "$ROOT/__init__.py" <<'PY'
import importlib.util
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("devmuse_hermes_adapter", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Context:
    def __init__(self):
        self.skills = []

    def register_skill(self, *, name, path):
        self.skills.append((name, path))


ctx = Context()
module.register(ctx)
assert len(ctx.skills) == 13, f"Hermes registered {len(ctx.skills)} skills; expected 13"
assert {name for name, _ in ctx.skills} == {
    "mu-arch", "mu-code", "mu-debug", "mu-grill", "mu-model", "mu-mrd",
    "mu-plan", "mu-prd", "mu-retro", "mu-review", "mu-scope", "mu-wiki",
    "mu-write-skill",
}
assert all(path.is_file() and path.name == "SKILL.md" for _, path in ctx.skills)
PY

echo "PASS: cross-platform plugin contract"
