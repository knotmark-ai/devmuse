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
    if (!migration || typeof migration.from !== "string" || typeof migration.to !== "string" || typeof migration.idMap !== "object") {
      return { status: "blocked", reason: "incomplete-migration" };
    }
    // Migration preserves stable IDs and old->new locators + provenance (UC-C7).
    return { status: "ok", state: "ProviderCanonical", migration: { from: migration.from, to: migration.to, idMap: migration.idMap } };
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
