// Single source of truth for scenario pass criteria is the table in README.md.
// This parser extracts a scenario's row so the auto-judge scores against the
// same text a human reads — no second, drifting copy of the criteria.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.join(directory, "README.md");

function splitRow(line) {
  // Split a Markdown table row on unescaped pipes, dropping the leading/trailing
  // empties produced by the surrounding pipes.
  const cells = line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split(/(?<!\\)\|/);
  return cells.map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

export function parseCriteria(readmeText = fs.readFileSync(readmePath, "utf8")) {
  const lines = readmeText.split("\n");
  const start = lines.findIndex((line) => /^## Scenarios and pass criteria/.test(line));
  if (start === -1) throw new Error("criteria table heading not found in README.md");
  const scenarios = new Map();
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^## /.test(line)) break;
    if (!/^\s*\|/.test(line)) continue;
    const cells = splitRow(line);
    if (cells.length < 3) continue;
    const [prompt, simulates, criteria] = cells;
    if (prompt === "Prompt" || /^-+$/.test(prompt.replace(/[|\s]/g, ""))) continue; // header / separator
    const match = prompt.match(/`([^`]+)\.txt`/);
    if (!match) continue;
    scenarios.set(match[1], { scenario: match[1], simulates, criteria });
  }
  return scenarios;
}

export function criteriaFor(scenario, readmeText) {
  const found = parseCriteria(readmeText).get(scenario);
  if (!found) throw Object.assign(new Error(`no criteria for scenario: ${scenario}`), { code: "unknown-scenario" });
  return found;
}

// CLI: `node parse-criteria.mjs [scenario]` prints JSON (one scenario or all).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scenario = process.argv[2];
  const all = parseCriteria();
  const output = scenario ? criteriaFor(scenario) : Object.fromEntries(all);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
