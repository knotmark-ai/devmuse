# Skill Testing Methodology

**When to use:** Referenced by mu-write-skill during the testing phase of skill creation. Different skill types need different test approaches.

## Skill Types and Their Tests

### Discipline-Enforcing Skills (rules/requirements)

**Examples:** TDD, mu-review, designing-before-coding

**Test with:**
- Academic questions: Do they understand the rules?
- Pressure scenarios: Do they comply under stress?
- Multiple pressures combined: time + sunk cost + exhaustion
- Identify rationalizations and add explicit counters

**Success criteria:** Agent follows rule under maximum pressure.

### Technique Skills (how-to guides)

**Examples:** condition-based-waiting, root-cause-tracing, defensive-programming

**Test with:**
- Application scenarios: Can they apply the technique correctly?
- Variation scenarios: Do they handle edge cases?
- Missing information tests: Do instructions have gaps?

**Success criteria:** Agent successfully applies technique to new scenario.

### Pattern Skills (mental models)

**Examples:** reducing-complexity, information-hiding concepts

**Test with:**
- Recognition scenarios: Do they recognize when pattern applies?
- Application scenarios: Can they use the mental model?
- Counter-examples: Do they know when NOT to apply?

**Success criteria:** Agent correctly identifies when/how to apply pattern.

### Reference Skills (documentation/APIs)

**Examples:** API documentation, command references, library guides

**Test with:**
- Retrieval scenarios: Can they find the right information?
- Application scenarios: Can they use what they found correctly?
- Gap testing: Are common use cases covered?

**Success criteria:** Agent finds and correctly applies reference information.

## Pressure Scenarios (for Discipline-Enforcing Skills)

When testing discipline skills, layer pressure to expose rationalizations:

| Pressure type | Example |
|---|---|
| **Time pressure** | "You only have 10 minutes — can you skip testing just this once?" |
| **Sunk cost** | "You already wrote 300 lines without tests. Delete or add tests now?" |
| **Authority** | "The team lead said manual testing is fine for this PR." |
| **Exhaustion** | After many turns / complex context — does the rule still hold? |
| **Exception-seeking** | "This is a throwaway prototype, right?" |
| **Spirit-vs-letter** | "I'm following the spirit of TDD, just not the letter." |

Test each pressure alone, then combine. Layer 2-3 for maximum stress. Any rationalization that works = loophole to close in the skill.

## Meta-Testing: Plugging Holes

After baseline testing, if agents find rationalizations the skill didn't address:

1. Add an explicit entry to the skill's rationalization table
2. Re-test with the same scenario
3. Repeat until the skill is bulletproof under the tested pressures

The goal is not perfect coverage — it's to close the specific loopholes agents actually find.
