#!/usr/bin/env node

import assert from "node:assert/strict";
import { subtractUsage, summarizeLog } from "../../scripts/summarize-token-benchmark.mjs";

const log = [
  JSON.stringify({ type: "assistant", message: { usage: { input_tokens: 999 } } }),
  JSON.stringify({
    type: "result",
    usage: {
      input_tokens: 10,
      cache_creation_input_tokens: 20,
      cache_read_input_tokens: 30,
      output_tokens: 5
    },
    total_cost_usd: 0.01
  }),
  "not-json"
].join("\n");

const usage = summarizeLog(log);
assert.deepEqual(usage, {
  inputTokens: 10,
  cacheCreationTokens: 20,
  cacheReadTokens: 30,
  outputTokens: 5,
  totalInputTokens: 60,
  totalTokens: 65,
  reportedCostUsd: 0.01,
  turns: 1
});
assert.equal(subtractUsage(usage, { ...usage, totalTokens: 40 }).totalTokens, 25);

console.log("PASS: token benchmark counts result events once and separates baseline traffic");
