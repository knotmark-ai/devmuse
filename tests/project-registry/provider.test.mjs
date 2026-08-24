import assert from "node:assert/strict";
import test from "node:test";

import { providerTransition, classifyOutcome, PROVIDER_STATES } from "../../plugin/runtime/project-registry/provider.mjs";
import { xrayCapabilities, xrayReadTestsRequest, normalizeXrayTest } from "../../plugin/runtime/project-registry/providers/xray.mjs";

// --- provider state machine ---

test("adoption requires approval and starts from Local", () => {
  assert.equal(providerTransition({ state: "Local", event: "adopt" }).reason, "approval-required");
  assert.equal(providerTransition({ state: "Local", event: "adopt", approved: true }).state, "ProviderCanonical");
  assert.equal(providerTransition({ state: "ProviderCanonical", event: "adopt", approved: true }).reason, "already-provider-backed");
});

test("an outage moves to PendingSync and NEVER silently demotes to Local", () => {
  const out = providerTransition({ state: "ProviderCanonical", event: "outage" });
  assert.equal(out.state, "PendingSync");
  // The only path back to Local is an explicit, approved force-local (UC-C6).
  assert.equal(providerTransition({ state: "PendingSync", event: "force-local" }).reason, "approval-required");
  assert.equal(providerTransition({ state: "PendingSync", event: "force-local", approved: true }).state, "Local");
  assert.equal(providerTransition({ state: "PendingSync", event: "restore" }).state, "ProviderCanonical");
});

test("migration requires approval and a complete id map, preserved on success", () => {
  assert.equal(providerTransition({ state: "ProviderCanonical", event: "migrate", approved: true }).reason, "incomplete-migration");
  const migrated = providerTransition({
    state: "ProviderCanonical", event: "migrate", approved: true,
    migration: { from: "xray", to: "testrail", idMap: { "tc:proj-1": "TR-9" } },
  });
  assert.equal(migrated.state, "ProviderCanonical");
  assert.equal(migrated.migration.idMap["tc:proj-1"], "TR-9");
});

test("outcome classification: transient = unavailable, auth = denied (not an outage)", () => {
  assert.equal(classifyOutcome({ ok: true }).status, "available");
  assert.equal(classifyOutcome({ reason: "timeout" }).status, "unavailable");
  assert.equal(classifyOutcome({ reason: "5xx" }).status, "unavailable");
  assert.equal(classifyOutcome({ reason: "unauthorized" }).status, "denied");
  assert.equal(PROVIDER_STATES.length, 3);
});

// --- Xray reference adapter (fixtures, no network) ---

test("the read request is project-scoped and carries no credentials", () => {
  assert.equal(xrayReadTestsRequest({ baseUrl: "http://insecure", projectKey: "PROJ" }).reason, "bad-base-url");
  assert.equal(xrayReadTestsRequest({ baseUrl: "https://x.atlassian.net", projectKey: "bad key" }).reason, "bad-project-key");
  const built = xrayReadTestsRequest({ baseUrl: "https://x.atlassian.net", projectKey: "PROJ", since: "2026-01-01" });
  assert.equal(built.status, "ready");
  assert.match(built.request.query.jql, /project = PROJ AND issuetype = Test/);
  assert.match(built.request.query.jql, /updated >= "2026-01-01"/);
  // No Authorization header — the transport applies auth from the credential store.
  assert.equal("Authorization" in built.request.headers, false);
  assert.equal(JSON.stringify(built).toLowerCase().includes("token"), false);
});

test("a provider test record normalizes to a registry reference, not a payload copy", () => {
  const normalized = normalizeXrayTest({ key: "PROJ-12", fields: { summary: "Login works", status: { name: "Approved" }, updated: "2026-08-01T00:00:00Z" } });
  assert.equal(normalized.status, "ok");
  assert.equal(normalized.asset.id, "tc:proj-12");
  assert.equal(normalized.asset.kind, "test_cases");
  assert.deepEqual(normalized.asset.locator, { provider: "xray", ref: "PROJ-12" });
  assert.equal(normalized.asset.fields.title, "Login works");
  assert.equal(normalized.providerRevision, "xray:2026-08-01T00:00:00Z");
  assert.equal(normalizeXrayTest({ nope: 1 }).reason, "missing-key");
});

test("capabilities are declared design-time-only until validated against live", () => {
  assert.equal(xrayCapabilities().validated_against_live, false);
  assert.equal(xrayCapabilities().test_cases_crud, true);
});
