// Manifest v1 -> v2 migration. `mu-setup` is the only writer, and it presents the
// proposal before any tracked write (UC-C5). This module only *proposes* — it
// computes the v2 manifest and a human-readable change list and performs no I/O.
import { validateRouting, defaultRouting } from "./routing.mjs";

// v1Value: the parsed v1 manifest value (from project-context manifest.mjs).
// routing: a `cases:` block to install, or omitted for the repository default.
export function proposeV2Migration(v1Value, routing = null) {
  if (!v1Value || typeof v1Value !== "object") return { status: "invalid", reason: "missing-v1-manifest", writes: false };
  const routingResult = routing === null ? { status: "valid", value: defaultRouting() } : validateRouting(routing);
  if (routingResult.status !== "valid") return { status: "invalid", reason: routingResult.reason, writes: false };

  const proposal = {
    schema_version: 2,
    project: v1Value.project,
    collaboration: v1Value.collaboration,
    artifacts: v1Value.artifacts,
    cases: routingResult.value,
  };
  const changes = [
    "schema_version: 1 -> 2",
    `cases.registry: ${routingResult.value.registry}`,
    ...Object.entries(routingResult.value.routes).map(([key, provider]) => `cases.routes.${key}: ${provider}`),
  ];
  // writes:false is the contract signal — a caller (mu-setup) must obtain
  // approval and perform the tracked write itself; this never touches disk.
  return { status: "proposed", proposal, changes, writes: false };
}
