// User-level preferences and the project-over-user precedence contract (UC-C9).
// Personal defaults live in a user config file and apply across projects; a
// project's own tracked configuration always wins, and reading/applying a
// preference never rewrites the user's global default.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ROUTE_KEYS, PROVIDERS } from "./routing.mjs";

const ROUTE_KEY_SET = new Set(ROUTE_KEYS);
const PROVIDER_SET = new Set(PROVIDERS);

// Keep only recognized route keys mapped to recognized providers. Unknown keys or
// providers are dropped rather than trusted — a stale or hand-edited file (or an
// unvalidated CLI input) never smuggles an invalid provider into resolution (M-3).
function sanitizeRoutes(routes) {
  const clean = {};
  if (routes && typeof routes === "object" && !Array.isArray(routes)) {
    for (const [key, provider] of Object.entries(routes)) {
      if (ROUTE_KEY_SET.has(key) && PROVIDER_SET.has(provider)) clean[key] = provider;
    }
  }
  return clean;
}

// The user preferences file — host-agnostic, outside any repo. Overridable by
// DEVMUSE_CONFIG_HOME; otherwise XDG, then ~/.config.
export function preferencesPath(env = process.env) {
  const home = env.DEVMUSE_CONFIG_HOME
    ?? (env.XDG_CONFIG_HOME ? path.join(env.XDG_CONFIG_HOME, "devmuse") : path.join(os.homedir(), ".config", "devmuse"));
  return path.join(home, "preferences.json");
}

// Read personal default routes. Absent file → empty defaults (not an error).
// Unknown route keys/providers are ignored rather than trusted, so a stale
// personal file never corrupts a project.
export function readPreferences(env = process.env) {
  const file = preferencesPath(env);
  if (!fs.existsSync(file)) return { status: "absent", routes: {} };
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { status: "unreadable", routes: {} };
  }
  const rawRoutes = (doc && doc.cases && typeof doc.cases.routes === "object" && doc.cases.routes) || {};
  return { status: "present", routes: sanitizeRoutes(rawRoutes) };
}

// Persist personal default routes to the user file. Writes ONLY the user
// config (never a repo/project path), and only the recognized routes — a
// project override is applied at read time by resolveEffectiveRoutes and never
// written back here, so a per-project choice can never rewrite the user default.
export function writePreferences(routes = {}, env = process.env) {
  const clean = sanitizeRoutes(routes);
  const file = preferencesPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ cases: { routes: clean } }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  // The `mode` option only applies when creating a new file; enforce user-private
  // permissions on rewrite too, so an older 0644 file is tightened (M-1).
  fs.chmodSync(file, 0o600);
  return { status: "written", file, routes: clean };
}

// Merge routes with precedence: PROJECT (explicitly set) > USER preference >
// repository default. `projectRoutes` holds only the routes the project set;
// project policy always wins, and the user default fills only the gaps. Returns
// a full routing object plus a per-kind `sources` map for transparency.
export function resolveEffectiveRoutes(projectRoutes = {}, preferenceRoutes = {}) {
  // Sanitize BOTH sides so an unknown provider on the project side is not trusted
  // any more than one on the user side — symmetric validation (M-3).
  const project = sanitizeRoutes(projectRoutes);
  const preference = sanitizeRoutes(preferenceRoutes);
  const routes = {};
  const sources = {};
  for (const key of ROUTE_KEYS) {
    if (project[key] !== undefined) {
      routes[key] = project[key];
      sources[key] = "project";
    } else if (preference[key] !== undefined) {
      routes[key] = preference[key];
      sources[key] = "user";
    } else {
      routes[key] = "repository";
      sources[key] = "default";
    }
  }
  return { routes, sources };
}
