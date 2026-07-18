---
name: test-driven-development
description: 'Use when implementing under red-green-refactor discipline.'
argument-hint: '<feature...>'
---

> **Invoke via `Skill({skill: "aegis:test-driven-development"})`.** This is a skill, not an agent. If you reached for the Agent tool, you're using the wrong primitive.

## Status
test-driven-development starting — red-green-refactor cycle; writing failing test before any production code

# TDD Worker

Strict test-driven development. Every line of production code exists because a test demanded it.

---

## The Iron Law

<HARD-GATE>
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.

If you are writing code that is not making a failing test pass, you are doing
it wrong. Stop. Write the test. Watch it fail. Then write the code.

No exceptions.
- Not for "simple" code.
- Not for "obvious" code.
- Not for "just a quick change."
- Not because "the test would be trivial."

A failing test is mandatory proof that the feature was missing. Without it,
you have no evidence the code you're writing is needed.
</HARD-GATE>

### GOOD vs BAD — the failing-test-first gate

**BAD — production code with no failing test first:**

```python
# Task: add a discount() helper. Author writes the implementation immediately.
def discount(price, pct):
    return price * (1 - pct / 100)
# ...then maybe writes a test that passes on the first run. No RED was observed,
# so there is no proof the test can fail — it may assert nothing meaningful.
```

**GOOD — RED first, watch it fail, then GREEN:**

```python
# 1. RED: write the test before any implementation.
def test_discount_applies_percentage():
    assert discount(100, 20) == 80

# 2. Run it. It FAILS with `NameError: name 'discount' is not defined`.
#    That failure is the proof the feature is genuinely missing.

# 3. GREEN: write the simplest code that passes.
def discount(price, pct):
    return price * (1 - pct / 100)

# 4. Re-run. Test passes. The RED → GREEN transition is the evidence.
```

The difference is not the final code — it is identical. The difference is the
observed `NameError` failure that proves the test exercises real behavior.

---

## The RED-GREEN-REFACTOR Cycle

Every feature, every fix, every change follows this cycle. In order. No skipping.

- **RED** — Write ONE failing test. Clear specification-style name. Tests one thing. Arrange-Act-Assert.
- **VERIFY RED (mandatory)** — Run it. Confirm it FAILS (not errors), the failure is expected, and the cause is "feature missing" not "import broken." A test that passes immediately is wrong — delete and rewrite.
- **GREEN** — Write the SIMPLEST code that passes. YAGNI. No refactor, no improvements, no error handling "while you're at it." Hardcoded returns are fine; the next test forces generalisation.
- **VERIFY GREEN (mandatory)** — New test passes AND all existing tests still pass. Side effects = fix now, before continuing.
- **REFACTOR** — Only after green. Remove duplication, improve names, extract helpers. Run tests after every step. Never add new behavior in refactor — start a new RED.
- **COMMIT** — After every GREEN. Each commit is a safe revert point.

**Test order matters:** degenerate cases (empty/null/zero) → happy path → multiple inputs → boundaries → errors. Each test should force a small amount of new code.

See `abilities/cycle-phases.md` for the full per-phase rules (good-vs-bad test traits, what NOT to do in GREEN, mandatory-verify checks, refactor discipline) and test-ordering guidance.

---

## Red Flags and Rationalizations

See `abilities/red-flags-and-rationalizations.md` for the catch-yourself red-flag table (writing code before the test, mocking everything, "I'll add tests later", etc.) and the excuse-vs-reality rationalization table.

---

## Debugging Integration

When a bug is found:

1. **Do not fix the bug yet.**
2. Write a failing test that reproduces the bug exactly.
3. Verify the test fails (VERIFY RED).
4. Fix the bug — the simplest change that makes the test pass.
5. Verify all tests pass (VERIFY GREEN).
6. Refactor if needed.
7. Commit.

The failing test is your proof that the bug existed and that your fix addresses it.
It stays in the suite permanently. The bug can never silently return.

This is where TDD and debugging meet. A bug without a test is a bug that will come back.

---

## Testing Anti-Patterns

Patterns that look like TDD but undermine it. See `abilities/testing-anti-patterns.md` for the full catalog:

1. **Ice Cream Cone** — inverted pyramid (lots of E2E, no units). Invert back.
2. **Mock Everything** — mocks at every boundary; you're testing the mock config. Mock only true system boundaries.
3. **Test the Implementation, Not the Behavior** — assertions on private state. Test observable behavior instead.
4. **The Liar Test** — always passes regardless of code. Verify RED first.
5. **Flaky Tests (Accepted)** — intermittent failures the team has normalised. Fix or delete; never tolerate.
6. **Overly DRY Tests** — heavy helpers that obscure intent. Prefer duplication over abstraction in tests.
7. **The Slow Suite** — `npm test` takes minutes. Push slow work into integration/E2E tiers.
8. **The Tautological Test** — expected value computed by the same formula under test; proves nothing. Assert against a hand-computed literal or independent oracle instead.

---

## Workflow Summary

```
1. Pick the next behavior to implement.
2. Write ONE failing test.           [RED]
3. Run it. Confirm it fails.         [VERIFY RED]
4. Write minimal code to pass.       [GREEN]
5. Run all tests. Confirm green.     [VERIFY GREEN]
6. Clean up code. Tests stay green.  [REFACTOR]
7. Commit.                           [COMMIT]
8. Go to 1.
```

---

## TDD Checklist (Quick Reference)

- [ ] I wrote the test BEFORE the production code.
- [ ] The test has a clear, descriptive name.
- [ ] The test tests ONE behavior.
- [ ] I watched the test fail and read the failure message.
- [ ] The test fails because the feature is missing, not because of an error.
- [ ] I wrote the simplest code that makes the test pass.
- [ ] I did not add anything the test does not require.
- [ ] All tests pass, not just the new one.
- [ ] I refactored only after reaching green.
- [ ] Tests stayed green through every refactoring step.
- [ ] I committed at green.

## Done
test-driven-development done — red-green-refactor cycle complete; all tests pass at green; status: DONE
