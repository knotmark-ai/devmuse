// Auto-judge for prd-state-modeling: build the judge prompt from a scenario's
// README criteria and parse the judging model's verdict. Kept separate from the
// claude invocation in judge.sh so both halves are unit-testable without a model.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { criteriaFor } from "./parse-criteria.mjs";

// A criteria cell is a semicolon-separated list of independent sub-criteria.
export function splitSubCriteria(criteria) {
  return criteria.split(";").map((part) => part.trim()).filter(Boolean);
}

export function buildJudgePrompt(scenario, transcriptText, readmeText) {
  const { simulates, criteria } = criteriaFor(scenario, readmeText);
  const subs = splitSubCriteria(criteria);
  const list = subs.map((sub, index) => `${index + 1}. ${sub}`).join("\n");
  return [
    "You are grading a DevMuse regression transcript against fixed pass criteria.",
    "Judge ONLY from the transcript below; do not credit a criterion the transcript does not evidence.",
    "",
    `Scenario: ${scenario} — ${simulates}`,
    "",
    "Pass criteria (each must hold independently):",
    list,
    "",
    "Transcript:",
    "<<<TRANSCRIPT",
    transcriptText,
    "TRANSCRIPT",
    "",
    "Respond with ONLY a JSON object, no prose, in this exact shape:",
    '{"criteria":[{"n":1,"verdict":"pass|fail","evidence":"<=200 chars quoting the transcript"}],"overall":"pass|fail"}',
    "overall is \"pass\" only if every criterion is \"pass\".",
  ].join("\n");
}

// Extract the verdict JSON from a model response that may wrap it in prose or a
// code fence. Throws a typed error when no usable verdict is present. When
// `expectedCount` is given, the judge must grade exactly that many criteria —
// otherwise a judge that silently drops the criteria it would fail, or returns an
// empty array, would pass the scenario.
export function parseVerdict(responseText, { expectedCount = null } = {}) {
  const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const brace = responseText.indexOf("{");
  const lastBrace = responseText.lastIndexOf("}");
  if (brace !== -1 && lastBrace > brace) candidates.push(responseText.slice(brace, lastBrace + 1));
  for (const candidate of candidates) {
    let value;
    try {
      value = JSON.parse(candidate);
    } catch {
      continue; // not JSON — try the next candidate
    }
    if (!Array.isArray(value.criteria) || !(value.overall === "pass" || value.overall === "fail")) continue;
    // An empty criteria array graded nothing — it can never be a pass.
    if (value.criteria.length === 0) {
      throw Object.assign(new Error("judge returned no criteria"), { code: "empty-criteria" });
    }
    // The judge must grade every criterion it was asked to; a short array means
    // it dropped some (possibly the ones it would fail).
    if (expectedCount !== null && value.criteria.length !== expectedCount) {
      throw Object.assign(new Error(`judge graded ${value.criteria.length} of ${expectedCount} criteria`), { code: "criteria-count-mismatch" });
    }
    // Recompute overall: every entry must carry an explicit "pass"; anything else
    // (fail, missing, malformed) is not a pass.
    const overall = value.criteria.every((entry) => entry?.verdict === "pass") ? "pass" : "fail";
    return { ...value, overall };
  }
  throw Object.assign(new Error("no valid verdict JSON in judge response"), { code: "unparseable-verdict" });
}

// The number of sub-criteria a scenario is graded on (its expected count).
export function criteriaCount(scenario, readmeText) {
  return splitSubCriteria(criteriaFor(scenario, readmeText).criteria).length;
}

// CLI: `node judge.mjs <scenario> <transcript-file>` prints the judge prompt.
// The verdict half is exercised by judge.sh, which pipes the model response back
// through parseVerdict via `node judge.mjs --parse`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "--parse") {
    // `--parse [expectedCount]` — exit 0 pass, 1 regression (fail), 2 judge fault.
    const expected = rest[0] !== undefined ? Number(rest[0]) : null;
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    try {
      const verdict = parseVerdict(Buffer.concat(chunks).toString("utf8"), { expectedCount: Number.isInteger(expected) ? expected : null });
      process.stdout.write(`${JSON.stringify(verdict)}\n`);
      process.exitCode = verdict.overall === "pass" ? 0 : 1;
    } catch (error) {
      // A judge/setup fault is distinct from a scenario regression (exit 2 vs 1)
      // so run-all.sh does not mislabel a broken judge as a skill regression.
      process.stdout.write(`${JSON.stringify({ error: error.code ?? "judge-fault", message: error.message })}\n`);
      process.exitCode = 2;
    }
  } else if (mode === "--count") {
    process.stdout.write(`${criteriaCount(rest[0])}\n`);
  } else {
    const transcriptText = fs.readFileSync(rest[0], "utf8");
    process.stdout.write(buildJudgePrompt(mode, transcriptText));
  }
}
