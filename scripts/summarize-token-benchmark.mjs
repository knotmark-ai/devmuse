#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const usageFields = ["inputTokens", "cacheCreationTokens", "cacheReadTokens", "outputTokens"];

function emptyUsage() {
  return {
    inputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    totalInputTokens: 0,
    totalTokens: 0,
    reportedCostUsd: 0,
    turns: 0,
  };
}

export function summarizeLog(text) {
  const total = emptyUsage();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type !== "result" || !event.usage) continue;
    total.inputTokens += event.usage.input_tokens ?? 0;
    total.cacheCreationTokens += event.usage.cache_creation_input_tokens ?? 0;
    total.cacheReadTokens += event.usage.cache_read_input_tokens ?? 0;
    total.outputTokens += event.usage.output_tokens ?? 0;
    total.reportedCostUsd += event.total_cost_usd ?? 0;
    total.turns += 1;
  }
  total.totalInputTokens = total.inputTokens + total.cacheCreationTokens + total.cacheReadTokens;
  total.totalTokens = total.totalInputTokens + total.outputTokens;
  return total;
}

export function subtractUsage(task, baseline) {
  return Object.fromEntries(
    [...usageFields, "totalInputTokens", "totalTokens"].map((field) => [field, task[field] - baseline[field]]),
  );
}

function sumLogs(directory) {
  const result = emptyUsage();
  const files = fs.readdirSync(directory).filter((name) => /^turn-\d+\.jsonl$/.test(name)).sort();
  for (const file of files) {
    const usage = summarizeLog(fs.readFileSync(path.join(directory, file), "utf8"));
    for (const field of [...usageFields, "reportedCostUsd", "turns"]) result[field] += usage[field];
  }
  result.totalInputTokens = result.inputTokens + result.cacheCreationTokens + result.cacheReadTokens;
  result.totalTokens = result.totalInputTokens + result.outputTokens;
  return result;
}

function mean(values, field) {
  return values.reduce((sum, value) => sum + value[field], 0) / values.length;
}

function aggregate(samples) {
  const usage = emptyUsage();
  for (const field of [...usageFields, "totalInputTokens", "totalTokens", "reportedCostUsd", "turns"]) {
    usage[field] = mean(samples.map((sample) => sample.usage), field);
  }
  return {
    samples: samples.length,
    usage,
    totalTokensRange: [
      Math.min(...samples.map((sample) => sample.usage.totalTokens)),
      Math.max(...samples.map((sample) => sample.usage.totalTokens)),
    ],
  };
}

export function summarizeDirectory(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  const samples = [];
  const runDirectories = fs.readdirSync(directory).filter((name) => /^run-\d+$/.test(name)).sort();
  for (const run of runDirectories) {
    for (const scenario of manifest.scenarios) {
      const scenarioDirectory = path.join(directory, run, scenario.id);
      if (!fs.existsSync(scenarioDirectory)) continue;
      samples.push({ run, id: scenario.id, usage: sumLogs(scenarioDirectory) });
    }
  }

  const results = manifest.scenarios.flatMap((scenario) => {
    const matches = samples.filter((sample) => sample.id === scenario.id);
    if (matches.length === 0) return [];
    return [{ id: scenario.id, kind: scenario.kind, baseline: scenario.baseline, compareTo: scenario.compareTo, ...aggregate(matches) }];
  });
  const byId = new Map(results.map((result) => [result.id, result]));
  for (const result of results) {
    if (result.baseline && byId.has(result.baseline)) {
      result.estimatedTaskUsage = subtractUsage(result.usage, byId.get(result.baseline).usage);
    }
    if (result.compareTo && byId.has(result.compareTo)) {
      const comparison = byId.get(result.compareTo).usage.totalTokens;
      result.totalTokenRatio = comparison === 0 ? null : result.usage.totalTokens / comparison;
    }
  }
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), results };
}

function markdown(summary) {
  const rows = summary.results.map((result) => {
    const delta = result.estimatedTaskUsage ? Math.round(result.estimatedTaskUsage.totalTokens).toLocaleString("en-US") : "-";
    const ratio = result.totalTokenRatio == null ? "-" : `${result.totalTokenRatio.toFixed(2)}x`;
    return `| ${result.id} | ${result.samples} | ${Math.round(result.usage.totalInputTokens).toLocaleString("en-US")} | ${Math.round(result.usage.outputTokens).toLocaleString("en-US")} | ${Math.round(result.usage.totalTokens).toLocaleString("en-US")} | ${delta} | ${ratio} |`;
  });
  return [
    "# DevMuse token benchmark",
    "",
    "Token counts come from Claude Code result events. Reported cost is retained in JSON but never recalculated with hard-coded prices.",
    "",
    "| Scenario | Samples | Input incl. cache | Output | Total traffic | Est. task traffic | vs comparison |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...rows,
    "",
    "`Est. task traffic` subtracts the matching fixed baseline. It is an estimate; cache behavior can make individual components negative.",
    "",
  ].join("\n");
}

function runCli(args) {
  if (args.length !== 1) {
    console.error("Usage: node scripts/summarize-token-benchmark.mjs <benchmark-output-directory>");
    return 2;
  }
  const directory = path.resolve(args[0]);
  const summary = summarizeDirectory(directory);
  fs.writeFileSync(path.join(directory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(path.join(directory, "summary.md"), markdown(summary));
  console.log(markdown(summary));
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = runCli(process.argv.slice(2));
