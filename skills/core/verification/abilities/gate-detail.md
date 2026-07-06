# Verification — Gate Detail

On-demand reference for the 5-step gate, the GOOD/BAD examples, the claims/red-flag/rationalization
tables, and the output format. The parent `SKILL.md` carries the Iron Law gate and the decision
forks; this fragment carries the mechanics.

## GOOD vs BAD — the no-claim-without-fresh-evidence gate

**BAD — a claim backed by memory, not output:**

```
"Tests pass and the build is green — should be good to merge."
(No command was run this session. The last `npm test` was three edits ago.)
```

**GOOD — the same claim, backed by fresh command output:**

```
$ npm test
Test Suites: 12 passed, 12 total
Tests:       142 passed, 142 total
Exit code: 0

$ npm run build
Compiled successfully. Exit code: 0

Tests pass — 142/142, exit 0. Build succeeds — exit 0. Both run just now.
```

The BAD version may even be true. It is still forbidden: the reader cannot
distinguish a verified claim from a hopeful one without the output beside it.

## The 5-Step Gate

Every claim passes through all five steps in order. Skipping a step invalidates the claim.

### Step 1 — IDENTIFY

What specific command proves this claim? Be precise.

- "Tests pass" requires the project's test runner (e.g., `npm test`, `pytest`, `cargo test`).
- "Build succeeds" requires the project's build command (e.g., `npm run build`, `make`).
- "Linter clean" requires the project's lint command (e.g., `npm run lint`, `ruff check .`).
- "Bug fixed" requires reproducing the original symptom and showing it no longer occurs.
- "Feature works" requires exercising the feature's primary path end-to-end.

If you cannot identify a verification command, you cannot make the claim.

### Step 2 — RUN

Execute the command now. Not "I ran it earlier." Not "It passed last time." Now.

- Run the **full** command, not a subset (e.g., the entire test suite, not one test file).
- Do not use cached results, incremental builds with stale caches, or partial runs.
- If the command takes too long, note that — but do not skip it.

### Step 3 — READ

Read the complete output. Do not skim. Check:

- **Exit code:** Was it 0?
- **Failure count:** How many tests failed? How many errors? How many warnings?
- **Unexpected output:** Anything that looks wrong even if the exit code was 0?
- **Skipped items:** Were tests skipped? Were files excluded?

A green exit code with skipped tests is not "all tests pass." It is "some tests pass, some were skipped."

### Step 4 — VERIFY

Compare the output against the claim:

- **If the output confirms the claim:** Proceed to Step 5.
- **If the output contradicts the claim:** STOP. State the actual status with evidence. Do not rationalize. Do not say "mostly passes" when tests fail. Do not say "basically works" when there are errors.

Partial success is not success. 47/48 tests passing means 1 test fails.

### Step 5 — CLAIM

Only now make the completion claim. Cite the evidence directly.

- Bad: "Tests pass."
- Good: "Tests pass — `npm test` ran 48 tests, 0 failures, exit code 0."
- Bad: "The bug is fixed."
- Good: "The bug is fixed — `curl localhost:3000/api/users` now returns 200 with the expected JSON payload, previously returned 500."

## Claims Requiring Verification

| Claim | Required Evidence |
|---|---|
| "Tests pass" | Test runner output showing 0 failures, exit code 0 |
| "Build succeeds" | Build command output with exit code 0, no errors |
| "Linter clean" | Linter output with 0 errors (warnings noted separately) |
| "Type-check passes" | `tsc --noEmit` or equivalent with exit code 0 |
| "Bug fixed" | Original symptom reproduced then shown resolved |
| "Feature works" | Feature's primary path demonstrated end-to-end |
| "No regressions" | Full test suite passes after changes |
| "Performance improved" | Before/after measurements with same workload |
| "Security issue resolved" | Specific vulnerability no longer exploitable |

## Red Flags — STOP

If you catch yourself thinking any of these, you are about to skip verification:

- **"Should work now."** — Should is not does.
- **"Probably fine."** — Probably is not certainly.
- **"Seems to work."** — Seems is not verified.
- **"Great, that should do it!"** — Satisfaction before verification is premature.
- **"Done!"** — Done requires proof.
- **"I'm confident this fixes it."** — Confidence is not evidence.
- **"I'll just commit this."** — Committing without verification ships uncertainty.
- **"It worked before my changes."** — Your changes are exactly why you must re-verify.
- **"The linter passed so it's fine."** — Linter coverage does not equal test coverage does not equal build success.
- **"I already checked earlier."** — Earlier evidence expired the moment you made another change.

When you notice a red flag: stop, go back to Step 1, and run the gate.

## Rationalization Table

| You're Thinking | Reality |
|---|---|
| "Should work now" | RUN the verification command and find out |
| "I'm confident" | Confidence is not evidence — run the proof |
| "Just this once" | No exceptions. The one you skip is the one that fails |
| "Linter passed" | Linter is not tests. Tests are not build. Each is independent |
| "It worked before" | Previous evidence expires immediately after any change |
| "Only a small change" | Small changes cause large failures — verify anyway |
| "The logic is obviously correct" | Obvious correctness is the most dangerous assumption |
| "I'll verify after committing" | Verification after commit is damage control, not prevention |

## Output Format

When reporting verification results, use this structure:

```
## Verification
- **Claim:** [exact claim being verified]
- **Command:** `[exact command that was run]`
- **Result:** [concrete output summary — counts, exit code, key lines]
- **Status:** VERIFIED / FAILED
```

Multiple claims require multiple verification blocks. One block per claim.

### Example — Passing

```
## Verification
- **Claim:** All tests pass after adding the new parser module
- **Command:** `npm test`
- **Result:** 142 tests, 0 failures, 0 skipped, exit code 0
- **Status:** VERIFIED
```

### Example — Failing

```
## Verification
- **Claim:** Build succeeds after TypeScript migration
- **Command:** `npm run build`
- **Result:** Exit code 2 — 3 type errors in src/core/config.ts (lines 45, 78, 112)
- **Status:** FAILED
```

When status is FAILED, do not proceed with completion. Fix the issue and re-run the full gate from Step 1.
