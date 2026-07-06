# RED-GREEN-REFACTOR Phase Detail

On-demand per-phase instructions for the TDD cycle. Parent `SKILL.md` covers the iron law, workflow summary, checklist, debugging integration, anti-patterns, and red-flags.

## RED Phase: Write a Failing Test

Write ONE test that describes the behavior you want. Just one.

**What makes a good test:**
- Tests ONE thing. If you need "and" to describe it, split it.
- Has a clear, descriptive name that reads like a specification.
  - Good: `rejects_empty_email_with_validation_error`
  - Bad: `test_email`, `it_works`, `test1`
- Tests real code, not mocks. Mocks are for boundaries (network, disk, time), not for the code under test.
- Follows Arrange-Act-Assert: set up state, perform action, check result.
- Is independent — does not depend on other tests running first.

**What makes a bad test:**
- Vague or generic name.
- Tests the mock instead of the code (your mock returns X, you assert X — congratulations, you tested nothing).
- Tests multiple behaviors in one test.
- Requires complex setup that obscures what is being tested.
- Tests implementation details instead of behavior (testing that a private method was called, instead of testing the observable result).

**Write the simplest test that fails for the right reason.**

Do not write multiple tests at once. One test. One cycle.

## VERIFY RED (Mandatory)

Run the test. Watch it fail. Read the failure message.

**This step is not optional.** You must confirm three things:

1. **The test fails** (not errors). A test that throws an unexpected exception is not "red" — it is broken. Fix the test.
2. **The failure is expected.** The failure message should describe the missing behavior. If the message is confusing, your test is poorly written.
3. **It fails because the feature is missing,** not because of a typo, import error, or setup problem.

**If the test passes immediately:** Your test is wrong. It is not testing what you think it is testing. Delete it. Think carefully about what behavior you are actually trying to verify. Write a new test.

A test that passes without any production code change is a test that tests nothing.

## GREEN Phase: Make It Pass

Write the SIMPLEST code that makes the test pass. Nothing more.

**Rules for the GREEN phase:**

- Satisfy the test. That is your only goal.
- YAGNI (You Ain't Gonna Need It). Do not add features the test does not require.
- Do not refactor. Do not improve. Do not optimize.
- Do not add error handling "while you're at it."
- Do not extract functions or classes "for cleanliness."
- Do not add logging, comments, or documentation.
- Hardcoding a return value is acceptable if it satisfies the test. The next test will force you to generalize.

**It is supposed to feel uncomfortable.** The GREEN phase produces ugly, minimal code. That is correct. Refactoring comes next.

If you find yourself writing more code than the test demands, stop. You are either:
- Writing code for a test that does not exist yet (write the test first), or
- Gold-plating (stop it).

## VERIFY GREEN (Mandatory)

Run the test. Watch it pass. Then run ALL tests.

**This step is not optional.** You must confirm two things:

1. **The new test passes.**
2. **All existing tests still pass.** If other tests broke, your change has side effects. Fix them NOW, before continuing. Do not proceed with broken tests.

If you cannot make the new test pass without breaking existing tests, that is important information. It may mean your design needs to change. Do not hack around it.

## REFACTOR Phase: Clean Up

Only AFTER green. Never refactor on red. Never.

**What to do in REFACTOR:**
- Remove duplication (especially between production code and test code).
- Improve names — variables, functions, classes, test descriptions.
- Extract helpers, utilities, or shared setup.
- Simplify complex conditionals.
- Apply design patterns where they emerge naturally (do not force them).

**Rules for REFACTOR:**
- Run tests after EVERY refactoring step. Stay green.
- If a refactoring breaks a test, undo it immediately. Refactor differently.
- Do not add new behavior during refactoring. If you need new behavior, start a new RED phase.
- Small steps. Rename one thing, run tests. Extract one function, run tests. Do not batch refactorings.

## COMMIT: Lock In Your Progress

**Commit after every GREEN phase.** Not after every refactor, not at the end of the day — after every green.

- Each commit is a safe point you can return to.
- Commit messages should describe the behavior added: "feat: reject empty email with validation error"
- If you realize you need to change direction, you can revert to the last green commit with confidence.

## Next Cycle — test ordering

Pick the next behavior. Write the next failing test. Repeat.

The order of tests matters. Start with the simplest, most degenerate cases:
1. Empty input, null, zero.
2. Single valid input (the "happy path" base case).
3. Multiple valid inputs.
4. Edge cases and boundary conditions.
5. Error cases and invalid input.

Each test should force you to write a small amount of new code. If a test requires a large change, break it into smaller tests.
