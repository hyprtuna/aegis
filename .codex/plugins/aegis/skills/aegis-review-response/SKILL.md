---
name: aegis-review-response
description: 'Use when handling code review feedback — verifies before implementing, pushes back when wrong.'
---

## Status
review-response starting — addressing each review finding with action or reasoned pushback

# Review Responder

> **Review-cluster role: workflow.** This is a workflow that consumes findings produced by the
> `code-review` skill (the instrument). `review-response` handles the feedback that
> `code-review` emits; it does not perform reviewing itself.

**REQUIRED BACKGROUND:** this skill consumes review findings, so it presupposes a completed review —
normally `aegis:code-review`. If you have no findings in hand, run that first; there is nothing here
to respond to otherwise.

Verify before implementing. Technical correctness over social comfort.

## Forbidden Responses

Never respond to review feedback with:

- "You're absolutely right!" — performative agreement that signals you didn't think about it
- "Great point!" / "Excellent feedback!" / "Thanks for catching that!" — sycophantic filler
- "Let me implement that now" — before you've verified the suggestion is correct
- "I apologize for the oversight" — long apologies waste everyone's time
- "Of course, that makes total sense" — often said before implementing something wrong

These phrases signal that you're optimizing for social comfort instead of code quality. The reviewer doesn't need gratitude; they need correct code.

## Response Process

Follow this sequence for every piece of feedback. Do not skip steps.

### 1. READ

Read the feedback carefully. What specifically is being requested? Is it a question, a suggestion, or a demand? Identify the exact code location being discussed.

### 2. UNDERSTAND

Is the feedback clear? If not, ask for clarification BEFORE doing anything else. Common ambiguities:
- "This should be refactored" — into what? Which pattern?
- "This doesn't handle edge cases" — which edge cases specifically?
- "Consider using X instead" — is this a strong recommendation or a casual thought?

Ask: "Can you clarify what you mean by [X]? I want to make sure I address the right thing."

### 3. VERIFY

Is the suggestion technically correct for THIS codebase? Check:
- Read the surrounding code. Does the suggestion account for how this code actually works?
- Check project conventions (CLAUDE.md, lint config, existing patterns). Does the suggestion align?
- Look for prior art. Has this pattern been used or deliberately avoided elsewhere in the codebase?
- Check dependencies. Will the suggested change break callers, tests, or downstream code?

### 4. EVALUATE

Even if technically correct, should you do it?
- **Scope**: Does this belong in this PR, or is it a separate concern?
- **YAGNI**: Is the reviewer suggesting premature abstraction or optimization?
- **Risk**: Does the change introduce more complexity than it removes?
- **Trade-offs**: What does the reviewer's approach gain? What does it lose?

### 5. RESPOND

State what you'll do and why. Be direct:
- **Agreeing**: "Fixed. Changed X to Y because [reason]." or "Good catch — [describe issue]. Fixed in `path/to/file.ts`."
- **Disagreeing**: "I'd prefer to keep this as-is because [reason]. [Evidence]."
- **Deferring**: "Valid point but out of scope for this PR. I'll track it as [issue/TODO]."
- **Clarifying**: "Before I change this — did you mean X or Y?"

### 6. IMPLEMENT

Only now do you write code. For each fix:
1. Make the change
2. Verify it doesn't break existing tests
3. Add tests if the fix introduces new behavior
4. Show the reviewer what you changed (diff or code snippet)

## When to Push Back

Push back when any of these apply:

- **Suggestion breaks existing functionality**: "This would break [X] because [Y]. The current approach handles [Z] which the suggestion doesn't account for."
- **Reviewer lacks full context**: "The reason this looks unusual is [context]. See `path/to/related/code.ts` for the pattern this follows."
- **Violates YAGNI**: "We don't have a use case for this abstraction yet. Adding it now would increase complexity without a concrete benefit."
- **Technically incorrect for this stack**: "That API was deprecated in v3. The current approach uses the recommended replacement. See [docs link]."
- **Conflicts with project conventions**: "CLAUDE.md specifies [convention]. The suggestion would violate that. If we want to change the convention, that's a separate discussion."

Push back is not confrontational. It's professional. Good reviewers expect it and respect it.

## How to Acknowledge Correct Feedback

When the reviewer IS right:

**DO:**
- "Fixed. [one-line description of what changed]"
- "Good catch — [describe the bug/issue]. Fixed in `path/to/file.ts:42`."
- Just fix it and show the code. No preamble needed.
- "Missed this edge case. Added handling for [case] and a test in `test/path.test.ts`."

**DON'T:**
- Lengthy expressions of gratitude
- Self-deprecating apologies
- Performative surprise ("Oh wow, I can't believe I missed that!")
- Over-explaining why you made the mistake

The fix speaks for itself.

## Implementation Order

When addressing multiple review findings:

1. **Clarify all unclear items first** — batch your questions into one response rather than going back and forth on each one.
2. **Fix blocking/critical issues** — anything that would prevent merging.
3. **Fix simple items** — typos, naming, small logic fixes. Quick wins build momentum.
4. **Fix complex items** — refactors, design changes, new abstractions.
5. **Test each fix individually** — don't batch all fixes and hope for the best. Verify after each change.
6. **One commit per concern** — commit each addressed finding separately, so a reviewer can map each commit to the feedback it resolves; don't fold several unrelated fixes into one commit.

After all fixes are applied, re-run the full test suite and report the results alongside your responses.

## Output Format

For each review finding, respond with:

```
### [Finding title or quote]
**Status**: Fixed / Pushed back / Deferred / Clarification needed
**Action**: [What you did or why you didn't]
**Diff**: [Show the change if applicable]
```

## REQUIRED SUB-SKILL: verification

Addressing findings changes code, so the change needs fresh evidence before anyone calls it done.
Hand off to `aegis:verification` and run its gate over the edits you just made. A disposition for
every finding is not the same as a green build.

## Done
review-response done — all review findings addressed (fixed, pushed back, or deferred with reasoning); status: DONE
