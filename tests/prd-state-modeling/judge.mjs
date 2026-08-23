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
// code fence. Throws a typed error when no valid verdict object is present.
export function parseVerdict(responseText) {
  const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const brace = responseText.indexOf("{");
  const lastBrace = responseText.lastIndexOf("}");
  if (brace !== -1 && lastBrace > brace) candidates.push(responseText.slice(brace, lastBrace + 1));
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (Array.isArray(value.criteria) && (value.overall === "pass" || value.overall === "fail")) {
        // Trust the model's per-criterion verdicts, but recompute overall so a
        // model that marks a criterion "fail" cannot still claim overall "pass".
        const overall = value.criteria.every((entry) => entry.verdict === "pass") ? "pass" : "fail";
        return { ...value, overall };
      }
    } catch {
      // try the next candidate
    }
  }
  throw Object.assign(new Error("no valid verdict JSON in judge response"), { code: "unparseable-verdict" });
}

// CLI: `node judge.mjs <scenario> <transcript-file>` prints the judge prompt.
// The verdict half is exercised by judge.sh, which pipes the model response back
// through parseVerdict via `node judge.mjs --parse`.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "--parse") {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const verdict = parseVerdict(Buffer.concat(chunks).toString("utf8"));
    process.stdout.write(`${JSON.stringify(verdict)}\n`);
    process.exitCode = verdict.overall === "pass" ? 0 : 1;
  } else {
    const transcriptText = fs.readFileSync(rest[0], "utf8");
    process.stdout.write(buildJudgePrompt(mode, transcriptText));
  }
}
