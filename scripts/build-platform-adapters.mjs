#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceSkillsRoot = path.join(repoRoot, "plugin", "skills");
const sourcePluginRoot = path.join(repoRoot, "plugin");
const codexRoot = path.join(repoRoot, "adapters", "codex");
const targetSkillsRoot = path.join(codexRoot, "skills");
const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

const implicitSkills = new Set(["mu-scope", "mu-arch", "mu-code", "mu-debug"]);

const ui = {
  "mu-arch": ["DevMuse Architecture", "Design bounded technical architecture", "design the architecture for an approved scope"],
  "mu-code": ["DevMuse Code", "Execute an approved DevMuse contract", "implement an approved DevMuse scope or plan"],
  "mu-debug": ["DevMuse Debug", "Trace defects to a verified root cause", "diagnose and fix this reproducible defect"],
  "mu-grill": ["DevMuse Grill", "Stress-test a plan or design", "stress-test this plan until its risky decisions are resolved"],
  "mu-model": ["DevMuse Domain Model", "Create or update the domain model", "create or update the repository domain model"],
  "mu-mrd": ["DevMuse MRD", "Validate a product or market premise", "evaluate this product premise and draft an MRD"],
  "mu-plan": ["DevMuse Plan", "Write a traceable implementation plan", "write a durable UC-traceable implementation plan"],
  "mu-prd": ["DevMuse PRD", "Define product flows and requirements", "create or update the product requirements document"],
  "mu-retro": ["DevMuse Retro", "Run an evidence-based retrospective", "run a repository retrospective for the requested period"],
  "mu-review": ["DevMuse Review", "Review coverage, security, and quality", "run the specialized DevMuse review requested here"],
  "mu-scope": ["DevMuse Scope", "Classify impact and define use cases", "probe this behavior-changing request and define its scope"],
  "mu-wiki": ["DevMuse Wiki", "Generate or update architecture docs", "generate or update the repository architecture wiki"],
  "mu-write-skill": ["DevMuse Skill Authoring", "Author and pressure-test Agent Skills", "author or revise this Agent Skill with pressure tests"],
};

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function rewritePortableText(text, skillName) {
  return text
    .replace(/^disable-model-invocation:\s*true\s*\n/gm, "")
    .replaceAll("@../../knowledge/", "references/devmuse/knowledge/")
    .replaceAll("@../../agents/", "references/devmuse/agents/")
    .replaceAll(`skills/${skillName}/`, "");
}

function collectExternalReferences(skillRoot) {
  const references = new Set();
  const pending = walkFiles(skillRoot).filter((file) => file.endsWith(".md"));
  const visited = new Set();

  while (pending.length > 0) {
    const file = pending.pop();
    if (visited.has(file)) continue;
    visited.add(file);

    const text = fs.readFileSync(file, "utf8");
    const pattern = /@((?:\.\.\/|\.\/)+[A-Za-z0-9._/-]+\.md)/g;
    for (const match of text.matchAll(pattern)) {
      const source = path.resolve(path.dirname(file), match[1]);
      const sourceRelative = path.relative(sourcePluginRoot, source);
      const skillRelative = path.relative(skillRoot, source);

      if (skillRelative !== ".." && !skillRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(skillRelative)) {
        continue;
      }
      if (sourceRelative === ".." || sourceRelative.startsWith(`..${path.sep}`) || path.isAbsolute(sourceRelative)) {
        throw new Error(`${path.relative(repoRoot, file)} references file outside plugin root: ${match[1]}`);
      }
      if (!/^(knowledge|agents)[/\\]/.test(sourceRelative)) {
        throw new Error(`${path.relative(repoRoot, file)} references unsupported plugin path: ${match[1]}`);
      }
      if (!fs.existsSync(source)) {
        throw new Error(`${path.relative(repoRoot, file)} references missing file ${sourceRelative}`);
      }

      references.add(sourceRelative);
      pending.push(source);
    }
  }
  return [...references].sort();
}

function writeOpenAiManifest(skillName, skillRoot) {
  const values = ui[skillName];
  if (!values) throw new Error(`Missing Codex UI metadata for ${skillName}`);
  const [displayName, shortDescription, prompt] = values;
  const body = [
    "interface:",
    `  display_name: ${JSON.stringify(displayName)}`,
    `  short_description: ${JSON.stringify(shortDescription)}`,
    `  default_prompt: ${JSON.stringify(`Use $${skillName} to ${prompt}.`)}`,
    "policy:",
    `  allow_implicit_invocation: ${implicitSkills.has(skillName)}`,
    "",
  ].join("\n");
  fs.mkdirSync(path.join(skillRoot, "agents"), { recursive: true });
  fs.writeFileSync(path.join(skillRoot, "agents", "openai.yaml"), body);
}

