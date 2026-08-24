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
  const routes = {};
  for (const [key, provider] of Object.entries(rawRoutes)) {
    if (ROUTE_KEY_SET.has(key) && PROVIDER_SET.has(provider)) routes[key] = provider;
  }
  return { status: "present", routes };
}

// Persist personal default routes to the user file. Writes ONLY the user
// config (never a repo/project path), and only the recognized routes — a
// project override is applied at read time by resolveEffectiveRoutes and never
// written back here, so a per-project choice can never rewrite the user default.
export function writePreferences(routes = {}, env = process.env) {
  const clean = {};
  for (const [key, provider] of Object.entries(routes)) {
    if (ROUTE_KEY_SET.has(key) && PROVIDER_SET.has(provider)) clean[key] = provider;
  }
  const file = preferencesPath(env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ cases: { routes: clean } }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return { status: "written", file, routes: clean };
}

// Merge routes with precedence: PROJECT (explicitly set) > USER preference >
// repository default. `projectRoutes` holds only the routes the project set;
// project policy always wins, and the user default fills only the gaps. Returns
// a full routing object plus a per-kind `sources` map for transparency.
export function resolveEffectiveRoutes(projectRoutes = {}, preferenceRoutes = {}) {
  const routes = {};
  const sources = {};
  for (const key of ROUTE_KEYS) {
    if (projectRoutes[key] !== undefined) {
      routes[key] = projectRoutes[key];
      sources[key] = "project";
    } else if (preferenceRoutes[key] !== undefined) {
      routes[key] = preferenceRoutes[key];
      sources[key] = "user";
    } else {
      routes[key] = "repository";
      sources[key] = "default";
    }
  }
  return { routes, sources };
}
