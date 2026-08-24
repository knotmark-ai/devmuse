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

// Env-override surface (documented contract). Binary and config-home let a user
// point at a specific CLI/auth without shell aliases; timeout/depth are read by
// the runner and the caller.
export const ENV_BINARY = "DEVMUSE_CROSS_REVIEW_BINARY";
export const ENV_CONFIG_HOME = "DEVMUSE_CROSS_REVIEW_CONFIG_HOME";
export const ENV_TIMEOUT_MS = "DEVMUSE_CROSS_REVIEW_TIMEOUT_MS";

// The structured output both reviewers must emit; the runner writes this to a
// temp file and passes it as the reviewer's output schema, then validates the
// result against it rather than trusting a zero exit.
export const FINDINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["findings"],
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "summary"],
        properties: {
          severity: { type: "string", enum: ["critical", "important", "minor"] },
          file: { type: "string" },
          line: { type: "integer" },
          summary: { type: "string" },
        },
      },
    },
  },
};

const HOST_FAMILY = { claude: "anthropic", codex: "openai" };
const RECIPROCAL = {
  claude: { host: "codex", family: "openai" },
  codex: { host: "claude", family: "anthropic" },
};

function familyOf(host) {
  return HOST_FAMILY[host] ?? null;
}

// The base BRANCH for the review, extracted from a `<base>...HEAD` range or a
// bare branch. codex `exec review --base` takes a branch, not a range. Split on
// the range separator first so the base cannot swallow it.
function baseBranch(refs) {
  for (const ref of refs) {
    if (typeof ref !== "string") continue;
    const candidate = ref.split(/\.\.\.?/)[0];
    if (candidate.length > 0 && !candidate.startsWith("-") && !candidate.includes("..") && /^[A-Za-z0-9._/-]+$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

// Build the argv/env for a one-shot, read-only, ephemeral cross-review. Returns a
// discriminated result: `unavailable`, `recursion-blocked`, `same-family`,
// `invalid`, or `ready` with `{ command, args, env, cwd, outputMode }`. Never
// throws on policy denial — a denial must degrade, not crash the primary review.
export function buildInvocation({
  currentHost,
  projectDir,
  refs = [],
  reviewer = null, // explicit override: { host, family, binary, authHome }
  env = {},
  outputPath,
  schemaPath,
} = {}) {
  if (env[RECURSION_ENV] === "1") return { status: "recursion-blocked", reason: "already-in-cross-review" };
  if (typeof projectDir !== "string" || projectDir.length === 0) return { status: "invalid", reason: "missing-project-dir" };
  if (typeof outputPath !== "string" || outputPath.length === 0) return { status: "invalid", reason: "missing-output-path" };
  if (typeof schemaPath !== "string" || schemaPath.length === 0) return { status: "invalid", reason: "missing-schema-path" };

  const target = reviewer ?? RECIPROCAL[currentHost] ?? null;
  if (!target || !target.host) return { status: "unavailable", reason: "no-configured-reviewer" };

  const hostFamily = familyOf(currentHost);
  const targetFamily = target.family ?? familyOf(target.host);
  if (hostFamily && targetFamily && hostFamily === targetFamily) {
    return { status: "same-family", reason: "reviewer-shares-host-family", host: currentHost, reviewer: target.host };
  }

  const binary = target.binary ?? env[ENV_BINARY] ?? null;
  const authHome = target.authHome ?? env[ENV_CONFIG_HOME] ?? null;
  const childEnv = { ...env, [RECURSION_ENV]: "1" };

  if (target.host === "codex") {
    const base = baseBranch(refs);
    if (!base) return { status: "invalid", reason: "missing-base-branch" };
    // Auth home for codex is CODEX_HOME, not a --config-home flag.
    if (authHome) childEnv.CODEX_HOME = authHome;
    return {
      status: "ready",
      reviewer: "codex",
      command: binary ?? "codex",
      // Verified against codex 0.149.1: --base <BRANCH>, --output-schema <FILE>,
      // --output-last-message <FILE>, --ephemeral/--ignore-user-config/--ignore-rules.
      args: [
        "exec", "review",
        "--base", base,
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--skip-git-repo-check",
        "--output-schema", schemaPath,
        "--output-last-message", outputPath,
      ],
      env: childEnv,
      cwd: projectDir,
      outputMode: "file",
    };
  }
  if (target.host === "claude") {
    // Auth/config home for claude is CLAUDE_CONFIG_DIR, not --settings.
    if (authHome) childEnv.CLAUDE_CONFIG_DIR = authHome;
    return {
      status: "ready",
      reviewer: "claude",
      command: binary ?? "claude",
      // Read-only (plan mode + an explicit read-only tool allowlist), ephemeral
      // (-p one-shot), structured JSON validated by the caller — never trusted by
      // exit code. Output is on stdout (--output-format json).
      args: [
        "-p", crossReviewPrompt(refs),
        "--permission-mode", "plan",
        "--allowed-tools", "Read", "Glob", "Grep",
        "--output-format", "json",
        "--json-schema", schemaPath,
      ],
      env: childEnv,
      cwd: projectDir,
      outputMode: "stdout",
    };
  }
  return { status: "unavailable", reason: "unsupported-reviewer-host" };
}

function crossReviewPrompt(refs) {
  const range = refs.find((ref) => typeof ref === "string" && /\.\.\.?/.test(ref)) ?? "the current branch against its merge-base with the default branch";
  return `Review ${range} for correctness, security, and requirements regressions. Inspect the repository directly; do not trust a serialized diff. Respond with JSON only: {"findings":[{"severity":"critical|important|minor","file":"","line":0,"summary":""}]}.`;
}

export { familyOf, baseBranch };
