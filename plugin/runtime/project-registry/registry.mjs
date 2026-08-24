// Behavior data plane: the registry assets and their relations. Each asset has a
// stable DevMuse identity that survives provider changes, repo moves, and Scope
// closure (UC-CR1), a content-hash revision, provenance, ownership, status, a
// locator to its current provider address, and typed many-to-many relations.
import { createHash } from "node:crypto";

import { ASSET_KINDS } from "./routing.mjs";

const KIND_SET = new Set(ASSET_KINDS);
const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}:[A-Za-z0-9._-]{1,128}$/; // e.g. "duc:checkout-flow"
const RELATION_TYPES = new Set(["refines", "covers", "exemplifies", "verifies", "depends-on"]);

// Deterministic canonical JSON: object keys sorted recursively, so a registry
// file diffs cleanly in review regardless of insertion order (UC — Git-reviewable
// truth). Arrays keep their order (the author's meaningful order).
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

// A content-hash revision over the identity-bearing content of an asset — its id,
// kind, normalized fields, AND its typed relations — excluding volatile metadata
// (the revision itself, provenance timestamps, the locator). Relations are the
// traceability graph #68 exists to protect, so re-pointing a `covers`/`verifies`
// edge must change the revision; excluding them let a silent edge rewrite pass the
// integrity gate (I-1). Relations are normalized and order-independent so an
// equivalent set hashes identically. Stable across checkouts, needs no counter.
export function assetRevision(asset) {
  const relations = (Array.isArray(asset.relations) ? asset.relations : [])
    .map((relation) => ({ type: relation?.type ?? null, to: relation?.to ?? null }))
    .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  const content = { id: asset.id, kind: asset.kind, fields: asset.fields ?? {}, relations };
  return `sha256:${createHash("sha256").update(canonicalJson(content), "utf8").digest("hex")}`;
}

export function makeLocator(provider, ref) {
  if (typeof provider !== "string" || provider.length === 0) return null;
  return { provider, ref: ref ?? null };
}

export function validateAsset(asset) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) return { status: "invalid", reason: "asset-not-a-map" };
  if (!ID_PATTERN.test(asset.id ?? "")) return { status: "invalid", reason: "invalid-id" };
  if (!KIND_SET.has(asset.kind)) return { status: "invalid", reason: "unknown-kind" };
  if (asset.fields !== undefined && (asset.fields === null || typeof asset.fields !== "object" || Array.isArray(asset.fields))) {
    return { status: "invalid", reason: "fields-not-a-map" };
  }
  const relations = asset.relations ?? [];
  if (!Array.isArray(relations)) return { status: "invalid", reason: "relations-not-a-list" };
  for (const relation of relations) {
    if (!relation || typeof relation !== "object" || !RELATION_TYPES.has(relation.type) || !ID_PATTERN.test(relation.to ?? "")) {
      return { status: "invalid", reason: "invalid-relation" };
    }
  }
  return { status: "valid" };
}

// Attach/refresh the computed revision. Callers store the returned asset.
export function withRevision(asset) {
  return { ...asset, revision: assetRevision(asset) };
}

// Serialize one asset kind's file: a sorted, pretty JSON document. Assets are
// sorted by id so the file order is stable and review diffs are minimal.
export function serializeRegistryFile(kind, assets) {
  if (!KIND_SET.has(kind)) throw Object.assign(new Error(`unknown kind: ${kind}`), { code: "unknown-kind" });
  for (const asset of assets) {
    const check = validateAsset(asset);
    if (check.status !== "valid") throw Object.assign(new Error(`invalid asset: ${check.reason}`), { code: check.reason });
    if (asset.kind !== kind) throw Object.assign(new Error("asset kind does not match file kind"), { code: "kind-mismatch" });
  }
  const sorted = [...assets].map(withRevision).sort((a, b) => a.id.localeCompare(b.id));
  return `${JSON.stringify({ schema: 1, kind, assets: sorted }, null, 2)}\n`;
}

export function parseRegistryFile(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { status: "invalid", reason: "unparseable", assets: [] };
  }
  if (!doc || doc.schema !== 1 || !KIND_SET.has(doc.kind) || !Array.isArray(doc.assets)) {
    return { status: "invalid", reason: "bad-registry-file", assets: [] };
  }
  const seen = new Set();
  for (const asset of doc.assets) {
    const check = validateAsset(asset);
    if (check.status !== "valid") return { status: "invalid", reason: check.reason, assets: [] };
    // Every asset must belong to this file's kind — a test-case in the
    // product-use-case file is a corrupt canonical record.
    if (asset.kind !== doc.kind) return { status: "invalid", reason: "kind-mismatch", assets: [] };
    // IDs are unique within a kind file; a duplicate silently drops data.
    if (seen.has(asset.id)) return { status: "invalid", reason: "duplicate-id", assets: [] };
    seen.add(asset.id);
    // A canonical asset must carry its content-hash revision, and it must match —
    // a hand-edit without rehashing is rejected rather than trusted.
    if (!asset.revision) return { status: "invalid", reason: "missing-revision", assets: [] };
    if (asset.revision !== assetRevision(asset)) return { status: "invalid", reason: "revision-mismatch", assets: [] };
  }
  return { status: "valid", kind: doc.kind, assets: doc.assets };
}

export { RELATION_TYPES };
