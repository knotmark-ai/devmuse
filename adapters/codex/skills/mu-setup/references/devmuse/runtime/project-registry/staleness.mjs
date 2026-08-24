// Coverage staleness. A Test Result is the anchor: it records the revisions of
// the requirement/example, the test case, and the code it ran against, plus the
// environment. Coverage is stale when any bound asset revision differs from the
// asset's current revision — so "covered" never hides a requirement or test that
// moved after its last run (UC-C10, AC#11). `environment` is a recorded axis,
// never a substitute for a revision axis.

const REVISION_AXES = Object.freeze(["requirement", "acceptance_example", "test_case", "code"]);

// result: { boundRevisions: { requirement?, acceptance_example?, test_case?, code? }, environment? } | null
// current: { requirement?, acceptance_example?, test_case?, code? } — current revisions of the bound assets
export function coverageStaleness(result, current = {}) {
  if (!result || typeof result !== "object" || !result.boundRevisions || typeof result.boundRevisions !== "object") {
    return { status: "uncovered", staleAxes: [] };
  }
  const bound = result.boundRevisions;
  const boundAxes = REVISION_AXES.filter((axis) => bound[axis] !== undefined && bound[axis] !== null);
  // A result that bound nothing is not coverage — never "covered".
  if (boundAxes.length === 0) return { status: "uncovered", staleAxes: [] };
  // Every bound axis needs a current revision to compare against; without it we
  // cannot assert coverage — report `unknown`, never a positive "covered".
  const missingAxes = boundAxes.filter((axis) => current[axis] === undefined || current[axis] === null);
  if (missingAxes.length > 0) {
    return { status: "unknown", staleAxes: [], missingAxes, environment: result.environment ?? null };
  }
  const staleAxes = boundAxes.filter((axis) => current[axis] !== bound[axis]);
  return { status: staleAxes.length > 0 ? "stale" : "covered", staleAxes, environment: result.environment ?? null };
}

export { REVISION_AXES };
