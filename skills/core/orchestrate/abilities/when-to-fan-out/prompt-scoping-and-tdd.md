# Prompt Scoping and TDD Loop Discipline

On-demand reference for sub-agent prompt scoping examples and the mandatory TDD loop for code-writing chains. The parent `SKILL.md` covers when to fan out, how to compose outputs, async-turn discipline, and when to stop and ask.

## Prompt scoping — examples

**Example of a good subagent prompt:**
```
Audit `src/payments/stripe.ts` for security vulnerabilities.
Focus on: input validation, secret handling, error message leakage.
Do NOT modify any files.
Return your findings as a markdown list: one finding per bullet,
each with severity (high/medium/low) and the line number.
Context: This module uses Stripe API v3. The `STRIPE_SECRET` env var
must never appear in logs or error messages.
```

**Example of a bad subagent prompt:**
```
Check the payments code for issues.
```
This is too vague. The agent will make assumptions that may not match your intent.

## TDD Loop Discipline

When the task involves writing or modifying code, orchestration must enforce the TDD loop. An agent that produces code without verifying it passes tests has not completed its subtask — it has produced a candidate.

**The mandatory code subagent chain:**

```
1. Plan → What files will be changed, and how?
2. Implement → Write the code.
3. Test → Run the test suite (or write tests first if doing TDD).
4. Verify → Confirm tests pass and no regressions are introduced.
```

Each subagent in a code-writing chain must end its output with:
- The test command it ran.
- The test output (pass/fail counts, failure messages if any).
- A clear statement: PASSING or FAILING.

**Do not accept a code result without test verification.** If a subagent returns code but no test results, re-dispatch it with explicit instructions to run the tests and report the output.

**If tests fail:**
- Re-dispatch the agent with: (a) the failing test output, (b) the code it wrote, (c) a request to diagnose and fix.
- If it fails a second time, escalate to the human rather than dispatching a third time blindly.

**For TDD-first workflows:**
- Dispatch a "write tests" agent first.
- Only dispatch the "implement" agent after the tests exist and are confirmed to fail (red).
- After implementation, verify the tests pass (green).
- Then dispatch a "refactor" agent if needed, verifying tests remain green.

The TDD loop is not optional for code tasks. A synthesis of code-generating subagents that skips test verification is incomplete by definition.

## Fan-out examples

**Correct fan-out pattern:**
```
Goal: Audit three independent modules for security issues.
→ Dispatch three agents in parallel, one per module.
→ Each agent gets: the module path, the audit rubric, the output format.
→ Collect all three results, then synthesize.
```

**Incorrect fan-out pattern (genuinely un-waveable):**
```
Goal: Rename a single internal symbol used in three files.
→ A single agent is faster than three coordinated ones — the work is mechanical,
  tightly coupled, and identical across files.
→ Dispatch one agent with the full file list, or do it inline.
```

**Correct multi-wave pattern for a feature release** (this is the *common* shape, not the exception):
```
Goal: Ship a bug fix with a failing test, a CHANGELOG entry, and a version bump.
→ Wave 1 (parallel): [write failing test] · [investigate root cause] · [draft CHANGELOG]
→ Wave 2 (parallel): [implement fix against the test] · [finalize CHANGELOG from wave 1 findings]
→ Wave 3 (parallel): [run full test suite] · [bump package.json]
→ Sequential tail: commit, push, PR, merge.
Each wave is a single `Task()` batch. Three waves of parallel dispatch is the norm
for feature/release work — not an anti-pattern.
```
