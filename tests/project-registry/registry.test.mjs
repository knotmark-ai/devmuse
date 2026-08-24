import assert from "node:assert/strict";
import test from "node:test";

import { defaultRouting, validateRouting, resolveProvider, ASSET_KINDS, ROUTE_KEYS } from "../../plugin/runtime/project-registry/routing.mjs";
import { assetRevision, validateAsset, serializeRegistryFile, parseRegistryFile, canonicalJson, withRevision } from "../../plugin/runtime/project-registry/registry.mjs";
import { coverageStaleness } from "../../plugin/runtime/project-registry/staleness.mjs";
import { proposeV2Migration } from "../../plugin/runtime/project-registry/migration.mjs";

const v1 = { project: { id: "github:x", repository: "github.com/o/r" }, collaboration: { provider: "github", mode: "github-first" }, artifacts: { prd: null, architecture: { index: "docs/architecture.md", domain_model: "CONTEXT.md" } } };

// --- routing ---

test("five asset kinds and route keys, distinct", () => {
  assert.equal(ASSET_KINDS.length, 5);
  assert.equal(new Set(ASSET_KINDS).size, 5);
  assert.equal(ROUTE_KEYS.length, 5);
});

test("routing validation fills defaults and rejects unknown keys/providers", () => {
  const filled = validateRouting({ routes: { test_cases: "xray" } });
  assert.equal(filled.status, "valid");
  assert.equal(filled.value.routes.test_cases, "xray");
  assert.equal(filled.value.routes.acceptance_examples, "repository"); // default fill
  assert.equal(filled.value.registry, "repository");
  assert.equal(validateRouting({ routes: { made_up: "jira" } }).reason, "unknown-route-key");
  assert.equal(validateRouting({ routes: { test_cases: "notaprovider" } }).reason, "unknown-route-provider");
  assert.equal(validateRouting({ registry: "notaprovider" }).reason, "unknown-registry-provider");
  assert.equal(validateRouting({ extra: 1 }).reason, "unknown-cases-key");
  assert.equal(resolveProvider(defaultRouting(), "test_results"), "repository");
});

// --- registry entity model ---

test("asset revision is a content hash: stable, and changes only with content", () => {
  const a = { id: "duc:checkout", kind: "product_use_cases", fields: { title: "Checkout", consequence: "order placed" } };
  const r1 = assetRevision(a);
  assert.match(r1, /^sha256:[a-f0-9]{64}$/);
  // Re-hashing identical content is stable; volatile metadata is excluded.
  assert.equal(assetRevision({ ...a, revision: "sha256:old", provenance: { created_at: "whenever" }, locator: { provider: "jira", ref: "PROJ-1" } }), r1);
  // Changing a content field changes the revision.
  assert.notEqual(assetRevision({ ...a, fields: { title: "Checkout", consequence: "order confirmed" } }), r1);
});

test("asset revision covers typed relations — re-pointing an edge is detected (I-1)", () => {
  const base = { id: "tc:x", kind: "test_cases", fields: { n: 1 }, relations: [{ type: "verifies", to: "duc:login" }] };
  const r1 = assetRevision(base);
  // Re-pointing the edge to a different target changes the revision (was excluded before).
  assert.notEqual(assetRevision({ ...base, relations: [{ type: "verifies", to: "duc:elsewhere" }] }), r1);
  // Relation order is not significant — an equivalent set hashes identically.
  const two = { ...base, relations: [{ type: "verifies", to: "duc:a" }, { type: "covers", to: "rule:b" }] };
  const twoReordered = { ...base, relations: [{ type: "covers", to: "rule:b" }, { type: "verifies", to: "duc:a" }] };
  assert.equal(assetRevision(two), assetRevision(twoReordered));
  // End to end: a serialized asset whose relation target is hand-edited without
  // rehashing is rejected as revision-mismatch (the integrity gate now protects relations).
  const file = serializeRegistryFile("test_cases", [base]);
  const tampered = file.replace("duc:login", "duc:attacker");
  assert.equal(parseRegistryFile(tampered).reason, "revision-mismatch");
});

test("canonical JSON sorts object keys for clean diffs, preserves array order", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});

test("asset validation checks id, kind, and relations", () => {
  assert.equal(validateAsset({ id: "duc:x", kind: "product_use_cases" }).status, "valid");
  assert.equal(validateAsset({ id: "BAD ID", kind: "rules" }).reason, "invalid-id");
  assert.equal(validateAsset({ id: "duc:x", kind: "not_a_kind" }).reason, "unknown-kind");
  assert.equal(validateAsset({ id: "tc:x", kind: "test_cases", relations: [{ type: "nope", to: "duc:y" }] }).reason, "invalid-relation");
  assert.equal(validateAsset({ id: "tc:x", kind: "test_cases", relations: [{ type: "verifies", to: "duc:y" }] }).status, "valid");
});

