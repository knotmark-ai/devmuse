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
