---
name: debugging
description: 'Use when investigating a bug systematically — reproduce, isolate, trace, fix, verify.'
visibility: user
platforms: [claude, opencode, codex, cursor, zed]
x-claude:
  argument-hint: "<issue...>"
  primitiveHint: skill
---

## Status
debugging starting — systematic root-cause investigation before any fix attempt

# Debugger

Systematic 4-phase debugging methodology. Every phase must be completed in order.
Skipping phases leads to guess-fixing, which leads to worse bugs.

**Phase order (gated).** Each phase gates on the prior's hand-off artifact: (1) Root Cause
Investigation → a root-cause statement with evidence; (2) Pattern Analysis → a working-vs-broken
comparison; (3) Hypothesis and Testing → one confirmed hypothesis; (4) Implementation → a failing
test turned green, all tests passing. Phases are internal — this skill hands off to no separate
named skill; see `docs/workflow-guide.md` → *The phase-ordered gated-workflow convention*. The Iron-Law gate below hard-gates Phase 1 → Phase 4.

---

## The Iron Law

<HARD-GATE>
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.

You do not have permission to change code until you can state:
"The root cause is X, and I know this because Y."

If you cannot complete that sentence, you are still in Phase 1.

"I think it might be X" is NOT a root cause statement. Evidence required.
- What exact value is wrong?
- Where did it first become wrong?
- What change introduced the condition that allows it to be wrong?

Until you can answer all three, you are investigating, not fixing.
</HARD-GATE>

### GOOD vs BAD — the reproduce-before-fix gate

**BAD — guess-fixing before reproduction:**

```
Report: "Sometimes the cart total is wrong."
Action: add `total = max(total, 0)` at the render site and ship it.
Result: the symptom is masked once; the real cause (a race writing a stale
        subtotal) still corrupts data and resurfaces elsewhere next week.
```

**GOOD — reproduce, locate, then fix the cause:**

```
1. Reproduce: add 2 items, remove 1 fast → total shows the pre-remove value.
   Consistent in 3/3 runs. Now it is debuggable.
2. Trace: log subtotal at each boundary → cart.subtotal is correct;
   renderTotal() reads a cached value written before the remove resolved.
3. Root cause: "renderTotal reads cache.subtotal, which the remove handler
   updates asynchronously after render — I know because the log shows render
   firing 4ms before the cache write."
4. Fix the cause: await the cache write before render. Symptom gone at source.
```

The BAD fix changes the crash site; the GOOD fix changes the line that produced
the wrong value. Only the second survives the next code path that hits the cache.

---

## Phase 1: Root Cause Investigation

This is the longest phase. Do not rush it. The phase has five steps:

- **1.1 — Read the error carefully.** Read the ENTIRE message. Stack trace, line numbers, error codes. Copy it verbatim. Silent failures count too — note their absence.
- **1.2 — Reproduce consistently.** Write the exact steps. Intermittent? Gather more data before proceeding. You cannot debug what you cannot reproduce.
- **1.3 — Check recent changes.** `git diff`, `git log --oneline -20`, dependency lock files, env vars, feature flags, infra config. If nothing "changed," something did — keep looking.
- **1.4 — Trace data flow.** Backward from the crash. Actual vs. expected value at each step. For multi-component systems log at every boundary.
- **1.5 — Form a root-cause statement.** *"The root cause is [mechanism], and I know this because [evidence]."* If you can't finish that sentence, you're still investigating.

