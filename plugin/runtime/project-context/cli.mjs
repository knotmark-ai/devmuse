#!/usr/bin/env node
import { resolveLocalProjectContext, safeProjectContextSummary } from "./resolver.mjs";

const command = process.argv[2] ?? "summary";
try {
  if (command === "summary") {
    const result = await resolveLocalProjectContext({ cwd: process.cwd() });
    process.stdout.write(`${JSON.stringify({ summary: safeProjectContextSummary(result) })}\n`);
  } else if (command === "resolve") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const input = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
    const result = await resolveLocalProjectContext({ cwd: input.cwd ?? process.cwd(), liveRepository: input.live_repository ?? null });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify({ error: { code: "unknown-command" } })}\n`);
    process.exitCode = 2;
  }
} catch {
  process.stdout.write(`${JSON.stringify({ error: { code: "invalid-request" } })}\n`);
  process.exitCode = 2;
}
