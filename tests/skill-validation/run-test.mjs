#!/usr/bin/env node

import assert from "node:assert/strict";
import { validateSkillText } from "../../scripts/validate-skills.mjs";

const valid = `---
name: demo-skill
description: Use when a deterministic demo is needed
---

# Demo
`;
assert.deepEqual(validateSkillText(valid, "demo-skill"), []);

const invalid = `---
name: Wrong_Name
description: ""
unknown-field: true
---
`;
assert.deepEqual(
  new Set(validateSkillText(invalid, "demo-skill").map((finding) => finding.rule)),
  new Set(["frontmatter-field", "name", "directory-name", "description", "body"]),
);

const malformedQuote = `---
name: demo-skill
description: "unterminated
---
# Demo
`;
assert.ok(validateSkillText(malformedQuote, "demo-skill").some((finding) => finding.rule === "frontmatter-syntax"));

console.log("PASS: skill validator rejects malformed metadata");
