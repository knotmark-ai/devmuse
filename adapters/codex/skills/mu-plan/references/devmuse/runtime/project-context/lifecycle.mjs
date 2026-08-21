function allRequiredPrsResolved(requiredPrs) {
  return requiredPrs.length > 0 && requiredPrs.every((pullRequest) => pullRequest?.merged === true || pullRequest?.waived === true);
}

function allPassed(results, { requireOne = false } = {}) {
  return (!requireOne || results.length > 0) && results.every((result) => result?.status === "passed");
}

export function projectDelivery({ currentState, event, requiredPrs = [], acceptanceResults = [], externalTaskResults = [] } = {}) {
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
    if (!allRequiredPrsResolved(requiredPrs)) return { currentState: "Reviewing", issueAction: "keep_open", reason: "required-prs-remaining" };
    if (!allPassed(acceptanceResults, { requireOne: true })) return { currentState, issueAction: "keep_open", reason: "acceptance-unverified" };
    if (!allPassed(externalTaskResults)) return { currentState: "MergedPendingDelivery", issueAction: "keep_open", reason: "external-work-remaining" };
    return { currentState: "Complete", issueAction: "close", reason: "all-acceptance-verified" };
  }
  return { currentState, issueAction: "keep_open", reason: "no-transition" };
}
