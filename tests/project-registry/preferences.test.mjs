import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  preferencesPath,
  readPreferences,
  writePreferences,
  resolveEffectiveRoutes,
} from "../../plugin/runtime/project-registry/preferences.mjs";

// A throwaway config home so tests never touch the real user file.
function tempEnv(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "devmuse-prefs-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { DEVMUSE_CONFIG_HOME: dir };
}

test("preferencesPath honors DEVMUSE_CONFIG_HOME, then XDG, then ~/.config", () => {
  assert.equal(preferencesPath({ DEVMUSE_CONFIG_HOME: "/x" }), path.join("/x", "preferences.json"));
  assert.equal(preferencesPath({ XDG_CONFIG_HOME: "/y" }), path.join("/y", "devmuse", "preferences.json"));
  assert.equal(preferencesPath({}), path.join(os.homedir(), ".config", "devmuse", "preferences.json"));
});

test("an absent user file reads as empty defaults, not an error", (t) => {
  const env = tempEnv(t);
  assert.deepEqual(readPreferences(env), { status: "absent", routes: {} });
});

test("write then read round-trips only recognized routes", (t) => {
  const env = tempEnv(t);
  const res = writePreferences({ test_cases: "xray", bogus_kind: "xray", rules: "not_a_provider" }, env);
  assert.equal(res.status, "written");
  assert.deepEqual(res.routes, { test_cases: "xray" }); // unknown key/provider dropped
  assert.deepEqual(readPreferences(env), { status: "present", routes: { test_cases: "xray" } });
  // The file is written user-private (0600).
  assert.equal(fs.statSync(preferencesPath(env)).mode & 0o777, 0o600);
});

test("a malformed user file degrades to empty, never throws", (t) => {
  const env = tempEnv(t);
  fs.mkdirSync(env.DEVMUSE_CONFIG_HOME, { recursive: true });
  fs.writeFileSync(preferencesPath(env), "{ not json");
  assert.deepEqual(readPreferences(env), { status: "unreadable", routes: {} });
});

test("precedence: project route wins, user default fills gaps, else repository", () => {
  const project = { test_cases: "xray" };            // project set only this one
  const user = { test_cases: "qase", test_results: "ci" }; // user prefers these
  const { routes, sources } = resolveEffectiveRoutes(project, user);
  assert.equal(routes.test_cases, "xray");    // project overrides user
  assert.equal(sources.test_cases, "project");
  assert.equal(routes.test_results, "ci");    // user default fills the gap
  assert.equal(sources.test_results, "user");
  assert.equal(routes.rules, "repository");   // neither set → repository
  assert.equal(sources.rules, "default");
});

test("applying a project override never rewrites the user default", (t) => {
  const env = tempEnv(t);
  writePreferences({ test_cases: "qase" }, env);
  const before = fs.readFileSync(preferencesPath(env), "utf8");
  // Resolve with a project override on the same route.
  const merged = resolveEffectiveRoutes({ test_cases: "xray" }, readPreferences(env).routes);
  assert.equal(merged.routes.test_cases, "xray");
  // The user file is byte-identical — the override lives only in the resolved view.
  assert.equal(fs.readFileSync(preferencesPath(env), "utf8"), before);
  assert.deepEqual(readPreferences(env).routes, { test_cases: "qase" });
});
