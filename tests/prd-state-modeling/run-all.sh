#!/usr/bin/env bash
# Model-churn regression routine: run every prd-state-modeling scenario against
# the current default model and auto-judge each against its README criteria.
#
# Run this on every default-model change — the upstream lesson is that each model
# release re-breaks skill triggering, so the suite is only meaningful against the
# model actually in use. Usage:
#   ./run-all.sh [max-turns]        # run + judge all scenarios, print a summary
#   SCENARIOS="a b" ./run-all.sh    # run only the named scenarios
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_TURNS="${1:-6}"

if [ -n "${SCENARIOS:-}" ]; then
    names="$SCENARIOS"
else
    names="$(for f in "$SCRIPT_DIR"/prompts/*.txt; do basename "$f" .txt; done)"
fi

model="$(claude --version 2>/dev/null || echo unknown)"
echo "=== prd-state-modeling model-churn run ==="
echo "CLI: $model"
echo

pass=0; fail=0; errored=0
summary=""
for name in $names; do
    printf 'RUN  %-32s ' "$name"
    # Capture the run's own transcript path; judging a stale prior-model transcript
    # would silently corrupt the model-churn signal this routine exists to give.
    run_output="$("$SCRIPT_DIR/run-test.sh" "prompts/$name.txt" "$MAX_TURNS" 2>/dev/null)"
    tx="$(printf '%s\n' "$run_output" | sed -n 's/^TRANSCRIPT_PATH=//p' | tail -1)"
    tx_status="$(printf '%s\n' "$run_output" | sed -n 's/^TRANSCRIPT_STATUS=//p' | tail -1)"
    if [ -z "$tx" ] || [ ! -s "$tx" ] || [ "${tx_status:-1}" != "0" ]; then
        echo "ERROR (no fresh transcript)"; errored=$((errored+1)); summary="${summary}ERROR $name (run produced no transcript)\n"
        continue
    fi
    verdict_json="$("$SCRIPT_DIR/judge.sh" "$name" "$tx" 2>/dev/null)"
    status=$?
    if [ $status -eq 0 ]; then
        echo "PASS"; pass=$((pass+1)); summary="${summary}PASS  $name\n"
    elif [ $status -eq 1 ]; then
        echo "FAIL"; fail=$((fail+1)); summary="${summary}FAIL  $name\n"
    else
        echo "ERROR (setup/judge)"; errored=$((errored+1)); summary="${summary}ERROR $name\n"
    fi
done

echo
echo "=== summary ==="
printf '%b' "$summary"
echo "pass=$pass fail=$fail error=$errored"
# Non-zero exit if any scenario regressed or could not be judged.
[ $fail -eq 0 ] && [ $errored -eq 0 ]
