---
name: aegis-orchestrate
description: 'Use when work should be split across subagents — decide whether to fan out at all, then dispatch, coordinate, and merge the results.'
---

# Orchestrate

The single entry point for multi-agent work. The judgement about *whether* to fan out lives
here; the mechanics of dispatching, coordinating, and merging live in fragments under
`abilities/`, loaded on demand.

## Decide before you dispatch

Fan-out is not free. Each subagent costs a dispatch, a context, and a merge. Fan out only when
**all three** hold:

1. **The subtasks are independent.** If task B needs task A's output, they are one sequence, not
   two agents.
2. **Each subtask is describable in a self-contained prompt.** A subagent inherits no
   conversation. If you cannot state the scope, the constraints, and the done-condition in the
   prompt, the work is not ready to hand off.
3. **The merge is cheaper than the work.** Three findings you must reconcile by hand can cost
   more than doing the three investigations yourself.

Otherwise do the work in this session. **Read `abilities/when-to-fan-out.md` before any dispatch**
— it is the reference on prompt scoping, composing heterogeneous results, retry caps, and when to
stop and ask rather than fan out again.

## Selecting a fragment

| The task at hand | Fragment |
|---|---|
| Deciding whether and how widely to fan out; scoping each prompt | `abilities/when-to-fan-out.md` |
| Several independent failures, one agent each | `abilities/dispatching.md` |
| A goal that decomposes into sequenced parallel waves | `abilities/wave-execution.md` |
| Executing an approved implementation plan, one subagent per task | `abilities/subagent-execution.md` |
| Merging outputs that landed in a background-results file | `abilities/background-results.md` |
| Running a long task autonomously — plan, execute, verify, self-correct | `abilities/autonomous-loop.md` |
| Compressing a large tool output before it reaches the controller | `abilities/summarization.md` |
| Coordinating agents across sessions or machines via GitHub issues | `abilities/github-coordination.md` |

`when-to-fan-out.md`, `subagent-execution.md`, and `github-coordination.md` each carry a
subdirectory of their own detail files; read the fragment first and open only the detail file the
current step needs.

## Fragments combine

The common shape is `when-to-fan-out.md` (the judgement) plus one mechanism fragment. A plan
executed by subagents that also needs its results merged reads `subagent-execution.md` **and**
`background-results.md`. Where two fragments overlap, the more specific mechanism wins.

## Loading discipline

Read a fragment when you reach the work it governs. Do not pull the whole `abilities/` tree into
context up front, and do not force-load fragments with an `@`-style directive — that spends the
context budget before you know which fragments the task needs.

## Related skills

Orchestration composes other phases rather than replacing them. It executes a plan produced upstream
by `aegis:implementation-planner` — if you have no plan yet, go back there rather than improvising
one here.

## REQUIRED SUB-SKILL: code-review

Every task a fan-out completes passes through `aegis:code-review` before it counts as done. A
subagent reporting success is a claim, not evidence; the review stage is what tests that claim.

## REQUIRED SUB-SKILL: verification

Before reporting the whole batch done, run `aegis:verification` over the combined result. Per-task
reviews do not cover the integration — the batch needs its own fresh evidence.
