---
kind: rule
name: verification-before-completion
description: Use before claiming any task complete — requires running verification commands and showing output. Evidence before assertions.
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
---

# verification-before-completion

> **Scope lane — completion gates.** Fires before you claim a task done/fixed/passing: run the tests/build/lint and paste the output. Siblings (kept separate, do not merge): `evidence-before-assertion` governs every prose *claim* (cite file:line / command output); `rationalization-prevention` governs every *skip/downgrade/defer* decision (name the urge, don't act on it). This rule owns the "is it actually done?" gate only.

## The rule

<HARD-GATE phase="completion">
Before you say a task is done, fixed, or passing, run the command that proves it and paste the output verbatim. No silent claims. No "should work." No "I'm confident it's fine." Evidence, not assertion.

letter = spirit: the intent of this gate is that the verification command runs *now*, against the *current* tree, with output the user can scrutinize. Running an older invocation, citing a prior session's output, or summarizing the result without a verbatim paste satisfies the letter (some command was run) but violates the spirit (the user cannot independently verify the claim). The output must be fresh and pasted whole.

This gate lifts ONLY when:
- The verification command is named explicitly (`npm test`, `tsc --noEmit`, etc.).
- The command was just run against the current working tree.
- The verbatim output (not a summary) appears in the response or a quoted block.
</HARD-GATE>

## When to use

- About to mark any task complete.
- About to claim a fix worked, a test is passing, or a feature is implemented.
- Composing an end-of-turn summary with phrases like "done," "fixed," or "ready."

## Red flags (thoughts that mean STOP)

| Thought | Reality |
|---|---|
| "It should work" | Should-work is a prediction, not evidence. Run it. |
| "I already checked that path earlier" | State changes. Re-check. |
| "The diff is small, the test will pass" | Prove it by running the test. |
| "I'll run the whole suite later" | Later ≠ now. Run the scoped test right now. |
| "It built — it's fine" | Build ≠ behavior. Run it. |
| "I verified it in my head" | Heads don't run code. |

## Exit condition

A concrete, testable success marker: command output, test-runner summary, commit hash, file diff, or screenshot. "It works" is not an exit condition.

## QA evidence

When you report completion, state four things in one compact block: WHAT you tested, WHAT you
observed, WHY that's sufficient, and WHAT was deliberately omitted or deferred. This is the
completion gate's evidence in artifact form — pairs with `evidence-before-assertion`'s per-claim
citation rule, but scoped to the single completion report rather than every sentence.

Example: "Tested: `npm test -- auth.spec.ts`. Observed: 12/12 pass, 0 skipped. Sufficient:
covers the new token-refresh branch end to end. Omitted: did not re-run the full E2E suite
(unrelated to this change)."

## Why

Unverified claims compound into real bugs and lost trust. The cheapest moment to catch a defect is before you stamp "done." Every shipped defect that could have been caught by a pre-claim run makes this rule cheaper retroactively.
