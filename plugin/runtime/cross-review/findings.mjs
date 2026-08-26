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
// A codex review whose text is empty or explicitly says there is nothing to flag.
// The WHOLE trimmed verdict must BE a clean phrase — anchored, allow-listed. A
// short abnormal output ("No issues could be checked because the transport changed
// format") merely CONTAINS "no issues" and must not read as clean (#51).
const CODEX_CLEAN = /^(?:no issues(?: found)?|no findings|no concerns|no problems|nothing to (?:flag|report)|looks good|lgtm)[.!]?$/i;
// `recognized` distinguishes a genuine clean review (empty or a clean sentinel, or
// a report we parsed bullets from) from an UNRECOGNIZED format — if codex changes
// its report shape, we must NOT silently return "clean" and drop real findings (#51).
export function extractCodexReviewFindings(text) {
  const findings = [];
  if (typeof text !== "string") return { findings, recognized: false };
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
  // Recognized when: we parsed at least one finding, OR the text is empty, OR it
  // is a SHORT clean verdict (a clean sentinel, under 240 chars, with no priority
  // marker). Long prose with no bullets — or text that merely mentions "no issues"
  // inside a larger changed-format report — is an unrecognized shape → the caller
  // degrades, never a silent "clean".
  const looksClean = CODEX_CLEAN.test(text.trim()) && !/\[P\d+\]/i.test(text);
  const recognized = findings.length > 0 || text.trim() === "" || looksClean;
  return { findings, recognized };
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
  // EVERY item must be a well-formed finding (an object with a non-empty summary).
  // A single null/shapeless entry means the structured output is untrustworthy, so
  // fail CLOSED — do not silently drop it and trust the rest (#51). An empty array
  // is a clean review (no findings), which is fine.
  const wellFormed = (item) => item && typeof item === "object" && !Array.isArray(item)
    && typeof item.summary === "string" && item.summary.trim().length > 0;
  if (!list.every(wellFormed)) return { status: "invalid", reason: "malformed-findings", findings: [] };
  const findings = list.map((item) => ({
    severity: normalizeSeverity(item.severity),
    file: typeof item.file === "string" ? item.file : null,
    line: Number.isInteger(item.line) ? item.line : null,
    summary: item.summary,
    reviewer: reviewer ?? "external",
    model,
  }));
  return { status: "ok", findings };
}

function locationKey(finding) {
  return `${finding.file ?? ""}:${finding.line ?? ""}`;
}

function hasLocation(finding) {
  return Boolean(finding.file) || Number.isInteger(finding.line);
}

function normalizedSummary(finding) {
  return String(finding.summary ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Two findings agree only when BOTH severity and normalized content match. Same
// severity is not agreement — "line X is unsafe" and "line X is safe" are both
// `important` yet opposite conclusions, and must surface as a contradiction (#4).
function sameConclusion(a, b) {
  return a.severity === b.severity && normalizedSummary(a) === normalizedSummary(b);
}

// Merge primary and external findings. An external finding is a `contradiction`
// when the primary set flagged nothing at that location OR reached a different
// conclusion (severity or content) there; agreeing findings are kept once with
// both provenances. Never drops or silently overrides either side. A location is
// a bucket of findings (many can share one line), and location-less findings are
// each kept distinct rather than collapsed into a single ":" slot.
export function mergeFindings(primary = [], external = []) {
  const merged = [];
  const contradictions = [];
  const byLocation = new Map();
  for (const finding of primary) {
    if (!hasLocation(finding)) continue; // never key a location-less finding to ":"
    const key = locationKey(finding);
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push({ finding, matched: false });
  }

  for (const ext of external) {
    const slot = hasLocation(ext) ? byLocation.get(locationKey(ext)) : null;
    if (!slot || slot.length === 0) {
      // A location (or location-less finding) the primary review did not raise.
      contradictions.push({ location: hasLocation(ext) ? locationKey(ext) : null, primary: null, external: ext });
      merged.push({ ...ext, provenance: [ext.reviewer], contested: true });
      continue;
    }
    const agree = slot.find((entry) => !entry.matched && sameConclusion(entry.finding, ext));
    if (agree) {
      agree.matched = true;
      merged.push({ ...agree.finding, provenance: ["primary", ext.reviewer], contested: false });
    } else {
      // A primary exists here but disagrees; pair with the first unmatched one.
      const counter = slot.find((entry) => !entry.matched) ?? slot[0];
      counter.matched = true;
      contradictions.push({ location: locationKey(ext), primary: counter.finding, external: ext });
      merged.push({ ...counter.finding, provenance: ["primary", ext.reviewer], contested: true, externalSeverity: ext.severity, externalSummary: ext.summary });
    }
  }
  // Emit every primary no external matched — located-unmatched plus all location-less.
  for (const finding of primary) {
    if (!hasLocation(finding)) { merged.push({ ...finding, provenance: ["primary"], contested: false }); continue; }
    const entry = byLocation.get(locationKey(finding))?.find((e) => e.finding === finding);
    if (entry && !entry.matched) merged.push({ ...finding, provenance: ["primary"], contested: false });
  }
  return { merged, contradictions };
}
