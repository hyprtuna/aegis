# Testing Anti-Patterns

On-demand catalog of eight anti-patterns that look like TDD but undermine it. The parent `SKILL.md` covers the iron law, the RED-GREEN-REFACTOR cycle, and the workflow checklist.

## 1. Ice Cream Cone

**What it looks like:** Hundreds of slow E2E tests, a handful of integration tests, almost no unit tests. The test pyramid inverted.

**Why it's bad:** E2E tests are slow, brittle, and give vague failure messages. A 20-minute suite is a suite people skip. When they fail, you don't know which unit broke.

**How to fix it:** Invert the pyramid back. Most behavior belongs in fast, precise unit tests.

| Layer | Count | Speed | What it verifies |
|---|---|---|---|
| Unit | Many | Milliseconds | Individual function/class behavior |
| Integration | Some | Seconds | Component boundaries, adapters, I/O |
| E2E | Few | Minutes | Critical user journeys only |

## 2. Mock Everything

**What it looks like:** Every dependency is a mock. The function under test calls nothing real. The test asserts that mocks were called with specific arguments.

**Why it's bad:** You are testing your mock configuration, not your code. If the real dependency changes behavior, the test still passes. The test has zero predictive value.

**How to fix it:** Only mock at true system boundaries — network calls, filesystem writes, time, randomness, external services. Use real implementations for everything else. If wiring up the real thing is painful, your design has a coupling problem. Fix the design.

## 3. Test the Implementation, Not the Behavior

**What it looks like:** Tests reach into private methods, assert on internal state, or verify that specific internal function calls happened.

**Why it's bad:** Tests are now coupled to implementation details. Every internal refactor breaks the tests even when behavior is unchanged. You can't improve code under test without rewriting the tests that are supposedly testing it.

**Bad — testing an implementation detail:**
```typescript
// Asserts internal cache was populated — coupled to how, not what
expect(service['_cache'].has(userId)).toBe(true)
```

**Good — testing observable behavior:**
```typescript
// Asserts what the caller can observe — decoupled from internals
const result = await service.getUser(userId)
expect(result.id).toBe(userId)
// Second call should return same data (cache is an implementation detail)
const result2 = await service.getUser(userId)
expect(result2.id).toBe(userId)
```

## 4. The Liar Test

**What it looks like:** A test that always passes regardless of the code it is supposed to test.

**Why it's bad:** False confidence. The test is in the suite, the coverage number goes up, but no behavior is verified.

**Common causes:**
- Asserting on the mock's own return value (`mock.returns(42)` → `expect(result).toBe(42)` — you just verified the mock works)
- Missing assertions — the test runs without `expect()` calls and vitest/jest marks it green
- Swallowing errors with try/catch and forgetting to re-throw or assert on the catch

**How to fix it:** Always run the test in RED first. A test you cannot make fail by deleting the production code is a liar. Delete it or rewrite it.

## 5. Flaky Tests (Accepted)

**What it looks like:** A test fails intermittently — once every few runs, usually on CI. The team marks it as "known flaky" and ignores it.

**Why it's bad:** A flaky test is a test that sometimes lies. Once a flaky test is accepted, the suite loses credibility. Developers stop trusting red builds. Eventually no one investigates failures.

**How to fix it:** Fix or delete. Flakiness is always caused by hidden non-determinism: shared mutable state between tests, time dependencies, network calls, race conditions. Find the cause. Eliminate it. No flaky test is ever "fine."

## 6. Overly DRY Tests

**What it looks like:** A shared `buildUser()` helper with 12 optional parameters, a `setupMocks()` function that abstracts the entire test environment, deeply nested `describe` blocks sharing state through `beforeEach`.

**Why it's bad:** Tests should be readable in isolation. When a test fails, you should understand what it tests and why it failed in 10 seconds. Heavy abstraction turns debugging into archaeology.

**How to fix it:** Prefer duplication over abstraction in tests. Inline the setup. Repeat yourself. A 30-line test that is self-contained is better than a 10-line test that requires reading 5 helper functions to understand.

## 7. The Slow Suite

**What it looks like:** `npm test` takes 5 minutes. Developers run it once before pushing and get coffee.

**Why it's bad:** Slow feedback breaks the RED-GREEN-REFACTOR loop. The cycle should take seconds, not minutes. When the cycle is slow, developers batch changes and lose the discipline of one-test-at-a-time.

**How to fix it:** Unit tests should run in milliseconds. If a unit test is slow, it is hitting disk, network, or spawning processes — that is an integration test, move it. Run unit tests with `--watch` constantly. Run integration tests on commit. Run E2E tests on CI only.

## 8. The Tautological Test

**What it looks like:** The expected value is computed by calling the same production formula/code the test claims to verify, then asserted against a call to that same code.

**Why it's bad:** It passes even when the formula is wrong — both sides compute the identical (possibly broken) result. The test proves nothing about correctness; it only proves the function returns whatever it returns.

**Bad — circular, recomputes the answer with the code under test:**
```typescript
const expected = computeThing(input) // same formula as production
expect(computeThing(input)).toBe(expected) // always true, even if computeThing is wrong
```

**Good — a hand-computed literal or independent oracle:**
```typescript
expect(computeThing(2)).toBe(5) // 2 -> 5 verified by hand, not derived from computeThing
```

**How to fix it:** Assert against a value computed independently of the code under test — a literal worked out by hand, a fixture from an external source, or a different algorithm. If you cannot state the expected value without calling the function itself, the test proves nothing.
