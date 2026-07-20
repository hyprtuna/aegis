# Phase 1 — Root Cause Investigation (detailed steps)

This is the longest phase. That is correct. Do not rush it. Parent `SKILL.md` covers the iron law, the 4-phase outline, phases 2–4, and the checklist.

## Red Flags — Stop Immediately If You Catch Yourself Saying:

| Red Flag | What It Really Means |
|---|---|
| "Quick fix for now" | You don't understand the problem |
| "Just try changing X" | You are guessing, not debugging |
| "Let me add multiple changes at once" | You will not know which one worked |
| "It works on my machine" | You have not reproduced it properly |
| "That's weird, let me try something else" | You skipped root cause analysis |
| "I think it might be..." (without evidence) | You are speculating, not investigating |
| "Let me just restart/rebuild/clear cache" | You are hoping the problem goes away |

If any of these apply, return to Phase 1. No exceptions.

## Step 1.1: Read the Error Carefully

- Read the ENTIRE error message. Stack traces, line numbers, error codes — all of it.
- Do not skim. Do not skip past "noise." The answer is often in the part you want to skip.
- Copy the exact error message. You will reference it later.
- If there is no error message (silent failure), that is important information. Note it.

## Step 1.2: Reproduce Consistently

- Write down the exact steps to reproduce. Every time? Or intermittent?
- If intermittent: gather more data before proceeding. Check logs, add instrumentation, identify patterns (timing, load, input-dependent?).
- If you cannot reproduce it, you cannot debug it. Gather more data.
- Create a minimal reproduction case if possible — strip away everything unrelated.

## Step 1.3: Check Recent Changes

- `git diff` — what changed since this last worked?
- `git log --oneline -20` — recent commits that might be relevant.
- Dependency changes — did a package update? Check lock files.
- Config changes — environment variables, feature flags, deployment config.
- Infrastructure changes — new service version, different environment, resource limits.
- If nothing changed and it "just broke," something DID change. You have not found it yet.

## Step 1.4: Trace Data Flow

- Where does the bad value originate? Start at the error and trace BACKWARD.
- At each step: what is the actual value vs. the expected value?
- Use debugging breakpoints, console.log, or diagnostic print statements. No guessing.
- For async code: verify the execution order. Race conditions hide here.
- For multi-component systems: add diagnostic logging at EVERY component boundary.
  - Request leaves Service A with value X.
  - Request arrives at Service B with value Y.
  - If X !== Y, the bug is in the boundary between A and B.

## Step 1.5: Form Your Root Cause Statement

Before leaving Phase 1, you must be able to say:

> "The root cause is [specific mechanism], and I know this because [specific evidence]."

Examples of GOOD root cause statements:
- "The root cause is that `userId` is null because the auth middleware skips token validation on PUT requests, and I know this because adding a log in the middleware shows the guard clause returning early."
- "The root cause is a race condition between the cache write and the DB read, and I know this because adding a 100ms delay before the read makes the bug disappear consistently."

Examples of BAD root cause statements:
- "Something is wrong with the auth." (Too vague.)
- "I think it might be a timing issue." (No evidence.)
- "The database query returns wrong results." (That is a symptom, not a cause.)

## The 3+ Fixes Rule

Track your fix attempts:

| Attempt | Hypothesis | Result |
|---|---|---|
| 1 | ... | Failed / Succeeded |
| 2 | ... | Failed / Succeeded |
| 3 | ... | Failed / Succeeded |

**If you have attempted 3 fixes and none worked: STOP.**

This is no longer a simple bug. You are likely facing one of:
- An architectural problem that cannot be fixed locally.
- A misunderstanding of the system's design or invariants.
- A problem in a layer you do not control.

**Do not attempt fix #4.** Instead:
1. Document what you tried and what you learned.
2. Escalate to the human with your findings.
3. Ask: "Is this the right architecture for what we're trying to do?"

Three failed fixes is evidence that the problem is bigger than the code you are looking at.