test("serialize/parse round-trips, sorts by id, and rejects a hand-edited revision", () => {
  const assets = [
    { id: "duc:b", kind: "product_use_cases", fields: { n: 2 } },
    { id: "duc:a", kind: "product_use_cases", fields: { n: 1 } },
  ];
  const file = serializeRegistryFile("product_use_cases", assets);
  const parsed = parseRegistryFile(file);
  assert.equal(parsed.status, "valid");
  assert.deepEqual(parsed.assets.map((a) => a.id), ["duc:a", "duc:b"]); // sorted
  assert.match(parsed.assets[0].revision, /^sha256:/);
  // Tamper with a field without rehashing → revision-mismatch.
  const tampered = file.replace('"n": 1', '"n": 999');
  assert.equal(parseRegistryFile(tampered).reason, "revision-mismatch");
  assert.equal(parseRegistryFile("{not json").reason, "unparseable");
  assert.equal(parseRegistryFile('{"schema":1,"kind":"nope","assets":[]}').reason, "bad-registry-file");
});

// --- staleness (result-anchored) ---

test("coverage staleness is result-anchored across all four revision axes", () => {
  assert.equal(coverageStaleness(null).status, "uncovered");
  const result = { boundRevisions: { requirement: "r1", test_case: "t1", code: "c1" }, environment: "ci-linux" };
  assert.equal(coverageStaleness(result, { requirement: "r1", test_case: "t1", code: "c1" }).status, "covered");
  const stale = coverageStaleness(result, { requirement: "r2", test_case: "t1", code: "c1" });
  assert.equal(stale.status, "stale");
  assert.deepEqual(stale.staleAxes, ["requirement"]);
});

test("parse enforces kind-match, id-uniqueness, and revision presence", () => {
  const foreign = withRevision({ id: "tc:x", kind: "test_cases", fields: {} });
  assert.equal(parseRegistryFile(JSON.stringify({ schema: 1, kind: "rules", assets: [foreign] })).reason, "kind-mismatch");
  const a = withRevision({ id: "rule:a", kind: "rules", fields: { n: 1 } });
  assert.equal(parseRegistryFile(JSON.stringify({ schema: 1, kind: "rules", assets: [a, a] })).reason, "duplicate-id");
  assert.equal(parseRegistryFile(JSON.stringify({ schema: 1, kind: "rules", assets: [{ id: "rule:a", kind: "rules", fields: {} }] })).reason, "missing-revision");
  // A well-formed single asset still parses.
  assert.equal(parseRegistryFile(JSON.stringify({ schema: 1, kind: "rules", assets: [a] })).status, "valid");
});

test("missing or empty comparison evidence is never reported as covered", () => {
  const result = { boundRevisions: { requirement: "r1", test_case: "t1", code: "c1" } };
  // A bound axis with no current revision to compare → unknown, not covered.
  assert.equal(coverageStaleness(result, { acceptance_example: "e9" }).status, "unknown");
  assert.equal(coverageStaleness(result, { requirement: "r1" }).status, "unknown"); // test_case/code missing
  // A result that bound nothing is not coverage.
  assert.equal(coverageStaleness({ boundRevisions: {} }, { requirement: "r1" }).status, "uncovered");
});

test("an under-bound result is partial, not covered — unbound axes could have drifted (M-2)", () => {
  // Only the requirement is bound; test_case and code are not — this must not read as covered.
  const underBound = { boundRevisions: { requirement: "r1" } };
  const result = coverageStaleness(underBound, { requirement: "r1", test_case: "t1", code: "c1" });
  assert.equal(result.status, "partial");
  assert.deepEqual(result.unboundAxes, ["test_case", "code"]);
  // An acceptance_example satisfies the source axis in place of a requirement.
  const full = { boundRevisions: { acceptance_example: "e1", test_case: "t1", code: "c1" } };
  assert.equal(coverageStaleness(full, { acceptance_example: "e1", test_case: "t1", code: "c1" }).status, "covered");
});

// --- migration (proposal only, never writes) ---

test("v1->v2 migration proposes without writing and lists every change", () => {
  const proposal = proposeV2Migration(v1, { routes: { test_cases: "xray", test_results: "ci" } });
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.writes, false);
  assert.equal(proposal.proposal.schema_version, 2);
  assert.equal(proposal.proposal.cases.routes.test_cases, "xray");
  assert.equal(proposal.proposal.project.id, "github:x"); // v1 members carried over
  assert.ok(proposal.changes.includes("schema_version: 1 -> 2"));
  assert.equal(proposeV2Migration(null).reason, "missing-v1-manifest");
  assert.equal(proposeV2Migration(v1, { routes: { bad: "x" } }).reason, "unknown-route-key");
});