fs.rmSync(codexRoot, { recursive: true, force: true });
fs.mkdirSync(targetSkillsRoot, { recursive: true });

const skillNames = fs.readdirSync(sourceSkillsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(sourceSkillsRoot, entry.name, "SKILL.md")))
  .map((entry) => entry.name)
  .sort();

for (const skillName of skillNames) {
  const sourceRoot = path.join(sourceSkillsRoot, skillName);
  const targetRoot = path.join(targetSkillsRoot, skillName);
  fs.cpSync(sourceRoot, targetRoot, { recursive: true });

  for (const reference of collectExternalReferences(sourceRoot)) {
    const source = path.join(sourcePluginRoot, reference);
    if (!fs.existsSync(source)) throw new Error(`${skillName} references missing file ${reference}`);
    const target = path.join(targetRoot, "references", "devmuse", reference);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }

  for (const file of walkFiles(targetRoot)) {
    if (!file.endsWith(".md")) continue;
    const before = fs.readFileSync(file, "utf8");
    const after = rewritePortableText(before, skillName);
    if (before !== after) fs.writeFileSync(file, after);
  }

  writeOpenAiManifest(skillName, targetRoot);
}

fs.mkdirSync(path.join(codexRoot, ".codex-plugin"), { recursive: true });
fs.writeFileSync(
  path.join(codexRoot, ".codex-plugin", "plugin.json"),
  `${JSON.stringify({
    name: "devmuse",
    version: packageJson.version,
    description: "Risk-proportional software delivery skills for Codex and ChatGPT Work",
    skills: "./skills/",
    author: { name: "KnotMark AI", url: "https://github.com/knotmark-ai" },
    homepage: "https://github.com/knotmark-ai/devmuse",
    repository: "https://github.com/knotmark-ai/devmuse",
    license: "MIT",
    keywords: ["agent-skills", "architecture", "debugging", "tdd", "workflow"],
    interface: {
      displayName: "DevMuse",
      shortDescription: "Risk-proportional software delivery workflows",
      longDescription: "Scope, architecture, debugging, product, and delivery skills that add ceremony only when risk or uncertainty justifies it.",
      developerName: "KnotMark AI",
      category: "Developer Tools",
      capabilities: ["skills"],
      websiteURL: "https://github.com/knotmark-ai/devmuse",
      brandColor: "#6366F1",
      defaultPrompt: "Use DevMuse to classify this development request and apply only the workflow depth its risk requires.",
    },
  }, null, 2)}\n`,
);

fs.writeFileSync(
  path.join(codexRoot, "HOST_POLICY.md"),
  `# Codex host policy\n\nDevMuse augments Codex; it does not replace the host's normal agent loop.\n\n- Use native \`/plan\` for ordinary multi-step planning. Invoke \`$mu-plan\` only when an approved architecture needs a durable, UC-traceable plan artifact.\n- Use native \`/review\` for routine working-tree or branch review. Invoke \`$mu-review\` for requirements coverage, security, or an explicitly authorized review-and-fix loop.\n- Let Codex implement and verify ordinary work normally. Allow \`$mu-code\` to take over automatically only when the user asks to execute a mu-scope \`bounded execution\` contract or an approved DevMuse implementation plan.\n- mu-scope, mu-arch, and mu-debug may invoke when their descriptions match. mu-code additionally requires its execution-request and contract gate. All other DevMuse skills require explicit \`$mu-*\` invocation.\n- Never force a direct or bounded task through the full scope → architecture → plan → code → review pipeline. Upgrade ceremony only when evidence exposes architectural risk or unresolved decisions.\n- Keep Codex sandbox, approval, and administrator policy authoritative. Do not emulate the Claude destructive-command \`ask\` hook: Codex \`PreToolUse\` can deny, but it cannot currently request approval.\n`,
);

fs.writeFileSync(
  path.join(codexRoot, ".generated-from-devmuse"),
  `Generated by scripts/build-platform-adapters.mjs from plugin/skills at version ${packageJson.version}.\n`,
);

console.log(`Built Codex adapter with ${skillNames.length} skills at ${codexRoot}`);
