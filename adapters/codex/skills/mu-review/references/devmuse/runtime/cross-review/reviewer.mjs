// Host-aware reciprocal cross-review command construction.
//
// Cross-review means a review by a genuinely different model family, so the
// reviewer is chosen relative to the current host: Claude Code delegates to
// Codex, Codex delegates to Claude Code, and any other host uses an explicitly
// configured different-family reviewer or has no capability. The current host is
// never its own external reviewer, and a reviewer process can never launch
// another cross-review.

// Recursion guard: set in the reviewer subprocess environment so a reviewer that
// itself runs DevMuse cannot start a second cross-review.
export const RECURSION_ENV = "DEVMUSE_CROSS_REVIEW_ACTIVE";

const HOST_FAMILY = { claude: "anthropic", codex: "openai" };

// Default reciprocal reviewer per host. Other hosts must configure one explicitly.
const RECIPROCAL = {
  claude: { host: "codex", family: "openai" },
  codex: { host: "claude", family: "anthropic" },
};

function familyOf(host) {
  return HOST_FAMILY[host] ?? null;
}

// Build the argv/env for a one-shot, read-only, ephemeral cross-review. Returns a
// discriminated result: `unavailable` (no reciprocal and none configured),
// `recursion-blocked` (already inside a cross-review), `same-family` (misconfig),
// or `ready` with `{ command, args, env, cwd }`. Never throws on policy denial —
// a denial must degrade, not crash the primary review.
export function buildInvocation({
  currentHost,
  projectDir,
  refs = [],
  reviewer = null, // explicit override: { host, family, binary, authHome }
  env = {},
  outputPath,
} = {}) {
  if (env[RECURSION_ENV] === "1") return { status: "recursion-blocked", reason: "already-in-cross-review" };
  if (typeof projectDir !== "string" || projectDir.length === 0) return { status: "invalid", reason: "missing-project-dir" };
  if (typeof outputPath !== "string" || outputPath.length === 0) return { status: "invalid", reason: "missing-output-path" };

  const target = reviewer ?? RECIPROCAL[currentHost] ?? null;
  if (!target || !target.host) return { status: "unavailable", reason: "no-configured-reviewer" };

  const hostFamily = familyOf(currentHost);
  const targetFamily = target.family ?? familyOf(target.host);
  if (hostFamily && targetFamily && hostFamily === targetFamily) {
    // Would review with the same family as the host — not cross-review.
    return { status: "same-family", reason: "reviewer-shares-host-family", host: currentHost, reviewer: target.host };
  }

  const childEnv = { ...env, [RECURSION_ENV]: "1" };
  if (target.host === "codex") {
    return {
      status: "ready",
      reviewer: "codex",
      command: target.binary ?? "codex",
      // `codex exec review` runs non-interactively with the existing ChatGPT
      // login. Ephemeral + ignore-user-config/rules keep it stateless and free of
      // unrelated user execution rules; output goes to a validated file.
      args: [
        "exec", "review",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--output-last-message", outputPath,
        ...(target.authHome ? ["--config-home", target.authHome] : []),
        ...refSpec(refs),
      ],
      env: childEnv,
      cwd: projectDir,
    };
  }
  if (target.host === "claude") {
    return {
      status: "ready",
      reviewer: "claude",
      command: target.binary ?? "claude",
      // Headless, read-only, ephemeral: no persisted session, no cross-project
      // memory, JSON output validated by the caller rather than trusted by exit.
      args: [
        "-p", crossReviewPrompt(refs),
        "--permission-mode", "plan",
        "--output-format", "json",
        ...(target.authHome ? ["--settings", target.authHome] : []),
      ],
      env: childEnv,
      cwd: projectDir,
    };
  }
  return { status: "unavailable", reason: "unsupported-reviewer-host" };
}

function refSpec(refs) {
  // Only well-formed ref/range tokens reach argv; never interpolate free text.
  return refs
    .filter((ref) => typeof ref === "string" && /^[A-Za-z0-9._/~^-]+(\.\.\.?[A-Za-z0-9._/~^-]+)?$/.test(ref))
    .flatMap((ref) => ["--base-ref", ref]);
}

function crossReviewPrompt(refs) {
  const range = refs.find((ref) => typeof ref === "string" && /\.\.\.?/.test(ref)) ?? "the current branch against its merge-base with the default branch";
  return `Review ${range} for correctness, security, and requirements regressions. Inspect the repository directly; do not trust a serialized diff. Respond with JSON: {"findings":[{"severity":"critical|important|minor","file":"","line":0,"summary":""}]}.`;
}

export { familyOf };
