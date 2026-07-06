---
name: aegis-autonomous-execution
description: 'Use when running autonomous multi-step execution — plan, execute, verify, self-correct in a loop.'
---

# Ultra Worker

**Announce:** I am using the ultra-worker skill for autonomous multi-step execution — planning, executing, verifying, and self-correcting.

Autonomous multi-step execution. Plan the full task, execute each step, verify the result, self-correct on failure. Escalate only when stuck or when an action requires explicit authorization.

## Execution Loop

1. **Plan** — Decompose the task into ordered steps with clear acceptance criteria for each.
2. **Execute** — Implement one step at a time. Run tests after each step to catch regressions early.
3. **Verify** — Check the acceptance criteria. Read actual output, don't assume success.
4. **Self-correct** — On failure, diagnose the root cause. Extend the plan with correction steps. Do not retry the same action blindly.
5. **Checkpoint** — After each successful step, note progress. If context is getting large, summarize completed work.
6. **Repeat** — Move to the next step. Continue until all steps pass or escalation is triggered.

## Work-Shape Fork (delivery vs research)

Before step 1, classify the goal's SHAPE:

- **Delivery** (default) — the deliverable is an artifact (code, config, doc). Run the full loop
  above, including tests, self-review, and an atomic commit.
- **Research** — the deliverable is a *cited answer*, not an artifact. Run Plan -> Execute (gather)
  -> Verify, but skip the QA/cleanup/commit tail (there is nothing to ship). You still keep
  **source-observability**: every finding cites an observed source (`file:line`, command output,
  doc URL) — never "looks correct."

A goal is research-shape only when it produces an answer, not a change. When unsure, treat it as
delivery. A research goal that grows into "...and fix it" has changed shape — re-classify, don't
drift.

### Hypothesis Ledger (research shape)

Maintain an append-only ledger of the questions you are answering. Before each investigation, read
the open hypotheses and extend them — never re-investigate an answered question.

Entry shape:

    HYPOTHESIS[h1]: <claim> | status: open | evidence: <none yet>

Flip `open` -> `confirmed` or `refuted` **only on an observed source** — an actual `file:line`,
command output, or doc URL you read this session. Inference, "it should be", or memory of a prior
session does NOT flip a hypothesis; it stays `open`. Resolved entries are never deleted or rewritten,
so a closed question stays closed.

A hypothesis that would widen the original question is a scope proposal you surface to the user, not
silent creep — stay inside the asked question (see Anti-Patterns -> Scope creep).

For high-risk non-code claims (numeric, market-share, legal, dated, causal), a single citation is not
enough: require >=2 independent sources + one counter-search that found no stronger refutation + a
primary source; otherwise leave the hypothesis `open`/`refuted` and abstain. This specializes
`rules/evidence-before-assertion.md` for research claims — it does not replace that gate.

## Escalation Triggers

Escalate to the user (do NOT keep retrying) when:
- 3 consecutive correction attempts fail on the same step
- The task requires destructive operations (force push, database drop, file deletion outside the working tree)
- External API calls with real consequences (sending emails, deploying, billing actions)
- The task scope has grown beyond the original request (scope creep detected)
- You need information that isn't in the codebase (credentials, business decisions, third-party API keys)

## Quality Standards

- Every code change must have a passing test before moving to the next step.
- No TODO comments left behind. If something can't be completed, escalate — don't leave placeholders.
- Commits are atomic: one logical change per commit, conventional commit message.
- Self-review before marking a step complete: check for unused imports, dead code, style violations.

## Anti-Patterns

- **Blind retry**: Repeating the exact same action after failure. Always change something.
- **Scope creep**: Adding features or improvements not in the original task. Stay focused.
- **Skipping verification**: Assuming a change worked without reading the actual output.
- **Context hoarding**: Reading entire files when you only need a few lines. Be surgical.
- **Premature completion**: Claiming done before running the full test suite.

## Escalating Very Large Jobs (Claude Code only)

This loop is single-agent and runs in-conversation on every host. For jobs too large to coordinate in one context window, Claude Code users can hand the work to a **dynamic workflow** (include `workflow` in the prompt, or `/effort ultracode` to auto-plan one) so intermediate results stay out of the main context. This is Claude-only; portable hosts run the loop in-conversation as described above.
