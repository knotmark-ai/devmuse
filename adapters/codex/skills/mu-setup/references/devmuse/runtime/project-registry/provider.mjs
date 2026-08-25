// Provider adoption / outage / migration state machine, per asset kind. The
// load-bearing invariant: a temporary outage is NOT "no provider" (UC-C6) — it
// moves to PendingSync and never silently forks a second local authority. A
// return to a local backend is always an explicit, approved decision.

export const PROVIDER_STATES = Object.freeze(["Local", "ProviderCanonical", "PendingSync"]);

// Transition the per-kind provider state. Returns { status: "ok", state, ... } or
// { status: "blocked", reason } — a denial degrades, never throws on policy.
// Approval is required for every transition that changes canonical authority.
export function providerTransition({ state = "Local", event, approved = false, migration = null } = {}) {
  if (!PROVIDER_STATES.includes(state)) return { status: "blocked", reason: "unknown-state" };

  if (event === "adopt") {
    if (state !== "Local") return { status: "blocked", reason: "already-provider-backed" };
    if (!approved) return { status: "blocked", reason: "approval-required" };
    return { status: "ok", state: "ProviderCanonical" };
  }
  if (event === "outage") {
    // Only meaningful when a provider is canonical; never demotes to Local.
    if (state !== "ProviderCanonical") return { status: "blocked", reason: "no-canonical-provider" };
    return { status: "ok", state: "PendingSync", note: "provider-unavailable-pending-sync" };
  }
  if (event === "restore") {
    if (state !== "PendingSync") return { status: "blocked", reason: "not-pending" };
    return { status: "ok", state: "ProviderCanonical" };
  }
  if (event === "migrate") {
    if (state !== "ProviderCanonical") return { status: "blocked", reason: "no-canonical-provider" };
    if (!approved) return { status: "blocked", reason: "approval-required" };
    // A complete migration is not just PRESENT evidence — it is INTERNALLY
    // CONSISTENT evidence (UC-C7): trimmed non-empty from/to providers, a non-empty
    // id map to non-empty target locators, a locator history whose recorded target
    // AGREES with the id map's target (no contradiction), an EXPLICIT links array
    // (so "no links" is asserted, never assumed from omission), and non-empty
    // provenance. Blank/whitespace evidence and contradictory history are rejected.
    const nonEmpty = (value) => typeof value === "string" && value.trim().length > 0;
    const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    const idMap = migration?.idMap;
    const validIdMap = isPlainObject(idMap)
      && Object.keys(idMap).length > 0
      && Object.entries(idMap).every(([id, target]) => nonEmpty(id) && nonEmpty(target));
    // History target must AGREE with the id map's canonical target for every asset.
    const history = migration?.locatorHistory;
    const validHistory = validIdMap && isPlainObject(history)
      && Object.keys(history).every((id) => Object.hasOwn(idMap, id))
      && Object.keys(idMap).every((id) => history[id] && nonEmpty(history[id].from) && nonEmpty(history[id].to)
        && history[id].to === idMap[id]); // contradiction (to !== canonical target) is rejected
    // Links must be an EXPLICIT array (empty is fine only when explicitly asserted);
    // an omitted `links` is incomplete, not silently "no links".
    const links = migration?.links;
    const validLinks = Array.isArray(links)
      && links.every((link) => link && nonEmpty(link.from) && nonEmpty(link.type) && nonEmpty(link.to));
    if (!migration || !nonEmpty(migration.from) || !nonEmpty(migration.to)
      || !validIdMap || !validHistory || !validLinks || !nonEmpty(migration.provenance)) {
      return { status: "blocked", reason: "incomplete-migration" };
    }
    return {
      status: "ok",
      state: "ProviderCanonical",
      migration: { from: migration.from, to: migration.to, idMap, locatorHistory: history, links, provenance: migration.provenance },
    };
  }
  if (event === "force-local") {
    // The ONLY path back to Local, and only with explicit approval (UC-C6:
    // never silently replace an unavailable provider with a local authority).
    if (!approved) return { status: "blocked", reason: "approval-required" };
    return { status: "ok", state: "Local", note: "explicit-local-fallback" };
  }
  return { status: "blocked", reason: "unknown-event" };
}

// Classify a provider probe/call outcome. `available` keeps the provider
// canonical; `unavailable` drives an outage (-> PendingSync); `denied` is an
// authorization problem, not an outage, and never forks local truth.
export function classifyOutcome(outcome = {}) {
  if (outcome.ok === true) return { status: "available" };
  const transient = new Set(["timeout", "connection-refused", "5xx", "rate-limited", "dns"]);
  if (transient.has(outcome.reason)) return { status: "unavailable", reason: outcome.reason };
  if (outcome.reason === "unauthorized" || outcome.reason === "forbidden") return { status: "denied", reason: outcome.reason };
  return { status: "unavailable", reason: outcome.reason ?? "unknown" };
}
