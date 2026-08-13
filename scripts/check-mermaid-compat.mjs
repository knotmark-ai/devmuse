#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FULLWIDTH_PUNCTUATION = /[，。；：（）【】！？]/;

function markdownFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(".md") ? [target] : [];

  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    return entry.isDirectory() ? markdownFiles(child) : child.endsWith(".md") ? [child] : [];
  });
}

function isQuotedNodeShape(shape) {
  return [
    /^\[\s*".*"\s*\]$/,
    /^\[\(\s*".*"\s*\)\]$/,
    /^\(\s*".*"\s*\)$/,
    /^\(\(\s*".*"\s*\)\)$/,
  ].some((pattern) => pattern.test(shape));
}

function finding(file, line, rule, message) {
  return { file, line, rule, message };
}

export function scanMarkdown(markdown, file = "<input>") {
  const findings = [];
  const lines = markdown.split(/\r?\n/);
  let inMermaid = false;
  let blockStart = 0;
  let block = [];

  const scanBlock = () => {
    const isFlowchart = block.some((entry) => /^\s*(?:graph|flowchart)\b/.test(entry.text));

    for (const entry of block) {
      if (entry.text.includes("<")) {
        findings.push(finding(file, entry.line, "raw-angle-bracket", "write comparisons in words and avoid raw HTML"));
      }
      if (FULLWIDTH_PUNCTUATION.test(entry.text)) {
        findings.push(finding(file, entry.line, "ascii-punctuation", "use ASCII punctuation inside Mermaid labels"));
      }
      if (!isFlowchart || /^\s*%%/.test(entry.text)) continue;

      const nodePattern = /\b[A-Za-z_][A-Za-z0-9_-]*\s*(\[\([^\]]*\)\]|\[[^\]]*\]|\(\([^)]*\)\)|\([^)]*\))/g;
      for (const match of entry.text.matchAll(nodePattern)) {
        if (!isQuotedNodeShape(match[1])) {
          findings.push(finding(file, entry.line, "quoted-node-label", `quote flowchart node label ${match[0].trim()}`));
        }
      }

      const edgeLabelPattern = /(?:[-.=]+>|-{2,})\s*\|([^|]+)\|/g;
      for (const match of entry.text.matchAll(edgeLabelPattern)) {
        const label = match[1].trim();
        if (!(label.startsWith('"') && label.endsWith('"'))) {
          findings.push(finding(file, entry.line, "quoted-edge-label", `quote flowchart edge label ${label}`));
        }
      }
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!inMermaid && /^\s*```mermaid\s*$/.test(line)) {
      inMermaid = true;
      blockStart = index + 1;
      block = [];
      continue;
    }
    if (inMermaid && /^\s*```\s*$/.test(line)) {
      scanBlock();
      inMermaid = false;
      block = [];
      continue;
    }
    if (inMermaid) block.push({ text: line, line: index + 1 });
  }

  if (inMermaid) {
    findings.push(finding(file, blockStart, "unclosed-block", "close the Mermaid code fence"));
  }

  return findings;
}

function runCli(args) {
  if (args.length === 0) {
    console.error("Usage: node scripts/check-mermaid-compat.mjs <file-or-directory> [...]");
    return 2;
  }

  const files = args.flatMap(markdownFiles).sort();
  const findings = files.flatMap((file) => scanMarkdown(fs.readFileSync(file, "utf8"), file));
  for (const item of findings) {
    console.error(`${item.file}:${item.line}: ${item.rule}: ${item.message}`);
  }
  if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} Mermaid compatibility finding(s)`);
    return 1;
  }
  console.log(`PASS: ${files.length} Markdown file(s) use the Mermaid compatibility subset`);
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = runCli(process.argv.slice(2));
