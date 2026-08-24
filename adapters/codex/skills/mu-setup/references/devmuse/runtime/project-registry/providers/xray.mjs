// Reference provider adapter: Xray (test management, delivered through Jira).
// This is the one worked adapter proving the provider contract. It is a
// DESIGN-TIME capability model plus deterministic request-building and response
// normalization — it must be validated against a live Xray/Jira before being
// marked supported, and claims no parity with other providers.
//
// The adapter never holds credentials. It builds a request DESCRIPTOR (method,
// url, query, non-secret headers); a transport applies auth from the host
// credential store. DevMuse stores normalized references + revisions, never a
// drifting prose copy of the provider payload.

// Capability model for Xray, mirroring the design-time matrix. Every cell is a
// claim to verify against the live provider, not an assertion of parity.
export function xrayCapabilities() {
  return {
    provider: "xray",
    requirements_read: "via-jira",
    test_cases_crud: true,
    runs_results: true,
    custom_links: "via-jira-issue-links",
    revision_reads: "jira-issue-history",
    conditional_write: "jira-version",
    validated_against_live: false, // flips true only after a live-provider check
  };
}

// Build a read request for a project's Xray tests. No credentials in the
// descriptor — the transport adds Authorization from the credential store.
export function xrayReadTestsRequest({ baseUrl, projectKey, since = null } = {}) {
  if (typeof baseUrl !== "string" || !/^https:\/\//.test(baseUrl)) return { status: "invalid", reason: "bad-base-url" };
  if (typeof projectKey !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(projectKey)) return { status: "invalid", reason: "bad-project-key" };
  const jql = `project = ${projectKey} AND issuetype = Test${since ? ` AND updated >= "${since}"` : ""}`;
  return {
    status: "ready",
    request: {
      method: "GET",
      url: `${baseUrl.replace(/\/+$/, "")}/rest/api/2/search`,
      query: { jql, fields: "summary,status,updated,issuelinks" },
      headers: { Accept: "application/json" }, // no Authorization here, by contract
    },
  };
}

// Normalize one Jira/Xray test issue into a registry reference. Stores the
// locator + a revision derived from the provider's own change stamp, plus
// minimal normalized fields — not the full payload.
export function normalizeXrayTest(record) {
  if (!record || typeof record !== "object" || typeof record.key !== "string") {
    return { status: "invalid", reason: "missing-key" };
  }
  const fields = record.fields ?? {};
  const asset = {
    id: `tc:${record.key.toLowerCase()}`,
    kind: "test_cases",
    fields: {
      title: typeof fields.summary === "string" ? fields.summary : "",
      status: fields.status?.name ?? null,
    },
    locator: { provider: "xray", ref: record.key },
    provenance: { source: "xray", provider_updated: fields.updated ?? null },
  };
  // The provider's own revision stamp (updated timestamp) is the reference's
  // revision cursor — DevMuse tracks it to detect provider-side drift.
  const providerRevision = typeof fields.updated === "string" ? `xray:${fields.updated}` : null;
  return { status: "ok", asset, providerRevision };
}
