#!/usr/bin/env node
// Thin CLI over the cross-review runtime. snake_case in, snake_case out.
//   plan       — build and print the reviewer invocation (no execution)
//   run        — execute the invocation with a bounded timeout and fallback
//   normalize  — normalize a reviewer's raw JSON output into DevMuse findings
//   merge      — merge primary and external findings, surfacing contradictions
import { buildInvocation } from "./reviewer.mjs";
import { runCrossReview } from "./runner.mjs";
import { normalizeExternalFindings, mergeFindings } from "./findings.mjs";

function write(value, status = 0) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
  process.exitCode = status;
}

const CAMEL = /_([a-z0-9])/g;
function camelizeKeys(value) {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key.replace(CAMEL, (_, c) => c.toUpperCase())] = camelizeKeys(item);
    return out;
  }
  return value;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.trim() ? camelizeKeys(JSON.parse(text)) : {};
}

const command = process.argv[2] ?? "plan";
try {
  const input = await readStdin();
  if (command === "plan") {
    write(buildInvocation({ ...input, env: input.env ?? process.env }));
  } else if (command === "run") {
    const invocation = buildInvocation({ ...input, env: input.env ?? process.env });
    write(await runCrossReview(invocation, { outputPath: input.outputPath }));
  } else if (command === "normalize") {
    write(normalizeExternalFindings(input.raw, { reviewer: input.reviewer, model: input.model }));
  } else if (command === "merge") {
    write(mergeFindings(input.primary ?? [], input.external ?? []));
  } else {
    write({ error: { code: "unknown-command" } }, 2);
  }
} catch (error) {
  write({ error: { code: error.code ?? "operation-failed" } }, 1);
}
