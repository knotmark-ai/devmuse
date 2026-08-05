#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanMarkdown } from "../../scripts/check-mermaid-compat.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, "fixtures", name), "utf8");

assert.deepEqual(scanMarkdown(fixture("safe.md"), "safe.md"), []);

const findings = scanMarkdown(fixture("unsafe.md"), "unsafe.md");
assert.deepEqual(
  new Set(findings.map((finding) => finding.rule)),
  new Set(["quoted-node-label", "quoted-edge-label", "raw-angle-bracket", "ascii-punctuation"]),
);

console.log("PASS: Mermaid compatibility checker accepts the documented safe subset");
