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
const projectContextConsumers = new Set(["mu-scope", "mu-arch", "mu-plan", "mu-code", "mu-review", "mu-setup"]);
const projectContextRuntimeRoot = path.join(sourcePluginRoot, "runtime", "project-context");
const crossReviewConsumers = new Set(["mu-review"]);
const crossReviewRuntimeRoot = path.join(sourcePluginRoot, "runtime", "cross-review");
const projectRegistryConsumers = new Set(["mu-setup"]);
const projectRegistryRuntimeRoot = path.join(sourcePluginRoot, "runtime", "project-registry");

const ui = {
  "mu-arch": ["DevMuse Architecture", "Design bounded technical architecture", "design the architecture for an approved scope"],
  "mu-code": ["DevMuse Code", "Execute an approved DevMuse contract", "implement an approved DevMuse scope or plan"],
  "mu-debug": ["DevMuse Debug", "Trace defects to a verified root cause", "diagnose and fix this reproducible defect"],
  "mu-grill": ["DevMuse Grill", "Stress-test a plan or design", "stress-test this plan until its risky decisions are resolved"],
  "mu-model": ["DevMuse Domain Model", "Create or update the domain model", "create or update the repository domain model"],
  "mu-mrd": ["DevMuse MRD", "Validate a product or market premise", "evaluate this product premise and draft an MRD"],
  "mu-plan": ["DevMuse Plan", "Write a traceable implementation plan", "write a durable UC-traceable implementation plan"],
  "mu-prd": ["DevMuse PRD", "Define product flows and requirements", "create or update the product requirements document"],
  "mu-review": ["DevMuse Review", "Review coverage, security, and quality", "run the specialized DevMuse review requested here"],
  "mu-scope": ["DevMuse Scope", "Classify impact and define use cases", "probe this behavior-changing request and define its scope"],
  "mu-setup": ["DevMuse Setup", "Initialize project case-registry routing", "discover and initialize this project's case-registry routing and preferences"],
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
    .replaceAll(
      "Claude skills invoke\n`${CLAUDE_PLUGIN_ROOT}/runtime/project-context/cli.mjs`. Portable skills invoke\ntheir vendored `references/devmuse/runtime/project-context/cli.mjs`.",
      "Codex skills invoke their vendored\n`references/devmuse/runtime/project-context/cli.mjs`.",
    )
    .replaceAll(
      "${CLAUDE_PLUGIN_ROOT}/runtime/project-context/cli.mjs",
      "references/devmuse/runtime/project-context/cli.mjs",
    )
    .replaceAll(
      "Claude skills invoke\n`${CLAUDE_PLUGIN_ROOT}/runtime/cross-review/cli.mjs`. Portable skills invoke\ntheir vendored `references/devmuse/runtime/cross-review/cli.mjs`.",
      "Codex skills invoke their vendored\n`references/devmuse/runtime/cross-review/cli.mjs`.",
    )
    .replaceAll(
      "${CLAUDE_PLUGIN_ROOT}/runtime/cross-review/cli.mjs",
      "references/devmuse/runtime/cross-review/cli.mjs",
    )
    .replaceAll(
      "${CLAUDE_PLUGIN_ROOT}/runtime/project-registry/cli.mjs",
      "references/devmuse/runtime/project-registry/cli.mjs",
    )
    // Reciprocal cross-review host identity: the canonical skill is authored for
    // Claude Code (reviewer = Codex); the generated Codex adapter reviews with
    // Claude Code instead. Both tokens are single-line so rewriting is wrap-proof.
    .replaceAll("reviewer direction:\n`Claude Code -> Codex`", "reviewer direction:\n`Codex -> Claude Code`")
    .replaceAll("`Claude Code -> Codex`", "`Codex -> Claude Code`")
    .replaceAll('`{"current_host":"claude"', '`{"current_host":"codex"')
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

// Single canonical source for the opt-in concurrent-dispatch guidance (#54): both
// the HOST_POLICY section and each eligible skill's own per-skill pointer derive
// from this map, so they cannot drift and every eligible skill carries the pointer
// even when its skill body is loaded without HOST_POLICY. Skills NOT listed here
// are ineligible and get no pointer. The guidance is opt-in and declinable — a
// conservative host manager is authoritative and may decline.
const CONCURRENT_DISPATCH = {
  "mu-code": "executing an approved plan: architectural tasks with no shared-file contention and no producer/consumer interface between them are worker candidates; keep tasks that touch the same files or exchange a named output on one thread, in dependency order.",
  "mu-review": "requirements-coverage, security, and code-quality passes are independent lenses over the same diff — dispatch them as parallel workers, then merge findings on the manager.",
  "mu-scope": "independent probes of separate subsystems may fan out; synthesis stays on the manager.",
};

function dispatchHostPolicyBullets() {
  return Object.entries(CONCURRENT_DISPATCH).map(([skill, note]) => `  - \`$${skill}\` ${note}`).join("\n");
}

function dispatchSkillPointer(skillName) {
  const note = CONCURRENT_DISPATCH[skillName];
  if (!note) return null; // ineligible skill — no pointer
  return [
    "",
    "## Optional: concurrent subagent dispatch (opt-in)",
    "",
    "This is an **opt-in suggestion**, not a default. It points to the canonical guide",
    "in the adapter's `HOST_POLICY.md` (§ *Optional: concurrent subagent dispatch*) —",
    "the single source of truth. The host manager and the user decide whether to spawn",
    "workers; **a conservative manager may decline, and concurrency is never forced.**",
    "It is not behavior-tested on Codex and claims no parity with the Claude fan-out.",
    "",
    `- Where \`$${skillName}\` decomposes: ${note}`,
    "- Prefer git-worktree isolation whenever workers mutate files; never share one",
    "  working tree for write work.",
    "",
  ].join("\n");
}

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

  if (projectContextConsumers.has(skillName)) {
    fs.cpSync(
      projectContextRuntimeRoot,
      path.join(targetRoot, "references", "devmuse", "runtime", "project-context"),
      { recursive: true },
    );
  }

  if (crossReviewConsumers.has(skillName)) {
    fs.cpSync(
      crossReviewRuntimeRoot,
      path.join(targetRoot, "references", "devmuse", "runtime", "cross-review"),
      { recursive: true },
    );
  }

  if (projectRegistryConsumers.has(skillName)) {
    fs.cpSync(
      projectRegistryRuntimeRoot,
      path.join(targetRoot, "references", "devmuse", "runtime", "project-registry"),
      { recursive: true },
    );
  }

  for (const file of walkFiles(targetRoot)) {
    if (!file.endsWith(".md")) continue;
    const before = fs.readFileSync(file, "utf8");
    const after = rewritePortableText(before, skillName);
    if (before !== after) fs.writeFileSync(file, after);
  }

  // Per-skill opt-in concurrent-dispatch pointer, generated from the canonical map
  // so eligible skills carry it even without loading HOST_POLICY (#54).
  const pointer = dispatchSkillPointer(skillName);
  if (pointer) fs.appendFileSync(path.join(targetRoot, "SKILL.md"), pointer);

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
  `# Codex host policy\n\nDevMuse augments Codex; it does not replace the host's normal agent loop.\n\n- Use native \`/plan\` for ordinary multi-step planning. Invoke \`$mu-plan\` only when an approved architecture needs a durable, UC-traceable plan artifact.\n- Use native \`/review\` for routine working-tree or branch review. Invoke \`$mu-review\` for requirements coverage, security, or an explicitly authorized review-and-fix loop.\n- Let Codex implement and verify ordinary work normally. Allow \`$mu-code\` to take over automatically only when the user asks to execute a mu-scope \`bounded execution\` contract or an approved DevMuse implementation plan.\n- mu-scope, mu-arch, and mu-debug may invoke when their descriptions match. mu-code additionally requires its execution-request and contract gate. All other DevMuse skills require explicit \`$mu-*\` invocation.\n- Never force a direct or bounded task through the full scope → architecture → plan → code → review pipeline. Upgrade ceremony only when evidence exposes architectural risk or unresolved decisions.\n- Keep exact operational bindings Direct under the canonical bootstrap criteria: a public hostname or provider boundary alone does not justify the full pipeline. Destructive DNS changes and policy changes still upgrade through mu-scope.\n- GitHub-first coordination uses Issues and Draft PRs only after a fresh host-native capability and approval check for the exact operation. Read each skill's vendored project-context contract and runtime; cached discovery is never authority to mutate GitHub.\n- Codex has no Claude SessionStart hook dependency. Resolve context when the workflow needs it and keep native GitHub tools, sandbox, approval, and administrator policy authoritative. Do not emulate the Claude destructive-command \`ask\` hook: Codex \`PreToolUse\` can deny, but it cannot currently request approval.\n\n## Optional: concurrent subagent dispatch (opt-in)\n\nThis section is opt-in and is **not** behavior-tested on Codex; it claims no parity with the Claude adapter's fan-out. It only points out where DevMuse work decomposes and never overrides the host's manager — the manager and the user decide whether to spawn workers.\n\n- Codex subagents (GA) run a small fixed number concurrently under a manager/worker model with git-worktree isolation and explorer/worker roles; \`agents.max_concurrent_threads_per_session\` in \`config.toml\` bounds them. (\`agents.max_threads\` is legacy, and there is no current official \`max_depth\` or \`spawn_agents_on_csv\` — do not rely on them.)\n- When a DevMuse skill yields independent units of work, you may run them as parallel workers instead of serially. Each eligible skill also carries this pointer in its own body (generated from this same source), so the guidance travels with the skill even when this file is not loaded:\n${dispatchHostPolicyBullets()}\n- Prefer worktree isolation whenever workers mutate files; never let workers share one working tree for write work.\n- This is a suggestion layer only. A conservative host manager is authoritative — do not force concurrency, and do not treat this guidance as a tested default.\n`,
);

fs.writeFileSync(
  path.join(codexRoot, ".generated-from-devmuse"),
  `Generated by scripts/build-platform-adapters.mjs from plugin/skills at version ${packageJson.version}.\n`,
);

console.log(`Built Codex adapter with ${skillNames.length} skills at ${codexRoot}`);