See `abilities/phase-1-investigation.md` for the full per-step instructions, the catch-yourself red-flags table ("quick fix for now", "just try changing X", "works on my machine", etc.), good-vs-bad root-cause statement examples, and the **3+ fixes rule** (after 3 failed fix attempts, stop and escalate — the problem is bigger than the code you're looking at).

---

## Phase 1 support references

Read these when applicable:

- **Root-cause tracing** (`abilities/root-cause-tracing.md`) — backward-trace protocol from crash site to origin; worked route-parameter-mismatch example; "never null-check at the crash site".
- **Defense in depth** (`abilities/defense-in-depth.md`) — three validation layers (input / domain / output); empty-string-through-4-layers example; the case for redundant validation.
- **Condition-based waiting** (`abilities/condition-based-waiting.md`) — replacing arbitrary `sleep()` with polling, the `waitFor()` helper, and a timeout/interval table.

---

## Phase 2: Pattern Analysis

Validate the hypothesis against the codebase.

- **2.1 Find working examples.** Search for similar code that WORKS — how do other callers handle the same API, data, or pattern? If nothing similar exists, check reference implementations or docs.
- **2.2 Compare completely.** Put working and broken code side by side. List EVERY difference (argument order, error handling, init sequence, missing null check, async/await pattern). Don't skim — the bug hides in the difference you dismiss as irrelevant.
- **2.3 Check assumptions.** What does the broken code assume about its inputs, execution order, state, environment? Are those assumptions still valid? Did an upstream change violate one this code relies on?

---

## Phase 3: Hypothesis and Testing

- **3.1 State ONE specific hypothesis.** Write it: *"I think [X] is the root cause because [Y]. If I'm right, then [Z] should fix it."* One hypothesis, not "A or B." Pick one. Test it.
- **3.2 Test minimally.** Change ONE variable at a time — the smallest change. Add a test or diagnostic that validates the hypothesis. Predict the outcome BEFORE running; if the outcome surprises you, your model is wrong.
- **3.3 Evaluate.** Correct → Phase 4. Wrong → REVERT the test change (leave no experimental code), form a NEW hypothesis from what you learned, return to 3.1. Never stack fixes on a failed one.
- **3.4 Honesty check.** If you don't know what's happening, say so. If behavior contradicts your mental model, the model is wrong — update it. "I don't understand why this happens" is valid: it means more data, not more guesses.

---

## Phase 4: Implementation

- **4.1 Write a failing test.** Before the fix, write a test that reproduces the bug — it FAILS on current code, PASSES after the fix. This is your proof the fix addresses the problem, and it stays in the suite permanently to prevent regression.

  **REQUIRED SUB-SKILL:** use `aegis:test-driven-development` to write that test. Phase 4 is a
  red-green cycle with the bug as the red, and that skill owns the discipline — a test written
  after the fix, or one that was never seen to fail, proves nothing about the root cause.
- **4.2 Fix the ROOT CAUSE, not the symptom.** Bad: a null check at the crash site. Good: fix the upstream code that produces the null. Make the smallest change that fixes the cause; don't "improve" nearby code while fixing — separate concerns.
- **4.3 Verify completely.** New test passes; ALL existing tests still pass (no regressions); manually confirm the original reproduction is fixed; check any related symptoms are resolved too.
- **4.4 Document.** Commit message explains the root cause and the fix, not just "fix bug." If the bug revealed a systemic issue, note it.

---

## The 3+ Fixes Rule

After 3 failed fix attempts, STOP. The problem is bigger than the code you're looking at — likely an architectural issue, a misunderstanding of system invariants, or a problem in a layer you don't control. Document, escalate to the human, ask whether the architecture is right. See `abilities/phase-1-investigation.md` for the full tracking table and escalation script.

---

## Debugging Checklist (Quick Reference)

- [ ] I can state the root cause with evidence.
- [ ] I have reproduced the bug consistently.
- [ ] I have checked recent changes (git diff, deps, config).
- [ ] I have traced data flow to the point of failure.
- [ ] I have found working examples of similar code.
- [ ] I have compared working vs. broken completely.
- [ ] My hypothesis is specific and testable.
- [ ] I am changing one variable at a time.
- [ ] I wrote a failing test before writing the fix.
- [ ] All tests pass after the fix.
- [ ] I have not exceeded 3 fix attempts.

## Done
debugging done — root cause identified and fix verified with failing test turned green; status: DONE

## Fragments

| When to load | Fragment |
|---|---|
| The bug is a slow path rather than a wrong one | [`abilities/profiling.md`](./abilities/profiling.md) |
| The full investigation protocol and the 3-fixes escalation rule | [`abilities/phase-1-investigation.md`](./abilities/phase-1-investigation.md) |
| Back-tracing from a crash site to its origin | [`abilities/root-cause-tracing.md`](./abilities/root-cause-tracing.md) |
| Deciding where validation layers belong | [`abilities/defense-in-depth.md`](./abilities/defense-in-depth.md) |
| Replacing an arbitrary `sleep()` with condition polling | [`abilities/condition-based-waiting.md`](./abilities/condition-based-waiting.md) |
