// Manifest serialization and routing read-back — the other half of the loop that
// makes the registry usable: proposeV2Migration builds a v2 value, this writes it
// as YAML the project-context parser accepts, and readRouting validates the
// parsed `cases:` block into a usable asset router.
import { validateRouting } from "./routing.mjs";

const ROUTE_ORDER = ["product_requirements", "rules", "acceptance_examples", "test_cases", "test_results"];

function scalar(value) {
  return value === null || value === undefined ? "null" : String(value);
}

// Serialize a manifest value (v1 members + optional v2 `cases:`) into the exact
// 2-space grammar parseProjectManifest accepts. Values are bareword-safe by
// construction (ids, repo slugs, provider tokens, artifact paths); null → `null`.
export function serializeManifest(value) {
  const lines = [
    `schema_version: ${scalar(value.schema_version)}`,
    "project:",
    `  id: ${scalar(value.project.id)}`,
    `  repository: ${scalar(value.project.repository)}`,
    "collaboration:",
    `  provider: ${scalar(value.collaboration.provider)}`,
    `  mode: ${scalar(value.collaboration.mode)}`,
    "artifacts:",
    `  prd: ${scalar(value.artifacts.prd)}`,
    "  architecture:",
    `    index: ${scalar(value.artifacts.architecture.index)}`,
    `    domain_model: ${scalar(value.artifacts.architecture.domain_model)}`,
  ];
  if (value.cases) {
    lines.push("cases:");
    lines.push(`  registry: ${scalar(value.cases.registry ?? "repository")}`);
    const routes = value.cases.routes ?? {};
    if (ROUTE_ORDER.some((key) => routes[key] !== undefined)) {
      lines.push("  routes:");
      for (const key of ROUTE_ORDER) {
        if (routes[key] !== undefined) lines.push(`    ${key}: ${scalar(routes[key])}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

// Validate the `cases:` block of a parsed manifest into a usable router. Returns
// { status:"none" } for a v1 manifest (no cases → repository default is applied
// by the caller), or validateRouting's result for a v2 cases block.
export function readRouting(manifestValue) {
  if (!manifestValue || !manifestValue.cases) return { status: "none" };
  return validateRouting(manifestValue.cases);
}
