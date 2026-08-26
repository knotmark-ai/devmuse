// Control plane: the asset router. Which provider is canonical for each asset
// kind. This is the `cases.routes` block of the v2 manifest. The registry is
// logical — routing per kind is what lets requirements, test design, and
// execution live in different systems (UC-C3).

// The five asset kinds, each with a distinct lifecycle (UC-CR2 — never one
// generic record moving through stages).
export const ASSET_KINDS = Object.freeze([
  "product_use_cases",
  "rules",
  "acceptance_examples",
  "test_cases",
  "test_results",
]);

// The route key names in the manifest (a stable external vocabulary). Product
// use cases and rules are both "requirements" surface; keep separate route keys
// so a project can send them to different systems.
export const ROUTE_KEYS = Object.freeze([
  "product_requirements",
  "rules",
  "acceptance_examples",
  "test_cases",
  "test_results",
]);

// Recognized provider tokens. `repository` and `ci` are always available;
// external SaaS tokens name a provider adapter that must be validated against
// the live provider before it is marked supported (design-time capability
// model, no implied parity).
export const PROVIDERS = Object.freeze([
  "repository", "ci", "jira", "xray", "qtest", "qase", "practitest", "testrail", "elm",
]);

const ROUTE_KEY_SET = new Set(ROUTE_KEYS);
const PROVIDER_SET = new Set(PROVIDERS);

// Any kind with no configured provider defaults to the repository backend.
export function defaultRouting() {
  return { registry: "repository", routes: Object.fromEntries(ROUTE_KEYS.map((key) => [key, "repository"])) };
}

// Validate a `cases:` block. Returns { status: "valid", value } or
// { status: "invalid", reason }. Unknown keys or providers are rejected rather
// than invented (UC-CR4 — never invent a provider the schema merely permits).
export function validateRouting(cases) {
  if (cases === null || typeof cases !== "object" || Array.isArray(cases)) return { status: "invalid", reason: "cases-not-a-map" };
  const allowed = new Set(["registry", "routes"]);
  if (Object.keys(cases).some((key) => !allowed.has(key))) return { status: "invalid", reason: "unknown-cases-key" };
  const registry = cases.registry ?? "repository";
  if (!PROVIDER_SET.has(registry)) return { status: "invalid", reason: "unknown-registry-provider" };
  const routes = cases.routes ?? {};
  if (routes === null || typeof routes !== "object" || Array.isArray(routes)) return { status: "invalid", reason: "routes-not-a-map" };
  for (const [key, provider] of Object.entries(routes)) {
    if (!ROUTE_KEY_SET.has(key)) return { status: "invalid", reason: "unknown-route-key" };
    if (!PROVIDER_SET.has(provider)) return { status: "invalid", reason: "unknown-route-provider" };
  }
  // Fill unspecified routes with the repository default.
  const filled = Object.fromEntries(ROUTE_KEYS.map((key) => [key, routes[key] ?? "repository"]));
  return { status: "valid", value: { registry, routes: filled } };
}

// Which provider owns a route key. Unknown key is a programming error, not input.
export function resolveProvider(routing, routeKey) {
  if (!ROUTE_KEY_SET.has(routeKey)) throw Object.assign(new Error(`unknown route key: ${routeKey}`), { code: "unknown-route-key" });
  return routing.routes[routeKey] ?? "repository";
}

// The route key that owns each asset kind. Names line up except that the
// `product_requirements` route owns the `product_use_cases` kind.
export const ROUTE_BY_KIND = Object.freeze({
  product_use_cases: "product_requirements",
  rules: "rules",
  acceptance_examples: "acceptance_examples",
  test_cases: "test_cases",
  test_results: "test_results",
});

// The asset kinds whose effective route is the repository backend — the only kinds
// mu-setup may create local canonical files for. A kind routed to CI or an external
// provider must NOT get a repository file, or setup forks a competing local
// authority for data another system owns (the no-silent-fork rule).
export function repositoryOwnedKinds(routes = {}) {
  return ASSET_KINDS.filter((kind) => (routes[ROUTE_BY_KIND[kind]] ?? "repository") === "repository");
}
