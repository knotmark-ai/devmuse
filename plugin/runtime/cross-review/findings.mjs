// Normalize an external reviewer's structured output into DevMuse findings and
// merge them with the primary review, preserving provenance and surfacing
// contradictions rather than silently choosing a side.

const SEVERITY = new Set(["critical", "important", "minor"]);
const SEVERITY_ALIAS = { high: "important", medium: "minor", low: "minor", warning: "minor", error: "important", info: "minor" };

function normalizeSeverity(value) {
  const key = String(value ?? "").toLowerCase();
  if (SEVERITY.has(key)) return key;
  return SEVERITY_ALIAS[key] ?? "minor";
}

// Unwrap claude's `-p --output-format json` envelope down to the schema-conforming
// payload. That flag emits either a single `{result}` object or an ARRAY of stream
// events whose terminal `type:"result"` element carries the final text (C3). Naively
// handing the array to the normalizer made the event list itself look like the
// findings list — one phantom finding per event. Returns the inner value (object or
// JSON string) for the normalizer to validate; the raw input when it can't unwrap
// (so a non-conforming reviewer degrades to `invalid`, never phantom findings).
export function extractClaudeStructuredOutput(raw) {
  let value;
  try {
    value = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return raw;
  }
  if (value && !Array.isArray(value) && typeof value === "object") {
    if (Array.isArray(value.findings)) return value;       // already the payload
    if (value.result !== undefined) return value.result;   // {result} envelope
    return raw;
  }
  if (Array.isArray(value)) {
    const result = value.find((event) => event && event.type === "result" && event.result !== undefined);
    if (result) return result.result;
    const parts = [];
    for (const event of value) {
      const content = event?.message?.content;
      if (Array.isArray(content)) for (const block of content) if (block?.type === "text") parts.push(block.text);
    }
    if (parts.length) return parts.join("\n");
  }
  return raw;
}

// codex `exec review` does NOT honor --output-schema — verified live against
// codex-cli 0.149.1, its --output-last-message carries codex's native review
// report, not `{findings}` (M4). The report is a summary line followed by
// priority-tagged bullets:  `- [P1] <title> — <file>:<start>[-<end>]`, each with
// an indented body. Parse that into findings; an empty/clean report yields `{findings:[]}`.
const CODEX_PRIORITY = { P0: "critical", P1: "important", P2: "minor", P3: "minor" };
export function extractCodexReviewFindings(text) {
  const findings = [];
  if (typeof text !== "string") return { findings };
  for (const line of text.split(/\r?\n/)) {
    const bullet = line.match(/^\s*-\s*\[(P\d+)\]\s*(.+)$/);
    if (!bullet) continue;
    const severity = CODEX_PRIORITY[bullet[1]] ?? "minor";
    let summary = bullet[2].trim();
    let file = null;
    let lineNo = null;
    // Split off a trailing " — <file>:<start>[-<end>]" locator when present. The
    // em dash separates title from locator; the line range sits at the very end.
    const located = summary.match(/^(.*?)\s+—\s+(.+?):(\d+)(?:-\d+)?\s*$/);
    if (located) {
      summary = located[1].trim();
      file = located[2];
      lineNo = Number.parseInt(located[3], 10);
    }
    findings.push({ severity, file, line: lineNo, summary });
  }
  return { findings };
}

// Validate the structured payload rather than trusting a zero exit. Returns a
// typed result: `invalid` when the reviewer produced no usable findings array,
// otherwise `ok` with normalized findings carrying reviewer provenance.
export function normalizeExternalFindings(raw, { reviewer, model = null } = {}) {
  let payload = raw;
  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch {
      return { status: "invalid", reason: "unparseable-output", findings: [] };
    }
  }
  const list = Array.isArray(payload) ? payload : payload?.findings;
  if (!Array.isArray(list)) return { status: "invalid", reason: "no-findings-array", findings: [] };
  const findings = list.map((item) => ({
    severity: normalizeSeverity(item?.severity),
    file: typeof item?.file === "string" ? item.file : null,
    line: Number.isInteger(item?.line) ? item.line : null,
    summary: typeof item?.summary === "string" ? item.summary : String(item?.summary ?? ""),
    reviewer: reviewer ?? "external",
    model,
  }));
  return { status: "ok", findings };
}

function locationKey(finding) {
  return `${finding.file ?? ""}:${finding.line ?? ""}`;
}

// Merge primary and external findings. Findings at the same file:line where the
// primary set found nothing OR disagrees on severity are flagged `contradiction`
// so both are shown side by side; matching findings are kept once with both
// provenances. Never drops or silently overrides either side.
export function mergeFindings(primary = [], external = []) {
  const byLocation = new Map();
  for (const finding of primary) {
    const key = locationKey(finding);
    byLocation.set(key, { primary: finding, external: null });
  }
  const contradictions = [];
  const merged = [];
  for (const finding of external) {
    const key = locationKey(finding);
    const existing = byLocation.get(key);
    if (!existing) {
      // The external reviewer flagged a location the primary review did not.
      contradictions.push({ location: key, primary: null, external: finding });
      merged.push({ ...finding, provenance: [finding.reviewer], contested: true });
    } else if (existing.primary.severity !== finding.severity) {
      contradictions.push({ location: key, primary: existing.primary, external: finding });
      merged.push({ ...existing.primary, provenance: ["primary", finding.reviewer], contested: true, externalSeverity: finding.severity });
    } else {
      merged.push({ ...existing.primary, provenance: ["primary", finding.reviewer], contested: false });
    }
    if (existing) existing.external = finding;
  }
  for (const finding of primary) {
    const key = locationKey(finding);
    if (!byLocation.get(key).external) merged.push({ ...finding, provenance: ["primary"], contested: false });
  }
  return { merged, contradictions };
}
