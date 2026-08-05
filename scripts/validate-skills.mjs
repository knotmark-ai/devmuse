#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowedFields = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
  "disable-model-invocation",
  "user-invocable",
]);

function unquote(value) {
  if (value.startsWith('"') || value.endsWith('"')) {
    if (!(value.startsWith('"') && value.endsWith('"'))) throw new Error("unmatched double quote");
    return JSON.parse(value);
  }
  if (value.startsWith("'") || value.endsWith("'")) {
    if (!(value.startsWith("'") && value.endsWith("'"))) throw new Error("unmatched single quote");
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

export function validateSkillText(text, expectedName, file = "SKILL.md") {
  const findings = [];
  const normalized = text.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return [{ file, rule: "frontmatter", message: "missing leading YAML frontmatter" }];

  const fields = new Map();
  for (const [index, line] of match[1].split("\n").entries()) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const field = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/);
    if (!field) {
      findings.push({ file, rule: "frontmatter-syntax", message: `invalid line ${index + 2}` });
      continue;
    }
    try {
      fields.set(field[1], unquote(field[2]));
    } catch {
      findings.push({ file, rule: "frontmatter-syntax", message: `invalid quoted value on line ${index + 2}` });
    }
    if (!allowedFields.has(field[1])) {
      findings.push({ file, rule: "frontmatter-field", message: `unsupported field ${field[1]}` });
    }
  }

  const name = fields.get("name") ?? "";
  const description = fields.get("description") ?? "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) {
    findings.push({ file, rule: "name", message: "name must be lowercase kebab-case and at most 64 characters" });
  }
  if (name !== expectedName) {
    findings.push({ file, rule: "directory-name", message: `name ${name || "<missing>"} does not match ${expectedName}` });
  }
  if (!description.trim()) {
    findings.push({ file, rule: "description", message: "description is required" });
  } else if (Buffer.byteLength(description, "utf8") > 1024) {
    findings.push({ file, rule: "description-budget", message: "description exceeds 1024 UTF-8 bytes" });
  }
  if (/[<>]/.test(description)) {
    findings.push({ file, rule: "description-markup", message: "description must not contain angle-bracket markup" });
  }
  if (!match[2].trim()) findings.push({ file, rule: "body", message: "skill body is empty" });
  return findings;
}

function validateRoot(root) {
  if (!fs.existsSync(root)) return { findings: [], count: 0, descriptionBytes: 0 };
  const findings = [];
  let count = 0;
  let descriptionBytes = 0;

  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const file = path.join(root, entry.name, "SKILL.md");
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    findings.push(...validateSkillText(text, entry.name, file));
    const descriptionLine = text.match(/^description:\s*(.*)$/m)?.[1] ?? "";
    try {
      descriptionBytes += Buffer.byteLength(unquote(descriptionLine), "utf8");
    } catch {
      findings.push({ file, rule: "description-syntax", message: "description is not valid quoted text" });
    }
    count += 1;
  }

  if (descriptionBytes > 4096) {
    findings.push({
      file: root,
      rule: "inventory-description-budget",
      message: `skill descriptions use ${descriptionBytes} bytes; maximum is 4096`,
    });
  }
  return { findings, count, descriptionBytes };
}

function runCli(args) {
  const roots = args.length > 0
    ? args.map((target) => path.resolve(target))
    : [path.join(repoRoot, "plugin", "skills"), path.join(repoRoot, "adapters", "codex", "skills")];
  let skillCount = 0;
  const findings = [];
  for (const root of roots) {
    const result = validateRoot(root);
    skillCount += result.count;
    findings.push(...result.findings);
  }
  for (const item of findings) console.error(`${item.file}: ${item.rule}: ${item.message}`);
  if (findings.length > 0) return 1;
  console.log(`PASS: validated ${skillCount} skill package(s)`);
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = runCli(process.argv.slice(2));
