function allRequiredPrsResolved(requiredPrs) {
  return requiredPrs.length > 0 && requiredPrs.every((pullRequest) => pullRequest?.merged === true || pullRequest?.waived === true);
}

function allPassed(results, { requireOne = false } = {}) {
  return (!requireOne || results.length > 0) && results.every((result) => result?.status === "passed");
}

const STATES = new Set(["Scoped", "Implementing", "Reviewing", "MergedPendingDelivery", "Complete", "Cancelled"]);
const EVENTS = new Set([
  "first-meaningful-commit", "tasks-verified", "changes-requested", "merged",
  "external-work-verified", "last-active-pr-closed", "cancelled",
]);

export function projectDelivery({ currentState, event, requiredPrs = [], acceptanceResults = [], externalTaskResults = [] } = {}) {
  // Reject unknown vocabulary instead of falling through to "no-transition":
  // a typo must not read as a silent keep-open from a projector the skills treat
  // as canonical.
  if (!STATES.has(currentState)) return { currentState: currentState ?? null, issueAction: "keep_open", reason: "unknown-state" };
  if (!EVENTS.has(event)) return { currentState, issueAction: "keep_open", reason: "unknown-event" };
  if (["Complete", "Cancelled"].includes(currentState)) return { currentState, issueAction: "close", reason: "terminal" };
  if (event === "cancelled") return { currentState: "Cancelled", issueAction: "close", reason: "cancelled" };
  if (event === "last-active-pr-closed" && ["Implementing", "Reviewing"].includes(currentState)) {
    return { currentState: "Scoped", issueAction: "keep_open", reason: "no-active-pr" };
  }
  if (currentState === "Scoped" && event === "first-meaningful-commit") {
    return { currentState: "Implementing", issueAction: "keep_open", reason: "implementation-started" };
  }
  if (currentState === "Implementing" && event === "tasks-verified") {
    return { currentState: "Reviewing", issueAction: "keep_open", reason: "review-ready" };
  }
  if (currentState === "Reviewing" && event === "changes-requested") {
    return { currentState: "Implementing", issueAction: "keep_open", reason: "changes-requested" };
  }

  const projectionRequested = (currentState === "Reviewing" && event === "merged")
    || (currentState === "MergedPendingDelivery" && event === "external-work-verified");
  if (projectionRequested) {
    // Preserve the current state — a required-PR-remaining check must never move
    // MergedPendingDelivery backward to Reviewing (that would reopen review after
    // merge and break monotonicity).
    if (!allRequiredPrsResolved(requiredPrs)) return { currentState, issueAction: "keep_open", reason: "required-prs-remaining" };
    if (!allPassed(acceptanceResults, { requireOne: true })) return { currentState, issueAction: "keep_open", reason: "acceptance-unverified" };
    if (!allPassed(externalTaskResults)) return { currentState: "MergedPendingDelivery", issueAction: "keep_open", reason: "external-work-remaining" };
    return { currentState: "Complete", issueAction: "close", reason: "all-acceptance-verified" };
  }
  return { currentState, issueAction: "keep_open", reason: "no-transition" };
}
